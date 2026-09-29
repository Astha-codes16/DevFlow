import { githubClient } from './githubClient.js';
import { Project } from '../../models/Project.js';
import { Activity } from '../../models/Activity.js';

export function normalizeRepoInput(ownerInput, repoInput) {
  let rawOwner = (ownerInput || '').trim();
  let rawRepo = (repoInput || '').trim();

  // If repo is a full URL: https://github.com/owner/repo or github.com/owner/repo
  if (rawRepo.includes('github.com')) {
    const cleaned = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    if (parts.length === 1) {
      return { owner: rawOwner, repo: parts[0] };
    }
  }

  // If owner is a full URL: https://github.com/owner/repo
  if (rawOwner.includes('github.com')) {
    const cleaned = rawOwner.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    if (parts.length === 1) {
      return { owner: parts[0], repo: rawRepo };
    }
  }

  // If owner contains owner/repo
  if (rawOwner.includes('/')) {
    const parts = rawOwner.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  // If repo contains owner/repo
  if (rawRepo.includes('/')) {
    const parts = rawRepo.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  return { owner: rawOwner, repo: rawRepo };
}

export class RepositoryService {
  /**
   * Fetches real repository metadata from GitHub API
   */
  async getRepositoryDetails(owner, repo, token = null) {
    const normalized = normalizeRepoInput(owner, repo);
    const safeOwner = normalized.owner;
    const safeRepo = normalized.repo;

    const data = await githubClient.request(`/repos/${safeOwner}/${safeRepo}`, {}, token);
    return {
      repositoryId: data.id,
      name: data.name,
      owner: data.owner?.login || safeOwner,
      fullName: data.full_name,
      description: data.description || '',
      url: data.html_url,
      defaultBranch: data.default_branch || 'main',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssues: data.open_issues_count || 0,
      isPrivate: Boolean(data.private),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Fetches real branches list from GitHub API
   */
  async getRepositoryBranches(owner, repo, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const branches = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/branches?per_page=50`, {}, token);
    return (branches || []).map((b) => ({
      name: b.name,
      sha: b.commit?.sha,
      protected: Boolean(b.protected),
    }));
  }

  /**
   * Fetches real repository commit history
   */
  async getRepositoryCommits(owner, repo, { branch, limit = 20 } = {}, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const query = new URLSearchParams();
    if (branch) query.append('sha', branch);
    query.append('per_page', String(limit));

    const commits = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/commits?${query.toString()}`, {}, token);
    return (commits || []).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit?.message?.split('\n')[0] || '',
      fullMessage: c.commit?.message || '',
      author: {
        name: c.commit?.author?.name || 'Developer',
        login: c.author?.login || c.commit?.author?.name || 'dev',
        avatarUrl: c.author?.avatar_url || '',
        date: c.commit?.author?.date || c.commit?.committer?.date,
      },
      url: c.html_url,
    }));
  }

  /**
   * Fetches repository source tree for AI code context
   */
  async getRepositoryFileTree(owner, repo, branch = 'main', token = null) {
    try {
      const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
      const data = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/git/trees/${branch}?recursive=1`, {}, token);
      const tree = data.tree || [];

      // Filter for actionable source code files, ignore vendor/build dirs
      const ignorePrefixes = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/', 'coverage/'];
      return tree
        .filter((node) => node.type === 'blob' && !ignorePrefixes.some((p) => node.path.startsWith(p)))
        .map((node) => node.path)
        .slice(0, 80);
    } catch (err) {
      console.warn(`[RepositoryService] Could not fetch file tree: ${err.message}`);
      return [];
    }
  }

  /**
   * Connects a GitHub repository to a DevFlow project
   */
  async connectRepository(project, { owner, repo }, userId, userToken = null) {
    // 1. Verify existence and accessibility on GitHub
    const details = await this.getRepositoryDetails(owner, repo, userToken);

    // 2. Persist to project document
    project.github = {
      connected: true,
      owner: details.owner,
      repository: details.name,
      repositoryId: details.repositoryId,
      url: details.url,
      defaultBranch: details.defaultBranch,
      description: details.description,
      stars: details.stars,
      forks: details.forks,
      openIssues: details.openIssues,
      connectedAt: new Date(),
      connectedBy: userId,
    };

    project.githubRepository = {
      connected: true,
      owner: details.owner,
      repo: details.name,
      url: details.url,
      defaultBranch: details.defaultBranch,
      connectedAt: new Date(),
    };

    await project.save();

    // 3. Log Activity
    await Activity.create({
      project: project._id,
      actor: userId,
      action: 'CONNECTED_GITHUB',
      entityType: 'PROJECT',
      entityId: project._id.toString(),
      metadata: { repository: `${details.owner}/${details.name}` },
    });

    return details;
  }

  /**
   * Disconnects GitHub repository from project
   */
  async disconnectRepository(project, userId) {
    const previousRepo = project.github?.repository || project.githubRepository?.repo;

    project.github = {
      connected: false,
      owner: '',
      repository: '',
      repositoryId: 0,
      url: '',
      defaultBranch: 'main',
      description: '',
      stars: 0,
      forks: 0,
      openIssues: 0,
      connectedAt: null,
      connectedBy: null,
    };

    project.githubRepository = {
      connected: false,
      owner: '',
      repo: '',
      url: '',
      defaultBranch: 'main',
      connectedAt: null,
    };

    await project.save();
    githubClient.clearCache();

    await Activity.create({
      project: project._id,
      actor: userId,
      action: 'DISCONNECTED_GITHUB',
      entityType: 'PROJECT',
      entityId: project._id.toString(),
      metadata: { repository: previousRepo },
    });

    return { success: true };
  }
}

export const repositoryService = new RepositoryService();
