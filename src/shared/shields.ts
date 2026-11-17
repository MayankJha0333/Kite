// Shields: Kite's ad and tracker blocker, plus the HTTPS-only rule.
// Pure logic lives here (and is tested); the main process does the blocking.

// ---- Filter lists ------------------------------------------------------------------
// The catalog follows AdGuard's grouping (see RESEARCH.md §9). Lists are fetched
// in uBlock Origin syntax, which Kite's engine understands fully, and refreshed
// on a timer. Nothing about you is ever sent: lists are plain downloads.

export type FilterGroupId = 'ads' | 'privacy' | 'social' | 'annoyances' | 'security' | 'language';

export interface FilterGroup {
  id: FilterGroupId;
  name: string;
  desc: string;
}

export const FILTER_GROUPS: readonly FilterGroup[] = [
  { id: 'ads', name: 'Ad blocking', desc: 'Ads, pop-unders and the scripts that fight ad blockers' },
  { id: 'privacy', name: 'Privacy', desc: 'Trackers, analytics and tracking links' },
  { id: 'social', name: 'Social widgets', desc: 'Like and Share buttons that report your visits' },
  { id: 'annoyances', name: 'Annoyances', desc: 'Cookie notices, pop-ups, app banners and chat widgets' },
  { id: 'security', name: 'Security', desc: 'Known malware, scam and phishing sites' },
  { id: 'language', name: 'Language-specific', desc: 'Ads on sites in other languages' },
];

export interface FilterListDef {
  id: string;
  group: FilterGroupId;
  name: string;
  desc: string;
  url: string;
  /** On for a new copy of Kite. */
  on: boolean;
  /** Turned on automatically for these languages (two-letter codes). */
  langs?: string[];
  /** Not shown as its own switch; driven by another setting. */
  hidden?: boolean;
}

const AG = 'https://filters.adtidy.org/extension/ublock/filters';
const UBO = 'https://ublockorigin.github.io/uAssets/filters';

