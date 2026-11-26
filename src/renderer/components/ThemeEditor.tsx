// The one theme editor for a Space, kept short. First: light or dark, one row of colors
// (Calm Air's own, then nine muted hues) and three backgrounds (none, a picture, a gradient).
// Everything else opens in place when asked for: "Custom…" holds the other swatches, the hue
// strip, both colors, Intensity and Grain; "Picture…" holds Kite's pictures and your own;
// "Gradient…" holds the ready-made gradients and the gradient editor; "Patterns" holds
// the patterns. Every change shows on the window as you make it. Settings › Appearance and
// the Space editor show all of it; Customize and the first-run look step show the first
// level (PresetPicker).

import { useState } from 'react';
import { Blend, Image, ImagePlus, Plus, X } from 'lucide-react';
import { hexToHsl } from '@shared/designTokens';
import { DEFAULT_PATTERN_STRENGTH, DEFAULT_THEME, PATTERNS, PLAIN, SWATCH_ROWS, THEME_PRESETS, gradientPatch, pairFromColor, pairFromHue, photoPatch, presetOf, presetPatch, starterGradient, swatchOf, type SwatchRowId } from '@shared/spaceTheme';
import { BACKDROPS, backdropById, backdropPatch } from '@shared/backdrops';
import { backdropUrl } from '../backdrops';
import { setSpaceTheme } from '@shared/spaces';
import type { ID, SpaceTheme } from '@shared/types';
import { act, toast, useKite } from '../store';
import { addImage, ImageError, useImageUrl } from '../images';
import { mix, patternCss, resolveDark } from '../theme';
import { useSystemDark } from '../systemDark';
import { Segmented, Slider, Toggle } from './Sheet';

type Gradient = { colors: string[]; angle: number };
const gradientCss = (g: Gradient) => `linear-gradient(${g.angle}deg, ${g.colors.join(', ')})`;
const useTheme = (spaceId: ID) => useKite((st) => st.s.spaces.find((x) => x.id === spaceId)?.theme);
const setTheme = (spaceId: ID, patch: Partial<SpaceTheme>) => act((d) => setSpaceTheme(d, spaceId, patch));
const isPlain = (t: SpaceTheme) => !t.backdrop && !t.photo && !t.gradient;

/** The row of swatches shown first, after Calm Air's own color. The other two rows are behind "Custom…". */
const FIRST_ROW: SwatchRowId = 'muted';
/** The ready-made looks that are gradients; they are offered under "Gradient…". */
const GRADIENT_PRESETS = THEME_PRESETS.filter((p) => p.gradient);

/** What each swatch is called, so it can be told apart without seeing it. Same order as the rows in spaceTheme.ts. */
const SWATCH_NAMES: Record<SwatchRowId, { row: string; colors: readonly string[] }> = {
  pastel: { row: 'Pastel', colors: ['Paper', 'Blush', 'Lilac', 'Rose', 'Peach', 'Butter', 'Mint', 'Sky', 'Lavender'] },
  muted: { row: 'Muted', colors: ['Plum', 'Mulberry', 'Brick', 'Copper', 'Ochre', 'Khaki', 'Sage', 'Pine', 'Navy'] },
  grey: { row: 'Gray', colors: ['White', 'Mist', 'Silver', 'Pewter', 'Gray', 'Slate', 'Charcoal', 'Ink', 'Black'] },
};

/**
 * A group of choices is one stop for the Tab key; the arrow keys move between its choices
 * (Space or Enter picks), as in a native radio group.
 */
