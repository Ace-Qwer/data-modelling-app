import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { UiStore } from './ui-store';

export function AboutDialog({ ui }: { ui: UiStore }) {
  const open = useStore(ui, (s) => s.aboutOpen);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ui.getState().closeAbout();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, ui]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <h2 id="about-title">Data Modelling App</h2>
        <p>Version {__APP_VERSION__}</p>
        <button
          type="button"
          autoFocus
          onClick={() => {
            ui.getState().closeAbout();
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