export const FILTER_LISTS: readonly FilterListDef[] = [
  { id: 'adguard-base', group: 'ads', name: 'AdGuard Base', desc: 'EasyList plus AdGuard’s own English filter. The core list.', url: `${AG}/2.txt`, on: true },
  { id: 'ubo', group: 'ads', name: 'uBlock filters', desc: 'Fixes for sites that fight ad blockers, including video sites', url: `${UBO}/filters.txt`, on: true },
  { id: 'ubo-unbreak', group: 'ads', name: 'uBlock unbreak', desc: 'Undoes rules that break sites', url: `${UBO}/unbreak.txt`, on: true },
  { id: 'ubo-quick', group: 'ads', name: 'uBlock quick fixes', desc: 'Same-day fixes for new tricks', url: `${UBO}/quick-fixes.txt`, on: true },
  { id: 'easylist', group: 'ads', name: 'EasyList', desc: 'The classic list. Already inside AdGuard Base.', url: 'https://easylist.to/easylist/easylist.txt', on: false },
  { id: 'adguard-mobile', group: 'ads', name: 'AdGuard Mobile Ads', desc: 'Ad networks used on phone-sized sites', url: `${AG}/11.txt`, on: false },
  { id: 'easyprivacy', group: 'privacy', name: 'EasyPrivacy', desc: 'Trackers and analytics that follow you between sites', url: 'https://easylist.to/easylist/easyprivacy.txt', on: true },
  { id: 'adguard-tracking', group: 'privacy', name: 'AdGuard Tracking Protection', desc: 'The most thorough tracker list. Large.', url: `${AG}/3.txt`, on: false },
  { id: 'ubo-privacy', group: 'privacy', name: 'uBlock privacy', desc: 'Extra tracker rules from uBlock Origin', url: `${UBO}/privacy.txt`, on: false },
  { id: 'adguard-url-tracking', group: 'privacy', name: 'AdGuard URL Tracking', desc: 'Removes tracking parts from links (utm_, fbclid, gclid…)', url: `${AG}/17.txt`, on: false, hidden: true },
  { id: 'adguard-social', group: 'social', name: 'AdGuard Social Media', desc: 'Like and Share buttons, embedded feeds', url: `${AG}/4.txt`, on: false },
  { id: 'adguard-cookies', group: 'annoyances', name: 'Cookie notices', desc: 'Hides cookie-consent banners', url: `${AG}/18.txt`, on: false },
  { id: 'adguard-popups', group: 'annoyances', name: 'Pop-ups', desc: 'Newsletter and sign-up pop-ups', url: `${AG}/19.txt`, on: false },
  { id: 'adguard-app-banners', group: 'annoyances', name: 'Mobile app banners', desc: '“Get our app” banners', url: `${AG}/20.txt`, on: false },
  { id: 'adguard-widgets', group: 'annoyances', name: 'Widgets', desc: 'Chat bubbles and support widgets', url: `${AG}/22.txt`, on: false },
  { id: 'adguard-other-annoyances', group: 'annoyances', name: 'Other annoyances', desc: 'Everything else that gets in the way', url: `${AG}/21.txt`, on: false },
  { id: 'ubo-badware', group: 'security', name: 'Badware risks', desc: 'Sites known to push malware or scams', url: `${UBO}/badware.txt`, on: true },
  { id: 'phishing', group: 'security', name: 'Phishing URL blocklist', desc: 'Pages that steal passwords', url: 'https://malware-filter.gitlab.io/malware-filter/phishing-filter.txt', on: false },
  { id: 'urlhaus', group: 'security', name: 'Online malicious URLs', desc: 'Addresses that spread malware right now. Large.', url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-ag-online.txt', on: false },
  { id: 'adguard-search-ads', group: 'ads', name: 'Allow search ads', desc: 'Lets search results show their ads', url: `${AG}/10.txt`, on: false, hidden: true },
  { id: 'adguard-de', group: 'language', name: 'German', desc: 'AdGuard German + EasyList Germany', url: `${AG}/6.txt`, on: false, langs: ['de'] },
  { id: 'adguard-fr', group: 'language', name: 'French', desc: 'AdGuard French + Liste FR', url: `${AG}/16.txt`, on: false, langs: ['fr'] },
  { id: 'adguard-es', group: 'language', name: 'Spanish & Portuguese', desc: 'AdGuard Spanish/Portuguese', url: `${AG}/9.txt`, on: false, langs: ['es', 'pt'] },
  { id: 'adguard-nl', group: 'language', name: 'Dutch', desc: 'AdGuard Dutch + EasyList Dutch', url: `${AG}/8.txt`, on: false, langs: ['nl'] },
  { id: 'adguard-ru', group: 'language', name: 'Russian', desc: 'AdGuard Russian', url: `${AG}/1.txt`, on: false, langs: ['ru'] },
  { id: 'adguard-uk', group: 'language', name: 'Ukrainian', desc: 'AdGuard Ukrainian', url: `${AG}/23.txt`, on: false, langs: ['uk'] },
  { id: 'adguard-tr', group: 'language', name: 'Turkish', desc: 'AdGuard Turkish', url: `${AG}/13.txt`, on: false, langs: ['tr'] },
  { id: 'adguard-ja', group: 'language', name: 'Japanese', desc: 'AdGuard Japanese', url: `${AG}/7.txt`, on: false, langs: ['ja'] },
  { id: 'adguard-zh', group: 'language', name: 'Chinese', desc: 'AdGuard Chinese + EasyList China', url: `${AG}/224.txt`, on: false, langs: ['zh'] },
];

/** uBlock Origin's resource library (scriptlets and stand-in files), in the engine's format. */
export const RESOURCES_URL = 'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/resources.json';

export const listById = (id: string) => FILTER_LISTS.find((l) => l.id === id);

export interface CustomList {
  id: string;
  url: string;
  name: string;
  on: boolean;
}

export interface Shields {
  /** Master switch. */
  enabled: boolean;
  /** Built-in lists that are switched on (ids from FILTER_LISTS). */
  lists: string[];
  /** Also use the list for each language you read (from macOS's language settings). */
  autoLanguage: boolean;
  /** Block ads in search results and sites promoting their own things. */
  searchAds: boolean;
  /** Hide what blocked ads leave behind, and run the lists' page fixes. */
  cosmetic: boolean;
  /** Lists you added by address. */
  custom: CustomList[];
  /** Your own rules, one per line (same syntax as the lists). */
  userRules: string;
  userRulesOn: boolean;
  /** Sites where nothing is blocked (hosts, without "www."). */
  allow: string[];
  /** Inverted: block only on the sites in `only`. */
  invert: boolean;
  only: string[];
  // Tracking protection
  /** Remove tracking parameters (utm_, fbclid, gclid…) from page addresses. */
  stripParams: boolean;
  /** Don't tell a site which search you came from. */
  hideSearchQueries: boolean;
  /** Third-party requests only learn their own address as the referrer. */
  hideReferrer: boolean;
  /** WebRTC may not reveal your local or real IP address. */
  blockWebRTC: boolean;
  /** Third-party cookies live at most this many minutes; 0 = no limit. */
  cookieMinutes: number;
  /** Hours between list updates; 0 = only when you ask. */
  updateHours: number;
}

export const UPDATE_HOURS = [0, 1, 6, 12, 24, 48] as const;
export const COOKIE_MINUTES = [0, 60, 360, 1440, 2880, 10080] as const;
export const MAX_CUSTOM_LISTS = 20;
export const MAX_USER_RULES_CHARS = 200_000;

export function defaultShields(): Shields {
  return {
    enabled: true,
    lists: FILTER_LISTS.filter((l) => l.on).map((l) => l.id),
    autoLanguage: true,
    searchAds: true,
    cosmetic: true,
    custom: [],
    userRules: '',
    userRulesOn: true,
    allow: [],
    invert: false,
    only: [],
    stripParams: true,
    hideSearchQueries: true,
    hideReferrer: false,
    blockWebRTC: false,
    cookieMinutes: 0,
    updateHours: 24,
  };
}

/** "https://www.Example.com/x" or "Example.com" → "example.com". Empty string if it isn't a site. */
export function siteKey(input: string): string {
  let h = String(input ?? '').trim().toLowerCase();
  if (!h) return '';
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(h)) h = new URL(h).hostname;
    else h = h.split('/')[0].split(':')[0];
  } catch {
    return '';
  }
  h = h.replace(/^www\./, '').replace(/\.$/, '');
  return /^[a-z0-9.-]+$/.test(h) && h.length <= 253 ? h : '';
}

