import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { User } from '../models/User.js';
import { PullRequest } from '../models/PullRequest.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { repositoryService } from '../services/github/repositoryService.js';
import { pullRequestService } from '../services/github/pullRequestService.js';
import { webhookService } from '../services/github/webhookService.js';
import { manualLinkPR, unlinkPRFromIssue } from '../services/github/issueLinker.js';
import { requireProjectAccess as verifyProjectAccess } from '../middleware/projectAccess.js';

/**
 * Helper to get user's GitHub access token if stored
 */
async function getUserGitHubToken(userId) {
  if (!userId) return null;
  const user = await User.findById(userId).select('+githubAccessToken');
  return user?.githubAccessToken || null;
}

/**
 * GET /api/projects/:projectId/github
 * Returns connected repository information
 */
export const getConnectedRepository = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const isConnected = Boolean(project.github?.connected || project.githubRepository?.connected);
    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!isConnected || !owner || !repo) {
      return res.status(200).json({
        success: true,
        connected: false,
        message: 'No GitHub repository connected to this project.',
      });
    }

    const token = await getUserGitHubToken(req.user._id);

    try {
      // Fetch fresh metadata from GitHub API
      const liveDetails = await repositoryService.getRepositoryDetails(owner, repo, token);

      // Update cached numbers on project
      project.github.stars = liveDetails.stars;
      project.github.forks = liveDetails.forks;
      project.github.openIssues = liveDetails.openIssues;
      project.github.defaultBranch = liveDetails.defaultBranch;
      await project.save();

      return res.status(200).json({
        success: true,
        connected: true,
        repository: liveDetails,
      });
    } catch (err) {
      // Return stored metadata if GitHub API temporary rate limit or error
      return res.status(200).json({
        success: true,
        connected: true,
        warning: `Could not fetch live GitHub updates (${err.message}). Showing last known metadata.`,
        repository: {
          owner,
          name: repo,
          fullName: `${owner}/${repo}`,
          url: project.github?.url || `https://github.com/${owner}/${repo}`,
          defaultBranch: project.github?.defaultBranch || 'main',
          stars: project.github?.stars || 0,
          forks: project.github?.forks || 0,
          openIssues: project.github?.openIssues || 0,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/projects/:projectId/github/connect
 * Connects a GitHub repository to a project (Admin only)
 */
export const connectRepository = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        message: 'GitHub repository owner and repository name are required.',
      });
    }

    const { project } = await verifyProjectAccess(projectId, req.user, { requireAdmin: true });
    const token = await getUserGitHubToken(req.user._id);

    const details = await repositoryService.connectRepository(
      project,
      { owner: owner.trim(), repo: repo.trim() },
      req.user._id,
      token
    );

    // Initial sync of pull requests in the background
    pullRequestService.syncProjectPullRequests(project, req.user._id, token).catch((e) =>
      console.warn('Initial PR sync failed:', e.message)
    );

    res.status(200).json({
      success: true,
      message: `Successfully connected repository ${owner}/${repo}`,
      repository: details,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:projectId/github/disconnect
 * Disconnects GitHub repository (Admin only)
 */
export const disconnectRepository = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { project } = await verifyProjectAccess(projectId, req.user, { requireAdmin: true });

    await repositoryService.disconnectRepository(project, req.user._id);

    res.status(200).json({
      success: true,
      message: 'GitHub repository disconnected successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/github/branches
 * Fetches real branches from GitHub
 */
export const getRepositoryBranches = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo || (!project.github?.connected && !project.githubRepository?.connected)) {
      return res.status(400).json({
        success: false,
        message: 'No GitHub repository connected to this project.',
      });
    }

    const token = await getUserGitHubToken(req.user._id);
    const branches = await repositoryService.getRepositoryBranches(owner, repo, token);

    res.status(200).json({
      success: true,
      defaultBranch: project.github?.defaultBranch || 'main',
      branches,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/github/commits
 * Fetches real commits from GitHub
 */
export const getRepositoryCommits = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { branch, limit } = req.query;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo || (!project.github?.connected && !project.githubRepository?.connected)) {
      return res.status(400).json({
        success: false,
        message: 'No GitHub repository connected to this project.',
      });
    }

    const token = await getUserGitHubToken(req.user._id);
    const commits = await repositoryService.getRepositoryCommits(
      owner,
      repo,
      { branch, limit: limit ? parseInt(limit, 10) : 15 },
      token
    );

    res.status(200).json({
      success: true,
      commits,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/github/pulls
 * Fetches real pull requests from GitHub (and syncs to DB)
 */
export const getProjectPullRequests = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { state = 'all', sync = 'false' } = req.query;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo || (!project.github?.connected && !project.githubRepository?.connected)) {
      return res.status(200).json({
        success: true,
        connected: false,
        pullRequests: [],
        message: 'GitHub repository not connected.',
      });
    }

    const token = await getUserGitHubToken(req.user._id);

    // If sync requested or no PRs in DB, run sync
    if (sync === 'true') {
      const synced = await pullRequestService.syncProjectPullRequests(project, req.user._id, token);
      return res.status(200).json({
        success: true,
        connected: true,
        synced: true,
        pullRequests: synced,
      });
    }

    // Fetch real PRs directly from GitHub API
    const livePulls = await pullRequestService.getRepoPullRequests(owner, repo, { state }, token);

    res.status(200).json({
      success: true,
      connected: true,
      pullRequests: livePulls,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/github/pulls/:prNumber/files
 * Fetches real changed files for a pull request
 */
export const getPullRequestFiles = async (req, res, next) => {
  try {
    const { projectId, prNumber } = req.params;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo) {
      return res.status(400).json({ success: false, message: 'GitHub repository not connected.' });
    }

    const token = await getUserGitHubToken(req.user._id);
    const files = await pullRequestService.getPullRequestFiles(
      owner,
      repo,
      parseInt(prNumber, 10),
      token
    );

    res.status(200).json({
      success: true,
      prNumber: parseInt(prNumber, 10),
      files,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/github/pulls/:prNumber/commits
 * Fetches real commits for a pull request
 */
export const getPullRequestCommits = async (req, res, next) => {
  try {
    const { projectId, prNumber } = req.params;
    const { project } = await verifyProjectAccess(projectId, req.user);

    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo) {
      return res.status(400).json({ success: false, message: 'GitHub repository not connected.' });
    }

    const token = await getUserGitHubToken(req.user._id);
    const commits = await pullRequestService.getPullRequestCommits(
      owner,
      repo,
      parseInt(prNumber, 10),
      token
    );

    res.status(200).json({
      success: true,
      prNumber: parseInt(prNumber, 10),
      commits,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/issues/:issueId/github/link-pr
 * Links a PR to an issue with full verification and real GitHub API check
 */
export const linkPullRequestToIssue = async (req, res, next) => {
  try {
    const { issueId } = req.params;
    const rawPr = req.body.prNumber !== undefined ? req.body.prNumber : req.body.prId;

    if (rawPr === undefined || rawPr === null || String(rawPr).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Pull Request number or identifier is required (e.g. 1).',
      });
    }

    // 1. Validate issueId format
    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      return res.status(404).json({
        success: false,
        message: `Issue not found: invalid ID format "${issueId}".`,
      });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: `Issue not found with ID "${issueId}".`,
      });
    }

    // 2. Verify user has access to the project
    const { project } = await verifyProjectAccess(issue.project, req.user);

    // 3. Verify that the project has a connected GitHub repository
    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;
    const isConnected = Boolean((project.github?.connected || project.githubRepository?.connected) && owner && repo);

    if (!isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Cannot link Pull Request: No GitHub repository is connected to this project.',
      });
    }

    // 4. Determine target PR number
    let targetPrNumber = null;
    const strVal = String(rawPr).replace(/^#/, '').trim();
    const parsedNum = parseInt(strVal, 10);

    if (!isNaN(parsedNum) && parsedNum > 0) {
      targetPrNumber = parsedNum;
    } else if (mongoose.Types.ObjectId.isValid(strVal)) {
      const existingDBPR = await PullRequest.findById(strVal);
      if (existingDBPR) {
        targetPrNumber = existingDBPR.prNumber;
      }
    }

    if (!targetPrNumber) {
      return res.status(400).json({
        success: false,
        message: 'A valid numeric Pull Request number (e.g. 1) is required.',
      });
    }

    // 5. Verify PR exists in that connected repository using real GitHub REST API
    const token = await getUserGitHubToken(req.user._id);
    let ghPRDetails;
    try {
      ghPRDetails = await pullRequestService.getPullRequestDetails(owner, repo, targetPrNumber, token);
    } catch (err) {
      if (err.message && (err.message.includes('404') || err.message.includes('Not Found') || err.message.includes('Resource Not Found'))) {
        return res.status(404).json({
          success: false,
          message: `Pull Request #${targetPrNumber} not found in connected repository ${owner}/${repo}.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `GitHub API error fetching PR #${targetPrNumber}: ${err.message}`,
      });
    }

    // 6. Create or update the PullRequest document in database
    let pullRequest = await PullRequest.findOne({
      project: project._id,
      prNumber: targetPrNumber,
    });

    if (!pullRequest) {
      pullRequest = await PullRequest.create({
        project: project._id,
        issue: issue._id,
        prNumber: ghPRDetails.prNumber,
        title: ghPRDetails.title,
        body: ghPRDetails.body || '',
        status: ghPRDetails.status,
        author: ghPRDetails.author,
        headBranch: ghPRDetails.headBranch,
        baseBranch: ghPRDetails.baseBranch,
        htmlUrl: ghPRDetails.htmlUrl,
        createdAt: ghPRDetails.createdAt,
        updatedAt: ghPRDetails.updatedAt,
      });
    } else {
      pullRequest.issue = issue._id;
      pullRequest.title = ghPRDetails.title;
      pullRequest.body = ghPRDetails.body || pullRequest.body;
      pullRequest.status = ghPRDetails.status;
      pullRequest.htmlUrl = ghPRDetails.htmlUrl;
      await pullRequest.save();
    }

    // 7. Ensure issue has PR in linkedPullRequests
    const alreadyLinked = issue.linkedPullRequests.some(
      (id) => id.toString() === pullRequest._id.toString()
    );

    if (!alreadyLinked) {
      issue.linkedPullRequests.push(pullRequest._id);
      if (issue.status === 'OPEN') {
        issue.status = 'IN_REVIEW';
      }
      await issue.save();
    }

    // 8. Log activity
    await Activity.create({
      project: project._id,
      issue: issue._id,
      actor: req.user._id,
      action: 'LINKED_PR',
      entityType: 'PR',
      entityId: pullRequest._id.toString(),
      metadata: {
        prNumber: pullRequest.prNumber,
        prTitle: pullRequest.title,
        htmlUrl: pullRequest.htmlUrl,
      },
    });

    // 9. Send notification to assignee or reporter if different from actor
    const notifyTarget = issue.assignee || issue.reporter;
    if (notifyTarget && notifyTarget.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: notifyTarget,
        sender: req.user._id,
        project: project._id,
        issue: issue._id,
        title: `PR #${pullRequest.prNumber} Linked`,
        message: `${req.user.name || 'A team member'} linked GitHub PR #${pullRequest.prNumber} "${pullRequest.title}" to Issue #${issue.issueNumber}`,
        type: 'PR_LINKED',
      });
    }

    // 10. Re-fetch and populate issue for fresh client state
    const populatedIssue = await Issue.findById(issue._id)
      .populate('reporter', 'name email avatar')
      .populate('assignee', 'name email avatar')
      .populate('project', 'name key github githubRepository members')
      .populate('linkedPullRequests');

    res.status(200).json({
      success: true,
      message: `Successfully linked PR #${pullRequest.prNumber} to Issue #${issue.issueNumber}`,
      issue: populatedIssue,
      pullRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/issues/:issueId/github/link-pr/:prNumber
 * Unlinks a PR from an issue
 */
export const unlinkPullRequestFromIssue = async (req, res, next) => {
  try {
    const { issueId, prNumber } = req.params;

    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      return res.status(404).json({ success: false, message: `Issue not found: invalid ID format "${issueId}".` });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    await verifyProjectAccess(issue.project, req.user);

    const num = parseInt(prNumber, 10);
    const pullRequest = await PullRequest.findOne({
      project: issue.project,
      prNumber: num,
    });

    if (pullRequest) {
      issue.linkedPullRequests = issue.linkedPullRequests.filter(
        (id) => id.toString() !== pullRequest._id.toString()
      );
      await issue.save();

      if (pullRequest.issue && pullRequest.issue.toString() === issue._id.toString()) {
        pullRequest.issue = null;
        await pullRequest.save();
      }

      await Activity.create({
        project: issue.project,
        issue: issue._id,
        actor: req.user._id,
        action: 'UNLINKED_PR',
        entityType: 'PR',
        entityId: pullRequest._id.toString(),
        metadata: { prNumber: pullRequest.prNumber },
      });
    }

    const populatedIssue = await Issue.findById(issue._id)
      .populate('reporter', 'name email avatar')
      .populate('assignee', 'name email avatar')
      .populate('project', 'name key github githubRepository members')
      .populate('linkedPullRequests');

    res.status(200).json({
      success: true,
      message: `Unlinked PR #${prNumber} from Issue #${issue.issueNumber}`,
      issue: populatedIssue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/github/simulate-webhook
 * Sends a local, authenticated PR event through the same service as GitHub.
 */
export const simulateGitHubWebhook = async (req, res, next) => {
  try {
    const { projectId, prNumber, action = 'closed', merged = false, title, body = '' } = req.body;
    const numericPrNumber = Number(prNumber);
    if (!Number.isInteger(numericPrNumber) || numericPrNumber < 1) {
      return res.status(400).json({ success: false, message: 'A valid pull request number is required.' });
    }
    if (!['opened', 'closed', 'synchronize', 'reopened'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Unsupported pull request action.' });
    }
    const { project } = await verifyProjectAccess(projectId, req.user);
    const owner = project.github?.owner || project.githubRepository?.owner;
    const repo = project.github?.repository || project.githubRepository?.repo;

    if (!owner || !repo || (!project.github?.connected && !project.githubRepository?.connected)) {
      return res.status(400).json({
        success: false,
        message: 'No GitHub repository connected to this project.',
      });
    }

    const result = await webhookService.handleWebhook({
      event: 'pull_request',
      deliveryId: `simulation-${randomUUID()}`,
      payload: {
        action,
        repository: {
          full_name: `${owner}/${repo}`,
          name: repo,
          owner: { login: owner },
        },
        pull_request: {
          number: numericPrNumber,
          title: title || `Simulated PR #${prNumber}`,
          body,
          merged: Boolean(merged),
          html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
          user: { login: req.user.name || 'devflow-simulator', avatar_url: '' },
          head: { ref: 'devflow-simulation' },
          base: { ref: project.github?.defaultBranch || 'main' },
        },
      },
    });

    res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/github/webhook
 * Inbound real GitHub Webhook receiver with HMAC-SHA256 signature verification & idempotency
 */
export const handleGitHubWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'] || 'ping';
    const deliveryId = req.headers['x-github-delivery'];
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    // 1. Signature Verification (Section 11)
    const isValid = webhookService.verifySignature(rawBody, signature);

    if (!isValid) {
      console.warn(`[GitHub Webhook] Invalid HMAC signature received for delivery: ${deliveryId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature: HMAC SHA-256 digest mismatch.',
      });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid webhook JSON payload.' });
    }

    // 2. Respond immediately to ping
    if (event === 'ping') {
      return res.status(200).json({
        success: true,
        message: 'Pong! DevFlow GitHub Webhook receiver is healthy.',
        zen: payload?.zen,
      });
    }

    // 3. Process event through WebhookService (idempotency, PR transitions, issue linking)
    const result = await webhookService.handleWebhook({
      event,
      deliveryId,
      payload,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[GitHub Webhook Error]:', error);
    next(error);
  }
};
