export interface GithubInstallation {
  id: string;
  organizationId: string;
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  createdAt: Date;
}

export interface GithubRepository {
  id: string;
  installationId: string;
  projectId?: string | null;
  repoId: number;
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
}

export interface GithubPullRequest {
  id: string;
  repositoryId: string;
  issueId?: string | null;
  prNumber: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  branchName: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
