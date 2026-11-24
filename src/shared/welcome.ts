// The Welcome tour: four short steps a new user can walk through (or skip at any point).
// Opened from the command bar ("Welcome to Kite"); nothing here runs by itself.

export type WelcomeStep = 'hello' | 'import' | 'theme' | 'finish';
export const WELCOME_STEPS: readonly WelcomeStep[] = ['hello', 'import', 'theme', 'finish'];

export const WELCOME_TEXT: Record<WelcomeStep, { title: string; body: string }> = {
  hello: { title: 'Welcome to Kite', body: 'A calm, sidebar-first browser. Everything stays on this computer: no account, no server, nothing to sign in to.' },
  import: { title: 'Bring your Arc setup across', body: 'Kite can read Arc’s sidebar file and bring in your Spaces, pinned tabs, folders and Favorites. It never reads passwords, cookies or history.' },
  theme: { title: 'Make Kite yours', body: 'Pick a look and a pattern. The window changes as you choose, and every Space can have its own.' },
  finish: { title: 'You’re set', body: 'You can change any of this later in Settings.' },
};

/** The step before (-1) or after (+1) this one; stays put at either end. */
export function stepFrom(step: WelcomeStep, dir: 1 | -1): WelcomeStep {
  const i = WELCOME_STEPS.indexOf(step);
  return WELCOME_STEPS[Math.max(0, Math.min(WELCOME_STEPS.length - 1, (i < 0 ? 0 : i) + dir))];
}

export const isLastStep = (step: WelcomeStep) => step === WELCOME_STEPS[WELCOME_STEPS.length - 1];
