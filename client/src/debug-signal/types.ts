/**
 * Shared types for the DebugSignal reference UI.
 * These describe only what the presentational components need as props —
 * there is no fetching, sockets, or persistence logic here by design.
 */

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface ConversationMessage {
  id: string;
  speaker: "developer" | "assistant";
  authorName: string;
  timestamp: string;
  text: string;
}

export type InvestigationStepStatus = "done" | "active" | "pending";

export interface InvestigationStep {
  id: string;
  label: string;
  description: string;
  status: InvestigationStepStatus;
}

export interface DiffLine {
  lineNumber: number;
  kind: "add" | "remove" | "context";
  code: string;
}

export interface EvidenceCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  tags: string[];
  filePath: string;
  diff: DiffLine[];
}

export interface RelatedCommit {
  sha: string;
  message: string;
  date: string;
}

export interface EvidenceSummary {
  found: boolean;
  confidencePercent: number;
  headline: string;
  commit: EvidenceCommit;
  relatedCommits: RelatedCommit[];
}

export type SessionStatus = "investigating" | "resolved" | "paused";

export interface SessionInfo {
  repository: string;
  branch: string;
  startedAt: string;
  status: SessionStatus;
  interruptionMode: string;
  voiceAgent: string;
}

export interface NavItem {
  id: string;
  label: string;
  active?: boolean;
}
