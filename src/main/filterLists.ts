// Shields' filter lists on disk: downloads, freshness, and the built engines.
//
//   <dir>/lists/<id>.txt   each list as downloaded
//   <dir>/lists.json       when each list was fetched, its title, rule count, last error
//   <dir>/resources.json   uBlock Origin's scriptlet library (for page fixes)
//   <dir>/engine.bin       the built engine; params.bin the $removeparam engine
//   <dir>/engine.json      which lists + rules built it (so it's reused only when it matches)
//
// Engines are built in a worker thread (see shieldsWorker.ts).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { ENGINE_VERSION } from '@ghostery/adblocker';
import { BUILTIN_FILTERS, BUILTIN_PARAMS, hashString, RESOURCES_URL, type ListSource } from '../shared/shields';
import type { ListStatus } from '../shared/ipc';
import type { BuildJob, BuildResult } from './shieldsWorker';

const MAX_BYTES = 40 * 1024 * 1024;

export interface ListDeps {
  dir: string;
  fetch(url: string): Promise<Response>;
  /** Where the worker script is (dist/main/shieldsWorker.cjs). */
  workerFile: string;
  log(msg: string): void;
  /** Tests: fetch lists from a local server instead. */
  rewriteUrl?: (url: string, id: string) => string;
}

interface Meta {
  url: string;
  updatedAt: number;
  rules: number;
  title?: string;
  error?: string;
  checkedAt?: number;
}

export interface Built {
  key: string;
  engine: Uint8Array;
  params: Uint8Array;
  counts: Record<string, number>;
  invalid: string[];
  userCount: number;
  /** At least one downloaded list is in it (not just the built-in one). */
  full: boolean;
  scriptlets: boolean;
}

const safeId = (id: string) => id.replace(/[^a-z0-9-]/gi, '_');

/** Why a download is not a filter list, or null if it looks like one. */
export function notAList(text: string, contentType: string): string | null {
  const head = text.slice(0, 600).trimStart().toLowerCase();
  if (/text\/html/i.test(contentType) || head.startsWith('<!doctype html') || head.startsWith('<html')) return 'That address returned a web page, not a filter list. Use a direct link to the list file.';
  if (!text.trim()) return 'The list is empty.';
  return null;
}

/** "! Title: …" from a list's header. */
export function listTitle(text: string): string | undefined {
  const m = /^!\s*Title:\s*(.+)$/im.exec(text.slice(0, 4000));
  return m?.[1].trim().slice(0, 80);
}

