import { Code2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { knownFavicon } from '@shared/icons';
import { siteLetter, hostOf, isNewTabUrl, sourceTarget } from '@shared/url';
import { lookupSiteIcon } from '../siteIcons';
import { useKite } from '../store';

/**
 * A page's favicon, or a colored letter tile when there isn't one.
 * Without one of its own, it takes the icon any tab or history entry reported for the same
 * site; failing that it asks the site itself for its icon once, so a shortcut typed by hand
 * or a search result shows the real site as soon as it can.
 */
export function SiteIcon({ url, favicon, title, size = 16 }: { url: string; favicon?: string; title?: string; size?: number }) {
  const [broken, setBroken] = useState<string[]>([]);
  const known = useKite((st) => (favicon ? undefined : knownFavicon(st.s, url)));
  const src = [favicon, known].find((c) => c && !broken.includes(c));
  const wantsLookup = !src && !isNewTabUrl(url) && !sourceTarget(url);
  useEffect(() => {
    if (wantsLookup) lookupSiteIcon(url);
  }, [wantsLookup, url]);
  // Kite's own new-tab page.
  if (isNewTabUrl(url)) {
    return (
      <span className="site-icon newtab" style={{ width: size, height: size }} aria-hidden="true">
        <Search size={Math.round(size * 0.66)} />
      </span>
    );
  }
  if (sourceTarget(url)) {
    return (
      <span className="site-icon newtab" style={{ width: size, height: size }} aria-hidden="true">
        <Code2 size={Math.round(size * 0.7)} />
      </span>
    );
  }
  if (src) {
    return <img className="site-icon" src={src} width={size} height={size} alt="" draggable={false} onError={() => setBroken((b) => [...b, src])} />;
  }
  const host = hostOf(url);
  let hue = 0;
  for (const c of host || title || '?') hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="site-icon letter" style={{ width: size, height: size, fontSize: size * 0.62, background: `hsl(${hue} 52% 56%)` }} aria-hidden="true">
      {siteLetter(url, title)}
    </span>
  );
}
