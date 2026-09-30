import type { EvidenceSummary } from "../../types";
import "./Evidence.css";

export interface EvidencePanelProps {
  evidence: EvidenceSummary;
  onViewInGitHub?: () => void;
  onViewFullDiff?: () => void;
  onViewMoreCommits?: () => void;
}

/**
 * Right-hand evidence panel: a confidence summary for the strongest lead,
 * the offending commit with a diff preview, and a short list of related
 * commits for context.
 */
export function EvidencePanel({
  evidence,
  onViewInGitHub,
  onViewFullDiff,
  onViewMoreCommits,
}: EvidencePanelProps) {
  const { commit } = evidence;

  return (
    <section className="ds-card ds-evidence" aria-label="Evidence">
      <header className="ds-evidence-header">
        <h3 className="ds-card-title">Evidence</h3>
        <button type="button" className="ds-evidence-link" onClick={onViewInGitHub}>
          View in GitHub
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </button>
      </header>

      <div className="ds-evidence-body">
        <div className="ds-evidence-summary">
          <span className="ds-evidence-summary-icon" aria-hidden="true">
            ✦
          </span>
          <div className="ds-evidence-summary-text">
            <div className="ds-evidence-summary-title-row">
              <p className="ds-evidence-summary-title">
                {evidence.found ? "Strong evidence found" : "No strong evidence yet"}
              </p>
              <span className="ds-evidence-confidence">{evidence.confidencePercent}%</span>
            </div>
            <p className="ds-evidence-summary-sub">{evidence.headline}</p>
          </div>
        </div>

        <div className="ds-evidence-commit">
          <div className="ds-evidence-commit-header">
            <span className="ds-evidence-commit-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.52.1.72-.23.72-.5v-1.83c-2.94.64-3.56-1.4-3.56-1.4-.48-1.22-1.18-1.55-1.18-1.55-.96-.66.07-.64.07-.64 1.07.08 1.63 1.1 1.63 1.1.94 1.62 2.47 1.15 3.08.88.1-.68.37-1.15.67-1.42-2.35-.27-4.82-1.17-4.82-5.22 0-1.15.41-2.1 1.09-2.83-.11-.27-.47-1.36.1-2.83 0 0 .89-.29 2.92 1.08a10.1 10.1 0 0 1 5.32 0c2.03-1.37 2.92-1.08 2.92-1.08.57 1.47.21 2.56.1 2.83.68.73 1.09 1.68 1.09 2.83 0 4.06-2.48 4.95-4.84 5.21.38.33.72.97.72 1.96v2.9c0 .27.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z" />
              </svg>
            </span>
            <div className="ds-evidence-commit-meta">
              <span className="ds-evidence-commit-sha">{commit.sha}</span>
              <span className="ds-evidence-commit-date">{commit.date}</span>
            </div>
          </div>

          <p className="ds-evidence-commit-message">{commit.message}</p>

          <div className="ds-evidence-tags">
            {commit.tags.map((tag) => (
              <span key={tag} className="ds-evidence-tag">
                {tag}
              </span>
            ))}
          </div>

          <div className="ds-diff">
            <div className="ds-diff-file">{commit.filePath}</div>
            {commit.diff.map((line, i) => (
              <div key={i} className={`ds-diff-line ds-diff-line--${line.kind}`}>
                <span className="ds-diff-line-number">{line.lineNumber}</span>
                <span className="ds-diff-line-symbol">
                  {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
                </span>
                <code className="ds-diff-line-code">{line.code}</code>
              </div>
            ))}
          </div>

          <button type="button" className="ds-evidence-link ds-evidence-link--diff" onClick={onViewFullDiff}>
            View full diff
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ds-related-commits">
        <h4 className="ds-related-commits-title">Related commits</h4>
        <ul className="ds-related-commits-list">
          {evidence.relatedCommits.map((c) => (
            <li key={c.sha} className="ds-related-commit">
              <span className="ds-related-commit-sha">{c.sha}</span>
              <span className="ds-related-commit-message">{c.message}</span>
              <span className="ds-related-commit-date">{c.date}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="ds-evidence-link" onClick={onViewMoreCommits}>
          View more
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
