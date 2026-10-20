import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Project } from '../../models/Project.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Issue } from '../../models/Issue.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';
import { WebhookDelivery } from '../../models/WebhookDelivery.js';
import { extractIssueNumbers, linkIssueToPullRequest } from './issueLinker.js';
import { analyzePullRequest } from '../ai/prAnalyzer.js';
import { pullRequestService } from './pullRequestService.js';
import { pullRequestLifecycleService } from './pullRequestLifecycleService.js';

export class WebhookService {
  /**
   * Verifies GitHub HMAC-SHA256 signature
   */
  verifySignature(rawBody, signature, secret = process.env.GITHUB_WEBHOOK_SECRET) {
    if (!secret) return false;
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
      const signatureBuffer = Buffer.from(signature, 'utf8');
      const digestBuffer = Buffer.from(digest, 'utf8');
      return signatureBuffer.length === digestBuffer.length &&
        crypto.timingSafeEqual(signatureBuffer, digestBuffer);
    } catch {
      return false;
    }
  }

  async claimDelivery({ deliveryId, event, action, repository }) {
    if (!deliveryId) return null;

    const claimToken = randomUUID();
    const delivery = await WebhookDelivery.findOneAndUpdate(
      { deliveryId },
      {
        $setOnInsert: {
          deliveryId,
          event,
          action,
          repository,
          status: 'PROCESSING',
          attempts: 1,
          claimToken,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('+claimToken');

    if (delivery.claimToken === claimToken) return { claimToken };
    if (delivery.status === 'COMPLETED' || (!delivery.status && delivery.processedAt)) {
      return { duplicate: true, message: `Webhook delivery ${deliveryId} was already processed.` };
    }
    if (delivery.status === 'PROCESSING') {
      return { duplicate: true, message: `Webhook delivery ${deliveryId} is already being processed.` };
    }

    const retry = await WebhookDelivery.findOneAndUpdate(
      { deliveryId, status: 'FAILED' },
      {
        $set: { status: 'PROCESSING', claimToken, lastError: '' },
        $inc: { attempts: 1 },
      },
      { new: true }
    ).select('+claimToken');

    if (retry?.claimToken === claimToken) return { claimToken };
    return { duplicate: true, message: `Webhook delivery ${deliveryId} is already being processed.` };
  }

  async completeDelivery(deliveryId, claimToken) {
    await WebhookDelivery.updateOne(
      { deliveryId, status: 'PROCESSING', claimToken },
      { $set: { status: 'COMPLETED', processedAt: new Date(), claimToken: '' } }
    );
  }

  async failDelivery(deliveryId, claimToken) {
    await WebhookDelivery.updateOne(
      { deliveryId, status: 'PROCESSING', claimToken },
      { $set: { status: 'FAILED', lastError: 'processing_failed', claimToken: '' }, $unset: { processedAt: 1 } }
    );
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

    const deliveryClaim = await this.claimDelivery({
      deliveryId,
      event,
      action: payload.action || '',
      repository: repoFullName || `${repoOwner}/${repoName}`,
    });
    if (deliveryClaim?.duplicate) {
      return { success: true, duplicate: true, message: deliveryClaim.message };
    }

    try {
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
        const result = {
          success: true,
          message: `Webhook received for ${repoOwner}/${repoName}, but no matching connected DevFlow project found.`,
        };
        if (deliveryClaim) await this.completeDelivery(deliveryId, deliveryClaim.claimToken);
        return result;
      }

      // 3. Dispatch by event type
      let result;
      if (event === 'pull_request') {
        result = await this.handlePullRequestEvent(payload, project);
      } else if (event === 'push') {
        result = await this.handlePushEvent(payload, project);
      } else {
        result = { success: true, message: `Event ${event} recorded.` };
      }

      if (deliveryClaim) await this.completeDelivery(deliveryId, deliveryClaim.claimToken);
      return result;
    } catch (error) {
      if (deliveryClaim) await this.failDelivery(deliveryId, deliveryClaim.claimToken);
      throw error;
    }
  }

  async handlePullRequestEvent(payload, project) {
    const action = payload.action;
    const prData = payload.pull_request;
    const repoOwner = payload.repository?.owner?.login || project.github?.owner || project.githubRepository?.owner;
    const repoName = payload.repository?.name || project.github?.repository || project.githubRepository?.repo;
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

    if (
      pullRequest &&
      ((pullRequest.repositoryOwner && pullRequest.repositoryOwner.toLowerCase() !== repoOwner.toLowerCase()) ||
        (pullRequest.repositoryName && pullRequest.repositoryName.toLowerCase() !== repoName.toLowerCase()))
    ) {
      throw new Error(`Pull Request #${prData.number} belongs to a different repository.`);
    }

    const updateFields = {
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
      prNumber: prData.number,
      status: pullRequest.status,
      linkedIssues: lifecycleResult.linkedIssueNumbers,
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
