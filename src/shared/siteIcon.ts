// Reading a site's declared icon out of its home page (pure; the fetch lives in the main process).

/** The best <link rel="icon"> in a page's head: an SVG or the largest sized one first, Apple touch icons last. */
export function iconFromHtml(html: string, baseUrl: string): string | null {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  let best: { href: string; score: number } | null = null;
  for (const tag of links) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
    const rel = (attr('rel')?.[1] ?? attr('rel')?.[2] ?? attr('rel')?.[3] ?? '').toLowerCase().split(/\s+/);
    const hrefM = attr('href');
    const href = hrefM?.[1] ?? hrefM?.[2] ?? hrefM?.[3];
    if (!href) continue;
    let score = 0;
    if (rel.includes('icon')) score = 100;
    else if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) score = 50;
    else continue;
    const type = (attr('type')?.[1] ?? attr('type')?.[2] ?? attr('type')?.[3] ?? '').toLowerCase();
    const sizes = (attr('sizes')?.[1] ?? attr('sizes')?.[2] ?? attr('sizes')?.[3] ?? '').toLowerCase();
    if (type.includes('svg') || /\.svg(\?|$)/i.test(href)) score += 40;
    const px = Number(sizes.match(/(\d+)x/)?.[1] ?? 0);
    if (px) score += Math.min(30, px / 8); // prefer bigger, up to ~240px
    if (!best || score > best.score) best = { href, score };
  }
  if (!best) return null;
  try {
    const u = new URL(best.href.replace(/&amp;/g, '&'), baseUrl);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
