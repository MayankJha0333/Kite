import { describe, expect, it } from 'vitest';
import { WELCOME_STEPS, WELCOME_TEXT, isLastStep, stepFrom } from '@shared/welcome';
import { ACTION_CATALOG } from '@shared/commandbar';

describe('Welcome tour', () => {
  it('has four steps in order, each with a title and text', () => {
    expect(WELCOME_STEPS).toEqual(['hello', 'import', 'theme', 'finish']);
    for (const s of WELCOME_STEPS) {
      expect(WELCOME_TEXT[s].title.length).toBeGreaterThan(3);
      expect(WELCOME_TEXT[s].body.length).toBeGreaterThan(10);
    }
  });

  it('moves forward and back, and stops at both ends', () => {
    expect(stepFrom('hello', 1)).toBe('import');
    expect(stepFrom('import', 1)).toBe('theme');
    expect(stepFrom('theme', 1)).toBe('finish');
    expect(stepFrom('finish', 1)).toBe('finish');
    expect(stepFrom('finish', -1)).toBe('theme');
    expect(stepFrom('hello', -1)).toBe('hello');
    expect(stepFrom('nope' as never, 1)).toBe('import');
    expect(WELCOME_STEPS.filter(isLastStep)).toEqual(['finish']);
  });

  it('can be opened by name from the command bar', () => {
    expect(ACTION_CATALOG.find((a) => a.id === 'welcome')?.title).toBe('Welcome to Kite');
  });
});