function rove(e: React.KeyboardEvent<HTMLElement>) {
  const by = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!by) return;
  const all = [...(e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
  const at = all.indexOf(e.currentTarget);
  if (at < 0) return;
  e.preventDefault();
  all[(at + by + all.length) % all.length].focus();
}
/** The Tab stop of a group: its chosen item, else its first. */
const stop = (chosen: number, i: number) => (i === Math.max(chosen, 0) ? 0 : -1);

/** A picture-sized choice with its name under it: a background, a pattern, a gradient. */
function Tile({ name, short, on, expanded, tabIndex, testId, tone, style, icon, onPick }: { name: string; /** Shown under the tile when the full name would not fit. */ short?: string; on: boolean; /** For a tile that opens more choices under it. */ expanded?: boolean; tabIndex: number; testId: string; tone?: string; style?: React.CSSProperties; /** Drawn in the tile when it has no picture of its own yet. */ icon?: React.ReactNode; onPick: () => void }) {
  return (
    <button type="button" role="radio" className="tile" aria-checked={on} aria-expanded={expanded} aria-label={name} title={name} tabIndex={tabIndex} data-on={on || undefined} data-open={expanded || undefined} data-tone={tone} data-testid={testId} onKeyDown={rove} onClick={(e) => { e.preventDefault(); onPick(); }}>
      <span className={icon ? 'tile-img tile-add' : 'tile-img'} style={style}>{icon}</span>
      <span className="tile-name" aria-hidden="true">{short ?? name}</span>
    </button>
  );
}

/** One row of swatches. Picking one goes back to plain color: no picture, no gradient. */
function SwatchRow({ spaceId, theme: t, row, lead }: { spaceId: ID; theme: SpaceTheme; row: SwatchRowId; /** Calm Air's own color goes first in the row shown first. */ lead?: boolean }) {
  const def = SWATCH_ROWS.find((r) => r.id === row)!;
  const names = SWATCH_NAMES[row];
  const on = isPlain(t) ? swatchOf(t) : null;
  const calm = lead && presetOf(t) === 'quiet';
  const at = on?.row === row ? on.index : -1;
  // Where the Tab key lands: the chosen swatch, else the first.
  const first = lead ? (calm ? 0 : at >= 0 ? at + 1 : 0) : Math.max(at, 0);
  return (
    <div className="swatches" role="radiogroup" aria-label={lead ? 'Color' : `${names.row} colors`}>
      {lead && (
        <button
          type="button"
          role="radio"
          className="swatch"
          aria-checked={!!calm}
          aria-label="Calm Air"
          title="Calm Air"
          tabIndex={first === 0 ? 0 : -1}
          data-testid="preset-quiet"
          data-on={calm || undefined}
          style={{ backgroundColor: DEFAULT_THEME.colors[0] }}
          onKeyDown={rove}
          onClick={(e) => {
            e.preventDefault();
            // Kite's own look again (its color, strength and no extras); light or dark stays as you set it.
            setTheme(spaceId, { ...presetPatch('quiet'), mode: t.mode });
          }}
        />
      )}
      {def.colors.map((c, i) => {
        const name = `${names.colors[i] ?? i + 1} (${names.row.toLowerCase()})`;
        const picked = at === i;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            className="swatch"
            aria-checked={picked}
            aria-label={name}
            title={name}
            tabIndex={(lead ? i + 1 : i) === first ? 0 : -1}
            data-testid={`swatch-${row}-${i + 1}`}
            data-on={picked || undefined}
            style={{ backgroundColor: c }}
            onKeyDown={rove}
            onClick={(e) => {
              e.preventDefault();
              setTheme(spaceId, { ...PLAIN, colors: pairFromColor(c) });
            }}
          />
        );
      })}
    </div>
  );
}

/** Color: one row to pick from and, in the full editor, "Custom…" for everything else about the color. */
function Color({ spaceId, theme: t, custom }: { spaceId: ID; theme: SpaceTheme; custom?: boolean }) {
  const [open, setOpen] = useState(false);
  const on = isPlain(t) ? swatchOf(t) : null;
  // A color of your own (not in the first row) is shown on the button, so it is not lost from view.
  const own = isPlain(t) && presetOf(t) !== 'quiet' && on?.row !== FIRST_ROW;
  return (
    <section className="te-sec" data-inline>
      <h4 className="te-label">Color</h4>
      <div className="te-colors" data-testid="theme-swatches">
        <SwatchRow spaceId={spaceId} theme={t} row={FIRST_ROW} lead />
        {custom && (
          <button type="button" className="btn small" aria-expanded={open} data-testid="theme-custom-toggle" onClick={() => setOpen(!open)}>
            {own && <span className="swatch-dot" style={{ backgroundColor: t.colors[0] }} aria-hidden="true" />}
            Custom…
          </button>
        )}
      </div>
      {custom && open && <CustomColor spaceId={spaceId} theme={t} />}
    </section>
  );
}

