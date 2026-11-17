// Builds Shields' filter engines off the main thread (parsing big lists takes
// 0.5–2 s; the main process must stay responsive while it happens).
//
// Two engines come back, serialized:
//  - `engine`: blocking, redirects, CSP and page fixes (cosmetics + scriptlets).
//  - `params`: only $removeparam rules. The engine's optimizer merges generic
//    $removeparam rules and then drops most of them (measured on AdGuard's URL
//    Tracking list, RESEARCH.md §9), so these get an engine with optimizations off.

import { parentPort } from 'node:worker_threads';
import { FiltersEngine, parseFilter } from '@ghostery/adblocker';
import { isParamRule } from '../shared/shields';

export interface BuildJob {
  id: number;
  /** Each list's text, in order. */
  lists: { id: string; text: string }[];
  userRules: string;
  resources: string | null;
}

export interface BuildResult {
  id: number;
  engine: Uint8Array;
  params: Uint8Array;
  counts: Record<string, number>;
  invalid: string[];
  userCount: number;
  error?: string;
}

/** Rules that are not comments; CRLF lists (AdGuard's) would otherwise leave "\r" inside rule options. */
const linesOf = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');
const isRule = (l: string) => !!l && !l.startsWith('!') && !(l.startsWith('[') && l.endsWith(']'));

export function build(job: BuildJob): BuildResult {
  const main: string[] = [];
  const params: string[] = [];
  const counts: Record<string, number> = {};
  const add = (line: string) => (isParamRule(line) ? params : main).push(line);
  for (const l of job.lists) {
    let n = 0;
    for (const raw of linesOf(l.text)) {
      const line = raw.trim();
      // Preprocessor lines (!#if …) are kept: the engine understands them.
      if (line.startsWith('!#')) {
        main.push(line);
        continue;
      }
      if (!isRule(line)) continue;
      n++;
      add(line);
    }
    counts[l.id] = n;
  }
  // Your own rules are checked line by line, so the ones the engine can't read can be shown to you.
  const invalid: string[] = [];
  let userCount = 0;
  for (const raw of linesOf(job.userRules)) {
    const line = raw.trim();
    if (!isRule(line)) continue;
    if (parseFilter(line) === null) {
      if (invalid.length < 50) invalid.push(line);
      continue;
    }
    userCount++;
    add(line);
  }
  const engine = FiltersEngine.parse(main.join('\n'), { loadCSPFilters: true, loadPreprocessors: true, enableHtmlFiltering: false });
  if (job.resources) engine.updateResources(job.resources, String(job.resources.length));
  const paramEngine = FiltersEngine.parse(params.join('\n'), { enableOptimizations: false, loadCosmeticFilters: false });
  return { id: job.id, engine: engine.serialize(), params: paramEngine.serialize(), counts, invalid, userCount };
}

parentPort?.on('message', (job: BuildJob) => {
  try {
    const r = build(job);
    parentPort!.postMessage(r, [r.engine.buffer as ArrayBuffer, r.params.buffer as ArrayBuffer]);
  } catch (err) {
    parentPort!.postMessage({ id: job.id, engine: new Uint8Array(), params: new Uint8Array(), counts: {}, invalid: [], userCount: 0, error: (err as Error).message } satisfies BuildResult);
  }
});
