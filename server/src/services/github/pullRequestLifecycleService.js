import mongoose from 'mongoose';
import { Project } from '../../models/Project.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Issue } from '../../models/Issue.js';
import { IssuePullRequest } from '../../models/IssuePullRequest.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';
import { extractIssueNumbers, linkIssueToPullRequest } from './issueLinker.js';
import { analyzePullRequest } from '../ai/prAnalyzer.js';

export class PullRequestLifecycleService {
  constructor() {
    this._locks = new Map();
  }

  async _withLock(key, fn) {
    const prev = this._locks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this._locks.set(key, current);

    try {
      await prev.catch(() => {});
      return await fn();
    } finally {
      if (this._locks.get(key) === current) {
        this._locks.delete(key);
      }
      release();
    }
  }

  /**
   * Applies unified PR lifecycle processing across webhooks, manual sync, and manual links.
   *
   * @param {Object} params
   * @param {Object} params.project - Project Mongoose document or project object
   * @param {Object} params.pullRequest - PullRequest Mongoose document
   * @param {string} [params.action='opened'] - Event action: 'opened', 'closed', 'reopened', 'synchronize', 'sync', 'manual_link'
   * @param {boolean} [params.isMerged=null] - Whether the PR is merged
   * @param {ObjectId|string} [params.actorId=null] - User ID initiating the event
   * @param {Array} [params.changedFiles=[]] - Changed files for AI analysis
   * @returns {Promise<{ pullRequest: Object, linkedIssueNumbers: number[], resolvedIssueNumbers: number[] }>}
   */
  async syncPullRequestLifecycle(params) {
    const { project, pullRequest } = params || {};
    const projId = (project?._id || project)?.toString() || 'global';
    const prKey = pullRequest?.prNumber ? `pr:${pullRequest.prNumber}` : `id:${pullRequest?._id || 'unknown'}`;
    const lockKey = `${projId}:${prKey}`;

    return this._withLock(lockKey, () => this._executeLifecycleSync(params));
  }