/** Behind "Custom…": the other swatches, any hue, the two colors themselves, how strongly they tint the window, and grain. */
function CustomColor({ spaceId, theme: t }: { spaceId: ID; theme: SpaceTheme }) {
  const [hue, setHue] = useState(() => Math.round(hexToHsl(t.colors[1])[0]));
  const [vivid, setVivid] = useState(0.7);
  const set = (patch: Partial<SpaceTheme>) => setTheme(spaceId, patch);
  // A color you pick replaces any picture or gradient: you are back on plain color.
  const setColors = (colors: [string, string]) => set({ ...PLAIN, colors });
  const wheel = (h: number, v: number) => {
    setHue(h);
    setVivid(v);
    setColors(pairFromHue(h, v));
  };
  return (
    <div className="te-custom" data-testid="theme-custom">
      <div className="te-line">
        <span className="te-sub">More</span>
        <div className="swatch-rows">
          {SWATCH_ROWS.filter((r) => r.id !== FIRST_ROW).map((r) => <SwatchRow key={r.id} spaceId={spaceId} theme={t} row={r.id} />)}
        </div>
      </div>
      <div className="te-line">
        <span className="te-sub">Hue</span>
        <input type="range" className="hue" aria-label="Hue" min={0} max={359} value={hue} data-testid="space-hue" style={{ ['--hue-thumb' as string]: pairFromHue(hue, vivid)[0] }} onChange={(e) => wheel(Number(e.target.value), vivid)} />
        <span className="te-value">{hue}°</span>
      </div>
      <div className="te-line">
        <span className="te-sub">Vivid</span>
        <Slider label="Vividness" min={0.15} max={1} step={0.05} value={vivid} testId="space-vivid" onChange={(v) => wheel(hue, v)} />
        <span className="te-value">{Math.round(vivid * 100)}%</span>
      </div>
      <div className="te-line">
        <span className="te-sub">Intensity</span>
        <Slider label="Intensity" min={0} max={1} step={0.05} value={t.intensity} testId="space-intensity" onChange={(intensity) => set({ intensity })} />
        <span className="te-value">{Math.round(t.intensity * 100)}%</span>
      </div>
      <div className="te-line te-wells">
        <label className="te-well">
          <input type="color" className="color-well" data-testid="color-a" value={t.colors[0]} onChange={(e) => setColors([e.target.value, t.colors[1]])} />
          Window tint
        </label>
        <label className="te-well">
          <input type="color" className="color-well" data-testid="color-b" value={t.colors[1]} onChange={(e) => setColors([t.colors[0], e.target.value])} />
          Accent
        </label>
        <span className="spacer" />
        <label className="te-well">
          Grain
          <Toggle checked={t.grain} onChange={(grain) => set({ grain })} testId="space-grain" label="Grain texture" />
        </label>
      </div>
    </div>
  );
}

