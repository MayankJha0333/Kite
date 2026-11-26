// Bundles the Electron main + preload processes with esbuild.
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['electron', 'koffi'],
  sourcemap: true,
  logLevel: 'warning',
};

await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs' });
await build({ ...common, entryPoints: ['src/main/preload.ts'], outfile: 'dist/main/preload.cjs' });
// Shields: builds filter engines off the main thread.
await build({ ...common, entryPoints: ['src/main/shieldsWorker.ts'], outfile: 'dist/main/shieldsWorker.cjs' });
// Shields: runs in every web page frame at document start (sandboxed: Electron's modules only).
await build({ ...common, entryPoints: ['src/main/pagePreload.ts'], outfile: 'dist/main/pagePreload.cjs', platform: 'browser', target: 'chrome156' });
console.log('main + preloads + shields worker built');
