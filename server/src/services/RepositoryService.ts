import { GitRepository } from "../interfaces/GitRepository";

export class RepositoryService {
  constructor(private readonly repository: GitRepository) {}

  async getRecentCommits(limit = 10) {
    return this.repository.getRecentCommits(limit);
  }

  async searchCommits(query: string, limit = 10) {
    return this.repository.searchCommits(query, limit);
  }

  async getCommitDiff(commitHash: string) {
    return this.repository.getCommitDiff(commitHash);
  }
  async getCurrentBranch() {
  return this.repository.getCurrentBranch();
}
}