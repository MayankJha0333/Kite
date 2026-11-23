import { describe, expect, it } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { deAmpUrl, debounceUrl, defaultShields, sanitizeShields, scopedScriptlet } from '@shared/shields';
import { farbleScript, farbleSeed } from '@shared/fingerprint';

describe('Brave-style protections', () => {
  it('are on by default, and saved settings keep them', () => {
    expect(defaultShields()).toMatchObject({ fingerprinting: true, crossSiteCookies: true, debounce: true, deAmp: true });
    expect(sanitizeShields({ fingerprinting: false, crossSiteCookies: false, debounce: false, deAmp: false })).toMatchObject({ fingerprinting: false, crossSiteCookies: false, debounce: false, deAmp: false });
    expect(sanitizeShields({})).toMatchObject({ fingerprinting: true, crossSiteCookies: true });
  });

  it('debouncing skips tracking redirect links, and leaves everything else alone', () => {
    expect(debounceUrl('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&sa=D')).toBe('https://example.com/a?b=1');
    expect(debounceUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fnews.example.org%2Fstory&h=AT0')).toBe('https://news.example.org/story');
    expect(debounceUrl('https://out.reddit.com/t3_abc?url=https%3A%2F%2Fexample.com%2F&token=x')).toBe('https://example.com/');
    expect(debounceUrl('https://www.youtube.com/redirect?event=video_description&q=https%3A%2F%2Fshop.example.com')).toBe('https://shop.example.com/');
    expect(debounceUrl('https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F')).toBe('https://example.com/');
    expect(debounceUrl('https://disq.us/url?url=https%3A%2F%2Fexample.com%2Fpost%3Aab12_cd')).toBe('https://example.com/post');
    // Not redirects, or not to a web page.
    expect(debounceUrl('https://www.google.com/search?q=kites')).toBeNull();
    expect(debounceUrl('https://www.google.com/url?q=javascript:alert(1)')).toBeNull();
    expect(debounceUrl('https://example.com/url?q=https://elsewhere.com')).toBeNull();
    expect(debounceUrl('not a url')).toBeNull();
  });

  it("De-AMP opens the publisher's own page", () => {
    expect(deAmpUrl('https://www.google.com/amp/s/www.example.com/news/story.amp.html')).toBe('https://www.example.com/news/story.amp.html');
    expect(deAmpUrl('https://www.google.co.uk/amp/example.com/plain')).toBe('http://example.com/plain');
    expect(deAmpUrl('https://www-example-com.cdn.ampproject.org/c/s/www.example.com/a?x=1')).toBe('https://www.example.com/a?x=1');
    expect(deAmpUrl('https://www.google.com/search?q=amp')).toBeNull();
    expect(deAmpUrl('https://www.google.com/amp/s/google.com/x')).toBeNull();
  });

  it('the fingerprinting seed is the same for a site within a run, and differs between sites and runs', () => {
    expect(farbleSeed(42, 'example.com')).toBe(farbleSeed(42, 'example.com'));
    expect(farbleSeed(42, 'example.com')).not.toBe(farbleSeed(42, 'example.org'));
    expect(farbleSeed(42, 'example.com')).not.toBe(farbleSeed(43, 'example.com'));
    expect(farbleSeed(0, '')).toBeGreaterThan(0);
  });

  it('the page script is valid JavaScript and carries its seed', () => {
    const js = farbleScript(123456);
    expect(() => new Function(js)).not.toThrow();
    expect(js).toContain('const SEED = 123456;');
  });
});

describe('filter-list scriptlets', () => {
  it("two scriptlets declaring the same helper both run (YouTube's stuck skeleton)", () => {
    const page = createContext({ ran: [] as string[] });
    const a = 'class JSONPath {} ran.push("json-prune");';
    const b = 'class JSONPath {} ran.push("json-prune-fetch-response");';
    // Unwrapped, the second one is a SyntaxError in the shared global scope.
    const bare = createContext({ ran: [] as string[] });
    runInContext(a, bare);
    expect(() => runInContext(b, bare)).toThrow(/already been declared/);
    runInContext(scopedScriptlet(a), page);
    runInContext(scopedScriptlet(b), page);
    expect(runInContext('ran', page)).toEqual(['json-prune', 'json-prune-fetch-response']);
  });
});
