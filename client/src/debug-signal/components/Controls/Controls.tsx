import "./Controls.css";

export interface ControlsProps {
  muted?: boolean;
  onToggleMute?: () => void;
  onEnd?: () => void;
  onOpenSettings?: () => void;
}

/**
 * The three-button control row beneath the orb. All handlers are optional
 * so this can be rendered with no wiring for a pure visual preview.
 */
export function Controls({ muted = false, onToggleMute, onEnd, onOpenSettings }: ControlsProps) {
  return (
    <div className="ds-controls">
      <div className="ds-control">
        <button
          type="button"
          className="ds-control-button"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M9 9v3a3 3 0 0 0 4.6 2.55M15 9.4V6a3 3 0 0 0-5.7-1.35M5 5l14 14" />
              <path d="M19 11a7 7 0 0 1-1.02 3.66M12 19v3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>
        <span className="ds-control-label">Mute</span>
      </div>

      <div className="ds-control">
        <button type="button" className="ds-control-button ds-control-button--end" onClick={onEnd} aria-label="End session">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <span className="ds-control-label">End</span>
      </div>

      <div className="ds-control">
        <button type="button" className="ds-control-button" onClick={onOpenSettings} aria-label="Open settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.55 1.55M17.55 17.55l1.55 1.55M3 12h2.2M18.8 12H21M4.9 19.1l1.55-1.55M17.55 6.45l1.55-1.55" />
          </svg>
        </button>
        <span className="ds-control-label">Settings</span>
      </div>
    </div>
  );
}
