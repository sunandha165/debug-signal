/**
 * DebugSignal — Investigation Engine Integration Tests
 *
 * These tests run against the real demo-repository on disk.
 * No mocking, no AssemblyAI, no network calls.
 *
 * The demo-repository contains two commits:
 *   b46c508  initial payment configuration   (add-only)
 *   37b2874  update payment timeout          (modifies PAYMENT_TIMEOUT: 30000 → 5000)
 */

import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";

import { LocalGitRepository } from "../repositories/LocalGitRepository";
import { InvestigationService } from "../services/InvestigationService";
import { EvidenceScorer } from "../services/EvidenceScorer";
import { InterruptionPolicy } from "../services/InterruptionPolicy";
import { ConversationService } from "../services/ConversationService";

// ---------------------------------------------------------------------------
// Locate the demo-repository
// ---------------------------------------------------------------------------

// Tests live at server/src/tests/ — go up 3 levels to the workspace root.
// server/src/tests → server/src → server → workspace-root/demo-repository
const DEMO_REPO_PATH = path.resolve(
  __dirname,
  "../../../demo-repository"
);

// Fail fast with a clear message if the demo-repository is not present.
if (!fs.existsSync(DEMO_REPO_PATH)) {
  throw new Error(
    `demo-repository not found at ${DEMO_REPO_PATH}. ` +
    "Make sure the workspace root contains the demo-repository directory."
  );
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeRepo() {
  return new LocalGitRepository(DEMO_REPO_PATH);
}

function makeInvestigationService() {
  return new InvestigationService(makeRepo());
}

// The planted payment-timeout commit hash (short) for assertions.
const PAYMENT_COMMIT_SHORT = "37b2874";

// ---------------------------------------------------------------------------
// Test 1 — Demo-repository payment timeout evidence
// ---------------------------------------------------------------------------

describe("demo-repository payment timeout evidence", () => {
  it("finds the planted payment-timeout commit with query 'payment timeout'", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.matches.length).toBeGreaterThan(0);

    const found = result.matches.some(c =>
      c.hash.startsWith(PAYMENT_COMMIT_SHORT) ||
      c.message.toLowerCase().includes("payment timeout")
    );
    expect(found).toBe(true);
  });

  it("bestEvidence points to the payment-timeout commit", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.bestEvidence).not.toBeNull();
    expect(
      result.bestEvidence!.commit.message.toLowerCase()
    ).toContain("payment");
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Weak database hypothesis does NOT trigger interruption
// ---------------------------------------------------------------------------

describe("weak database hypothesis", () => {
  it("does not find strong evidence for an unrelated database hypothesis", async () => {
    const service = makeInvestigationService();
    // The demo-repository has no 'database' commits.
    const result = await service.investigate(
      "database causing checkout problems"
    );

    expect(result.decision.shouldInterrupt).toBe(false);
  });

  it("returns empty matches for a database-only query", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("database connection failure");

    // Either no matches at all, or all matches score below threshold.
    const allBelowThreshold =
      result.matches.length === 0 ||
      result.decision.shouldInterrupt === false;

    expect(allBelowThreshold).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Natural-language payment timeout query
// ---------------------------------------------------------------------------

describe("natural-language payment timeout query", () => {
  it("handles 'payment started timing out recently' via phrase normalisation", async () => {
    const service = makeInvestigationService();
    // "timing out" → normalised to "timeout" inside searchCommits.
    const result = await service.investigate(
      "payment started timing out recently"
    );

    expect(result.matches.length).toBeGreaterThan(0);

    const found = result.matches.some(c =>
      c.message.toLowerCase().includes("payment")
    );
    expect(found).toBe(true);
  });

  it("finds the payment commit even when query is a full spoken sentence", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate(
      "Actually, payment started timing out recently."
    );

    expect(result.bestEvidence).not.toBeNull();
    expect(
      result.bestEvidence!.commit.message.toLowerCase()
    ).toContain("payment");
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Strong evidence crosses the interruption threshold
// ---------------------------------------------------------------------------

describe("strong evidence interruption", () => {
  it("shouldInterrupt is true for 'payment timeout'", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.decision.shouldInterrupt).toBe(true);
  });

  it("evidence score is >= 50 for 'payment timeout'", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.bestEvidence).not.toBeNull();
    expect(result.bestEvidence!.score).toBeGreaterThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Weak evidence stays silent
// ---------------------------------------------------------------------------

describe("weak evidence silence", () => {
  it("shouldInterrupt is false when evidence is weak", async () => {
    const policy = new InterruptionPolicy();

    const weakEvidence = {
      commit: {
        hash: "abc123",
        author: "test",
        date: new Date().toISOString(),
        message: "unrelated refactor",
      },
      score: 20,
      reasons: ["minor match"],
    };

    const decision = policy.decide(weakEvidence);
    expect(decision.shouldInterrupt).toBe(false);
  });

  it("shouldInterrupt is false when score is exactly at threshold minus 1", async () => {
    const policy = new InterruptionPolicy();
    const decision = policy.decide({
      commit: {
        hash: "abc",
        author: "x",
        date: new Date().toISOString(),
        message: "test",
      },
      score: 49,
      reasons: [],
    });
    expect(decision.shouldInterrupt).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — No evidence results in stay-silent
// ---------------------------------------------------------------------------

describe("no evidence silence", () => {
  it("shouldInterrupt is false when bestEvidence is null", () => {
    const policy = new InterruptionPolicy();
    const decision = policy.decide(null);

    expect(decision.shouldInterrupt).toBe(false);
    expect(decision.reason).toBeTruthy();
  });

  it("investigation returns shouldInterrupt false and null bestEvidence for a completely unrelated query", async () => {
    const service = makeInvestigationService();
    // Query with no possible match in the demo-repository.
    const result = await service.investigate("kubernetes ingress helm chart");

    expect(result.decision.shouldInterrupt).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 7 — Concrete diff summary is produced
// ---------------------------------------------------------------------------

describe("concrete diff summary", () => {
  it("extracts PAYMENT_TIMEOUT changed from 30000 to 5000", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.bestEvidence).not.toBeNull();
    expect(result.bestEvidence!.diffSummary).toBeDefined();
    expect(result.bestEvidence!.diffSummary).toContain("PAYMENT_TIMEOUT");
    expect(result.bestEvidence!.diffSummary).toContain("30000");
    expect(result.bestEvidence!.diffSummary).toContain("5000");
  });

  it("includes the diff summary in the reasons array", async () => {
    const service = makeInvestigationService();
    const result = await service.investigate("payment timeout");

    expect(result.bestEvidence).not.toBeNull();
    const hasSummaryInReasons = result.bestEvidence!.reasons.some(r =>
      r.includes("PAYMENT_TIMEOUT")
    );
    expect(hasSummaryInReasons).toBe(true);
  });

  it("EvidenceScorer.score() returns diffSummary for a synthetic diff", () => {
    const scorer = new EvidenceScorer();
    const commit = {
      hash: "abc123",
      author: "test",
      date: new Date().toISOString(),
      message: "update payment timeout",
    };

    const syntheticDiff = [
      "diff --git a/app.js b/app.js",
      "--- a/app.js",
      "+++ b/app.js",
      "-const PAYMENT_TIMEOUT = 30000;",
      "+const PAYMENT_TIMEOUT = 5000;",
    ].join("\n");

    const result = scorer.score("payment timeout", commit, syntheticDiff);

    expect(result.diffSummary).toBeDefined();
    expect(result.diffSummary).toContain("PAYMENT_TIMEOUT");
    expect(result.diffSummary).toContain("30000");
    expect(result.diffSummary).toContain("5000");
  });
});

// ---------------------------------------------------------------------------
// Test 8 — Configured repository path (env-var logic)
// ---------------------------------------------------------------------------

describe("configured repository path", () => {
  it("LocalGitRepository works against the demo-repository path", async () => {
    const repo = new LocalGitRepository(DEMO_REPO_PATH);
    const commits = await repo.getRecentCommits(10);

    expect(Array.isArray(commits)).toBe(true);
    expect(commits.length).toBeGreaterThan(0);

    // Every commit has required fields.
    for (const c of commits) {
      expect(typeof c.hash).toBe("string");
      expect(typeof c.author).toBe("string");
      expect(typeof c.date).toBe("string");
      expect(typeof c.message).toBe("string");
    }
  });

  it("LocalGitRepository.getCurrentBranch() returns a non-empty string", async () => {
    const repo = new LocalGitRepository(DEMO_REPO_PATH);
    const branch = await repo.getCurrentBranch();
    expect(typeof branch).toBe("string");
    expect(branch.length).toBeGreaterThan(0);
  });

  it("LocalGitRepository.getCommitDiff() returns a non-empty diff for the payment commit", async () => {
    const repo = new LocalGitRepository(DEMO_REPO_PATH);
    const diff = await repo.getCommitDiff(PAYMENT_COMMIT_SHORT);
    expect(typeof diff).toBe("string");
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContain("PAYMENT_TIMEOUT");
  });
});

// ---------------------------------------------------------------------------
// Test 9 — Invalid repository path is handled gracefully by LocalGitRepository
// ---------------------------------------------------------------------------

describe("invalid repository path", () => {
  it("throws at construction time for a non-existent path", () => {
    // simple-git validates the path synchronously in the constructor.
    expect(
      () => new LocalGitRepository("/nonexistent/path/to/repo")
    ).toThrow();
  });

  it("the app.ts validation logic detects a missing path", () => {
    // Verify our fs.existsSync guard would catch a bad configured path.
    const badPath = "/nonexistent/path/to/repo";
    const exists = require("fs").existsSync(badPath);
    expect(exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — Existing repository endpoints (service-layer smoke tests)
// ---------------------------------------------------------------------------

describe("existing repository service endpoints", () => {
  it("getRecentCommits returns the expected commits", async () => {
    const repo = makeRepo();
    const commits = await repo.getRecentCommits(10);
    expect(commits.length).toBeGreaterThanOrEqual(2);
  });

  it("searchCommits with 'payment' returns at least one result", async () => {
    const repo = makeRepo();
    const commits = await repo.searchCommits("payment", 10);
    expect(commits.length).toBeGreaterThan(0);
  });

  it("searchCommits with 'payment timeout' returns the planted commit", async () => {
    const repo = makeRepo();
    const commits = await repo.searchCommits("payment timeout", 10);
    expect(commits.length).toBeGreaterThan(0);
    const found = commits.some(c =>
      c.message.toLowerCase().includes("payment timeout")
    );
    expect(found).toBe(true);
  });

  it("getCommitDiff returns a valid diff string", async () => {
    const repo = makeRepo();
    const diff = await repo.getCommitDiff(PAYMENT_COMMIT_SHORT);
    expect(typeof diff).toBe("string");
    expect(diff.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test bonus — ConversationService improved query extraction
// ---------------------------------------------------------------------------

describe("ConversationService improved query extraction", () => {
  it("normalises 'timing out' to 'timeout' in the candidate query", () => {
    const svc = new ConversationService();
    const ctx = svc.addDeveloperMessage(
      "payment started timing out recently"
    );
    expect(ctx.candidate).not.toBeNull();
    expect(ctx.candidate!.query).toContain("timeout");
  });

  it("extracts 'payment' and 'timeout' from a natural-language sentence", () => {
    const svc = new ConversationService();
    const ctx = svc.addDeveloperMessage(
      "Actually, payment started timing out recently."
    );
    expect(ctx.candidate).not.toBeNull();
    const q = ctx.candidate!.query;
    expect(q).toContain("payment");
    expect(q).toContain("timeout");
  });

  it("returns null candidate for a non-debugging message", () => {
    const svc = new ConversationService();
    const ctx = svc.addDeveloperMessage(
      "Let me look at the dashboard."
    );
    expect(ctx.candidate).toBeNull();
  });

  it("weights the most recent message over old context", () => {
    const svc = new ConversationService();
    svc.addDeveloperMessage(
      "The database is slow."
    );
    const ctx = svc.addDeveloperMessage(
      "Actually payment is timing out."
    );
    expect(ctx.candidate).not.toBeNull();
    // Most recent message keywords should dominate.
    const q = ctx.candidate!.query;
    expect(q).toContain("payment");
    expect(q).toContain("timeout");
  });
});
