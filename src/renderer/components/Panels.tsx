import { Component, type ReactNode } from 'react';
import { setUi, toast, useKite } from '../store';
import { SpaceEditor } from './Spaces';
import { ArchivePage } from './ArchivePage';
import { HistoryPage } from './HistoryPage';
import { BoostEditor, BoostsList } from './Boosts';
import { RoutingPanel } from './Routing';
import { ImportArc } from './ImportArc';
import { DownloadsPanel } from './Downloads';
import { ExtensionsPanel } from './Extensions';
import { Welcome } from './Welcome';
import { Customize } from './Customize';

/** Side sheets (Settings, Archive, Boosts, Space editor…). A panel that breaks closes
 *  itself with a message instead of taking the whole window (and your pages) down. */
export function Panels() {
  const panel = useKite((st) => st.ui.panel ?? st.ui.leaving?.panel ?? null);
  return (
    <PanelGuard key={panel ?? 'none'}>
      <PanelSwitch />
    </PanelGuard>
  );
}

export class PanelGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('Kite panel failed:', err);
    setUi({ panel: null, panelArg: undefined });
    toast('That panel hit a problem and was closed. Your tabs are safe.');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PanelSwitch() {
  // A panel that is leaving is still drawn until its exit animation ends (see Sheet.tsx).
  const panel = useKite((st) => st.ui.panel ?? st.ui.leaving?.panel ?? null);
  const arg = useKite((st) => (st.ui.panel ? st.ui.panelArg : st.ui.leaving?.panelArg));
  if (panel === 'space' && arg) return <SpaceEditor id={arg} />;
  if (panel === 'archive') return <ArchivePage />;
  if (panel === 'history') return <HistoryPage />;
  if (panel === 'boost' && arg) return <BoostEditor key={arg} id={arg} />;
  if (panel === 'boosts') return <BoostsList />;
  if (panel === 'routing') return <RoutingPanel />;
  if (panel === 'import') return <ImportArc />;
  // Settings is a page inside the page area (see Stage), not a sheet.
  if (panel === 'downloads') return <DownloadsPanel />;
  if (panel === 'extensions') return <ExtensionsPanel />;
  if (panel === 'welcome') return <Welcome />;
  if (panel === 'customize') return <Customize />;
  return null;
}
