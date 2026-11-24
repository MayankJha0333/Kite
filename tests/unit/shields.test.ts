import { describe, expect, it } from 'vitest';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import {
  BUILTIN_FILTERS, BUILTIN_PARAMS, FILTER_LISTS, capCookie, defaultShields, httpsUpgrade, isAllowedSite, isLocalHost, isParamRule, languageCodes, listSources, listUrl, loadErrorText, ruleLines, sanitizeShields,
  searchReferrer, securityLevel, setSiteAllowed, shieldsActive, siteKey,
} from '../../src/shared/shields';
import { build } from '../../src/main/shieldsWorker';
import { listTitle, notAList } from '../../src/main/filterLists';
import { loadState } from '../../src/shared/persistence';
import { createInitialState } from '../../src/shared/defaults';
import { updateSettings } from '../../src/shared/settings';

describe('shields: sites and exceptions', () => {
  it('reads a site from an address or a host', () => {
    expect(siteKey('https://www.Example.com/a?b')).toBe('example.com');
    expect(siteKey('news.example.com:8080/x')).toBe('news.example.com');
    expect(siteKey('not a site')).toBe('');
    expect(siteKey('')).toBe('');
  });

  it('an exception covers the site and its subdomains, not look-alikes', () => {
    const sh = setSiteAllowed(defaultShields(), 'https://www.example.com/page', true);
    expect(sh.allow).toEqual(['example.com']);
    expect(isAllowedSite(sh, 'https://example.com/')).toBe(true);
    expect(isAllowedSite(sh, 'https://shop.example.com/')).toBe(true);
    expect(isAllowedSite(sh, 'https://notexample.com/')).toBe(false);
    expect(isAllowedSite(sh, 'https://example.com.evil.io/')).toBe(false);
    expect(shieldsActive(sh, 'https://example.com/')).toBe(false);
    expect(shieldsActive(sh, 'https://other.org/')).toBe(true);
    expect(setSiteAllowed(sh, 'example.com', false).allow).toEqual([]);
  });

  it('is inactive when switched off', () => {
    expect(shieldsActive({ ...defaultShields(), enabled: false }, 'https://a.com')).toBe(false);
    expect(shieldsActive(defaultShields(), 'https://a.com')).toBe(true);
  });

  it('inverted: blocks only on listed sites; the per-site switch edits that list', () => {
    let sh = { ...defaultShields(), invert: true, only: ['news.com'] };
    expect(shieldsActive(sh, 'https://www.news.com/a')).toBe(true);
    expect(shieldsActive(sh, 'https://m.news.com/')).toBe(true);
    expect(shieldsActive(sh, 'https://other.org/')).toBe(false);
    sh = setSiteAllowed(sh, 'https://other.org/', false); // turn blocking ON for other.org
    expect(sh.only).toEqual(['news.com', 'other.org']);
    sh = setSiteAllowed(sh, 'https://m.news.com/', true); // OFF for a subdomain removes the parent entry
    expect(sh.only).toEqual(['other.org']);
    expect(sh.allow).toEqual([]);
  });

  it('cleans up saved values', () => {
    const sh = sanitizeShields({ enabled: 'yes', lists: ['easylist', 'nope', 'adguard-url-tracking', 'easylist'], allow: ['HTTPS://WWW.A.com/x', 'a.com', 42, '<script>'], cookieMinutes: 7, updateHours: 6, userRules: 5, custom: [{ url: 'javascript:alert(1)' }, { url: 'https://x.org/l.txt', name: '  ' }, { url: 'https://x.org/l.txt' }] });
    expect(sh.enabled).toBe(true);
    expect(sh.lists).toEqual(['easylist']); // unknown and hidden lists are dropped, duplicates merged
    expect(sh.allow).toEqual(['a.com']);
    expect(sh.cookieMinutes).toBe(0);
    expect(sh.updateHours).toBe(6);
    expect(sh.userRules).toBe('');
    expect(sh.custom).toHaveLength(1);
    expect(sh.custom[0]).toMatchObject({ url: 'https://x.org/l.txt', name: 'x.org', on: true });
    expect(sh.custom[0].id).toMatch(/^c-/);
    expect(sanitizeShields(null)).toEqual(defaultShields());
  });

  it('settings saved by an older Kite keep their choices', () => {
    const noAds = sanitizeShields({ enabled: true, ads: false, trackers: true, cookieBanners: true, cosmetic: true, allow: [] });
    expect(noAds.lists).not.toContain('adguard-base');
    expect(noAds.lists).toContain('easyprivacy');
    expect(noAds.lists).toContain('adguard-cookies');
    const noTrackers = sanitizeShields({ enabled: true, ads: true, trackers: false });
    expect(noTrackers.lists).toContain('adguard-base');
    expect(noTrackers.lists).not.toContain('easyprivacy');
  });

  it('picks lists: yours, your languages, and those other settings need', () => {
    const d = defaultShields();
    const ids = (sh = d, langs: string[] = []) => listSources(sh, langs).map((x) => x.id);
    expect(ids()).toEqual(expect.arrayContaining(['adguard-base', 'ubo', 'easyprivacy', 'ubo-badware', 'adguard-url-tracking']));
    expect(ids()).not.toContain('adguard-search-ads');
    expect(ids({ ...d, searchAds: false })).toContain('adguard-search-ads');
    expect(ids({ ...d, stripParams: false })).not.toContain('adguard-url-tracking');
    expect(ids(d, ['de', 'en'])).toContain('adguard-de');
    expect(ids({ ...d, autoLanguage: false }, ['de'])).not.toContain('adguard-de');
    expect(ids({ ...d, custom: [{ id: 'c-1', url: 'https://x.org/a.txt', name: 'X', on: true }, { id: 'c-2', url: 'https://y.org/a.txt', name: 'Y', on: false }] }).slice(-1)).toEqual(['c-1']);
    // Every built-in list has a unique id and an https address.
    expect(new Set(FILTER_LISTS.map((l) => l.id)).size).toBe(FILTER_LISTS.length);
    for (const l of FILTER_LISTS) expect(l.url).toMatch(/^https:\/\//);
  });

  it('reads languages, list addresses and rule lines', () => {
    expect(languageCodes(['en-GB', 'de_DE', 'pt-BR', 'en', 'zh-Hans-CN', 'x'])).toEqual(['en', 'de', 'pt', 'zh']);
    expect(listUrl(' https://a.org/list.txt ')).toBe('https://a.org/list.txt');
    expect(listUrl('file:///etc/passwd')).toBe('');
    expect(listUrl('https://user:pw@a.org/l.txt')).toBe('');
    expect(ruleLines('! comment\r\n[Adblock Plus 2.0]\n\n||a.com^\r\n# just a note\nexample.com##.ad\n  ')).toEqual(['||a.com^', 'example.com##.ad']);
    expect(isParamRule('$removeparam=utm_source')).toBe(true);
    expect(isParamRule('||a.com^$script,removeparam=x')).toBe(true);
    expect(isParamRule('@@||a.com^$removeparam')).toBe(true);
    expect(isParamRule('||removeparam.com^')).toBe(false);
  });

  it('old saved data gets Shields; settings changes are sanitised', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState()));
    delete raw.settings.shields;
    delete raw.settings.motionSpeed;
    raw.settings.motionFeel = 'wobbly';
    const s = loadState(raw);
    expect(s.settings.shields).toEqual(defaultShields());
    expect(s.settings.motionSpeed).toBe(1);
    expect(s.settings.motionFeel).toBe('style');
    updateSettings(s, { motionSpeed: 9, shields: { ...defaultShields(), allow: ['B.com', 'b.com'] } });
    expect(s.settings.motionSpeed).toBe(2);
    expect(s.settings.shields.allow).toEqual(['b.com']);
  });
});

