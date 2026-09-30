import type { InvestigationStep } from "../../types";
import "./InvestigationSteps.css";

export interface InvestigationStepsProps {
  steps: InvestigationStep[];
  title?: string;
}

/**
 * Vertical checklist of investigation phases (done / active / pending),
 * shown beside the orb while DebugSignal works quietly in the background.
 */
export function InvestigationSteps({ steps, title = "Investigating quietly…" }: InvestigationStepsProps) {
  return (
    <div className="ds-steps">
      <div className="ds-steps-title">
        <span className="ds-steps-title-spinner" aria-hidden="true" />
        {title}
      </div>
      <ol className="ds-steps-list">
        {steps.map((step) => (
          <li key={step.id} className={`ds-step ds-step--${step.status}`}>
            <span className="ds-step-marker" aria-hidden="true">
              {step.status === "done" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17 19 7" />
                </svg>
              )}
              {step.status === "active" && <span className="ds-step-marker-dot" />}
            </span>
            <div className="ds-step-text">
              <p className="ds-step-label">{step.label}</p>
              <p className="ds-step-description">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
