import simpleGit, { SimpleGit } from "simple-git";
import {
  GitCommit,
  GitRepository,
} from "../interfaces/GitRepository";
function normalizeWord(word: string): string {
  const cleaned = word
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  if (cleaned.endsWith("ies") && cleaned.length > 4) {
    return cleaned.slice(0, -3) + "y";
  }

  if (
    cleaned.endsWith("s") &&
    !cleaned.endsWith("ss") &&
    !cleaned.endsWith("us") &&
    cleaned.length > 3
  ) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

export class LocalGitRepository implements GitRepository {
  private readonly git: SimpleGit;

  constructor(private readonly repositoryPath: string) {
    this.git = simpleGit(repositoryPath);
  }

  async getRecentCommits(limit: number): Promise<GitCommit[]> {
    const log = await this.git.log({
      maxCount: limit,
    });

    return log.all.map((commit) => ({
      hash: commit.hash,
      author: commit.author_name,
      date: commit.date,
      message: commit.message,
    }));
  }

 
async searchCommits(
  query: string,
  limit: number
): Promise<GitCommit[]> {
  const normalizedQuery = query
    .toLowerCase()
    .replace(/\btiming out\b/g, "timeout")
    .replace(/\btimed out\b/g, "timeout")
    .replace(/\btime out\b/g, "timeout");

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
    "when",
    "flow",
    "problem",
    "issue",
    "having",
    "has",
    "have",
    "code",
    "project",
    "change",
    "changed",
    "changes",
    "frontend",
    "backend"
  ]);

  const keywords = normalizedQuery
  .split(/\s+/)
  .filter(
    keyword =>
      keyword.length > 2 &&
      !stopWords.has(keyword)
  )
  .map(normalizeWord);

  if (keywords.length === 0) {
    return [];
  }

  const log = await this.git.log({
    maxCount: 100,
    "--all": null,
  });

  const scoredCommits = await Promise.all(
    log.all.map(async commit => {
      const message =
        commit.message.toLowerCase();

      let diff = "";

      try {
        diff = await this.git.show([
          "--format=",
          commit.hash,
        ]);
      } catch {
        diff = "";
      }

      /*
       * Detect whether this is an initial/add-only commit.
       * Initial commits often contain the entire project,
       * so matching words anywhere inside them is weak evidence.
       */
      const addedLines =
        diff
          .split("\n")
          .filter(
            line =>
              line.startsWith("+") &&
              !line.startsWith("+++")
          );

      const removedLines =
        diff
          .split("\n")
          .filter(
            line =>
              line.startsWith("-") &&
              !line.startsWith("---")
          );

      const isAddOnlyCommit =
        addedLines.length > 0 &&
        removedLines.length === 0;

      /*
       * Only inspect actual changed lines.
       */
      const addedText =
        addedLines.join(" ").toLowerCase();

      const removedText =
        removedLines.join(" ").toLowerCase();

      /*
       * Match query terms against:
       * 1. Commit message
       * 2. Added code
       * 3. Removed code
       */
      const messageMatches =
  keywords.filter(keyword =>
    message
      .split(/\s+/)
      .some(word =>
        normalizeWord(word).includes(keyword)
      )
  );

const addedMatches =
  keywords.filter(keyword =>
    addedText
      .split(/\s+/)
      .some(word =>
        normalizeWord(word).includes(keyword)
      )
  );

const removedMatches =
  keywords.filter(keyword =>
    removedText
      .split(/\s+/)
      .some(word =>
        normalizeWord(word).includes(keyword)
      )
  );
      const allMatches =
        new Set([
          ...messageMatches,
          ...addedMatches,
          ...removedMatches
        ]);

      if (allMatches.size === 0) {
        return null;
      }

      let relevanceScore = 0;

      /*
       * Commit message is strong evidence.
       */
      relevanceScore +=
        messageMatches.length * 20;

      /*
       * Terms appearing in newly added code
       * are useful evidence.
       */
      relevanceScore +=
        addedMatches.length * 8;

      /*
       * Terms appearing in removed code can indicate
       * something was changed or fixed.
       */
      relevanceScore +=
        removedMatches.length * 12;

      /*
       * A commit that actually replaces code is stronger
       * than an add-only commit.
       */
      if (
        addedLines.length > 0 &&
        removedLines.length > 0
      ) {
        relevanceScore += 15;
      }

      /*
       * Initial/add-only commits get a penalty.
       * They create the project rather than fixing an
       * existing problem.
       */
      if (isAddOnlyCommit) {
        relevanceScore -= 25;
      }

      /*
       * Require stronger evidence when the query has
       * multiple technical keywords.
       */
      const coverage =
        allMatches.size /
        keywords.length;

      relevanceScore +=
        Math.round(coverage * 20);

      return {
        commit,
        relevanceScore,
      };
    })
  );

  return scoredCommits
    .filter(
      (
        item
      ): item is NonNullable<typeof item> =>
        item !== null
    )
    .sort(
      (a, b) =>
        b.relevanceScore -
        a.relevanceScore
    )
    .slice(0, limit)
    .map(item => ({
      hash: item.commit.hash,
      author: item.commit.author_name,
      date: item.commit.date,
      message: item.commit.message,
    }));
}

  async getCommitDiff(commitHash: string): Promise<string> {
    return this.git.show([
      "--format=",
      commitHash,
    ]);
  }
  async getCurrentBranch(): Promise<string> {
  const branchSummary = await this.git.branchLocal();

  return branchSummary.current;
}
}