export function createFilterLists(deps: ListDeps) {
  const listDir = join(deps.dir, 'lists');
  mkdirSync(listDir, { recursive: true });
  const metaFile = join(deps.dir, 'lists.json');
  let meta: Record<string, Meta> = {};
  try {
    meta = JSON.parse(readFileSync(metaFile, 'utf8')) as Record<string, Meta>;
  } catch {
    meta = {};
  }
  const saveMeta = () => writeAtomic(metaFile, JSON.stringify(meta));
  const fileOf = (id: string) => join(listDir, `${safeId(id)}.txt`);
  const resourcesFile = join(deps.dir, 'resources.json');

  function writeAtomic(file: string, data: string | Uint8Array) {
    writeFileSync(`${file}.tmp`, data);
    renameSync(`${file}.tmp`, file);
  }

  async function download(id: string, url: string): Promise<{ text: string; type: string }> {
    const res = await deps.fetch(deps.rewriteUrl?.(url, id) ?? url);
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error('The list is too large (over 40 MB).');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('The list is too large (over 40 MB).');
    return { text, type: res.headers.get('content-type') ?? '' };
  }

  async function fetchList(src: ListSource): Promise<void> {
    try {
      const { text, type } = await download(src.id, src.url);
      const bad = notAList(text, type);
      if (bad) throw new Error(bad);
      writeAtomic(fileOf(src.id), text);
      const rules = text.split('\n').filter((l) => l.trim() && !l.startsWith('!') && !l.startsWith('[')).length;
      meta[src.id] = { url: src.url, updatedAt: Date.now(), rules, title: listTitle(text), checkedAt: Date.now() };
    } catch (err) {
      const prev = meta[src.id];
      // Keep an older copy if there is one; just remember that updating failed.
      meta[src.id] = { url: src.url, updatedAt: prev?.url === src.url ? prev.updatedAt : 0, rules: prev?.url === src.url ? prev.rules : 0, title: prev?.title, error: (err as Error).message, checkedAt: Date.now() };
      deps.log(`shields: ${src.id}: ${(err as Error).message}`);
    }
  }

  const has = (src: ListSource) => meta[src.id]?.url === src.url && meta[src.id].updatedAt > 0 && existsSync(fileOf(src.id));

  /** Download what is missing, or older than maxAgeMs (all of it when forced). */
  async function ensure(sources: ListSource[], maxAgeMs: number, force: boolean): Promise<void> {
    const now = Date.now();
    // A failed list isn't retried for 30 minutes unless you ask.
    const due = sources.filter((s) => {
      if (force) return true;
      const m = meta[s.id];
      if (m?.error && m.checkedAt && now - m.checkedAt < 30 * 60_000) return false;
      return !has(s) || now - m.updatedAt > maxAgeMs;
    });
    const queue = [...due];
    const work = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) await fetchList(s);
    };
    const jobs: Promise<void>[] = [work(), work(), work(), work()];
    const resAge = meta.__resources ? now - meta.__resources.updatedAt : Infinity;
    if (force || (resAge > maxAgeMs && !(meta.__resources?.error && now - (meta.__resources.checkedAt ?? 0) < 30 * 60_000))) {
      jobs.push(
        (async () => {
          try {
            const { text } = await download('resources', RESOURCES_URL);
            JSON.parse(text); // must be the library, not an error page
            writeAtomic(resourcesFile, text);
            meta.__resources = { url: RESOURCES_URL, updatedAt: Date.now(), rules: 0, checkedAt: Date.now() };
          } catch (err) {
            meta.__resources = { ...(meta.__resources ?? { url: RESOURCES_URL, updatedAt: 0, rules: 0 }), error: (err as Error).message, checkedAt: Date.now() };
          }
        })(),
      );
    }
    await Promise.all(jobs);
    if (due.length || jobs.length > 4) saveMeta();
  }

  /** A name for exactly this set of lists, versions and rules. */
  function keyFor(sources: ListSource[], userRules: string): string {
    const parts = [String(ENGINE_VERSION), ...sources.filter(has).map((s) => `${s.id}@${meta[s.id].updatedAt}`), `res@${existsSync(resourcesFile) ? (meta.__resources?.updatedAt ?? 0) : 0}`, `u${hashString(userRules)}:${userRules.length}`];
    return `${hashString(parts.join('|')).toString(36)}-${parts.length}`;
  }

  /** The engine saved last time, if it was built from exactly this. */
  function loadSaved(key: string): Built | null {
    try {
      const info = JSON.parse(readFileSync(join(deps.dir, 'engine.json'), 'utf8')) as Omit<Built, 'engine' | 'params'>;
      if (info.key !== key) return null;
      return { ...info, engine: new Uint8Array(readFileSync(join(deps.dir, 'engine.bin'))), params: new Uint8Array(readFileSync(join(deps.dir, 'params.bin'))) };
    } catch {
      return null;
    }
  }

  let jobId = 0;
  /** Build an engine from the lists on disk (plus Kite's own small list and your rules). */
  async function build(sources: ListSource[], userRules: string): Promise<Built> {
    const key = keyFor(sources, userRules);
    const lists = [{ id: 'builtin', text: `${BUILTIN_FILTERS}\n${BUILTIN_PARAMS}` }];
    for (const s of sources) if (has(s)) lists.push({ id: s.id, text: readFileSync(fileOf(s.id), 'utf8') });
    let resources: string | null = null;
    try {
      resources = existsSync(resourcesFile) ? readFileSync(resourcesFile, 'utf8') : null;
    } catch {
      resources = null;
    }
    const job: BuildJob = { id: ++jobId, lists, userRules, resources };
    const r = await new Promise<BuildResult>((resolve, reject) => {
      const w = new Worker(deps.workerFile);
      w.once('message', (m: BuildResult) => {
        resolve(m);
        void w.terminate(); // parsing needs a lot of memory; give it back at once
      });
      w.once('error', reject);
      w.once('exit', (code) => code !== 0 && reject(new Error(`filter worker stopped (${code})`)));
      w.postMessage(job);
    });
    if (r.error) throw new Error(r.error);
    const built: Built = { key, engine: r.engine, params: r.params, counts: r.counts, invalid: r.invalid, userCount: r.userCount, full: lists.length > 1, scriptlets: !!resources };
    try {
      writeAtomic(join(deps.dir, 'engine.bin'), built.engine);
      writeAtomic(join(deps.dir, 'params.bin'), built.params);
      const { engine: _e, params: _p, ...info } = built;
      writeAtomic(join(deps.dir, 'engine.json'), JSON.stringify(info));
    } catch (err) {
      deps.log(`shields: couldn't save the engine: ${(err as Error).message}`);
    }
    return built;
  }

  function status(sources: ListSource[], counts: Record<string, number>): Record<string, ListStatus> {
    const out: Record<string, ListStatus> = {};
    for (const s of sources) {
      const m = meta[s.id];
      out[s.id] = { updatedAt: m?.url === s.url ? m.updatedAt : 0, rules: counts[s.id] ?? (m?.url === s.url ? m.rules : 0), title: m?.title, error: m?.error };
    }
    return out;
  }

  return { ensure, keyFor, loadSaved, build, status, has };
}

export type FilterLists = ReturnType<typeof createFilterLists>;