/** A filter list address: http(s) only, no credentials. */
export function listUrl(input: string): string {
  try {
    const u = new URL(String(input ?? '').trim());
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return '';
    return u.href;
  } catch {
    return '';
  }
}

const sites = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => (typeof x === 'string' ? siteKey(x) : '')).filter(Boolean))].sort().slice(0, 1000) : []);
const pickNum = (v: unknown, allowed: readonly number[], d: number): number => (typeof v === 'number' && allowed.includes(v) ? v : d);

export function sanitizeShields(v: unknown): Shields {
  const d = defaultShields();
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const bool = (k: keyof Shields) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : (d[k] as boolean));
  let lists: string[];
  if (Array.isArray(o.lists)) {
    lists = [...new Set(o.lists.filter((x): x is string => typeof x === 'string' && !!listById(x) && !listById(x)!.hidden))];
  } else {
    // Saved by an older Kite (ads / trackers / cookie banners switches): keep what they chose.
    lists = d.lists.filter((id) => {
      const g = listById(id)!.group;
      if (g === 'ads' && o.ads === false) return false;
      if (g === 'privacy' && o.trackers === false) return false;
      return true;
    });
    if (o.cookieBanners === true) lists.push('adguard-cookies');
  }
  const custom: CustomList[] = [];
  if (Array.isArray(o.custom)) {
    for (const c of o.custom as Record<string, unknown>[]) {
      const url = listUrl(c?.url as string);
      if (!url || custom.some((x) => x.url === url) || custom.length >= MAX_CUSTOM_LISTS) continue;
      const id = typeof c.id === 'string' && /^c-[a-z0-9-]{1,40}$/.test(c.id) ? c.id : `c-${custom.length}-${Math.abs(hashString(url)).toString(36)}`;
      custom.push({ id, url, name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 80) : new URL(url).hostname, on: c.on !== false });
    }
  }
  return {
    enabled: bool('enabled'),
    lists,
    autoLanguage: bool('autoLanguage'),
    searchAds: bool('searchAds'),
    cosmetic: bool('cosmetic'),
    custom,
    userRules: typeof o.userRules === 'string' ? o.userRules.slice(0, MAX_USER_RULES_CHARS) : '',
    userRulesOn: bool('userRulesOn'),
    allow: sites(o.allow),
    invert: bool('invert'),
    only: sites(o.only),
    stripParams: bool('stripParams'),
    hideSearchQueries: bool('hideSearchQueries'),
    hideReferrer: bool('hideReferrer'),
    blockWebRTC: bool('blockWebRTC'),
    cookieMinutes: pickNum(o.cookieMinutes, COOKIE_MINUTES, d.cookieMinutes),
    updateHours: pickNum(o.updateHours, UPDATE_HOURS, d.updateHours),
  };
}

