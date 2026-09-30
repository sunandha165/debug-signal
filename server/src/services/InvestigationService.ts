import {
  GitRepository,
  GitCommit,
} from "../interfaces/GitRepository";

import {
  EvidenceScorer,
  EvidenceScore,
} from "./EvidenceScorer";

import {
  InterruptionPolicy,
  InterruptionDecision,
} from "./InterruptionPolicy";

export interface InvestigatedEvidence
  extends EvidenceScore {
  diff: string;
}

export interface InvestigationResult {
  query: string;
  matches: GitCommit[];
  bestEvidence: InvestigatedEvidence | null;
  decision: InterruptionDecision;
}

export class InvestigationService {
  private readonly evidenceScorer: EvidenceScorer;
  private readonly interruptionPolicy: InterruptionPolicy;

  constructor(
    private readonly repository: GitRepository
  ) {
    this.evidenceScorer = new EvidenceScorer();

    this.interruptionPolicy =
      new InterruptionPolicy();
  }

  async investigate(
    query: string
  ): Promise<InvestigationResult> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new Error(
        "Investigation query is required"
      );
    }

    // Search Git history
    const matches =
      await this.repository.searchCommits(
        normalizedQuery,
        10
      );

    // No matching commits
    if (matches.length === 0) {
      const decision =
        this.interruptionPolicy.decide(null);

      return {
        query: normalizedQuery,
        matches: [],
        bestEvidence: null,
        decision,
      };
    }

    // Investigate each matching commit
    const investigatedEvidence =
      await Promise.all(
        matches.map(async (commit) => {
          const diff =
            await this.repository.getCommitDiff(
              commit.hash
            );

         const score =
  this.evidenceScorer.score(
    normalizedQuery,
    commit,
    diff
  );

          return {
            ...score,
            diff,
          };
        })
      );

    // Find strongest evidence
    const bestEvidence =
      investigatedEvidence.reduce(
        (best, current) =>
          current.score > best.score
            ? current
            : best
      );

    // Decide whether to interrupt
    const decision =
      this.interruptionPolicy.decide(
        bestEvidence
      );

    return {
      query: normalizedQuery,
      matches,
      bestEvidence,
      decision,
    };
  }
}