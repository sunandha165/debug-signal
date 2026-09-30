import React from "react";
import type { SessionInfo as SessionInfoType } from "../../types";
import "./SessionInfo.css";

export interface SessionInfoProps {
  session: SessionInfoType;
}

const statusLabel: Record<SessionInfoType["status"], string> = {
  investigating: "Investigating",
  resolved: "Resolved",
  paused: "Paused",
};

/**
 * Read-only summary card for the current debug session's metadata.
 */
export function SessionInfo({ session }: SessionInfoProps) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Repository", session.repository],
    ["Branch", session.branch],
    ["Started", session.startedAt],
    [
      "Status",
      <span key="status" className={`ds-session-status ds-session-status--${session.status}`}>
        <span className="ds-session-status-dot" aria-hidden="true" />
        {statusLabel[session.status]}
      </span>,
    ],
    ["Interruption mode", session.interruptionMode],
    ["Voice agent", session.voiceAgent],
  ];

  return (
    <section className="ds-card ds-session-info" aria-label="Session info">
      <h3 className="ds-card-title ds-session-info-title">Session info</h3>
      <dl className="ds-session-info-list">
        {rows.map(([label, value]) => (
          <div className="ds-session-info-row" key={label as string}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
