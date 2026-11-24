// Renders Kite's app icon (build/icon.png, 1024×1024) from the logo.
import { chromium } from 'playwright';
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b39a6"/><stop offset=".55" stop-color="#2a4f9a"/><stop offset="1" stop-color="#16627c"/>
    </linearGradient>
    <radialGradient id="glow" cx=".2" cy="0" r=".9">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#bg)"/>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#glow)"/>
  <g transform="translate(64 64) scale(7.4667)" fill="#fff">
    <path d="M62 14 92 50 60 48Z"/>
    <path d="M62 14 30 46 60 48Z" opacity=".8"/>
    <path d="M92 50 56 86 60 48Z" opacity=".68"/>
    <path d="M30 46 56 86 60 48Z" opacity=".5"/>
    <path d="M56 86C47 94 64 98 54 107" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  </g>
</svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await p.locator('svg').screenshot({ path: 'build/icon.png', omitBackground: true });
await b.close();
console.log('build/icon.png written');
