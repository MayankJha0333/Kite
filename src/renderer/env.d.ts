import 'react';

declare global {
  /** Kite's version, from package.json (vite.config.ts). */
  const __KITE_VERSION__: string;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: string;
        webpreferences?: string;
      };
    }
  }
}