/** A small, stable number for a string (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

const onList = (list: string[], urlOrHost: string) => {
  const h = siteKey(urlOrHost);
  return !!h && list.some((a) => h === a || h.endsWith(`.${a}`));
};

/** Is blocking off for this site (on the allowlist, or not on the list when inverted)? */
export function isAllowedSite(sh: Pick<Shields, 'allow' | 'invert' | 'only'>, urlOrHost: string): boolean {
  return sh.invert ? !onList(sh.only, urlOrHost) : onList(sh.allow, urlOrHost);
}

/** Does Shields block things on this page? */
export function shieldsActive(sh: Shields, pageUrl: string): boolean {
  return sh.enabled && !isAllowedSite(sh, pageUrl);
}

/** Turn blocking off (allow = true) or back on for one site. Works with an inverted list too. */
export function setSiteAllowed(sh: Shields, urlOrHost: string, allow: boolean): Shields {
  const h = siteKey(urlOrHost);
  if (!h) return sh;
  if (sh.invert) {
    const rest = sh.only.filter((a) => a !== h && !h.endsWith(`.${a}`));
    return { ...sh, only: allow ? rest : [...rest, h].sort() };
  }
  const rest = sh.allow.filter((a) => a !== h);
  return { ...sh, allow: allow ? [...rest, h].sort() : rest };
}

/** Two-letter language codes from locale names ("en-GB" → "en"). */
export function languageCodes(locales: readonly string[]): string[] {
  return [...new Set(locales.map((l) => String(l).toLowerCase().split(/[-_]/)[0]).filter((l) => /^[a-z]{2}$/.test(l)))];
}

export interface ListSource {
  id: string;
  url: string;
  name: string;
}

/** Every list these choices need, in a stable order: built-in, language, driven, then yours. */
export function listSources(sh: Shields, languages: readonly string[] = []): ListSource[] {
  const ids = new Set(sh.lists);
  if (sh.autoLanguage) for (const l of FILTER_LISTS) if (l.langs?.some((x) => languages.includes(x))) ids.add(l.id);
  if (!sh.searchAds) ids.add('adguard-search-ads');
  if (sh.stripParams) ids.add('adguard-url-tracking');
  const out: ListSource[] = FILTER_LISTS.filter((l) => ids.has(l.id)).map((l) => ({ id: l.id, url: l.url, name: l.name }));
  for (const c of sh.custom) if (c.on) out.push({ id: c.id, url: c.url, name: c.name });
  return out;
}

