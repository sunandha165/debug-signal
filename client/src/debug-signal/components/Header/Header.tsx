import type { ConnectionStatus } from "../../types";
import "./Header.css";

export interface HeaderProps {
  repository: string;
  branch: string;
  connectionStatus?: ConnectionStatus;
  userInitial?: string;
}

const statusLabel: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
};

/**
 * Top bar: product mark, active repo/branch pickers (display-only here),
 * connection status, and the current user's avatar.
 */
export function Header({
  repository,
  branch,
  connectionStatus = "connected",
  userInitial = "S",
}: HeaderProps) {
  return (
    <header className="ds-header">
      <div className="ds-header-brand">
        <span className="ds-header-mark" aria-hidden="true">
          <span className="ds-header-mark-bar" />
          <span className="ds-header-mark-bar" />
          <span className="ds-header-mark-bar" />
          <span className="ds-header-mark-bar" />
        </span>
        <div className="ds-header-title">
          <span className="ds-header-name">
            Debug<span className="ds-header-name-accent">Signal</span>
          </span>
          <span className="ds-header-tagline">Your AI pair programmer for production issues</span>
        </div>
      </div>

      <div className="ds-header-context">
        <button type="button" className="ds-header-pill" aria-label={`Repository: ${repository}`}>
          <span className="ds-header-pill-icon" aria-hidden="true">
            ⌥
          </span>
          {repository}
          <span className="ds-header-pill-caret" aria-hidden="true">
            ⌄
          </span>
        </button>
        <button type="button" className="ds-header-pill" aria-label={`Branch: ${branch}`}>
          <span className="ds-header-pill-icon" aria-hidden="true">
            ⑂
          </span>
          {branch}
          <span className="ds-header-pill-caret" aria-hidden="true">
            ⌄
          </span>
        </button>
      </div>

      <div className="ds-header-right">
        <span className={`ds-status-dot ds-status-dot--${connectionStatus}`} aria-hidden="true" />
        <span className="ds-header-status-label">{statusLabel[connectionStatus]}</span>
        <span className="ds-header-avatar">{userInitial}</span>
      </div>
    </header>
  );
}