describe('shields: the built-in list really blocks', () => {
  const engine = FiltersEngine.parse(BUILTIN_FILTERS);
  const blocked = (url: string, sourceUrl: string, type = 'script') => engine.match(Request.fromRawDetails({ url, sourceUrl, type: type as never })).match;

  it('blocks well-known ad and tracker hosts on other sites', () => {
    expect(blocked('https://securepubads.g.doubleclick.net/tag/js/gpt.js', 'https://news.example.com/')).toBe(true);
    expect(blocked('https://www.google-analytics.com/analytics.js', 'https://news.example.com/')).toBe(true);
    expect(blocked('https://connect.facebook.net/en_US/fbevents.js', 'https://shop.example.com/')).toBe(true);
  });

  it('leaves ordinary requests alone', () => {
    expect(blocked('https://news.example.com/app.js', 'https://news.example.com/')).toBe(false);
    expect(blocked('https://cdn.jsdelivr.net/npm/react/index.js', 'https://news.example.com/')).toBe(false);
    expect(blocked('https://fonts.gstatic.com/s/inter.woff2', 'https://news.example.com/', 'font')).toBe(false);
  });

  it('does not break a company’s own site', () => {
    expect(blocked('https://www.hotjar.com/app.js', 'https://www.hotjar.com/')).toBe(false);
  });

  it('has cosmetic rules for leftover ad boxes', () => {
    const { styles } = engine.getCosmeticsFilters({ url: 'https://news.example.com/', hostname: 'news.example.com', domain: 'example.com', classes: ['adsbygoogle'], getInjectionRules: false });
    expect(styles).toContain('.adsbygoogle');
  });

  it('survives being saved and loaded again', () => {
    const again = FiltersEngine.deserialize(engine.serialize());
    expect(again.match(Request.fromRawDetails({ url: 'https://ad.doubleclick.net/x.js', sourceUrl: 'https://a.com/', type: 'script' as never })).match).toBe(true);
  });
});