/** Lines that are rules (not blank, not comments). */
export function ruleLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('!') && !(l.startsWith('[') && l.endsWith(']')) && !/^#(?![#@?$%])/.test(l));
}

/** Rules for $removeparam (handled by their own engine: see network.ts). */
export const isParamRule = (line: string) => /\$(?:[^$]*,)?~?removeparam\b/.test(line);

// ---- Tracking protection helpers ----------------------------------------------------

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z]+|baidu\.com|ecosia\.org|search\.brave\.com|kagi\.com|startpage\.com|qwant\.com)$/;

/** The referrer to send instead of a search-results address (its origin), or null to leave it. */
export function searchReferrer(referrer: string): string | null {
  try {
    const u = new URL(referrer);
    if (!SEARCH_HOSTS.test(u.hostname) || (!u.search && !u.hash)) return null;
    return `${u.origin}/`;
  } catch {
    return null;
  }
}

/**
 * A Set-Cookie header that lives at most `maxSeconds`. Session cookies (no
 * Expires / Max-Age) are left alone: they already end when Kite quits.
 */
export function capCookie(header: string, maxSeconds: number): string {
  if (maxSeconds <= 0) return header;
  const parts = header.split(';');
  const attrs = parts.slice(1).map((p) => p.trim());
  const maxAge = attrs.find((a) => /^max-age=/i.test(a));
  const expires = attrs.find((a) => /^expires=/i.test(a));
  if (!maxAge && !expires) return header;
  let current = Infinity;
  if (maxAge) current = Number(maxAge.split('=')[1]);
  else if (expires) {
    const t = Date.parse(expires.slice(expires.indexOf('=') + 1));
    if (Number.isFinite(t)) current = Math.round((t - Date.now()) / 1000);
  }
  if (Number.isFinite(current) && current <= maxSeconds) return header;
  const kept = attrs.filter((a) => !/^(max-age|expires)=/i.test(a));
  return [parts[0].trim(), ...kept, `Max-Age=${maxSeconds}`].join('; ');
}

/**
 * A small list that ships inside Kite, used until the full lists have been
 * downloaded (and when you are offline). Same syntax as EasyList.
 */
export const BUILTIN_FILTERS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'google-analytics.com', 'googletagmanager.com',
  'googletagservices.com', 'amazon-adsystem.com', 'adnxs.com', 'adsrvr.org', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
  'pubmatic.com', 'rubiconproject.com', 'openx.net', 'casalemedia.com', 'scorecardresearch.com', 'quantserve.com', 'moatads.com',
  'adform.net', 'smartadserver.com', 'bidswitch.net', 'zedo.com', 'advertising.com', 'serving-sys.com', 'media.net', 'popads.net',
  'propellerads.com', 'hotjar.com', 'mixpanel.com', 'segment.io', 'fullstory.com', 'mouseflow.com', 'chartbeat.com', 'newrelic.com',
  'nr-data.net', 'bat.bing.com', 'connect.facebook.net', 'analytics.twitter.com', 'ads-twitter.com', 'analytics.tiktok.com',
  'ads.linkedin.com', 'ads.yahoo.com', 'yandex.ru/metrika', 'mc.yandex.ru', 'adroll.com', 'teads.tv', 'sharethrough.com', '3lift.com',
  'indexww.com', 'lijit.com', 'revcontent.com', 'mgid.com', 'exoclick.com', 'adcolony.com', 'branch.io', 'amplitude.com', 'clarity.ms',
]
  .map((d) => `||${d}^$third-party`)
  .concat(['##.adsbygoogle', '##ins.adsbygoogle', '##[id^="google_ads_iframe"]', '##[id^="div-gpt-ad"]', '##.ad-banner', '##.ad-container', '##a[href*="doubleclick.net"]'])
  .join('\n');

