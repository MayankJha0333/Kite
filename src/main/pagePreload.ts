// Runs in every frame of every web page, at document start, in an isolated
// world the page can't see. It gives the page nothing (no API, no globals).
//
// Shields' page fixes need to be in place before the page's own scripts run:
//  - scriptlets from the filter lists (e.g. stop a site's anti-adblock check),
//    run in the page's world via webFrame
//  - CSS that hides ad slots, inserted as a user stylesheet
// Then, as the page adds elements, generic hiding rules for their classes and
// ids are fetched and inserted (batched, at most a few times a second).

import { ipcRenderer, webFrame } from 'electron';

interface FrameFixes {
  css: string;
  scripts: string[];
  watch: boolean;
}

function start() {
  const url = location.href;
  if (!/^https?:/i.test(url)) return;
  let fixes: FrameFixes | null = null;
  try {
    // Synchronous on purpose: the fixes must land before the page's first script.
    fixes = ipcRenderer.sendSync('shields:frame', url) as FrameFixes | null;
  } catch {
    return;
  }
  if (!fixes) return;
  for (const s of fixes.scripts) void webFrame.executeJavaScript(s).catch(() => undefined);
  if (fixes.css) webFrame.insertCSS(fixes.css, { cssOrigin: 'user' });
  if (fixes.watch) watch(url);
}

function watch(url: string) {
  const classes = new Set<string>();
  const ids = new Set<string>();
  const hrefs = new Set<string>();
  const fresh = { classes: [] as string[], ids: [] as string[], hrefs: [] as string[] };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let asked = 0;

  const note = (el: Element) => {
    if (el.id && !ids.has(el.id) && ids.size < 3000) {
      ids.add(el.id);
      fresh.ids.push(el.id);
    }
    for (const c of el.classList) {
      if (classes.has(c) || classes.size >= 6000) continue;
      classes.add(c);
      fresh.classes.push(c);
    }
    if (el.tagName === 'A') {
      const h = (el as HTMLAnchorElement).href;
      if (h && !hrefs.has(h) && hrefs.size < 2000) {
        hrefs.add(h);
        fresh.hrefs.push(h);
      }
    }
  };
  const scan = (root: Element) => {
    note(root);
    for (const el of root.querySelectorAll('[id],[class],a[href]')) note(el);
  };
  const flush = () => {
    timer = null;
    if (!fresh.classes.length && !fresh.ids.length && !fresh.hrefs.length) return;
    // A page that never stops changing doesn't get to ask forever.
    if (++asked > 200) return;
    const batch = { classes: fresh.classes.splice(0), ids: fresh.ids.splice(0), hrefs: fresh.hrefs.splice(0) };
    void ipcRenderer
      .invoke('shields:dom', url, batch.classes, batch.ids, batch.hrefs)
      .then((css: string) => {
        if (css) webFrame.insertCSS(css, { cssOrigin: 'user' });
      })
      .catch(() => undefined);
  };
  const soon = (ms: number) => {
    if (!timer) timer = setTimeout(flush, ms);
  };

  const begin = () => {
    if (document.documentElement) scan(document.documentElement);
    flush();
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && r.target instanceof Element) note(r.target);
        for (const n of r.addedNodes) if (n instanceof Element) scan(n);
      }
      soon(250);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
}

start();