/** Your own gradient: its colors (two to four) and its angle. */
function GradientEditor({ g, onChange }: { g: Gradient; onChange: (g: Gradient) => void }) {
  return (
    <div className="grad" data-testid="gradient-editor">
      <div className="grad-stops">
        {g.colors.map((c, i) => (
          <span className="grad-stop" key={i}>
            <input type="color" className="color-well" aria-label={`Gradient color ${i + 1}`} data-testid={`grad-color-${i}`} value={c} onChange={(e) => onChange({ ...g, colors: g.colors.map((x, j) => (j === i ? e.target.value : x)) })} />
            {g.colors.length > 2 && (
              <button type="button" className="grad-remove" aria-label={`Remove color ${i + 1}`} data-testid={`grad-remove-${i}`} onClick={() => onChange({ ...g, colors: g.colors.filter((_, j) => j !== i) })}>
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {g.colors.length < 4 && (
          <button type="button" className="icon-btn" aria-label="Add a color" title="Add a color" data-testid="grad-add" onClick={() => onChange({ ...g, colors: [...g.colors.slice(0, -1), mix(g.colors[g.colors.length - 2], g.colors[g.colors.length - 1], 0.5), g.colors[g.colors.length - 1]] })}>
            <Plus size={16} />
          </button>
        )}
      </div>
      <div className="te-line">
        <span className="te-sub">Angle</span>
        <Slider label="Gradient angle" min={0} max={359} value={g.angle} testId="grad-angle" onChange={(angle) => onChange({ ...g, angle })} />
        <span className="te-value">{g.angle}°</span>
      </div>
    </div>
  );
}

/**
 * What the window frame shows. Three choices: the plain tint, a picture, a gradient. The
 * last two open their choices in place, and show what the Space has when it has one.
 */
function Background({ spaceId, theme: t }: { spaceId: ID; theme: SpaceTheme }) {
  const [open, setOpen] = useState<'picture' | 'gradient' | null>(null);
  const [busy, setBusy] = useState(false);
  const photoUrl = useImageUrl(t.photo?.id);
  const set = (patch: Partial<SpaceTheme>) => setTheme(spaceId, patch);
  const g = t.gradient;
  const setGradient = (next: Gradient) => set(gradientPatch(next));
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await addImage(file);
      set(photoPatch(r.id, r.luma, r.colors));
    } catch (err) {
      toast(err instanceof ImageError ? err.message : 'Kite couldn’t use that picture.');
    } finally {
      setBusy(false);
    }
  };
  const hasPhoto = !!(t.photo && photoUrl);
  const picture = t.backdrop ? backdropById(t.backdrop) : undefined;
  const pictured = !!picture || !!t.photo;
  const pictureName = picture?.name ?? (t.photo ? 'Your picture' : null);
  const pictureThumb = picture ? backdropUrl(picture.id, true) : hasPhoto ? photoUrl : null;
  const preset = presetOf(t);
  const chosen = isPlain(t) ? 0 : pictured ? 1 : 2;
  const pictureAt = t.backdrop ? BACKDROPS.findIndex((b) => b.id === t.backdrop) : hasPhoto ? BACKDROPS.length : -1;
  const gradientAt = g ? (GRADIENT_PRESETS.some((p) => p.id === preset) ? GRADIENT_PRESETS.findIndex((p) => p.id === preset) : GRADIENT_PRESETS.length) : -1;
  return (
    <section className="te-sec" data-inline>
      <h4 className="te-label">Background</h4>
      <div className="tile-row" role="radiogroup" aria-label="Background" data-testid="theme-backdrops">
        <Tile name="None" on={chosen === 0} tabIndex={stop(chosen, 0)} testId="backdrop-none" style={{ backgroundColor: 'var(--chrome-mid)' }} onPick={() => { set(backdropPatch(null)); setOpen(null); }} />
        <Tile
          name={pictureName ? `Picture: ${pictureName}` : 'Picture…'}
          short={pictureName ?? 'Picture…'}
          on={chosen === 1}
          expanded={open === 'picture'}
          tabIndex={stop(chosen, 1)}
          testId="backdrop-picture"
          style={pictureThumb ? { backgroundImage: `url("${pictureThumb}")` } : undefined}
          icon={pictureThumb ? undefined : <Image size={16} aria-hidden="true" />}
          onPick={() => setOpen(open === 'picture' ? null : 'picture')}
        />
        <Tile
          name={g ? 'Gradient' : 'Gradient…'}
          on={chosen === 2}
          expanded={open === 'gradient'}
          tabIndex={stop(chosen, 2)}
          testId="backdrop-gradient"
          style={g ? { backgroundImage: gradientCss(g) } : undefined}
          icon={g ? undefined : <Blend size={16} aria-hidden="true" />}
          onPick={() => setOpen(open === 'gradient' ? null : 'gradient')}
        />
      </div>

      {open === 'picture' && (
        <div className="te-custom" data-testid="theme-pictures">
          <div className="tile-grid" role="radiogroup" aria-label="Pictures">
            {BACKDROPS.map((b, i) => (
              <Tile key={b.id} name={b.name} on={t.backdrop === b.id} tabIndex={stop(pictureAt, i)} testId={`backdrop-${b.id}`} tone={b.tone} style={{ backgroundImage: `url("${backdropUrl(b.id, true)}")` }} onPick={() => set(backdropPatch(b.id))} />
            ))}
            {hasPhoto && <Tile name="Your picture" short="Yours" on tabIndex={stop(pictureAt, BACKDROPS.length)} testId="backdrop-photo" style={{ backgroundImage: `url("${photoUrl}")` }} onPick={() => undefined} />}
            <label className="tile" title={hasPhoto ? 'Replace your picture…' : 'Use a picture of your own…'} data-testid="backdrop-upload" data-busy={busy || undefined}>
              <span className="tile-img tile-add">
                <ImagePlus size={16} aria-hidden="true" />
              </span>
              <span className="tile-name">{busy ? 'Adding…' : hasPhoto ? 'Replace…' : 'Your own…'}</span>
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                aria-label="Choose a picture for this Space"
                data-testid="backdrop-upload-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void upload(f);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {open === 'gradient' && (
        <div className="te-custom" data-testid="theme-gradients">
          <div className="tile-grid" role="radiogroup" aria-label="Gradients">
            {GRADIENT_PRESETS.map((p, i) => (
              <Tile key={p.id} name={p.name} on={preset === p.id} tabIndex={stop(gradientAt, i)} testId={`preset-${p.id}`} style={{ backgroundImage: gradientCss(p.gradient!) }} onPick={() => set(presetPatch(p.id))} />
            ))}
            <Tile name={g && gradientAt === GRADIENT_PRESETS.length ? 'Your own' : 'Your own…'} on={gradientAt === GRADIENT_PRESETS.length} tabIndex={stop(gradientAt, GRADIENT_PRESETS.length)} testId="gradient-own" style={{ backgroundImage: gradientCss(starterGradient(t)) }} onPick={() => !g && setGradient(starterGradient(t))} />
          </div>
          {g && <GradientEditor g={g} onChange={setGradient} />}
        </div>
      )}
    </section>
  );
}

/** Patterns drawn softly over the Space's colors, behind "Patterns". */
function Patterns({ spaceId, theme: t }: { spaceId: ID; theme: SpaceTheme }) {
  const systemDark = useSystemDark();
  const set = (patch: Partial<SpaceTheme>) => setTheme(spaceId, patch);
  const dark = resolveDark(t, systemDark);
  const strength = t.patternStrength ?? DEFAULT_PATTERN_STRENGTH;
  // A pattern tile: the pattern at full strength over the Space's own tint.
  const patternTile = (id: (typeof PATTERNS)[number]['id'] | undefined): React.CSSProperties => {
    const p = patternCss(id, dark, 1);
    return id ? { backgroundColor: 'var(--chrome-mid)', backgroundImage: p.image, backgroundSize: p.size } : { backgroundColor: 'var(--chrome-mid)' };
  };
  const at = PATTERNS.findIndex((p) => p.id === t.pattern) + 1;
  return (
    <section className="te-sec">
      <h4 className="te-label">Pattern</h4>
      <div className="tile-grid" role="radiogroup" aria-label="Pattern" data-testid="theme-patterns">
        <Tile name="None" on={!t.pattern} tabIndex={stop(at, 0)} testId="pattern-none" style={patternTile(undefined)} onPick={() => set({ pattern: undefined, patternStrength: undefined })} />
        {PATTERNS.map((p, i) => (
          <Tile key={p.id} name={p.name} on={t.pattern === p.id} tabIndex={stop(at, i + 1)} testId={`pattern-${p.id}`} style={patternTile(p.id)} onPick={() => set({ pattern: p.id })} />
        ))}
      </div>
      {t.pattern && (
        <div className="te-line">
          <span className="te-sub">Strength</span>
          <Slider label="Pattern strength" min={0.1} max={1} step={0.05} value={strength} testId="pattern-strength" onChange={(v) => set({ patternStrength: v })} />
          <span className="te-value">{Math.round(strength * 100)}%</span>
        </div>
      )}
    </section>
  );
}

/**
 * The short version: a color and a background. Used where there is little room or the
 * person has only just arrived (Customize, the first-run look step).
 */
export function PresetPicker({ spaceId }: { spaceId: ID }) {
  const t = useTheme(spaceId);
  if (!t) return null;
  return (
    <>
      <Color spaceId={spaceId} theme={t} />
      <Background spaceId={spaceId} theme={t} />
    </>
  );
}

/** The editor: Mode, Color (with "Custom…"), Background, and the patterns behind "Patterns". */
export function ThemeControls({ spaceId }: { spaceId: ID }) {
  const t = useTheme(spaceId);
  if (!t) return null;
  return (
    <div className="theme-controls" data-testid="theme-controls">
      <section className="te-sec" data-inline>
        <h4 className="te-label">Mode</h4>
        <Segmented
          testId="space-mode"
          label="Mode"
          value={t.mode}
          onChange={(mode) => setTheme(spaceId, { mode })}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>
      <Color spaceId={spaceId} theme={t} custom />
      <Background spaceId={spaceId} theme={t} />
      <details className="disclosure te-more">
        <summary data-testid="theme-more">Patterns</summary>
        <Patterns spaceId={spaceId} theme={t} />
      </details>
    </div>
  );
}
