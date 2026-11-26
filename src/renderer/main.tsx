import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
// Kite's text is San Francisco on a Mac. Everywhere else it is Figtree, bundled in the three
// weights the design uses (regular, medium, semibold); see FONT in theme.ts.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import './styles/app.css';
import { App } from './App';
import { LittleApp } from './LittleApp';
import { PipFrameApp } from './PipFrameApp';
import { bridge, mode } from './platform';
import { flushSave } from './store';

/**
 * The last line of defence: if Kite's own UI throws, show what happened and a way
 * back instead of a blank window. Tabs are already saved to disk; Reload restores them.
 */
class AppGuard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Kite UI failed:', error, info.componentStack);
    try {
      bridge.debugLog(`ui error: ${error.message}\n${error.stack ?? ''}\n${info.componentStack ?? ''}`.slice(0, 2000));
      flushSave(true);
    } catch {
      /* best effort */
    }
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app-crash" role="alert" data-testid="app-crash">
        <div className="app-crash-card">
          <h1>Kite hit a problem</h1>
          <p>Something in Kite’s window stopped working. Your tabs, notes and settings are saved on disk.</p>
          <pre className="app-crash-detail">{error.message}</pre>
          <div className="inline-form">
            <button className="btn primary" onClick={() => location.reload()}>Reload Kite</button>
            <button className="btn" onClick={() => this.setState({ error: null })}>Try to continue</button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(<AppGuard>{mode === 'little' ? <LittleApp /> : mode === 'pip' ? <PipFrameApp /> : <App />}</AppGuard>);
