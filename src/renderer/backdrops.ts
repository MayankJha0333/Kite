// Where the built-in theme pictures live once bundled (see src/shared/backdrops.ts).

import type { BackdropId } from '@shared/backdrops';

const files = import.meta.glob('./assets/backgrounds/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function backdropUrl(id: BackdropId, thumb = false): string | undefined {
  return files[`./assets/backgrounds/${id}${thumb ? '-thumb' : ''}.jpg`];
}
