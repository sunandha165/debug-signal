import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { LocalGitRepository } from "./repositories/LocalGitRepository";

import { RepositoryService } from "./services/RepositoryService";
import { RepositoryController } from "./controllers/RepositoryController";
import { createRepositoryRoutes } from "./routes/repositoryRoutes";

import { InvestigationService } from "./services/InvestigationService";
import { InvestigationController } from "./controllers/InvestigationController";
import { createInvestigationRoutes } from "./routes/investigationRoutes";
import { AssemblyAIService } from "./services/AssemblyAIService";
import { VoiceController } from "./controllers/VoiceController";
import { createVoiceRoutes } from "./routes/voiceRoutes";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());


// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "DebugSignal API is running",
    service: "backend",
  });
});


// ─────────────────────────────────────────────
// Repository path resolution
// ─────────────────────────────────────────────

/*
 * REPOSITORY_PATH env var selects the local Git repository to investigate.
 *
 * If REPOSITORY_PATH is set, that path is used exactly as configured.
 * If it is absent, we fall back to the demo-repository sibling directory
 * so local development works out of the box without any .env config.
 *
 * Rules:
 *   - A relative REPOSITORY_PATH is resolved relative to this file's directory.
 *   - If the resolved path does not exist or is not a Git repository the
 *     server still starts, but investigation requests will return errors
 *     rather than silently using a fallback.  This makes misconfiguration
 *     obvious rather than hidden.
 */

function resolveRepositoryPath(): string {
  const configured = process.env.REPOSITORY_PATH;

  if (configured) {
    // Resolve relative paths from the server/src directory so that
    // values like "../demo-repository" work predictably.
    return path.resolve(__dirname, configured);
  }

  // Default fallback: demo-repository lives two levels above server/src
  // (workspace-root/demo-repository).
  return path.resolve(__dirname, "../../demo-repository");
}

const repositoryPath = resolveRepositoryPath();

// Validate the path before wiring it up.  We check synchronously at startup
// so the problem is immediately visible in the server log.
const gitDir = path.join(repositoryPath, ".git");
if (!fs.existsSync(repositoryPath)) {
  console.error(
    `[DebugSignal] ERROR: Configured REPOSITORY_PATH does not exist: ${repositoryPath}`
  );
  console.error(
    "[DebugSignal] Set REPOSITORY_PATH in server/.env to a valid local Git repository."
  );
  process.exit(1);
}
if (!fs.existsSync(gitDir)) {
  console.error(
    `[DebugSignal] ERROR: Configured path is not a Git repository (no .git directory): ${repositoryPath}`
  );
  console.error(
    "[DebugSignal] Set REPOSITORY_PATH in server/.env to a valid local Git repository."
  );
  process.exit(1);
}

console.log(`[DebugSignal] Repository: ${repositoryPath}`);

const gitRepository =
  new LocalGitRepository(repositoryPath);


// ─────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────

const repositoryService =
  new RepositoryService(gitRepository);

const repositoryController =
  new RepositoryController(repositoryService);

app.use(
  "/api/repository",
  createRepositoryRoutes(repositoryController)
);


// ─────────────────────────────────────────────
// Investigation Service
// ─────────────────────────────────────────────

const investigationService =
  new InvestigationService(gitRepository);

const investigationController =
  new InvestigationController(
    investigationService
  );

app.use(
  "/api/investigation",
  createInvestigationRoutes(
    investigationController
  )
);

// ─────────────────────────────────────────────
// Voice / AssemblyAI
// ─────────────────────────────────────────────

const assemblyAIService =
  new AssemblyAIService();

const voiceController =
  new VoiceController(
    assemblyAIService
  );

app.use(
  "/api/voice",
  createVoiceRoutes(voiceController)
);
export default app;