import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  define: { __KITE_VERSION__: JSON.stringify('test') },
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
