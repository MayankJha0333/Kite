// Checking for a newer Kite.
//
// Kite keeps everything on this computer, so this is the one question it asks the outside
// world about itself: "is there a newer version?" The answer comes from the public list of
// releases on GitHub. Nothing about the person or their browsing is sent, and the check can
// be switched off (Settings → Updates). This file is the pure part: reading the answer.

/** Where releases are published. */
export const RELEASES_REPO = 'MayankJha0333/M-Arc';
export const RELEASES_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;

/** How often to ask when the setting is on. */
export const UPDATE_CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

export interface UpdateInfo {
  /** The newer version, without a leading "v". */
  version: string;
  /** The release's page, always on github.com. */
  pageUrl: string;
  /** The installer for this computer, when the release has one. */
  downloadUrl?: string;
  /** The first lines of the release notes, plain text. */
  notes?: string;
}

/** "v1.2.3" or "1.2.3-beta.1" as numbers; null when it is not a version. */
export function parseVersion(text: string): { parts: [number, number, number]; pre: string } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!m) return null;
  return { parts: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? '' };
}

/** Negative when a is older than b, positive when newer, 0 when the same. Unreadable versions count as oldest. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
  for (let i = 0; i < 3; i++) if (x.parts[i] !== y.parts[i]) return x.parts[i] - y.parts[i];
  // A pre-release ("1.2.0-beta") comes before the release it leads to ("1.2.0").
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

const onGitHub = (url: unknown): url is string => {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'github.com' || u.hostname.endsWith('.github.com') || u.hostname.endsWith('.githubusercontent.com'));
  } catch {
    return false;
  }
};

/** Which file of a release installs Kite on this computer. */
function installerFor(name: string, platform: string, arch: string): boolean {
  const n = name.toLowerCase();
  // Builds are named for one chip; "x64" is also what Intel Macs report.
  if (!n.includes(arch.toLowerCase())) return false;
  if (platform === 'darwin') return n.includes('mac') && n.endsWith('.dmg');
  if (platform === 'win32') return n.endsWith('.exe');
  if (platform === 'linux') return n.endsWith('.appimage');
  return false;
}

/**
 * Reads GitHub's "latest release" answer. Returns the update when it is newer than the
 * running version, and null when Kite is up to date or the answer is not one to trust
 * (a draft, a pre-release, a link that leaves GitHub, anything malformed).
 */
export function pickUpdate(release: unknown, current: string, platform: string, arch: string): UpdateInfo | null {
  if (!release || typeof release !== 'object') return null;
  const r = release as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true) return null;
  const tag = typeof r.tag_name === 'string' ? r.tag_name : '';
  const found = parseVersion(tag);
  if (!found || found.pre) return null;
  if (compareVersions(tag, current) <= 0) return null;
  const pageUrl = onGitHub(r.html_url) ? r.html_url : RELEASES_PAGE;
  const assets = Array.isArray(r.assets) ? (r.assets as Record<string, unknown>[]) : [];
  const asset = assets.find((a) => a && typeof a.name === 'string' && installerFor(a.name, platform, arch) && onGitHub(a.browser_download_url));
  const body = typeof r.body === 'string' ? r.body : '';
  const notes = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^[#>*\-\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n')
    .slice(0, 400);
  return {
    version: found.parts.join('.'),
    pageUrl,
    downloadUrl: asset ? (asset.browser_download_url as string) : undefined,
    notes: notes || undefined,
  };
}

/** Only links to a release on GitHub may be opened by the "Download" button. */
export const isUpdateUrl = (url: string): boolean => onGitHub(url);
