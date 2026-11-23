// Fingerprinting protection, the way Brave's "standard" mode works ("farbling"): the
// answers a page can use to recognise your computer are varied a tiny, invisible amount,
// differently on every site and every time Kite starts, but the same within one site for
// the session (so pages that check twice still work). The page sees nothing else changed.
//
// What varies:
//  - Canvas read-back (getImageData, toDataURL, toBlob): a few low bits of a few pixels.
//  - Audio read-back (getChannelData, analyser data): differences far below hearing.
//  - WebGL's unmasked GPU vendor and renderer: generic names instead of your exact GPU.
//  - navigator.hardwareConcurrency and deviceMemory: plausible, per-site values.
// The wrapped functions still say they are native code.

/** A number that stays the same for a site during one run of Kite, and differs between sites and runs. */
export function farbleSeed(sessionKey: number, site: string): number {
  let h = (2166136261 ^ sessionKey) >>> 0;
  for (let i = 0; i < site.length; i++) h = Math.imul(h ^ site.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0 || 1;
}

/** The script that runs in a page's own world at document start. */
export function farbleScript(seed: number): string {
  return `(() => {
  if (window.__kiteFarbled) return;
  Object.defineProperty(window, '__kiteFarbled', { value: true });
  const SEED = ${seed >>> 0};
  const natives = new WeakMap();
  const nativeToString = Function.prototype.toString;
  const toString = function toString() { return nativeToString.call(natives.get(this) || this); };
  natives.set(toString, nativeToString);
  Function.prototype.toString = toString;
  const wrap = (proto, name, make) => {
    const orig = proto && proto[name];
    if (typeof orig !== 'function') return;
    const fn = make(orig);
    natives.set(fn, orig);
    try { Object.defineProperty(proto, name, { value: fn, configurable: true, writable: true }); } catch (e) {}
  };
  const getter = (proto, name, value) => {
    const desc = proto && Object.getOwnPropertyDescriptor(proto, name);
    if (!desc || !desc.get) return;
    const get = { get [name]() { return value; } }.__lookupGetter__(name);
    natives.set(get, desc.get);
    try { Object.defineProperty(proto, name, { get, configurable: true, enumerable: desc.enumerable }); } catch (e) {}
  };
  // A deterministic stream of numbers from the seed and a position.
  const mix = (a, b) => { let h = Math.imul(a ^ b, 0x9e3779b1) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; return (h ^ (h >>> 13)) >>> 0; };

  // ---- canvas ----
  const noise = (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const h = mix(SEED, mix(i, data[i] | (data[i + 1] << 8) | (data[i + 2] << 16)));
      if ((h & 31) === 0) data[i + (h >>> 5) % 3] ^= 1;
    }
  };
  wrap(CanvasRenderingContext2D.prototype, 'getImageData', (orig) => function getImageData(...args) {
    const img = orig.apply(this, args);
    try { noise(img.data); } catch (e) {}
    return img;
  });
  const noisyCopy = (canvas) => {
    const w = canvas.width, h = canvas.height;
    if (!w || !h || w * h > 16e6) return null;
    const copy = document.createElement('canvas');
    copy.width = w; copy.height = h;
    const ctx = copy.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0);
    const img = natives.get(CanvasRenderingContext2D.prototype.getImageData).call(ctx, 0, 0, w, h);
    noise(img.data);
    ctx.putImageData(img, 0, 0);
    return copy;
  };
  wrap(HTMLCanvasElement.prototype, 'toDataURL', (orig) => function toDataURL(...args) {
    let c = null;
    try { c = noisyCopy(this); } catch (e) {}
    return orig.apply(c || this, args);
  });
  wrap(HTMLCanvasElement.prototype, 'toBlob', (orig) => function toBlob(...args) {
    let c = null;
    try { c = noisyCopy(this); } catch (e) {}
    return orig.apply(c || this, args);
  });

  // ---- audio ----
  const audioNoise = (arr, salt) => {
    for (let i = 0; i < arr.length; i += 1) {
      const h = mix(SEED ^ salt, i);
      if ((h & 15) === 0) arr[i] += ((h >>> 4) / 268435456 - 0.5) * 1e-7;
    }
  };
  const touched = new WeakSet();
  wrap(window.AudioBuffer && AudioBuffer.prototype, 'getChannelData', (orig) => function getChannelData(ch) {
    const data = orig.call(this, ch);
    if (!touched.has(data)) { touched.add(data); try { audioNoise(data, 7 + ch); } catch (e) {} }
    return data;
  });
  wrap(window.AnalyserNode && AnalyserNode.prototype, 'getFloatFrequencyData', (orig) => function getFloatFrequencyData(arr) {
    orig.call(this, arr);
    try { audioNoise(arr, 11); } catch (e) {}
  });

  // ---- WebGL ----
  const gl = (proto) => wrap(proto, 'getParameter', (orig) => function getParameter(p) {
    if (p === 0x9245) return 'Google Inc.';
    if (p === 0x9246) return 'ANGLE (Generic GPU)';
    return orig.call(this, p);
  });
  if (window.WebGLRenderingContext) gl(WebGLRenderingContext.prototype);
  if (window.WebGL2RenderingContext) gl(WebGL2RenderingContext.prototype);

  // ---- hardware ----
  getter(Navigator.prototype, 'hardwareConcurrency', 2 + (SEED % 7));
  getter(Navigator.prototype, 'deviceMemory', [2, 4, 8][SEED % 3]);
})();`;
}
