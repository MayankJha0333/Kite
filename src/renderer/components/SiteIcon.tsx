import { Code2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { knownFavicon } from '@shared/icons';
import { siteLetter, isNewTabUrl, sourceTarget } from '@shared/url';
import { iconTone, lookupSiteIcon, measureIconTone, type IconTone } from '../siteIcons';
import { useKite } from '../store';

/**
 * A page's favicon, or its first letter on a neutral tile when there isn't one.
 * Without one of its own, it takes the icon any tab or history entry reported for the same
 * site; failing that it asks the site itself for its icon once, so a shortcut typed by hand
 * or a search result shows the real site as soon as it can.
 * An icon that would vanish against the window (GitHub's dark mark on a dark sidebar) is
 * marked with its tone, and the stylesheet sits it on a small plate.
 */
export function SiteIcon({ url, favicon, title, size = 16 }: { url: string; favicon?: string; title?: string; size?: number }) {
  const [broken, setBroken] = useState<string[]>([]);
  const known = useKite((st) => (favicon ? undefined : knownFavicon(st.s, url)));
  const src = [favicon, known].find((c) => c && !broken.includes(c));
  const wantsLookup = !src && !isNewTabUrl(url) && !sourceTarget(url);
  const tone = useIconTone(src);
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
    return <img className="site-icon" data-tone={tone ?? undefined} src={src} width={size} height={size} alt="" draggable={false} onError={() => setBroken((b) => [...b, src])} />;
  }
  return (
    <span className="site-icon letter" style={{ width: size, height: size }} aria-hidden="true">
      {siteLetter(url, title)}
    </span>
  );
}

/** The icon's tone once it has been measured (see siteIcons.ts); null until then, and for icons that need no plate. */
function useIconTone(src: string | undefined): IconTone {
  const [, measured] = useState(0);
  useEffect(() => {
    if (src && iconTone(src) === undefined) return measureIconTone(src, () => measured((n) => n + 1));
  }, [src]);
  return (src && iconTone(src)) || null;
}
