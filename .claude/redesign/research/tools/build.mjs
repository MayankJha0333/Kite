import { createRequire } from 'node:module';
const require = createRequire('/Users/apple/Personal/MArc/package.json');
const esbuild = require('esbuild');
await esbuild.build({ entryPoints: ['entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'entry.out.mjs', logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^@shared\// }, (a) => ({ path: '/Users/apple/Personal/MArc/src/shared/' + a.path.slice(8) + '.ts' }));
    b.onResolve({ filter: /^\.\/backdrops$/ }, (a) => a.importer.includes('/renderer/') ? { path: 'stub-backdrops', namespace: 'stub' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const backdropUrl = (id, thumb) => `/assets/${id}${thumb ? "-thumb" : ""}.jpg`;', loader: 'js' }));
  } }] });
