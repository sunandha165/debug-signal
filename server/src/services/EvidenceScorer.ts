import { GitCommit } from "../interfaces/GitRepository";

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface EvidenceScore {
  commit: GitCommit;
  score: number;
  reasons: string[];
  /** Human-readable summary of the most significant diff change, if any. */
  diffSummary?: string;
}

// ---------------------------------------------------------------------------
// Diff summary extraction
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a concrete human-readable summary of the most
 * significant change in the diff — particularly numeric/configuration
 * value changes.
 *
 * Examples of what this produces:
 *   "PAYMENT_TIMEOUT changed from 30000 to 5000"
 *   "MAX_RETRIES changed from 3 to 10"
 *
 * Returns undefined when no clear value change can be identified.
 */
function extractDiffSummary(
  addedLines: string[],
  removedLines: string[]
): string | undefined {
  // Look for lines that change a named constant / variable assignment.
  // Pattern: IDENTIFIER = <old_value>  →  IDENTIFIER = <new_value>
  //          or IDENTIFIER: <old_value>  →  IDENTIFIER: <new_value>

  const assignmentPattern =
    /([A-Z_][A-Z0-9_]{2,}|[a-z][a-zA-Z0-9_]{2,})\s*[=:]\s*(\d[\d.,]*)/;

  interface NamedValue {
    name: string;
    value: string;
  }

  function parseAssignment(line: string): NamedValue | null {
    // Strip the leading +/- diff marker.
    const stripped = line.replace(/^[+-]/, "").trim();
    const match = assignmentPattern.exec(stripped);
    if (!match) return null;
    return { name: match[1], value: match[2] };
  }

  // Build a map of name → value for added lines and removed lines.
  const added: Map<string, string> = new Map();
  const removed: Map<string, string> = new Map();

  for (const line of addedLines) {
    const parsed = parseAssignment(line);
    if (parsed) added.set(parsed.name, parsed.value);
  }

  for (const line of removedLines) {
    const parsed = parseAssignment(line);
    if (parsed) removed.set(parsed.name, parsed.value);
  }

  // Find names that appear in both — these are genuine value changes.
  for (const [name, newValue] of added) {
    const oldValue = removed.get(name);
    if (oldValue !== undefined && oldValue !== newValue) {
      return `${name} changed from ${oldValue} to ${newValue}`;
    }
  }

  return undefined;
}

