// Asks GitHub whether a newer Kite has been released (see shared/updates.ts for what is
// sent: nothing but the request itself). Today's builds are not signed, so Kite cannot
// replace itself the way a signed app can; it tells the person and hands them the installer.

import { app, session } from 'electron';
import { RELEASES_API, pickUpdate, type UpdateInfo } from '../shared/updates';
import type { Result } from '../shared/ipc';

/** A jar of its own, kept in memory: the request never carries a site's cookies. */
const updateSession = () => session.fromPartition('kite-updates', { cache: false });

/** The newer release, null when Kite is up to date, or why the question could not be asked. */
export async function checkForUpdate(): Promise<Result<UpdateInfo | null>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 10_000);
  try {
    const res = await updateSession().fetch(RELEASES_API, {
      signal: stop.signal,
      credentials: 'omit',
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Kite-update-check' },
    });
    // No release has been published yet: that is "up to date", not a problem.
    if (res.status === 404) return { value: null };
    if (!res.ok) return { error: res.status === 403 || res.status === 429 ? 'GitHub is limiting requests right now. Try again in a while.' : `GitHub answered with an error (${res.status}).` };
    const text = await res.text();
    if (text.length > 2_000_000) return { error: 'The answer from GitHub was not a release.' };
    return { value: pickUpdate(JSON.parse(text), app.getVersion(), process.platform, process.arch) };
  } catch {
    return { error: 'Couldn’t reach GitHub. Check your connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}
