import { githubClient } from './githubClient.js';
import { PullRequest } from '../../models/PullRequest.js';
import { linkPRToIssues } from './issueLinker.js';
import { normalizeRepoInput } from './repositoryService.js';

export class PullRequestService {
  /**
   * Fetches real pull requests directly from GitHub REST API
   */
  async getRepoPullRequests(owner, repo, { state = 'all', page = 1, limit = 30 } = {}, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const query = new URLSearchParams({
      state,
      page: String(page),
      per_page: String(limit),
    });

    const pulls = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/pulls?${query.toString()}`, {}, token);

    return (pulls || []).map((pr) => ({
      prNumber: pr.number,
      title: pr.title,
      body: pr.body || '',
      status: pr.merged_at ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : pr.draft ? 'DRAFT' : 'OPEN',
      author: {
        login: pr.user?.login || 'developer',
        avatarUrl: pr.user?.avatar_url || '',
      },
      headBranch: pr.head?.ref || '',
      baseBranch: pr.base?.ref || 'main',
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
    }));
  }

  /**
   * Fetches detailed information for a single pull request
   */
  async getPullRequestDetails(owner, repo, prNumber, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const pr = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/pulls/${prNumber}`, {}, token);
    return {
      prNumber: pr.number,
      title: pr.title,
      body: pr.body || '',
      status: pr.merged_at ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : pr.draft ? 'DRAFT' : 'OPEN',
      author: {
        login: pr.user?.login || 'developer',
        avatarUrl: pr.user?.avatar_url || '',
      },
      headBranch: pr.head?.ref || '',
      baseBranch: pr.base?.ref || 'main',
      changedFilesCount: pr.changed_files || 0,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      merged: Boolean(pr.merged_at),
    };
  }

  /**
   * Fetches real changed files and diff snippets for a pull request
   */
  async getPullRequestFiles(owner, repo, prNumber, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const files = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/pulls/${prNumber}/files?per_page=50`, {}, token);
    return (files || []).map((f) => ({
      filename: f.filename,
      status: f.status, // added, modified, removed
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch ? f.patch.substring(0, 1500) : '', // Cap patch snippet size for AI analysis
    }));
  }

  /**
   * Fetches real commits associated with a pull request
   */
  async getPullRequestCommits(owner, repo, prNumber, token = null) {
    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);
    const commits = await githubClient.request(`/repos/${safeOwner}/${safeRepo}/pulls/${prNumber}/commits?per_page=30`, {}, token);
    return (commits || []).map((c) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.author?.login || c.commit?.author?.name || 'developer',
      date: c.commit?.author?.date || c.commit?.committer?.date,
      url: c.html_url,
    }));
  }

  /**
   * Synchronizes real GitHub pull requests into DevFlow's database and links them to issues
   */
  async syncProjectPullRequests(project, userId, token = null) {
    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo) {
      throw new Error('Project is not connected to a GitHub repository.');
    }

    const remotePulls = await this.getRepoPullRequests(owner, repo, { state: 'all', limit: 25 }, token);
    const synced = [];

    for (const pr of remotePulls) {
      // Fetch changed files and commits for rich AI context
      let files = [];
      let commits = [];
      try {
        [files, commits] = await Promise.all([
          this.getPullRequestFiles(owner, repo, pr.prNumber, token),
          this.getPullRequestCommits(owner, repo, pr.prNumber, token),
        ]);
      } catch (err) {
        console.warn(`[PullRequestService] Failed to load details for PR #${pr.prNumber}: ${err.message}`);
      }

      const totalAdditions = files.reduce((acc, f) => acc + (f.additions || 0), 0);
      const totalDeletions = files.reduce((acc, f) => acc + (f.deletions || 0), 0);

      const prData = {
        project: project._id,
        prNumber: pr.prNumber,
        title: pr.title,
        body: pr.body,
        htmlUrl: pr.htmlUrl,
        author: pr.author,
        status: pr.status,
        headBranch: pr.headBranch,
        baseBranch: pr.baseBranch,
        changedFilesCount: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
        changedFiles: files.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          status: f.status,
          patch: f.patch,
        })),
        commits: commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          date: c.date,
          url: c.url,
        })),
      };

      const pullRequest = await PullRequest.findOneAndUpdate(
        { project: project._id, prNumber: pr.prNumber },
        { $set: prData },
        { upsert: true, new: true }
      );

      // Run issue linking
      await linkPRToIssues({
        pullRequest,
        projectId: project._id,
        projectKey: project.key,
        actorId: userId,
      });

      synced.push(pullRequest);
    }

    return synced;
  }
}

export const pullRequestService = new PullRequestService();