export class EvidenceScorer {
  score(
    query: string,
    commit: GitCommit,
    diff: string
  ): EvidenceScore {
    const normalizedQuery = normalizeText(query);
    const message = normalizeText(commit.message);
    const normalizedDiff = normalizeText(diff);

    let score = 0;
    const reasons: string[] = [];

    // --------------------------------
    // 1. Words that are too generic
    // --------------------------------

    const stopWords = new Set([
      "the",
      "is",
      "are",
      "was",
      "were",
      "a",
      "an",
      "and",
      "or",
      "to",
      "of",
      "in",
      "on",
      "for",
      "with",
      "from",
      "this",
      "that",
      "there",
      "problem",
      "issue",
      "having",
      "has",
      "have",
      "fix",
      "fixed",
      "update",
      "updated",
      "code",
      "project",
      "change",
      "changed",
      "changes",
      "frontend",
      "backend",
      "related",
      "think",
      "might",
      "causing",
      "cause",
      "caused",
      "started",
      "start",
      "debugging",
      "debug",
    ]);

    // --------------------------------
    // 2. Extract UNIQUE meaningful terms
    // --------------------------------

    const rawKeywords = normalizedQuery
      .split(/\s+/)
      .map(normalizeWord)
      .filter(
        word =>
          word.length > 2 &&
          !stopWords.has(word)
      );

    const keywords = [
      ...new Set(rawKeywords),
    ];

    if (keywords.length === 0) {
      return {
        commit,
        score: 10,
        reasons: [
          "Investigation query is too generic to establish strong evidence",
        ],
      };
    }

    // --------------------------------
    // 3. Useful debugging synonyms
    // --------------------------------

    const synonymGroups: string[][] = [
      ["timeout", "timing", "timedout", "timingout"],
      ["payment", "payments", "pay"],
      ["database", "db", "databases"],
      ["connection", "connections", "connect"],
      ["error", "errors", "exception", "failure", "failed"],
      ["crash", "crashing", "crashed"],
      ["slow", "latency", "latencies", "performance"],
      ["retry", "retries", "retrying"],
    ];

    const getEquivalentTerms = (
      keyword: string
    ): string[] => {
      const group = synonymGroups.find(
        terms => terms.includes(keyword)
      );

      return group ?? [keyword];
    };

    const termMatches = (
      text: string,
      keyword: string
    ): boolean => {
      return getEquivalentTerms(keyword).some(
        term =>
          text.includes(term)
      );
    };

    // --------------------------------
    // 4. Separate actual changed lines
    // --------------------------------

    const lines = diff.split("\n");

    const addedLines = lines.filter(
      line =>
        line.startsWith("+") &&
        !line.startsWith("+++")
    );

    const removedLines = lines.filter(
      line =>
        line.startsWith("-") &&
        !line.startsWith("---")
    );

    const addedText = normalizeText(
      addedLines.join(" ")
    );

    const removedText = normalizeText(
      removedLines.join(" ")
    );

    // --------------------------------
    // 5. Detect real modification
    // --------------------------------

    const isModification =
      addedLines.length > 0 &&
      removedLines.length > 0;

    const isAddOnlyCommit =
      addedLines.length > 0 &&
      removedLines.length === 0;

    // --------------------------------
    // 6. Match meaningful terms
    // --------------------------------

    const messageMatches =
      keywords.filter(keyword =>
        termMatches(message, keyword)
      );

    const addedMatches =
      keywords.filter(keyword =>
        termMatches(addedText, keyword)
      );

    const removedMatches =
      keywords.filter(keyword =>
        termMatches(removedText, keyword)
      );

    const changedCodeMatches = [
      ...new Set([
        ...addedMatches,
        ...removedMatches,
      ]),
    ];

    const allMatches = [
      ...new Set([
        ...messageMatches,
        ...changedCodeMatches,
      ]),
    ];

    if (allMatches.length === 0) {
      return {
        commit,
        score: 0,
        reasons: [
          "No meaningful investigation terms found in the commit",
        ],
      };
    }

    // --------------------------------
    // 7. Commit-message evidence
    // --------------------------------

    const messageCoverage =
      messageMatches.length /
      keywords.length;

    /*
     * Important:
     * A natural-language hypothesis may contain
     * contextual words that are not present in the
     * commit message.
     *
     * Example:
     *
     * "checkout timeout payment timeout"
     *
     * Relevant commit:
     *
     * "update payment timeout"
     *
     * "checkout" does not need to appear in the
     * commit message if payment + timeout match.
     */

    if (
      messageMatches.length >= 2
    ) {
      score += 45;

      reasons.push(
        "Commit message contains multiple strong investigation signals"
      );
    } else if (
      messageCoverage >= 0.5
    ) {
      score += 35;

      reasons.push(
        "Commit message strongly matches the investigation"
      );
    } else if (
      messageMatches.length > 0
    ) {
      score += 20;

      reasons.push(
        "Commit message contains a relevant investigation signal"
      );
    }

    // --------------------------------
    // 8. Actual changed-code evidence
    // --------------------------------

    if (
      addedMatches.length >= 2
    ) {
      score += 20;

      reasons.push(
        "Multiple investigation signals appear in added code"
      );
    } else if (
      addedMatches.length > 0
    ) {
      score += 10;

      reasons.push(
        "Investigation signal appears in added code"
      );
    }

    if (
      removedMatches.length > 0
    ) {
      score += 10;

      reasons.push(
        "Investigation signal appears in removed code"
      );
    }

    // --------------------------------
    // 9. Real modification
    // --------------------------------

    if (isModification) {
      score += 15;

      reasons.push(
        "Existing code was modified"
      );
    }

    // --------------------------------
    // 10. Strong query coverage
    // --------------------------------

    const changedCodeCoverage =
      changedCodeMatches.length /
      keywords.length;

    if (
      changedCodeCoverage >= 0.5 &&
      isModification
    ) {
      score += 10;

      reasons.push(
        "Strong investigation coverage in the code change"
      );
    }

    // --------------------------------
    // 11. Numeric/configuration change
    // --------------------------------

    const numberChangeRegex =
      /^[-+].*\d+/m;

    if (
      isModification &&
      numberChangeRegex.test(diff)
    ) {
      score += 10;

      reasons.push(
        "Configuration or numeric value changed"
      );
    }

    // --------------------------------
    // 12. Recent commit
    // --------------------------------

    const commitDate =
      new Date(commit.date);

    const daysOld =
      (
        Date.now() -
        commitDate.getTime()
      ) /
      (1000 * 60 * 60 * 24);

    if (
      daysOld >= 0 &&
      daysOld <= 7 &&
      isModification
    ) {
      score += 5;

      reasons.push(
        "Recent commit"
      );
    }

    // --------------------------------
    // 13. Add-only commits are weaker
    // --------------------------------

    if (isAddOnlyCommit) {
      score -= 35;

      reasons.push(
        "Add-only commit provides weaker evidence for a debugging fix"
      );
    }

    // --------------------------------
    // 14. Concrete diff summary
    // --------------------------------

    const diffSummary = extractDiffSummary(addedLines, removedLines);

    if (diffSummary && isModification) {
      // Surface the specific change as a high-value reason so the voice
      // agent can quote it verbatim.
      reasons.push(`Concrete change detected: ${diffSummary}`);
    }

    // --------------------------------
    // 15. Corroboration required for interruption-grade evidence
    // --------------------------------

    /*
     * A commit corroborated by only one lone query term — especially a
     * generic symptom word like "timeout" — is not strong evidence,
     * no matter how many individual signals the diff contributes.
     *
     * Interruption-grade evidence therefore requires either:
     *   - at least two distinct query terms corroborated by the commit, or
     *   - at least half of the query's investigation terms corroborated.
     *
     * Genuine multi-term matches (e.g. "payment" + "timeout") stay fully
     * scored, while single-term lookalikes are held below the
     * interruption threshold.  This rule only makes interruption
     * stricter; it never raises a score.
     */
    const coverage =
      allMatches.length / keywords.length;

    if (
      allMatches.length < 2 &&
      coverage < 0.5
    ) {
      score = Math.min(score, 45);

      reasons.push(
        `Only ${allMatches.length} of ${keywords.length} investigation terms corroborated by this commit — evidence held below the interruption bar`
      );
    }

    // --------------------------------
    // 16. Final score
    // --------------------------------

    score = Math.min(
      Math.max(score, 0),
      100
    );

    return {
      commit,
      score,
      reasons,
      diffSummary: diffSummary ?? undefined,
    };
  }
}
