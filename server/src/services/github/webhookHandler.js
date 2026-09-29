import crypto from 'crypto';
import { Project } from '../../models/Project.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Issue } from '../../models/Issue.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';
import { extractIssueNumbers } from './issueLinker.js';
import { analyzePullRequest } from '../ai/prAnalyzer.js';

/**
 * Verify GitHub webhook HMAC-SHA256 signature
 */
export function verifyGitHubSignature(payload, signature, secret) {
  if (!secret) return true; // If no secret configured in development, bypass check
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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

  const prFields = {
    project: project._id,
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

  // Detect issue references in PR title or body
  const combinedText = `${prData.title} ${prData.body || ''}`;
  const issueNumbers = extractIssueNumbers(combinedText);

  if (issueNumbers.length > 0) {
    const linkedIssues = await Issue.find({
      project: project._id,
      issueNumber: { $in: issueNumbers },
    });

    for (const issue of linkedIssues) {
      if (!issue.linkedPullRequests.includes(pullRequest._id)) {
        issue.linkedPullRequests.push(pullRequest._id);
      }

      // If PR was merged, update issue status to RESOLVED if configured
      if (isMerged && project.settings?.autoCloseOnMerge !== false) {
        issue.status = 'RESOLVED';
      } else if (action === 'opened' || action === 'synchronize') {
        if (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') {
          issue.status = 'IN_REVIEW';
        }
      }

      await issue.save();

      // Ensure issue link is saved on the PR
      pullRequest.issue = issue._id;
      await pullRequest.save();

      // Trigger automatic AI PR analysis if newly opened/updated
      if (action === 'opened' || action === 'synchronize' || !pullRequest.aiAnalysis?.summary) {
        const analysis = await analyzePullRequest({ issue, pullRequest });
        pullRequest.aiAnalysis = analysis;
        await pullRequest.save();
      }

      // Record Activity
      await Activity.create({
        project: project._id,
        issue: issue._id,
        actor: project.owner,
        action: isMerged ? 'MERGED_PR' : action === 'opened' ? 'LINKED_PR' : 'UPDATED_PR',
        entityType: 'PR',
        entityId: pullRequest._id.toString(),
        metadata: {
          prNumber: pullRequest.prNumber,
          prTitle: pullRequest.title,
          isMerged,
          action,
        },
      });

      // Notification
      const recipient = issue.assignee || issue.reporter || project.owner;
      if (recipient) {
        await Notification.create({
          recipient,
          sender: project.owner,
          project: project._id,
          issue: issue._id,
          title: isMerged ? `PR #${pullRequest.prNumber} Merged` : `PR #${pullRequest.prNumber} Updated`,
          message: isMerged
            ? `Pull Request #${pullRequest.prNumber} was merged and Issue #${issue.issueNumber} was marked RESOLVED!`
            : `Pull Request #${pullRequest.prNumber} ("${pullRequest.title}") status changed: ${action}`,
          type: isMerged ? 'PR_MERGED' : 'PR_LINKED',
        });
      }
    }
  }

  return {
    success: true,
    message: `Processed PR #${prData.number} (${action})`,
    pullRequest,
    linkedIssueNumbers: issueNumbers,
  };
}