describe('https-only', () => {
  const none = new Set<string>();
  it('upgrades ordinary sites', () => {
    expect(httpsUpgrade('http://example.com/a?b=1', true, none)).toBe('https://example.com/a?b=1');
    expect(httpsUpgrade('http://example.com:80/', true, none)).toBe('https://example.com/');
  });
  it('leaves local addresses, odd ports, exceptions and https alone', () => {
    for (const u of ['http://localhost:3000/', 'http://127.0.0.1/', 'http://192.168.1.10/admin', 'http://10.0.0.2/', 'http://printer.local/', 'http://router/', 'http://[::1]:8080/', 'http://example.com:8080/'])
      expect(httpsUpgrade(u, true, none)).toBeNull();
    expect(httpsUpgrade('https://example.com/', true, none)).toBeNull();
    expect(httpsUpgrade('http://example.com/', false, none)).toBeNull();
    expect(httpsUpgrade('http://old.example.com/', true, new Set(['old.example.com']))).toBeNull();
  });
  it('knows local hosts', () => {
    expect(isLocalHost('172.20.1.1')).toBe(true);
    expect(isLocalHost('172.32.1.1')).toBe(false);
    expect(isLocalHost('8.8.8.8')).toBe(false);
    expect(isLocalHost('example.com')).toBe(false);
  });
});

describe('what the address bar says', () => {
  it('rates connections', () => {
    expect(securityLevel('https://a.com/')).toBe('secure');
    expect(securityLevel('http://a.com/')).toBe('insecure');
    expect(securityLevel('http://localhost:5173/')).toBe('local');
    expect(securityLevel('file:///Users/me/a.html')).toBe('local');
    expect(securityLevel('about:blank')).toBe('internal');
    expect(securityLevel('https://a.com/', true)).toBe('broken');
  });
  it('explains load failures; certificate problems are marked', () => {
    expect(loadErrorText(-202, 'ERR_CERT_AUTHORITY_INVALID').cert).toBe(true);
    expect(loadErrorText(-105, '').title).toBe('Site not found');
    expect(loadErrorText(-106, '').title).toBe('You’re offline');
    expect(loadErrorText(-999, 'ERR_WEIRD').detail).toContain('ERR_WEIRD');
    expect(loadErrorText(-105, '').cert).toBe(false);
  });
});

describe('tracking protection helpers', () => {
  it('caps cookie lifetimes, leaving session and short cookies alone', () => {
    expect(capCookie('id=1; Path=/; Max-Age=31536000; Secure', 3600)).toBe('id=1; Path=/; Secure; Max-Age=3600');
    expect(capCookie('id=1; Expires=Wed, 01 Jan 2099 00:00:00 GMT; HttpOnly', 60)).toBe('id=1; HttpOnly; Max-Age=60');
    expect(capCookie('id=1; Max-Age=30', 3600)).toBe('id=1; Max-Age=30');
    expect(capCookie('session=1; Path=/', 60)).toBe('session=1; Path=/');
    expect(capCookie('id=1; Max-Age=99999', 0)).toBe('id=1; Max-Age=99999');
  });

  it('hides search queries from the sites you open', () => {
    expect(searchReferrer('https://www.google.com/search?q=secret')).toBe('https://www.google.com/');
    expect(searchReferrer('https://duckduckgo.com/?q=secret')).toBe('https://duckduckgo.com/');
    expect(searchReferrer('https://www.google.com/')).toBeNull();
    expect(searchReferrer('https://news.example.com/?q=1')).toBeNull();
    expect(searchReferrer('not a url')).toBeNull();
  });
});

