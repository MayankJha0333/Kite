import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import * as ops from '@shared/ops';
import { getS, setUi, useKite } from '../store';
import { surface } from '../surfaces';

/** Find-in-page bar (⌘F): type to search, Enter / ⇧Enter step through matches. */
export function FindBar() {
  const open = useKite((st) => st.ui.findOpen);
  const result = useKite((st) => st.ui.findResult);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [open]);
  if (!open) return null;
  const h = () => surface(ops.activeTab(getS())?.id);
  const close = () => {
    h()?.stopFind();
    setUi({ findOpen: false, findResult: null });
    h()?.focus();
  };
  const none = !!q && result !== null && result.total === 0;
  const count = q && result && result.total > 0 ? `${result.active} of ${result.total}` : none ? 'No matches' : '';
  return (
    <div className="find-bar" data-testid="find-bar" role="search" data-none={none || undefined}>
      <input
        ref={ref}
        value={q}
        placeholder="Find in page"
        aria-label="Find in page"
        data-testid="find-input"
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value) h()?.find(e.target.value);
          else {
            h()?.stopFind();
            setUi({ findResult: null });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            h()?.find(q, !e.shiftKey);
          }
          if (e.key === 'Escape') close();
        }}
      />
      <span className="find-count" data-testid="find-count" aria-live="polite">{count}</span>
      <button className="icon-btn" aria-label="Previous match" title="Previous match (⇧↩)" disabled={!q} onClick={() => h()?.find(q, false)}><ChevronUp size={14} /></button>
      <button className="icon-btn" aria-label="Next match" title="Next match (↩)" disabled={!q} onClick={() => h()?.find(q, true)}><ChevronDown size={14} /></button>
      <button className="icon-btn" aria-label="Close find" title="Close (esc)" onClick={close}><X size={14} /></button>
    </div>
  );
}
