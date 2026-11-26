import type { ID } from '@shared/types';
import { PAGE_GONE, loadErrorText } from '@shared/shields';
import { hostOf } from '@shared/url';
import { bridge } from '../platform';
import { surface } from '../surfaces';
import { useKite } from '../store';
import { setShieldsForSite } from '../browserRuntime';
import { closeItemCmd } from '../commands';

type Failure = { code: number; desc: string; url: string };
type Kind = 'crash' | 'cert' | 'dns' | 'offline' | 'timeout' | 'refused' | 'secure' | 'shields' | 'port' | 'other';

/** Chromium's error codes, grouped by what the person can do about them. */
function kindOf(code: number): Kind {
  if (code === PAGE_GONE) return 'crash';
  if (code <= -200 && code >= -299) return 'cert';
  if (code === -105 || code === -137) return 'dns';
  if (code === -106) return 'offline';
  if (code === -118 || code === -7) return 'timeout';
  if (code === -100 || code === -101 || code === -102) return 'refused';
  if (code === -107 || code === -110 || code === -113) return 'secure';
  if (code === -20) return 'shields';
  if (code === -312) return 'port';
  return 'other';
}

/** The sentence that names the problem, and the line with the likely cause and the way out. */
function words(kind: Kind, site: string, e: Failure, upgraded: boolean): { title: string; detail: string } {
  switch (kind) {
    case 'crash':
      return { title: 'This page stopped working', detail: e.desc === 'oom' ? 'It ran out of memory. Your other tabs are fine; reload to open it again.' : 'Something in the page crashed. Your other tabs are fine; reload to open it again.' };
    case 'cert':
      return { title: `The connection to ${site} isn’t private`, detail: 'The site’s security certificate isn’t valid, so someone could be pretending to be this site. Kite won’t open it, and there is no way to skip this check.' };
    case 'dns':
      return { title: `Can’t find ${site}`, detail: 'The address may be mistyped, or the site may be gone. Check the spelling, or search for it instead.' };
    case 'offline':
      return { title: 'You’re offline', detail: 'Kite can’t reach the internet. Check your Wi-Fi or network cable, then try again.' };
    case 'timeout':
      return { title: `${site} took too long to answer`, detail: 'The site may be busy or down. Try again in a moment.' };
    case 'refused':
      return { title: `Can’t reach ${site}`, detail: 'The site refused to connect. It may be down, or it may be blocking this network.' };
    case 'secure':
      return upgraded
        ? { title: `${site} has no secure connection`, detail: 'Kite asks every site for https first, and this one didn’t answer that way. You can open it without encryption; don’t type passwords or card numbers there.' }
        : { title: `Can’t connect securely to ${site}`, detail: 'The site didn’t set up a secure (https) connection properly. Try again, or come back later.' };
    case 'shields':
      return { title: `Shields blocked ${site}`, detail: 'This address is on one of your block lists. If you trust it, turn Shields off for this site.' };
    case 'port':
      return { title: 'This address is blocked', detail: 'It uses a network port that browsers refuse to open, for safety.' };
    default:
      return { title: 'This page didn’t load', detail: 'Something went wrong on the way to the site. Try again.' };
  }
}

/** Shown over a page that failed to load: what went wrong, in plain words, and what you can do. */
export function LoadError({ id, error }: { id: ID; error: Failure }) {
  const httpsOnly = useKite((st) => st.s.settings.httpsOnly);
  const searchEngine = useKite((st) => st.s.settings.searchEngine);
  const canGoBack = useKite((st) => !!st.ui.nav[id]?.back);
  const kind = kindOf(error.code);
  const site = hostOf(error.url) || 'this site';
  // A site that only speaks http fails under HTTPS-only: offer the way through, clearly labelled.
  const canHttp = httpsOnly && !loadErrorText(error.code, error.desc).cert && /^https:/i.test(error.url) && [-100, -101, -102, -107, -110, -113, -118, -7].includes(error.code);
  const said = words(kind, site, error, canHttp);
  const title = said.title;
  // HTTPS-only may be why it failed: say what the second button is for.
  const detail = canHttp && kind !== 'secure' ? `${said.detail} If the site has no secure (https) version, you can open it without encryption.` : said.detail;
  const code = kind === 'crash' ? error.desc || 'crashed' : [error.desc, error.code].filter(Boolean).join(' · ');
  const page = () => surface(id);
  return (
    <div className="load-error" data-testid="load-error" data-kind={kind} data-cert={kind === 'cert' || undefined} role="alert">
      <div className="contour-field" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{detail}</p>
      <p className="load-error-code">{code}</p>
      <div className="load-error-actions">
        {kind === 'dns' && (
          <button className="btn" data-testid="load-error-search" onClick={() => page()?.load(searchEngine.replace('%s', encodeURIComponent(site)))}>
            Search for {site}
          </button>
        )}
        {kind === 'cert' && canGoBack && (
          <button className="btn primary" data-testid="load-error-back" onClick={() => page()?.back()}>
            Go back
          </button>
        )}
        {kind === 'shields' && (
          <button
            className="btn"
            data-testid="load-error-shields"
            // Turning Shields off reloads the page by itself.
            onClick={() => setShieldsForSite(error.url, false)}
          >
            Turn off Shields for this site
          </button>
        )}
        {canHttp && (
          <button
            className="btn"
            data-testid="load-error-http"
            onClick={() => {
              try {
                const u = new URL(error.url);
                bridge.allowHttp(u.hostname);
                u.protocol = 'http:';
                page()?.load(u.href);
              } catch {
                /* not an address */
              }
            }}
          >
            Open without encryption
          </button>
        )}
        {/* A bad certificate won't fix itself: with nowhere to go back to, closing the tab is the way out. */}
        {kind === 'cert' && !canGoBack && (
          <button className="btn primary" data-testid="load-error-close" onClick={() => closeItemCmd(id)}>
            Close tab
          </button>
        )}
        <button className={kind === 'cert' ? 'btn' : 'btn primary'} data-testid="load-error-retry" onClick={() => page()?.load(error.url)}>
          {kind === 'crash' ? 'Reload page' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
