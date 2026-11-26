// The first run. It takes over the page area (the sidebar stays beside it, because the
// sidebar is what is being introduced) for three short steps, each one screen, each made of
// real controls: what Kite is, where tabs live, how it looks. Return goes on, Esc skips.
//
// Kite opens it once, on a new profile (home/firstRun.ts); "Welcome to Kite" in the command
// bar opens it again. It is drawn inside the page card so that it follows the sidebar's
// side, width and hiding exactly.

import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { archiveAfterFor } from '@shared/archive';
import { formatShortcut } from '@shared/shortcuts';
import { setSpaceTheme } from '@shared/spaces';
import { activeSpace } from '@shared/tree';
import { STARTER_FAVORITES, WELCOME_STEPS, WELCOME_TEXT, forPlatform, isLastStep, setStarterFavorite, sidebarPlaces, starterFavorite, stepFrom, type WelcomeStep } from '@shared/welcome';
import { bridge, isMac, now } from '../platform';
import { act, setUi, toast, useKite } from '../store';
import { focusStartPage } from '../commands';
import { leaveForImport, takeEntrance, takeOpeningStep } from './home/firstRun';
import { KiteLogo } from './KiteLogo';
import { PresetPicker } from './ThemeEditor';
import { Segmented } from './Sheet';
import { SiteIcon } from './SiteIcon';

type Place = 'favorites' | 'pinned' | 'today';
/** The real part of the sidebar each place is. */
const PLACE_SELECTOR: Record<Place, string> = { favorites: '[data-testid="favorites"]', pinned: '[data-testid="pinned-list"]', today: '[data-testid="today-list"]' };

export function Welcome() {
  // The page card exists once the window has been laid out; the first run is drawn inside it.
  const [card, setCard] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setCard(document.querySelector<HTMLElement>('.stage > .card')), []);
  return card ? createPortal(<FirstRun />, card) : null;
}

function FirstRun() {
  const [step, setStep] = useState<WelcomeStep>(takeOpeningStep);
  // Only the first run Kite opens by itself, on its first screen, makes an entrance.
  const [arriving] = useState(() => takeEntrance() && step === 'hello');
  const entrance = arriving && step === 'hello';
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const text = WELCOME_TEXT[step];
  const index = WELCOME_STEPS.indexOf(step);

  const close = () => {
    setUi({ panel: null, panelArg: undefined });
    // Straight into the search field of the start page, if that is what is underneath.
    focusStartPage();
  };
  const next = () => (isLastStep(step) ? close() : setStep(stepFrom(step, 1)));

  // Each step starts with the keyboard on its title: Return and Esc work at once, and a screen reader says where you are.
  useEffect(() => title.current?.focus({ preventScroll: true }), [step]);

  // Return goes on and Esc skips, from anywhere in the first run or with nothing focused.
  // Keys typed into the command bar, a menu or the sidebar are theirs.
  const keys = useRef({ next, close });
  keys.current = { next, close };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !(t === document.body || root.current?.contains(t))) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        keys.current.close();
      } else if (e.key === 'Enter' && !t.closest('button, a, select, textarea, input:not([type="checkbox"])')) {
        e.preventDefault();
        keys.current.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section ref={root} className="first-run" data-testid="welcome" data-step={step} data-entrance={entrance || undefined} aria-labelledby="first-run-title">
      <div className="contour-field" aria-hidden="true" />
      <div className="first-run-scroll">
        <div className="first-run-col">
          {step === 'hello' && (
            <div className="first-run-mark">
              <KiteLogo size={40} />
            </div>
          )}
          <h1 ref={title} id="first-run-title" className="first-run-title" tabIndex={-1}>
            {text.title}
          </h1>
          {/* The string is how far along the three steps are: Kite's one progress line. */}
          <span className="thread first-run-string" aria-hidden="true" style={{ '--p': (index + 1) / WELCOME_STEPS.length } as React.CSSProperties} />
          <p className="first-run-lede">{forPlatform(text.body, isMac)}</p>

          {step === 'hello' && <Hello />}
          {step === 'sidebar' && <SidebarStep onTried={() => setStep('look')} />}
          {step === 'look' && <Look />}

          <footer className="first-run-foot">
            <span className="first-run-progress" data-testid="welcome-step" aria-label={`Step ${index + 1} of ${WELCOME_STEPS.length}`}>
              {index + 1} of {WELCOME_STEPS.length}
            </span>
            <span className="spacer" />
            {!isLastStep(step) && (
              <button className="btn ghost" data-testid="welcome-skip" onClick={close}>
                Skip
              </button>
            )}
            {index > 0 && (
              <button className="btn" data-testid="welcome-back" onClick={() => setStep(stepFrom(step, -1))}>
                Back
              </button>
            )}
            <button className="btn primary" data-testid={isLastStep(step) ? 'welcome-done' : 'welcome-next'} onClick={next}>
              {step === 'hello' ? 'Get started' : isLastStep(step) ? 'Start browsing' : 'Continue'}
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}

