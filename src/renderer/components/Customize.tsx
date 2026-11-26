// Customize: the quick "make it mine" panel. It sits in the corner beside the page, so
// every change shows on the window as you make it; the full set is one link away in
// Settings. Opened from the sidebar's footer and from the command bar ("Customize Kite").

import { CORNERS, DENSITIES, FEELS, MARGINS, cornerOf, customizeDefaults, feelOf, marginOf } from '@shared/customize';
import { defaultHome } from '@shared/home';
import { updateSettings } from '@shared/settings';
import { setSpaceTheme } from '@shared/spaces';
import { presetPatch } from '@shared/spaceTheme';
import type { Settings } from '@shared/types';
import { act, setUi, toast, useKite } from '../store';
import { Segmented, Sheet, Toggle } from './Sheet';
import { PresetPicker } from './ThemeEditor';

/** One line of the panel: its name on the left, its control on the right. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cz-row">
      <span className="cz-label">{label}</span>
      {children}
    </div>
  );
}

/** A switch: the name takes the line, the switch sits at its end. */
function Switch({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="cz-row" data-switch>
      <span className="cz-label">{label}</span>
      <Toggle checked={checked} onChange={onChange} testId={testId} label={label} />
    </label>
  );
}

export function Customize() {
  const settings = useKite((st) => st.s.settings);
  const spaceId = useKite((st) => st.s.activeSpaceId);
  const mode = useKite((st) => st.s.spaces.find((x) => x.id === st.s.activeSpaceId)?.theme.mode ?? 'system');
  const home = useKite((st) => st.s.home);
  const set = (patch: Partial<Settings>) => act((d) => updateSettings(d, patch));
  const reset = () => {
    act((d) => {
      updateSettings(d, customizeDefaults());
      setSpaceTheme(d, spaceId, presetPatch('quiet'));
      const h = defaultHome();
      d.home.showGreeting = h.showGreeting;
      d.home.showFrequent = h.showFrequent;
      d.home.showHints = h.showHints;
    });
    toast('Look and layout are back to how Kite starts');
  };
  return (
    <Sheet
      dock
      title="Customize"
      testId="customize"
      footer={
        <>
          <button className="btn small ghost" data-testid="customize-reset" onClick={reset}>Reset</button>
          <span className="spacer" />
          <button className="btn small" data-testid="customize-all" onClick={() => setUi({ panel: 'settings', panelArg: 'appearance' })}>All settings…</button>
        </>
      }
    >
      <div className="cz">
        <div className="theme-controls">
          <PresetPicker spaceId={spaceId} />
        </div>
        <hr className="divider" />
        <Line label="Mode">
          <Segmented fill testId="cz-mode" label="Mode" value={mode} onChange={(m) => act((d) => setSpaceTheme(d, spaceId, { mode: m }))} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Line>
        <Line label="Sidebar">
          <Segmented fill testId="cz-side" label="Sidebar side" value={settings.sidebarSide} onChange={(sidebarSide) => set({ sidebarSide })} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
        </Line>
        <Line label="Density">
          <Segmented fill testId="cz-density" label="Density" value={settings.density} onChange={(density) => set({ density })} options={DENSITIES.map((x) => ({ value: x.id, label: x.name }))} />
        </Line>
        <Line label="Corners">
          <Segmented fill testId="cz-corners" label="Corners" value={cornerOf(settings.radius)} onChange={(id) => set({ radius: CORNERS.find((c) => c.id === id)!.radius })} options={CORNERS.map((x) => ({ value: x.id, label: x.name }))} />
        </Line>
        <Line label="Margin">
          <Segmented fill testId="cz-margin" label="Page margin" value={marginOf(settings.gap)} onChange={(id) => set({ gap: MARGINS.find((m) => m.id === id)!.gap })} options={MARGINS.map((x) => ({ value: x.id, label: <span title={x.name}>{x.short}</span> }))} />
        </Line>
        <Line label="Motion">
          <Segmented fill testId="cz-feel" label="Motion feel" value={feelOf(settings.motionFeel)} onChange={(motionFeel) => set({ motionFeel })} options={FEELS.map((x) => ({ value: x.id, label: x.name }))} />
        </Line>
        <Switch label="Reduce motion" checked={settings.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} testId="cz-reduce" />
        <hr className="divider" />
        <h4 className="section-label">Start page</h4>
        <Switch label="Greeting" checked={home.showGreeting} onChange={(v) => act((d) => void (d.home.showGreeting = v))} testId="cz-greeting" />
        <Switch label="Frequently visited sites" checked={home.showFrequent} onChange={(v) => act((d) => void (d.home.showFrequent = v))} testId="cz-frequent" />
        <Switch label="Shortcut hints" checked={home.showHints} onChange={(v) => act((d) => void (d.home.showHints = v))} testId="cz-hints" />
      </div>
    </Sheet>
  );
}
