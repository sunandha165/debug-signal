import { Router } from "express";
import { RepositoryController } from "../controllers/RepositoryController";

export const createRepositoryRoutes = (
  repositoryController: RepositoryController
) => {
  const router = Router();
  router.get(
  "/info",
  repositoryController.getRepositoryInfo
);

  router.get(
    "/commits",
    repositoryController.getRecentCommits
  );

  router.get(
    "/commits/search",
    repositoryController.searchCommits
  );

  router.get(
    "/commits/:commitHash/diff",
    repositoryController.getCommitDiff
  );

  return router;
};