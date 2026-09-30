export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitRepository {
  getRecentCommits(limit: number): Promise<GitCommit[]>;

  searchCommits(
    query: string,
    limit: number
  ): Promise<GitCommit[]>;

  getCommitDiff(
    commitHash: string
  ): Promise<string>;
  getCurrentBranch(): Promise<string>;
}