describe('filter engine build (the worker)', () => {
  const req = (url: string, sourceUrl: string, type: string) => Request.fromRawDetails({ url, sourceUrl, type: type as never });
  const crlf = (lines: string[]) => lines.join('\r\n');
  const list = crlf(['[Adblock Plus 2.0]', '! Title: Test list', '||ads.example^', '##.ad-slot', 'news.test##+js(set-constant, adsAllowed, true)', '$removeparam=fbclid', '$removeparam=gclid', '$removeparam=pjclid', '||shop.test^$removeparam=ref']);

  it('builds from CRLF lists: blocks, hides, strips parameters, and counts rules', () => {
    const r = build({ id: 1, lists: [{ id: 'builtin', text: `${BUILTIN_FILTERS}\n${BUILTIN_PARAMS}` }, { id: 't', text: list }], userRules: '', resources: null });
    expect(r.error).toBeUndefined();
    expect(r.counts.t).toBe(7);
    const engine = FiltersEngine.deserialize(r.engine);
    const params = FiltersEngine.deserialize(r.params);
    expect(engine.match(req('https://ads.example/x.js', 'https://site.test/', 'script')).match).toBe(true);
    expect(engine.getCosmeticsFilters({ url: 'https://site.test/', hostname: 'site.test', domain: 'site.test', classes: ['ad-slot'] }).styles).toContain('.ad-slot');
    // Several generic $removeparam rules together all apply (they need the unoptimized engine).
    expect(params.match(req('https://a.test/p?fbclid=1&gclid=2&utm_source=x&id=3', 'https://a.test/p', 'main_frame')).rewrite?.url).toBe('https://a.test/p?id=3');
    expect(params.match(req('https://shop.test/i?ref=abc&q=1', 'https://shop.test/', 'main_frame')).rewrite?.url).toBe('https://shop.test/i?q=1');
    expect(params.match(req('https://other.test/i?ref=abc', 'https://other.test/', 'main_frame')).rewrite).toBeUndefined();
  });

  it('your rules: block, unblock (beating the lists), hide; unreadable lines are reported', () => {
    const r = build({ id: 2, lists: [{ id: 't', text: list }], userRules: '||mine.test^\n@@||ads.example^$domain=friend.test\nfriend.test##.promo\n||bad^$unknownoption\n! a comment', resources: null });
    expect(r.userCount).toBe(3);
    expect(r.invalid).toEqual(['||bad^$unknownoption']);
    const engine = FiltersEngine.deserialize(r.engine);
    expect(engine.match(req('https://mine.test/a.js', 'https://site.test/', 'script')).match).toBe(true);
    expect(engine.match(req('https://ads.example/x.js', 'https://friend.test/', 'script')).match).toBe(false);
    expect(engine.match(req('https://ads.example/x.js', 'https://site.test/', 'script')).match).toBe(true);
    expect(engine.getCosmeticsFilters({ url: 'https://friend.test/', hostname: 'friend.test', domain: 'friend.test' }).styles).toContain('.promo');
  });

  it('runs page-fix scripts when the resource library is loaded', () => {
    const resources = JSON.stringify({ scriptlets: [{ name: 'set-constant.js', aliases: ['set-constant'], body: 'function setConstant(a, b) { window[a] = b; }', dependencies: [], executionWorld: 'MAIN', requiresTrust: false }], redirects: [] });
    const r = build({ id: 3, lists: [{ id: 't', text: list }], userRules: '', resources });
    const engine = FiltersEngine.deserialize(r.engine);
    const { scripts } = engine.getCosmeticsFilters({ url: 'https://news.test/', hostname: 'news.test', domain: 'news.test', getInjectionRules: true });
    expect(scripts.join('\n')).toContain('adsAllowed');
  });

  it('knows a filter list from a web page', () => {
    expect(notAList('<!DOCTYPE html><html>…', 'text/html; charset=utf-8')).toMatch(/web page/);
    expect(notAList('  <html><body>', 'text/plain')).toMatch(/web page/);
    expect(notAList('', 'text/plain')).toMatch(/empty/);
    expect(notAList('! Title: X\n||a^', 'text/plain')).toBeNull();
    expect(listTitle('[Adblock Plus 2.0]\n! Title: AdGuard Base filter + EasyList\n')).toBe('AdGuard Base filter + EasyList');
  });
});

describe('per-site protections summary', () => {
  it('follows how each protection is applied', async () => {
    const { defaultShields, setSiteAllowed, siteProtections } = await import('@shared/shields');
    const on = (sh: ReturnType<typeof defaultShields>, url: string) => Object.fromEntries(siteProtections(sh, url).map((p) => [p.id, p.on]));
    const sh = defaultShields();
    const url = 'https://news.example.com/story';
    expect(siteProtections(sh, url).map((p) => p.id)).toEqual(['ads', 'cosmetic', 'fingerprinting', 'cookies', 'links', 'webrtc']);
    expect(on(sh, url)).toMatchObject({ ads: true, cosmetic: sh.cosmetic, fingerprinting: true, cookies: true });
    // Allowing a site stops ad blocking there, but not the protections that are not per-site.
    const allowed = setSiteAllowed(sh, url, true);
    expect(on(allowed, url)).toMatchObject({ ads: false, cosmetic: false, fingerprinting: true, cookies: true });
    expect(on(allowed, 'https://other.example.org/')).toMatchObject({ ads: true });
    // The master switch turns off everything that depends on it.
    const off = { ...sh, enabled: false };
    expect(on(off, url)).toMatchObject({ ads: false, cosmetic: false, cookies: false, webrtc: false, fingerprinting: sh.fingerprinting });
    expect(on({ ...sh, stripParams: false, debounce: false, deAmp: false }, url).links).toBe(false);
    expect(on({ ...sh, stripParams: false, debounce: true, deAmp: false }, url).links).toBe(true);
  });
});
