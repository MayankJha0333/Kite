// Icons for sites no page has reported yet (a shortcut typed by hand, a search engine, a
// site from an import). One lookup per site, a few at a time; the answer is stamped on the
// state so every place that shows the site picks it up, and a miss is not asked again.

import { rememberSiteIcon } from '@shared/ops';
import { hostOf } from '@shared/url';
import { bridge } from './platform';
import { useKite } from './store';

const asked = new Set<string>();
const queue: string[] = [];
let running = 0;
const AT_ONCE = 4;

export function lookupSiteIcon(url: string): void {
  const host = hostOf(url);
  if (!host || asked.has(host) || !/^https?:/i.test(url)) return;
  asked.add(host);
  queue.push(url);
  pump();
}

function pump() {
  while (running < AT_ONCE && queue.length) {
    const url = queue.shift()!;
    running++;
    bridge
      .siteIcon(url)
      .then((icon) => {
        if (icon) useKite.getState().act((d) => rememberSiteIcon(d, url, icon));
      })
      .catch(() => {})
      .finally(() => {
        running--;
        pump();
      });
  }
}

/** For tests: forget what was asked, so a fresh page asks again. */
export function resetSiteIconLookups(): void {
  asked.clear();
  queue.length = 0;
}