/** Step 1. Only people who have Arc's data on this computer are offered the way across. */
function Hello() {
  const [hasArc, setHasArc] = useState(false);
  useEffect(() => {
    let live = true;
    void bridge
      .readDefaultArcFile()
      .then((f) => live && setHasArc(!!f))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!hasArc) return <div data-testid="welcome-hello" />;
  return (
    <p className="first-run-aside" data-testid="welcome-hello">
      Coming from Arc?{' '}
      <button className="link" data-testid="welcome-import-go" onClick={() => leaveForImport('hello')}>
        Bring your Spaces and pinned tabs
      </button>
    </p>
  );
}

/** Step 2. The three places, pointing at the real sidebar; the command bar, by pressing it; a few Favorites, by ticking them. */
function SidebarStep({ onTried }: { onTried: () => void }) {
  const keysText = useKite((st) => formatShortcut(st.s.settings.shortcuts.commandBar, isMac));
  const after = useKite((st) => archiveAfterFor(st.s, st.s.activeSpaceId));
  const [place, setPlace] = useState<Place | null>(null);
  const show = (p: Place | null) => ({ onMouseEnter: () => setPlace(p), onMouseLeave: () => setPlace(null), onFocus: () => setPlace(p), onBlur: () => setPlace(null) });

  // Pressing the shortcut opens the real command bar. Once it closes again (a page opened, or Esc), this step is done.
  const barOpen = useKite((st) => !!st.ui.commandBar);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !barOpen) onTried();
    wasOpen.current = barOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barOpen]);

  return (
    <div className="first-run-body" data-testid="welcome-sidebar">
      <ul className="first-run-places">
        {sidebarPlaces(after).map((p) => (
          <li key={p.id} tabIndex={0} data-testid={`welcome-place-${p.id}`} {...show(p.id)}>
            <strong>{p.name}</strong>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>

      <p className="first-run-habit" data-testid="welcome-habit">
        Press <Keys text={keysText} /> to open or find anything.
      </p>

      <section className="first-run-starters" aria-labelledby="first-run-starters" {...show('favorites')}>
        <h2 className="section-label" id="first-run-starters">
          Start with a few Favorites, if you like
        </h2>
        <div className="first-run-picks">
          {STARTER_FAVORITES.map((f) => (
            <Starter key={f.url} site={f} />
          ))}
        </div>
      </section>
      {place && <SidebarMark place={place} />}
    </div>
  );
}

/** A shortcut as key caps: "⌘T" is two keys, "Ctrl+T" is two as well. */
function Keys({ text }: { text: string }) {
  const keys = text.includes('+') ? text.split('+') : [...text];
  return (
    <span className="first-run-keys" aria-label={text}>
      {keys.map((k, i) => (
        <kbd className="kbd" key={i} aria-hidden="true">
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** A starter site: ticking it puts it in the real Favorites at once, unticking takes it out. */
function Starter({ site }: { site: { name: string; url: string } }) {
  const on = useKite((st) => !!starterFavorite(st.s, site.url));
  return (
    <label className="first-run-pick" data-on={on || undefined}>
      <input type="checkbox" className="checkbox" checked={on} aria-label={`Add ${site.name} to Favorites`} data-testid={`welcome-starter-${site.name.toLowerCase()}`} onChange={(e) => act((d) => setStarterFavorite(d, site, e.target.checked, now()))} />
      <span className="first-run-pick-plate">
        <SiteIcon url={site.url} title={site.name} size={18} />
      </span>
      <span className="first-run-pick-name">{site.name}</span>
    </label>
  );
}

/**
 * Shows which part of the real sidebar a line is about: a quiet fill over that region,
 * or a short rule where the region is still empty. Drawn over the window, so the sidebar
 * itself is not touched. It appears and goes at once; nothing pulses.
 */
function SidebarMark({ place }: { place: Place }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const app = document.querySelector<HTMLElement>('[data-testid="app"]');
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="sidebar"] ${PLACE_SELECTOR[place]}`);
    if (!el || !app) return setBox(null);
    const r = el.getBoundingClientRect();
    const o = app.getBoundingClientRect();
    // A place still empty has no height to fill: mark the line where its first item will go.
    setBox(r.width > 0 ? { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height } : null);
  }, [place, app]);
  if (!box || !app) return null;
  return createPortal(<div className="first-run-pointer" data-empty={box.height < 12 || undefined} style={box} aria-hidden="true" />, app);
}

/** Step 3. Light or dark, the Space's look, and the default-browser question. All of it applies to the real window as it is chosen. */
function Look() {
  const spaceId = useKite((st) => st.s.activeSpaceId);
  const mode = useKite((st) => activeSpace(st.s).theme.mode);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  useEffect(() => {
    void bridge.isDefaultBrowser().then(setIsDefault);
  }, []);
  const makeDefault = async () => {
    const ok = await bridge.setDefaultBrowser();
    setIsDefault(ok);
    if (!ok) toast(isMac ? 'Kite couldn’t become the default browser. You can choose it in System Settings › Desktop & Dock.' : 'Kite couldn’t become the default browser. You can choose it in your system’s settings.');
  };
  return (
    <div className="first-run-body" data-testid="welcome-look">
      <div className="theme-controls" data-testid="welcome-theme">
        <section className="te-sec" data-inline>
          <h4 className="te-label">Mode</h4>
          <Segmented
            testId="welcome-mode"
            label="Mode"
            value={mode}
            onChange={(m) => act((d) => setSpaceTheme(d, spaceId, { mode: m }))}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </section>
        <PresetPicker spaceId={spaceId} />
      </div>

      <div className="first-run-default">
        <span>Links you click in other apps can open in Kite.</span>
        {isDefault ? (
          <span className="first-run-done" data-testid="welcome-is-default">
            <Check size={16} aria-hidden="true" /> Kite is your default browser
          </span>
        ) : (
          <button className="btn" data-testid="welcome-default" disabled={isDefault === null} onClick={() => void makeDefault()}>
            Make Kite your default browser
          </button>
        )}
      </div>
    </div>
  );
}
