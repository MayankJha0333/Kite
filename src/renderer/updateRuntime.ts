// Tells the person when a newer Kite exists. The question goes to GitHub's public list of
// releases (see shared/updates.ts); it is asked a little after launch and then once a day,
// only while "Check for updates" is on in Settings. "Check now" asks whatever the setting is.

import { UPDATE_CHECK_EVERY_MS, type UpdateInfo } from '@shared/updates';
import { bridge } from './platform';
import { getS, toast } from './store';

/** Wait for the window to settle before asking: nothing about launch should depend on the network. */
const FIRST_CHECK_AFTER_MS = 30_000;

/** The update last told about, so the same version is announced once per launch. */
let announced: string | null = null;

export const openUpdate = (u: UpdateInfo) => bridge.openUpdate(u.downloadUrl ?? u.pageUrl);

function announce(u: UpdateInfo) {
  if (announced === u.version) return;
  announced = u.version;
  toast(`Kite ${u.version} is available`, 'Download', () => openUpdate(u), 12_000);
}

async function checkQuietly() {
  if (!getS()?.settings.checkForUpdates) return;
  const found = await bridge.checkForUpdate().catch(() => null);
  // A failed check says nothing: there is another one tomorrow.
  if (found?.value) announce(found.value);
}

export function watchUpdates() {
  setTimeout(() => void checkQuietly(), FIRST_CHECK_AFTER_MS);
  setInterval(() => void checkQuietly(), UPDATE_CHECK_EVERY_MS);
}

/** Settings → "Check now": what was found, as a sentence to show beside the button. */
export async function checkForUpdateNow(): Promise<{ text: string; update: UpdateInfo | null }> {
  const found = await bridge.checkForUpdate().catch(() => ({ error: 'Couldn’t check for updates.' }) as const);
  if (found.error !== undefined) return { text: found.error, update: null };
  if (!found.value) return { text: 'Kite is up to date.', update: null };
  return { text: `Kite ${found.value.version} is available.`, update: found.value };
}
