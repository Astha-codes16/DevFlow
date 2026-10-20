import crypto from 'crypto';
import { Project } from '../../models/Project.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Issue } from '../../models/Issue.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';
import { extractIssueNumbers, linkIssueToPullRequest } from './issueLinker.js';
import { analyzePullRequest } from '../ai/prAnalyzer.js';
import { pullRequestLifecycleService } from './pullRequestLifecycleService.js';

/**
 * Verify GitHub webhook HMAC-SHA256 signature
 */
export function verifyGitHubSignature(payload, signature, secret) {
  if (!secret) return false;
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  
  try {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const digestBuffer = Buffer.from(digest, 'utf8');
    return signatureBuffer.length === digestBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, digestBuffer);
  } catch {
    return false;
  }
}

/**
 * Handle incoming GitHub webhook event
 */
export async function handleWebhookEvent(event, payload) {
  const repoName = payload.repository?.name;
  const repoOwner = payload.repository?.owner?.login;

  if (!repoName || !repoOwner) {
    return { success: false, message: 'Missing repository payload' };
  }

  // Find corresponding DevFlow project
  const project = await Project.findOne({
    'githubRepository.owner': new RegExp(`^${repoOwner}$`, 'i'),
    'githubRepository.repo': new RegExp(`^${repoName}$`, 'i'),
  });

  if (!project) {
    return { success: true, message: 'Webhook received but no matching DevFlow project connected.' };
  }

  if (event === 'pull_request') {
    return await handlePullRequestEvent(payload, project);
  }

  return { success: true, message: `Event ${event} recorded without state transition.` };
}

async function handlePullRequestEvent(payload, project) {
  const action = payload.action; // opened, closed, synchronize, reopened
  const prData = payload.pull_request;
  const isMerged = Boolean(prData.merged);

  let prStatus = 'OPEN';
  if (isMerged) {
    prStatus = 'MERGED';
  } else if (action === 'closed') {
    prStatus = 'CLOSED';
  }

  // Upsert PullRequest document
  let pullRequest = await PullRequest.findOne({
    project: project._id,
    prNumber: prData.number,
  });

  if (
    pullRequest &&
    ((pullRequest.repositoryOwner && pullRequest.repositoryOwner.toLowerCase() !== repoOwner.toLowerCase()) ||
      (pullRequest.repositoryName && pullRequest.repositoryName.toLowerCase() !== repoName.toLowerCase()))
  ) {
    throw new Error(`Pull Request #${prData.number} belongs to a different repository.`);
  }

  const prFields = {
    project: project._id,
    repositoryOwner: repoOwner,
    repositoryName: repoName,
    prNumber: prData.number,
    title: prData.title,
    body: prData.body || '',
    htmlUrl: prData.html_url,
    author: {
      login: prData.user?.login || 'developer',
      avatarUrl: prData.user?.avatar_url || '',
    },
    status: prStatus,
    headBranch: prData.head?.ref || '',
    baseBranch: prData.base?.ref || 'main',
    changedFilesCount: prData.changed_files || 0,
    additions: prData.additions || 0,
    deletions: prData.deletions || 0,
  };

  if (!pullRequest) {
    pullRequest = await PullRequest.create(prFields);
  } else {
    Object.assign(pullRequest, prFields);
    await pullRequest.save();
  }

  const lifecycleResult = await pullRequestLifecycleService.syncPullRequestLifecycle({
    project,
    pullRequest,
    action,
    isMerged,
    actorId: project.owner,
    changedFiles: prData.changed_files,
  });

  return {
    success: true,
    message: `Processed PR #${prData.number} (${action})`,
    pullRequest,
    linkedIssueNumbers: lifecycleResult.linkedIssueNumbers,
  };
}
