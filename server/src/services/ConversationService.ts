import {
  ConversationContext,
  ConversationMessage,
  InvestigationCandidate,
} from "../types/ConversationContext";

// ---------------------------------------------------------------------------
// Stop-words: terms that carry no debugging signal and should be removed
// before building an investigation query.
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "is", "are", "was", "were", "a", "an", "and", "or",
  "to", "of", "in", "on", "for", "with", "from", "this", "that",
  "there", "when", "actually", "think", "might", "could", "would",
  "having", "has", "have", "had", "been", "being",
  "problem", "issue", "something", "anything", "nothing",
  "started", "start", "starting", "recently", "just", "still",
  "causing", "cause", "caused", "seems", "seem", "looked", "looks",
  "maybe", "perhaps", "also", "very", "really", "bit",
  "debugging", "debug", "code", "project", "change", "changed",
  "frontend", "backend", "related", "think", "now", "going",
]);

// ---------------------------------------------------------------------------
// Phrase normalisation: expand common speech patterns to canonical tokens
// so they match commit-message vocabulary.
// ---------------------------------------------------------------------------

function normalisePhrases(text: string): string {
  return text
    .toLowerCase()
    .replace(/\btiming out\b/g, "timeout")
    .replace(/\btimed out\b/g, "timeout")
    .replace(/\btime out\b/g, "timeout")
    .replace(/\btimes out\b/g, "timeout")
    .replace(/[.,!?;:'"()\[\]]/g, " ");
}

// ---------------------------------------------------------------------------
// Debugging-signal words: at least one must appear for a message to be
// considered a genuine debugging hypothesis worth investigating.
// ---------------------------------------------------------------------------

const DEBUGGING_SIGNALS = [
  "bug", "error", "issue", "problem", "fail", "failing", "failed",
  "timeout", "crash", "crashing", "slow", "broken", "exception",
  "regression", "outage", "latency", "hung", "hang",
];

function containsDebuggingSignal(text: string): boolean {
  // Normalise phrases first so "timing out" becomes "timeout", etc.
  const normalised = normalisePhrases(text);
  return DEBUGGING_SIGNALS.some(signal => normalised.includes(signal));
}

// ---------------------------------------------------------------------------
// Extract meaningful keywords from a single normalised string.
// Returns deduplicated tokens longer than 2 chars that are not stop-words.
// ---------------------------------------------------------------------------

function extractKeywords(normalisedText: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const word of normalisedText.split(/\s+/)) {
    if (word.length > 2 && !STOP_WORDS.has(word) && !seen.has(word)) {
      seen.add(word);
      result.push(word);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// ConversationService
// ---------------------------------------------------------------------------

export class ConversationService {
  private readonly maxMessages = 10;

  private context: ConversationContext = {
    messages: [],
    candidate: null,
  };

  addDeveloperMessage(
    text: string
  ): ConversationContext {
    const message: ConversationMessage = {
      role: "developer",
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    this.context.messages.push(message);

    this.trimContext();

    this.context.candidate =
      this.extractCandidate();

    return this.getContext();
  }

  getContext(): ConversationContext {
    return {
      messages: [...this.context.messages],
      candidate: this.context.candidate,
    };
  }

  clearContext(): void {
    this.context = {
      messages: [],
      candidate: null,
    };
  }

  private trimContext(): void {
    if (
      this.context.messages.length >
      this.maxMessages
    ) {
      this.context.messages =
        this.context.messages.slice(
          -this.maxMessages
        );
    }
  }

  private extractCandidate():
    InvestigationCandidate | null {

    const developerMessages =
      this.context.messages
        .filter(m => m.role === "developer")
        .map(m => m.text);

    if (developerMessages.length === 0) {
      return null;
    }

    // Check whether any message contains a debugging signal at all.
    const combinedRaw = developerMessages.join(" ");
    if (!containsDebuggingSignal(combinedRaw)) {
      return null;
    }

    /*
     * Query construction strategy:
     *
     * 1. Start from the MOST RECENT developer message.  It carries the
     *    current hypothesis and should dominate the query.
     * 2. Add context keywords from earlier messages (up to 2 previous) only
     *    when they are not already represented.
     * 3. Cap total keywords at 6 so the query stays focused.
     */

    const latest = developerMessages[developerMessages.length - 1];
    const latestNorm = normalisePhrases(latest);
    const primaryKeywords = extractKeywords(latestNorm);

    // Count how many debugging signals the latest message triggered.
    const latestSignals = DEBUGGING_SIGNALS.filter(s =>
      latestNorm.includes(s)
    );

    // Supplement with context from recent earlier messages.
    const contextKeywords: string[] = [];
    const seen = new Set(primaryKeywords);

    const recentPrevious = developerMessages
      .slice(0, -1)
      .slice(-2);

    for (const prev of recentPrevious) {
      const prevNorm = normalisePhrases(prev);
      for (const kw of extractKeywords(prevNorm)) {
        if (!seen.has(kw)) {
          seen.add(kw);
          contextKeywords.push(kw);
        }
      }
    }

    // Combine: primary keywords first, then context fill-in, capped at 6.
    const allKeywords = [
      ...primaryKeywords,
      ...contextKeywords,
    ].slice(0, 6);

    if (allKeywords.length === 0) {
      return null;
    }

    const query = allKeywords.join(" ");

    // Confidence is based on how many distinct debugging signals we found.
    const signalCount = latestSignals.length;
    const confidence = Math.min(0.5 + signalCount * 0.15, 0.9);

    return {
      query,
      sourceText: combinedRaw,
      confidence,
    };
  }
}
