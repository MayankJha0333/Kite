// A Space's theme controls, the way Arc's theme editor has them: a colour (swatches or
// the wheel), how strongly it tints the window, grain, and light/dark/auto, plus one of
// Kite's own pictures. Changes apply to the window as you make them. Used by the Space
// editor and Settings › Spaces.

import { useState } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react';
import { hexToHsl } from '@shared/designTokens';
import { PLAIN, SWATCH_ROWS, gradientPatch, pairFromColor, pairFromHue, photoPatch, starterGradient, swatchOf } from '@shared/spaceTheme';
import { BACKDROPS, backdropPatch } from '@shared/backdrops';
import { backdropUrl } from '../backdrops';
import { setSpaceTheme } from '@shared/spaces';
import type { ID, SpaceTheme } from '@shared/types';
import { act, toast, useKite } from '../store';
import { addImage, ImageError, useImageUrl } from '../images';
import { mix } from '../theme';
import { Field, Segmented, Toggle } from './Sheet';

export function ThemeControls({ spaceId }: { spaceId: ID }) {
  const t = useKite((st) => st.s.spaces.find((x) => x.id === spaceId)?.theme);
  const [hue, setHue] = useState(() => (t ? Math.round(hexToHsl(t.colors[1])[0]) : 210));
  const [vivid, setVivid] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const photoUrl = useImageUrl(t?.photo?.id);
  if (!t) return null;
  const set = (patch: Partial<SpaceTheme>) => act((d) => setSpaceTheme(d, spaceId, patch));
  // A colour you pick replaces any picture or gradient: you are back on plain colours.
  const setColors = (colors: [string, string]) => set({ ...PLAIN, colors });
  const plain = !t.backdrop && !t.photo && !t.gradient;
  const on = plain ? swatchOf(t) : null;
  const g = t.gradient;
  const setGradient = (next: { colors: string[]; angle: number }) => set(gradientPatch(next));
  const css = (x: { colors: string[]; angle: number }) => `linear-gradient(${x.angle}deg, ${x.colors.join(', ')})`;
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
  const wheel = (h: number, v: number) => {
    setHue(h);
    setVivid(v);
    setColors(pairFromHue(h, v));
  };
  return (
    <div className="theme-controls" data-testid="theme-controls">
      <Field label="Background">
        <div className="backdrop-grid" role="radiogroup" aria-label="Background picture" data-testid="theme-backdrops">
          <button
            type="button"
            role="radio"
            className="backdrop-tile"
            aria-checked={plain}
            data-on={plain || undefined}
            data-testid="backdrop-none"
            title="Just colours"
            style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
            onClick={() => set(backdropPatch(null))}
          >
            <span className="backdrop-name">Colours</span>
          </button>
          <button
            type="button"
            role="radio"
            className="backdrop-tile"
            aria-checked={!!g}
            data-on={g ? true : undefined}
            data-testid="backdrop-gradient"
            title="Your own gradient"
            style={{ background: css(starterGradient(t)) }}
            onClick={() => !g && setGradient(starterGradient(t))}
          >
            <span className="backdrop-name">Gradient</span>
          </button>
          {t.photo && photoUrl && (
            <button
              type="button"
              role="radio"
              className="backdrop-tile"
              aria-checked
              data-on
              data-testid="backdrop-photo"
              title="Your picture"
              style={{ backgroundImage: `url("${photoUrl}")` }}
            >
              <span className="backdrop-name">Your picture</span>
            </button>
          )}
          <label className="backdrop-tile backdrop-upload" title="Use a picture of your own" data-testid="backdrop-upload" data-busy={busy || undefined}>
            <ImagePlus size={18} aria-hidden="true" />
            <span className="backdrop-upload-label">{busy ? 'Adding…' : t.photo ? 'Replace' : 'Upload'}</span>
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              aria-label="Upload a picture for this Space"
              data-testid="backdrop-upload-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void upload(f);
              }}
            />
          </label>
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              className="backdrop-tile"
              aria-checked={t.backdrop === b.id}
              aria-label={b.name}
              title={b.name}
              data-on={t.backdrop === b.id || undefined}
              data-tone={b.tone}
              data-testid={`backdrop-${b.id}`}
              style={{ backgroundImage: `url("${backdropUrl(b.id, true)}")` }}
              onClick={() => set(backdropPatch(b.id))}
            >
              <span className="backdrop-name">{b.name}</span>
            </button>
          ))}
        </div>
      </Field>

      {g && (
        <Field label="Gradient" hint={`${g.angle}°`}>
          <div className="grad" data-testid="gradient-editor">
            <div className="grad-preview" style={{ background: css(g) }} aria-hidden="true" />
            <div className="grad-stops">
              {g.colors.map((c, i) => (
                <span className="grad-stop" key={i}>
                  <input type="color" aria-label={`Gradient colour ${i + 1}`} data-testid={`grad-color-${i}`} value={c} onChange={(e) => setGradient({ ...g, colors: g.colors.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {g.colors.length > 2 && (
                    <button type="button" className="grad-remove" aria-label={`Remove colour ${i + 1}`} data-testid={`grad-remove-${i}`} onClick={() => setGradient({ ...g, colors: g.colors.filter((_, j) => j !== i) })}>
                      <X size={10} strokeWidth={2.6} />
                    </button>
                  )}
                </span>
              ))}
              {g.colors.length < 4 && (
                <button type="button" className="grad-add" aria-label="Add a colour" title="Add a colour" data-testid="grad-add" onClick={() => setGradient({ ...g, colors: [...g.colors.slice(0, -1), mix(g.colors[g.colors.length - 2], g.colors[g.colors.length - 1], 0.5), g.colors[g.colors.length - 1]] })}>
                  <Plus size={14} />
                </button>
              )}
            </div>
            <div className="wheel-row">
              <span className="wheel-label">Angle</span>
              <input type="range" className="range wheel-vivid" aria-label="Gradient angle" min={0} max={359} value={g.angle} data-testid="grad-angle" onChange={(e) => setGradient({ ...g, angle: Number(e.target.value) })} />
            </div>
          </div>
        </Field>
      )}

      <Field label="Colour">
        <div className="swatch-rows" data-testid="theme-swatches">
          {SWATCH_ROWS.map((row) => (
            <div className="swatches" key={row.id} role="radiogroup" aria-label={`${row.name} colours`}>
              {row.colors.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  className="swatch"
                  aria-checked={on?.row === row.id && on.index === i}
                  aria-label={`${row.name} ${i + 1}`}
                  title={`${row.name} ${i + 1}`}
                  data-testid={`swatch-${row.id}-${i + 1}`}
                  data-on={(on?.row === row.id && on.index === i) || undefined}
                  style={{ background: c }}
                  onClick={(e) => {
                    e.preventDefault();
                    setColors(pairFromColor(c));
                  }}
                />
              ))}
            </div>
          ))}
          <span className="swatch-custom" title="Your own colours">
            <span>Your own</span>
            <input type="color" aria-label="First colour" data-testid="color-a" value={t.colors[0]} onChange={(e) => setColors([e.target.value, t.colors[1]])} />
            <input type="color" aria-label="Second colour" data-testid="color-b" value={t.colors[1]} onChange={(e) => setColors([t.colors[0], e.target.value])} />
          </span>
        </div>
      </Field>

      <Field label="Colour wheel" hint={`${hue}°`}>
        <div className="wheel">
          <input type="range" className="range wheel-hue" aria-label="Hue" min={0} max={359} value={hue} data-testid="space-hue" style={{ ['--wheel-thumb' as string]: pairFromHue(hue, vivid)[1] }} onChange={(e) => wheel(Number(e.target.value), vivid)} />
          <div className="wheel-row">
            <span className="wheel-label">Vivid</span>
            <input type="range" className="range wheel-vivid" aria-label="Vividness" min={0.15} max={1} step={0.05} value={vivid} data-testid="space-vivid" onChange={(e) => wheel(hue, Number(e.target.value))} />
          </div>
        </div>
      </Field>

      <Field label="Intensity" hint={`${Math.round(t.intensity * 100)}%`}>
        <input type="range" className="range" aria-label="Intensity" min={0} max={1} step={0.05} value={t.intensity} data-testid="space-intensity" onChange={(e) => set({ intensity: Number(e.target.value) })} />
      </Field>

      <div className="field-row">
        <Field label="Appearance">
          <Segmented
            testId="space-mode"
            value={t.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Auto' },
            ]}
          />
        </Field>
        <Field label="Grain" inline>
          <Toggle checked={t.grain} onChange={(grain) => set({ grain })} testId="space-grain" label="Grain texture" />
        </Field>
      </div>
    </div>
  );
}