  async _executeLifecycleSync({
    project,
    pullRequest,
    action = 'opened',
    isMerged = null,
    actorId = null,
    changedFiles = [],
  }) {
    let projectDoc = project;
    if (project && (!project.settings || !project.key) && mongoose.Types.ObjectId.isValid(project._id || project)) {
      projectDoc = await Project.findById(project._id || project);
    }

    if (pullRequest?._id) {
      const freshPR = await PullRequest.findById(pullRequest._id);
      if (freshPR) {
        pullRequest = freshPR;
      }
    }

    const merged = isMerged !== null ? Boolean(isMerged) : pullRequest.status === 'MERGED';

    // 1. Reconcile PR document status
    if (merged) {
      pullRequest.status = 'MERGED';
    } else if (action === 'closed' || pullRequest.status === 'CLOSED') {
      pullRequest.status = 'CLOSED';
    } else if (pullRequest.status === 'DRAFT') {
      pullRequest.status = 'DRAFT';
    } else {
      pullRequest.status = 'OPEN';
    }
    await pullRequest.save();

    // 2. Extract issue references from PR text and link newly discovered issues
    const combinedText = `${pullRequest.title || ''} ${pullRequest.body || ''}`;
    const extractedNumbers = extractIssueNumbers(combinedText, projectDoc?.key);

    if (extractedNumbers.length > 0) {
      const referencedIssues = await Issue.find({
        project: projectDoc._id,
        issueNumber: { $in: extractedNumbers },
      });

      for (const issue of referencedIssues) {
        const relationship = await linkIssueToPullRequest({
          issue,
          pullRequest,
          actorId,
          repositoryOwner: pullRequest.repositoryOwner,
          repositoryName: pullRequest.repositoryName,
          transitionStatus: false, // Lifecycle service manages status below
        });

        // Record LINKED_PR activity and notification if newly linked
        if (relationship.created) {
          await Activity.findOneAndUpdate(
            {
              project: projectDoc._id,
              issue: issue._id,
              entityType: 'PR',
              entityId: pullRequest._id.toString(),
              action: 'LINKED_PR',
            },
            {
              $setOnInsert: {
                project: projectDoc._id,
                issue: issue._id,
                actor: actorId || projectDoc.owner,
                action: 'LINKED_PR',
                entityType: 'PR',
                entityId: pullRequest._id.toString(),
                metadata: {
                  prNumber: pullRequest.prNumber,
                  prTitle: pullRequest.title,
                  htmlUrl: pullRequest.htmlUrl,
                },
                timestamp: new Date(),
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          const notifyTarget = issue.assignee || issue.reporter;
          if (notifyTarget && notifyTarget.toString() !== actorId?.toString()) {
            await Notification.findOneAndUpdate(
              {
                recipient: notifyTarget,
                project: projectDoc._id,
                issue: issue._id,
                type: 'PR_LINKED',
                title: `PR #${pullRequest.prNumber} Linked`,
              },
              {
                $setOnInsert: {
                  recipient: notifyTarget,
                  sender: actorId || projectDoc.owner,
                  project: projectDoc._id,
                  issue: issue._id,
                  title: `PR #${pullRequest.prNumber} Linked`,
                  message: `GitHub Pull Request #${pullRequest.prNumber} "${pullRequest.title}" was linked to Issue #${issue.issueNumber}`,
                  type: 'PR_LINKED',
                  read: false,
                },
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }
        }
      }
    }

    // 3. Find all issues linked to this PR via canonical IssuePullRequest & linkedIssues
    const junctionLinks = await IssuePullRequest.find({
      project: projectDoc._id,
      pullRequest: pullRequest._id,
    }).select('issue');

    const issueIds = new Set([
      ...junctionLinks.map((jl) => jl.issue.toString()),
      ...(pullRequest.linkedIssues || []).map((id) => id.toString()),
    ]);
    if (pullRequest.issue) {
      issueIds.add(pullRequest.issue.toString());
    }

    const allLinkedIssues = await Issue.find({
      _id: { $in: Array.from(issueIds) },
      project: projectDoc._id,
    });

    const resolvedIssueNumbers = [];
    const autoClose = projectDoc?.settings?.autoCloseOnMerge !== false;

    // 4. State transitions across linked issues
    for (const issue of allLinkedIssues) {
      if (merged) {
        // Resolve issue if autoClose is enabled and issue is not already CLOSED
        if (autoClose && issue.status !== 'CLOSED') {
          if (issue.status !== 'RESOLVED') {
            issue.status = 'RESOLVED';
            await issue.save();
            resolvedIssueNumbers.push(issue.issueNumber);
          }

          // Atomic upsert Activity: MERGED_PR
          await Activity.findOneAndUpdate(
            {
              project: projectDoc._id,
              issue: issue._id,
              entityType: 'PR',
              entityId: pullRequest._id.toString(),
              action: 'MERGED_PR',
            },
            {
              $setOnInsert: {
                project: projectDoc._id,
                issue: issue._id,
                actor: actorId || projectDoc.owner,
                action: 'MERGED_PR',
                entityType: 'PR',
                entityId: pullRequest._id.toString(),
                metadata: {
                  prNumber: pullRequest.prNumber,
                  prTitle: pullRequest.title,
                  action: action || 'closed',
                  isMerged: true,
                  htmlUrl: pullRequest.htmlUrl,
                },
                timestamp: new Date(),
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Atomic upsert Notification: PR_MERGED
          const notifyUsers = new Set([issue.assignee?.toString(), issue.reporter?.toString()]);
          for (const recipientId of notifyUsers) {
            if (recipientId) {
              await Notification.findOneAndUpdate(
                {
                  recipient: recipientId,
                  project: projectDoc._id,
                  issue: issue._id,
                  type: 'PR_MERGED',
                  title: `PR #${pullRequest.prNumber} Merged`,
                },
                {
                  $setOnInsert: {
                    recipient: recipientId,
                    sender: actorId || projectDoc.owner,
                    project: projectDoc._id,
                    issue: issue._id,
                    title: `PR #${pullRequest.prNumber} Merged`,
                    message: `PR #${pullRequest.prNumber} was merged! Issue #${issue.issueNumber} automatically moved to RESOLVED.`,
                    type: 'PR_MERGED',
                    read: false,
                  },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            }
          }
        }
      } else if (pullRequest.status === 'OPEN') {
        // Only move to IN_REVIEW if currently OPEN or IN_PROGRESS (never overwrite RESOLVED or CLOSED)
        if (['OPEN', 'IN_PROGRESS'].includes(issue.status)) {
          issue.status = 'IN_REVIEW';
          await issue.save();
        }

        // Atomic upsert update activity for synchronize/reopened
        if (['synchronize', 'reopened'].includes(action)) {
          await Activity.findOneAndUpdate(
            {
              project: projectDoc._id,
              issue: issue._id,
              entityType: 'PR',
              entityId: pullRequest._id.toString(),
              action: 'UPDATED_PR',
              'metadata.action': action,
            },
            {
              $setOnInsert: {
                project: projectDoc._id,
                issue: issue._id,
                actor: actorId || projectDoc.owner,
                action: 'UPDATED_PR',
                entityType: 'PR',
                entityId: pullRequest._id.toString(),
                metadata: {
                  prNumber: pullRequest.prNumber,
                  prTitle: pullRequest.title,
                  action,
                  isMerged: false,
                  htmlUrl: pullRequest.htmlUrl,
                },
                timestamp: new Date(),
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      } else if (pullRequest.status === 'CLOSED') {
        // Closed without merge: preserve issue status as required by constraint 6
      }
    }

    // 5. Minimal AI PR analysis (only when opened/synchronize, not on every sync)
    const shouldRunAi =
      allLinkedIssues.length > 0 &&
      (action === 'opened' || action === 'synchronize' || (!pullRequest.aiAnalysis?.summary && action !== 'sync'));

    if (shouldRunAi) {
      try {
        const analysis = await analyzePullRequest({
          issue: allLinkedIssues[0],
          pullRequest,
          changedFiles: changedFiles.length > 0 ? changedFiles : pullRequest.changedFiles || [],
        });
        pullRequest.aiAnalysis = analysis;
        await pullRequest.save();
      } catch (aiErr) {
        console.warn(`[PullRequestLifecycleService] AI PR analysis failed: ${aiErr.message}`);
      }
    }

    return {
      pullRequest,
      linkedIssueNumbers: allLinkedIssues.map((i) => i.issueNumber),
      resolvedIssueNumbers,
    };
  }
}

export const pullRequestLifecycleService = new PullRequestLifecycleService();
