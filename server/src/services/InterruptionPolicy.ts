import { EvidenceScore } from "./EvidenceScorer";

export interface InterruptionDecision {
  shouldInterrupt: boolean;
  reason: string;
}

export class InterruptionPolicy {
private readonly threshold = 50;
  decide(
    evidence: EvidenceScore | null
  ): InterruptionDecision {
    if (!evidence) {
      return {
        shouldInterrupt: false,
        reason: "No relevant evidence was found",
      };
    }

    if (evidence.score >= this.threshold) {
      return {
        shouldInterrupt: true,
        reason: `Evidence confidence is ${evidence.score}%, above the interruption threshold`,
      };
    }

    return {
      shouldInterrupt: false,
      reason: `Evidence confidence is ${evidence.score}%, below the interruption threshold`,
    };
  }
}