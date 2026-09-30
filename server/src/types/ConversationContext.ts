export interface ConversationMessage {
  role: "developer" | "assistant";
  text: string;
  timestamp: string;
}

export interface InvestigationCandidate {
  query: string;
  sourceText: string;
  confidence: number;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  candidate: InvestigationCandidate | null;
}