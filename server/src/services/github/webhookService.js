import crypto from 'crypto';
import { Project } from '../../models/Project.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Issue } from '../../models/Issue.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';
import { WebhookDelivery } from '../../models/WebhookDelivery.js';
import { extractIssueNumbers } from './issueLinker.js';
import { analyzePullRequest } from '../ai/prAnalyzer.js';
import { pullRequestService } from './pullRequestService.js';

export class WebhookService {
  /**
   * Verifies GitHub HMAC-SHA256 signature
   */
  verifySignature(rawBody, signature, secret = process.env.GITHUB_WEBHOOK_SECRET) {
    if (!secret) return true; // Bypass only if no secret is configured
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  }

  /**
   * Main webhook entrypoint with idempotency check
   */
  async handleWebhook({ event, deliveryId, payload }) {
    const repoFullName = payload.repository?.full_name;
    const repoOwner = payload.repository?.owner?.login;
    const repoName = payload.repository?.name;

    if (!repoOwner || !repoName) {
      return { success: false, message: 'Invalid payload: missing repository details' };
    }

    // 1. Idempotency Check (Section 12)
    if (deliveryId) {
      const existing = await WebhookDelivery.findOne({ deliveryId });
      if (existing) {
        return {
          success: true,
          duplicate: true,
          message: `Webhook delivery ${deliveryId} was already processed (idempotency hit).`,
        };
      }

      await WebhookDelivery.create({
        deliveryId,
        event,
        action: payload.action || '',
        repository: repoFullName || `${repoOwner}/${repoName}`,
      });
    }

    // 2. Find matching DevFlow Project
    const project = await Project.findOne({
      $or: [
        {
          'github.owner': new RegExp(`^${repoOwner}$`, 'i'),
          'github.repository': new RegExp(`^${repoName}$`, 'i'),
        },
        {
          'githubRepository.owner': new RegExp(`^${repoOwner}$`, 'i'),
          'githubRepository.repo': new RegExp(`^${repoName}$`, 'i'),
        },
      ],
    });

    if (!project) {
      return {
        success: true,
        message: `Webhook received for ${repoOwner}/${repoName}, but no matching connected DevFlow project found.`,
      };
    }

    // 3. Dispatch by event type
    if (event === 'pull_request') {
      return await this.handlePullRequestEvent(payload, project);
    } else if (event === 'push') {
      return await this.handlePushEvent(payload, project);
    }

    return { success: true, message: `Event ${event} recorded.` };
  }

  async handlePullRequestEvent(payload, project) {
    const action = payload.action;
    const prData = payload.pull_request;
    const isMerged = Boolean(prData.merged);

    let status = 'OPEN';
    if (isMerged) {
      status = 'MERGED';
    } else if (action === 'closed') {
      status = 'CLOSED';
    } else if (prData.draft) {
      status = 'DRAFT';
    }

    // Upsert PullRequest
    let pullRequest = await PullRequest.findOne({
      project: project._id,
      prNumber: prData.number,
    });

    const updateFields = {
      project: project._id,
      prNumber: prData.number,
      title: prData.title,
      body: prData.body || '',
      htmlUrl: prData.html_url,
      author: {
        login: prData.user?.login || 'developer',
        avatarUrl: prData.user?.avatar_url || '',
      },
      status,
      headBranch: prData.head?.ref || '',
      baseBranch: prData.base?.ref || 'main',
      changedFilesCount: prData.changed_files || 0,
      additions: prData.additions || 0,
      deletions: prData.deletions || 0,
    };

    if (!pullRequest) {
      pullRequest = await PullRequest.create(updateFields);
    } else {
      Object.assign(pullRequest, updateFields);
      await pullRequest.save();
    }

    // Extract referenced issue numbers
    const combinedText = `${prData.title} ${prData.body || ''}`;
    const issueNumbers = extractIssueNumbers(combinedText, project.key);

    const matchedIssues = await Issue.find({
      project: project._id,
      issueNumber: { $in: issueNumbers },
    });

    for (const issue of matchedIssues) {
      if (!issue.linkedPullRequests.includes(pullRequest._id)) {
        issue.linkedPullRequests.push(pullRequest._id);
      }

      pullRequest.issue = issue._id;
      await pullRequest.save();

      // State Transitions based on PR event
      if (isMerged && project.settings?.autoCloseOnMerge !== false) {
        issue.status = 'RESOLVED';
      } else if (action === 'opened' || action === 'reopened') {
        if (issue.status === 'OPEN') {
          issue.status = 'IN_REVIEW';
        }
      }

      await issue.save();

      // Activity Logging
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
          action,
          isMerged,
          htmlUrl: pullRequest.htmlUrl,
        },
      });

      // Notify Assignee and Reporter
      const notifyUsers = new Set([issue.assignee?.toString(), issue.reporter?.toString()]);
      for (const recipientId of notifyUsers) {
        if (recipientId) {
          await Notification.create({
            recipient: recipientId,
            sender: project.owner,
            project: project._id,
            issue: issue._id,
            title: isMerged ? `PR #${pullRequest.prNumber} Merged` : `PR #${pullRequest.prNumber} ${action}`,
            message: isMerged
              ? `PR #${pullRequest.prNumber} was merged! Issue #${issue.issueNumber} automatically moved to RESOLVED.`
              : `PR #${pullRequest.prNumber} ("${pullRequest.title}") status updated to ${status}.`,
            type: isMerged ? 'PR_MERGED' : 'PR_LINKED',
          });
        }
      }

      // Run AI PR Analysis if opened or synchronize
      if (action === 'opened' || action === 'synchronize' || !pullRequest.aiAnalysis?.summary) {
        try {
          const analysis = await analyzePullRequest({
            issue,
            pullRequest,
          });
          pullRequest.aiAnalysis = analysis;
          await pullRequest.save();
        } catch (aiErr) {
          console.warn(`[WebhookService] AI PR analysis failed: ${aiErr.message}`);
        }
      }
    }

    return {
      success: true,
      message: `Processed PR #${prData.number} (${action})`,
      prNumber: prData.number,
      status,
      linkedIssues: issueNumbers,
    };
  }

  async handlePushEvent(payload, project) {
    const pusher = payload.pusher?.name || payload.sender?.login || 'developer';
    const ref = payload.ref || 'refs/heads/main';
    const branch = ref.replace('refs/heads/', '');
    const commitsCount = (payload.commits || []).length;

    await Activity.create({
      project: project._id,
      actor: project.owner,
      action: 'PUSH_COMMITS',
      entityType: 'PROJECT',
      entityId: project._id.toString(),
      metadata: {
        branch,
        pusher,
        commitsCount,
        headCommit: payload.head_commit?.message?.split('\n')[0] || '',
      },
    });

    return {
      success: true,
      message: `Recorded push event with ${commitsCount} commits on ${branch}.`,
    };
  }
}

export const webhookService = new WebhookService();
