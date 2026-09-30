import type {
  ConversationMessage,
  EvidenceSummary,
  InvestigationStep,
  SessionInfo,
  NavItem,
} from "./types";

export const mockNavItems: NavItem[] = [
  { id: "home", label: "Home", active: true },
  { id: "repositories", label: "Repositories" },
  { id: "debug-sessions", label: "Debug Sessions" },
  { id: "settings", label: "Settings" },
];

export const mockConversation: ConversationMessage[] = [
  {
    id: "m1",
    speaker: "developer",
    authorName: "You",
    timestamp: "10:24 AM",
    text: "Our checkout flow is timing out. It started happening this week.",
  },
  {
    id: "m2",
    speaker: "assistant",
    authorName: "DebugSignal",
    timestamp: "10:24 AM",
    text: "Got it. I'll investigate the recent changes related to the checkout flow and payment configuration. I'll stay quiet unless I find something important.",
  },
];

export const mockInvestigationSteps: InvestigationStep[] = [
  {
    id: "s1",
    label: "Searching commit history",
    description: "Looking for relevant changes...",
    status: "done",
  },
  {
    id: "s2",
    label: "Analyzing code differences",
    description: "Checking 12 commits...",
    status: "done",
  },
  {
    id: "s3",
    label: "Evaluating evidence",
    description: "Scoring relevance...",
    status: "active",
  },
  {
    id: "s4",
    label: "Ready when needed",
    description: "I'll speak up if I find something important.",
    status: "pending",
  },
];

export const mockEvidence: EvidenceSummary = {
  found: true,
  confidencePercent: 96,
  headline: "This change likely introduced the issue.",
  commit: {
    sha: "a3f9c1e",
    message: "Update payment timeout configuration",
    author: "M. Alvarez",
    date: "Tue, Sep 2, 2025, 2:14 PM",
    tags: ["backend", "config"],
    filePath: "src/config/payment.ts",
    diff: [
      { lineNumber: 12, kind: "remove", code: "timeout: 30000," },
      { lineNumber: 12, kind: "add", code: "timeout: 5000," },
    ],
  },
  relatedCommits: [
    { sha: "b7c2d9a", message: "Add retry logic", date: "Sep 1, 2025" },
    { sha: "e4f8a1c", message: "Refactor payment service", date: "Aug 30, 2025" },
    { sha: "c2d9e7b", message: "Update API client", date: "Aug 28, 2025" },
  ],
};

export const mockSessionInfo: SessionInfo = {
  repository: "debug-signal",
  branch: "main",
  startedAt: "Sep 5, 2025, 10:24 AM",
  status: "investigating",
  interruptionMode: "Smart (high confidence)",
  voiceAgent: "AssemblyAI",
};
