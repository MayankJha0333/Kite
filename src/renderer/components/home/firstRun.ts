// What the first minute needs outside any one component: starting the first run on a new
// profile, bringing it back after a side trip to the Arc import, and counting command-bar
// uses until the start page stops hinting at it. Started once from boot.ts.

import { BAR_HINT_USES } from '@shared/home';
import { firstRunDue, type WelcomeStep } from '@shared/welcome';
import { act, setUi, useKite } from '../../store';

/** The first run was opened by Kite itself at launch (not from the command bar): it may make its entrance. */
let atLaunch = false;
/** Where to pick the first run up again once the Arc import closes. */
let resume: null | { step: WelcomeStep; items: number } = null;
/** The step the first run opens on next (the first, unless it is coming back from the import). */
let opensOn: WelcomeStep = 'hello';

/** True once, for the first run that Kite opened at launch. */
export function takeEntrance(): boolean {
  const v = atLaunch;
  atLaunch = false;
  return v;
}

/** The step to open on; asking resets it to the first. */
export function takeOpeningStep(): WelcomeStep {
  const v = opensOn;
  opensOn = 'hello';
  return v;
}

/** Leave the first run for the Arc import; it comes back when the import closes. */
export function leaveForImport(step: WelcomeStep): void {
  resume = { step, items: Object.keys(useKite.getState().s.items).length };
  setUi({ panel: 'import' });
}

export function watchHome(): void {
  const start = useKite.getState();
  if (firstRunDue(start.s.home, location.search, navigator.webdriver === true)) {
    // Seen from the moment it is on screen: quitting halfway still counts, so it never comes back by itself.
    start.act((d) => void (d.home.firstRunSeen = true));
    atLaunch = true;
    setUi({ panel: 'welcome' });
  }
  useKite.subscribe((st, prev) => {
    // The command bar opened: one more use, until the start page's hint has done its job.
    if (st.ui.commandBar && !prev.ui.commandBar && st.s.home.barUses < BAR_HINT_USES) queueMicrotask(() => act((d) => void (d.home.barUses = Math.min(BAR_HINT_USES, d.home.barUses + 1))));
    if (!resume || st.ui.panel === prev.ui.panel) return;
    if (prev.ui.panel === 'import' && st.ui.panel === null) {
      // With their Arc sidebar brought in, the next thing to see is the sidebar itself; otherwise back where they were.
      const imported = Object.keys(st.s.items).length > resume.items;
      opensOn = imported && resume.step === 'hello' ? 'sidebar' : resume.step;
      resume = null;
      queueMicrotask(() => setUi({ panel: 'welcome' }));
    } else if (st.ui.panel !== 'import') {
      resume = null; // they went somewhere else from the import
    }
  });
}