/** The most common tracking parameters, stripped even before the full list has loaded. */
export const BUILTIN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'mc_eid', 'yclid', 'twclid', 'igshid', '_hsenc', '_hsmi', 'mkt_tok', 'oly_anon_id', 'oly_enc_id', 'vero_id', 'ttclid', 'li_fat_id']
  .map((p) => `$removeparam=${p}`)
  .join('\n');

// ---- HTTPS-only ------------------------------------------------------------------

/** Hosts that are this computer or the local network: never upgraded. */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.test') || h.endsWith('.internal') || !h.includes('.') ) return true;
  if (h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/**
 * The https:// address to use instead of this page address, or null to leave it alone.
 * `allowHttp` holds hosts you chose to open over http anyway.
 */
export function httpsUpgrade(url: string, httpsOnly: boolean, allowHttp: ReadonlySet<string>): string | null {
  if (!httpsOnly || !/^http:\/\//i.test(url)) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (isLocalHost(u.hostname) || allowHttp.has(u.hostname.toLowerCase())) return null;
  if (u.port && u.port !== '80') return null; // an odd port rarely speaks https
  u.protocol = 'https:';
  u.port = '';
  return u.href;
}

// ---- What the address bar says about a page ---------------------------------------

export type SecurityLevel = 'secure' | 'insecure' | 'local' | 'internal' | 'broken';

export function securityLevel(url: string, certError = false): SecurityLevel {
  if (certError) return 'broken';
  if (/^https:/i.test(url)) return 'secure';
  if (/^http:/i.test(url)) {
    try {
      return isLocalHost(new URL(url).hostname) ? 'local' : 'insecure';
    } catch {
      return 'insecure';
    }
  }
  if (/^file:/i.test(url)) return 'local';
  return 'internal';
}

export const SECURITY_TEXT: Record<SecurityLevel, { title: string; detail: string }> = {
  secure: { title: 'Connection is secure', detail: 'What you send to this site is encrypted and can’t be read on the way.' },
  insecure: { title: 'Not secure', detail: 'This site doesn’t use encryption. Don’t type passwords or card numbers here.' },
  local: { title: 'On this computer or network', detail: 'This page comes from your own computer or local network.' },
  internal: { title: 'Kite page', detail: 'This is a page that belongs to Kite.' },
  broken: { title: 'Connection isn’t private', detail: 'This site’s security certificate isn’t valid, so Kite stopped loading it.' },
};

/** Readable reason for a page that failed to load (Chromium error codes). */
export function loadErrorText(code: number, desc: string): { title: string; detail: string; cert: boolean } {
  const cert = code <= -200 && code >= -299;
  if (cert) return { title: 'This connection isn’t private', detail: 'The site’s security certificate isn’t valid. Someone could be pretending to be this site, so Kite won’t open it.', cert };
  if (code === -105 || code === -137) return { title: 'Site not found', detail: 'Kite couldn’t find this address. Check it for typos.', cert };
  if (code === -106) return { title: 'You’re offline', detail: 'Connect to the internet and try again.', cert };
  if (code === -312) return { title: 'This address is blocked', detail: 'It uses a network port that browsers refuse to open, for safety.', cert };
  if (code === -102 || code === -101 || code === -100) return { title: 'The site refused to connect', detail: 'It may be down, or blocking this connection.', cert };
  if (code === -118 || code === -7) return { title: 'The site took too long to answer', detail: 'Try again in a moment.', cert };
  if (code === -107 || code === -113 || code === -110) return { title: 'Secure connection failed', detail: 'This site doesn’t support a secure (https) connection properly.', cert };
  return { title: 'This page didn’t load', detail: desc ? `${desc} (${code})` : `Error ${code}`, cert };
}
