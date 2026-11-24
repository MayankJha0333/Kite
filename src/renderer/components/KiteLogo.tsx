/**
 * Kite's mark: a kite seen head-on, cut into four facets of one colour, with a ribbon tail.
 * Original artwork. The same shape is drawn in white on the app icon (scripts/make-icon.mjs).
 */
export function KiteLogo({ size = 28 }: { size?: number }) {
  const c = 'var(--tint-2, #8f8cff)';
  return (
    <svg width={size} height={size} viewBox="11 10 100 100" aria-hidden="true" className="kite-logo">
      <path d="M62 14 92 50 60 48Z" fill={c} />
      <path d="M62 14 30 46 60 48Z" fill={c} opacity=".8" />
      <path d="M92 50 56 86 60 48Z" fill={c} opacity=".68" />
      <path d="M30 46 56 86 60 48Z" fill={c} opacity=".5" />
      <path d="M56 86C47 94 64 98 54 107" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
