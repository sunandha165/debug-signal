import { Request, Response } from "express";
import { RepositoryService } from "../services/RepositoryService";

export class RepositoryController {
  constructor(
    private readonly repositoryService: RepositoryService
  ) {}
getRepositoryInfo = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const branch =
      await this.repositoryService.getCurrentBranch();

    res.status(200).json({
      success: true,
      data: {
        repository: "debug-signal",
        branch,
      },
    });
  } catch (error) {
    console.error(
      "Failed to fetch repository info:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch repository info",
    });
  }
};
  /**
   * GET /api/repository/commits
   *
   * Returns the most recent commits from the repository.
   */
  getRecentCommits = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const commits =
        await this.repositoryService.getRecentCommits(10);

      res.status(200).json({
        success: true,
        data: commits,
      });
    } catch (error) {
      console.error("Failed to fetch commits:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch repository commits",
      });
    }
  };

  /**
   * GET /api/repository/commits/search?query=payment
   *
   * Searches Git commit messages for a keyword.
   */
  searchCommits = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { query } = req.query;

      // Validate query
      if (typeof query !== "string" || !query.trim()) {
        res.status(400).json({
          success: false,
          message: "Search query is required",
        });

        return;
      }

      const commits =
        await this.repositoryService.searchCommits(
          query.trim(),
          10
        );

      res.status(200).json({
        success: true,
        data: commits,
      });
    } catch (error) {
      console.error(
        "Failed to search repository commits:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to search repository commits",
      });
    }
  };

  /**
   * GET /api/repository/commits/:commitHash/diff
   *
   * Returns the complete diff for a specific commit.
   */
  getCommitDiff = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const rawHash = req.params.commitHash;
      const commitHash =
        typeof rawHash === "string"
          ? rawHash
          : Array.isArray(rawHash)
          ? rawHash[0]
          : "";

      // Validate commit hash
      if (!commitHash || !commitHash.trim()) {
        res.status(400).json({
          success: false,
          message: "Commit hash is required",
        });

        return;
      }

      const diff =
        await this.repositoryService.getCommitDiff(
          commitHash.trim()
        );

      res.status(200).json({
        success: true,
        data: {
          commitHash: commitHash.trim(),
          diff,
        },
      });
    } catch (error) {
      console.error(
        "Failed to fetch commit diff:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch commit diff",
      });
    }
  };
}