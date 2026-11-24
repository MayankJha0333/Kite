// The Welcome tour: hello, import from Arc, pick a theme, finish. A sheet like the other
// panels; opened from the command bar, so it never gets in the way by itself.

import { useEffect, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { WELCOME_STEPS, WELCOME_TEXT, isLastStep, stepFrom, type WelcomeStep } from '@shared/welcome';
import { bridge } from '../platform';
import { setUi, toast, useKite } from '../store';
import { KiteLogo } from './KiteLogo';
import { PresetPicker } from './ThemeEditor';
import { Sheet } from './Sheet';

export function Welcome() {
  const [step, setStep] = useState<WelcomeStep>('hello');
  const spaceId = useKite((st) => st.s.activeSpaceId);
  const shieldsOn = useKite((st) => st.s.settings.shields.enabled);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  useEffect(() => {
    void bridge.isDefaultBrowser().then(setIsDefault);
  }, []);
  const text = WELCOME_TEXT[step];
  const index = WELCOME_STEPS.indexOf(step);
  const close = () => setUi({ panel: null, panelArg: undefined });
  const makeDefault = async () => {
    const ok = await bridge.setDefaultBrowser();
    setIsDefault(ok);
    toast(ok ? 'Kite is now your default browser' : 'Kite couldn’t become the default. Try from System Settings.');
  };
  return (
    <Sheet
      title={text.title}
      subtitle={text.body}
      testId="welcome"
      wide={step === 'theme'}
      footer={
        <>
          <span className="welcome-dots" role="img" aria-label={`Step ${index + 1} of ${WELCOME_STEPS.length}`} data-testid="welcome-step">
            {WELCOME_STEPS.map((s) => <i key={s} data-on={s === step || undefined} />)}
          </span>
          <span className="spacer" />
          {index > 0 && <button className="btn small ghost" data-testid="welcome-back" onClick={() => setStep(stepFrom(step, -1))}>Back</button>}
          {isLastStep(step) ? (
            <button className="btn small" data-testid="welcome-done" onClick={close}>Start browsing</button>
          ) : (
            <button className="btn small" data-testid="welcome-next" onClick={() => setStep(stepFrom(step, 1))}>{step === 'import' ? 'Skip' : 'Continue'}</button>
          )}
        </>
      }
    >
      {step === 'hello' && (
        <div className="welcome-hero" data-testid="welcome-hello">
          <KiteLogo size={64} />
        </div>
      )}
      {step === 'import' && (
        <div className="welcome-block" data-testid="welcome-import">
          <button className="btn" data-testid="welcome-import-go" onClick={() => setUi({ panel: 'import' })}>
            <Download size={14} /> Import from Arc…
          </button>
          <p className="muted">Kite shows a preview first. Nothing is added until you press Import.</p>
        </div>
      )}
      {step === 'theme' && (
        <div className="theme-controls" data-testid="welcome-theme">
          <PresetPicker spaceId={spaceId} />
        </div>
      )}
      {step === 'finish' && (
        <div className="welcome-block" data-testid="welcome-finish">
          <div className="welcome-line">
            <span>{isDefault ? 'Kite is your default browser' : 'Open links from other apps in Kite'}</span>
            {isDefault ? <Check size={16} aria-hidden="true" /> : <button className="btn small" data-testid="welcome-default" onClick={() => void makeDefault()}>Make default</button>}
          </div>
          <div className="welcome-line">
            <span>{shieldsOn ? 'Shields are on: ads and trackers are blocked' : 'Shields are off'}</span>
            <button className="btn small ghost" data-testid="welcome-shields" onClick={() => setUi({ panel: 'settings', panelArg: 'adblock' })}>Ad blocking settings</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
