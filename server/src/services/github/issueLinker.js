import mongoose from 'mongoose';
import { Issue } from '../../models/Issue.js';
import { PullRequest } from '../../models/PullRequest.js';
import { Activity } from '../../models/Activity.js';
import { Notification } from '../../models/Notification.js';

/**
 * Extracts issue numbers from PR text supporting both plain (#124)
 * and project-scoped (DEVFLOW-124, FLOW-124) conventions.
 */
export function extractIssueNumbers(text, projectKey = null) {
  if (!text) return [];
  const numbers = new Set();

  // Pattern 1: Fixes #124, Closes #124, Resolves #124, #124
  const standardRegex = /(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s*#(\d+)|#(\d+)/gi;
  let match;
  while ((match = standardRegex.exec(text)) !== null) {
    const num = match[1] || match[2];
    if (num) numbers.add(parseInt(num, 10));
  }

  // Pattern 2: Project key based references (e.g. Fixes FLOW-124, DEVFLOW-124, FLOW #124)
  const keyPattern = projectKey ? `${projectKey}|DEVFLOW` : '[A-Z]{2,10}';
  const scopedRegex = new RegExp(`(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\\s*(?:${keyPattern})[-_\\s]#?(\\d+)`, 'gi');
  while ((match = scopedRegex.exec(text)) !== null) {
    if (match[1]) numbers.add(parseInt(match[1], 10));
  }

  return Array.from(numbers);
}

/**
 * Links a PullRequest document with matching issues in the project
 */
export async function linkPRToIssues({ pullRequest, projectId, projectKey = null, actorId = null }) {
  const combinedText = `${pullRequest.title} ${pullRequest.body || ''}`;
  const issueNumbers = extractIssueNumbers(combinedText, projectKey);

  if (issueNumbers.length === 0) return [];

  const matchedIssues = await Issue.find({
    project: projectId,
    issueNumber: { $in: issueNumbers },
  });

  const linkedIssues = [];

  for (const issue of matchedIssues) {
    if (!issue.linkedPullRequests.includes(pullRequest._id)) {
      issue.linkedPullRequests.push(pullRequest._id);

      // Transition to IN_REVIEW if currently OPEN
      if (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') {
        issue.status = 'IN_REVIEW';
      }

      await issue.save();
      linkedIssues.push(issue);

      // Associate issue on PR
      if (!pullRequest.issue) {
        pullRequest.issue = issue._id;
        await pullRequest.save();
      }

      // Log Activity
      await Activity.create({
        project: projectId,
        issue: issue._id,
        actor: actorId || issue.reporter,
        action: 'LINKED_PR',
        entityType: 'PR',
        entityId: pullRequest._id.toString(),
        metadata: {
          prNumber: pullRequest.prNumber,
          prTitle: pullRequest.title,
          htmlUrl: pullRequest.htmlUrl,
        },
      });

      // Send Notification to assignee / reporter
      const notifyTarget = issue.assignee || issue.reporter;
      if (notifyTarget && notifyTarget.toString() !== actorId?.toString()) {
        await Notification.create({
          recipient: notifyTarget,
          sender: actorId || issue.reporter,
          project: projectId,
          issue: issue._id,
          title: `PR #${pullRequest.prNumber} Linked`,
          message: `GitHub Pull Request #${pullRequest.prNumber} "${pullRequest.title}" was linked to Issue #${issue.issueNumber}`,
          type: 'PR_LINKED',
        });
      }
    }
  }

  return linkedIssues;
}

/**
 * Manually links a specific PR to an issue (accepts prNumber, prId string, or ObjectId)
 */
export async function manualLinkPR(issueId, prIdentifier, actorId) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    const error = new Error(`Issue not found with ID ${issueId}`);
    error.statusCode = 404;
    throw error;
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    const error = new Error('Issue not found');
    error.statusCode = 404;
    throw error;
  }

  let pullRequest = null;
  const strVal = String(prIdentifier || '').replace(/^#/, '').trim();
  const parsedNum = parseInt(strVal, 10);

  if (!isNaN(parsedNum) && parsedNum > 0) {
    pullRequest = await PullRequest.findOne({ project: issue.project, prNumber: parsedNum });
  }

  if (!pullRequest && mongoose.Types.ObjectId.isValid(strVal)) {
    pullRequest = await PullRequest.findById(strVal);
  }

  if (!pullRequest) {
    const error = new Error(`Pull Request "${prIdentifier}" not found for this project.`);
    error.statusCode = 404;
    throw error;
  }

  if (!issue.linkedPullRequests.includes(pullRequest._id)) {
    issue.linkedPullRequests.push(pullRequest._id);
    if (issue.status === 'OPEN') issue.status = 'IN_REVIEW';
    await issue.save();
  }

  pullRequest.issue = issue._id;
  await pullRequest.save();

  await Activity.create({
    project: issue.project,
    issue: issue._id,
    actor: actorId,
    action: 'LINKED_PR',
    entityType: 'PR',
    entityId: pullRequest._id.toString(),
    metadata: {
      prNumber: pullRequest.prNumber,
      prTitle: pullRequest.title,
      htmlUrl: pullRequest.htmlUrl,
    },
  });

  return { issue, pullRequest };
}

/**
 * Unlinks a PR from an issue
 */
export async function unlinkPRFromIssue(issueId, prNumber, actorId) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    const error = new Error(`Issue not found with ID ${issueId}`);
    error.statusCode = 404;
    throw error;
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    const error = new Error('Issue not found');
    error.statusCode = 404;
    throw error;
  }

  const pullRequest = await PullRequest.findOne({
    project: issue.project,
    prNumber: parseInt(prNumber, 10),
  });

  if (!pullRequest) {
    const error = new Error(`Pull Request #${prNumber} not found.`);
    error.statusCode = 404;
    throw error;
  }

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
    actor: actorId,
    action: 'UNLINKED_PR',
    entityType: 'PR',
    entityId: pullRequest._id.toString(),
    metadata: { prNumber: pullRequest.prNumber },
  });

  return { issue, pullRequest };
}
