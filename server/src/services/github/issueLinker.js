import mongoose from 'mongoose';
import { Issue } from '../../models/Issue.js';
import { PullRequest } from '../../models/PullRequest.js';
import { IssuePullRequest } from '../../models/IssuePullRequest.js';
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

const sameId = (left, right) => left?.toString() === right?.toString();

const relationshipError = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

export async function linkIssueToPullRequest({
  issue,
  pullRequest,
  actorId = null,
  transitionStatus = true,
  repositoryOwner = null,
  repositoryName = null,
}) {
  if (!issue || !pullRequest || !sameId(issue.project, pullRequest.project)) {
    throw relationshipError('Issue and pull request must belong to the same project.');
  }
  if (
    (repositoryOwner && pullRequest.repositoryOwner && repositoryOwner.toLowerCase() !== pullRequest.repositoryOwner.toLowerCase()) ||
    (repositoryName && pullRequest.repositoryName && repositoryName.toLowerCase() !== pullRequest.repositoryName.toLowerCase())
  ) {
    throw relationshipError('Issue and pull request must belong to the same repository.');
  }

  if (repositoryOwner && !pullRequest.repositoryOwner) pullRequest.repositoryOwner = repositoryOwner;
  if (repositoryName && !pullRequest.repositoryName) pullRequest.repositoryName = repositoryName;

  const issueLinks = issue.linkedPullRequests || [];
  const pullRequestLinks = pullRequest.linkedIssues || [];
  const legacyLinked = issueLinks.some((id) => sameId(id, pullRequest._id)) ||
    pullRequestLinks.some((id) => sameId(id, issue._id)) ||
    sameId(pullRequest.issue, issue._id);
  let relationshipCreated = true;

  try {
    await IssuePullRequest.create({
      project: issue.project,
      issue: issue._id,
      pullRequest: pullRequest._id,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    relationshipCreated = false;
  }

  if (!issueLinks.some((id) => sameId(id, pullRequest._id))) {
    issue.linkedPullRequests = [...issueLinks, pullRequest._id];
  }
  if (!pullRequestLinks.some((id) => sameId(id, issue._id))) {
    pullRequest.linkedIssues = [...pullRequestLinks, issue._id];
  }
  if (transitionStatus && !legacyLinked && relationshipCreated && ['OPEN', 'IN_PROGRESS'].includes(issue.status)) {
    issue.status = 'IN_REVIEW';
  }

  await Promise.all([
    Issue.updateOne({ _id: issue._id, project: issue.project }, { $addToSet: { linkedPullRequests: pullRequest._id } }),
    PullRequest.updateOne({ _id: pullRequest._id, project: pullRequest.project }, { $addToSet: { linkedIssues: issue._id } }),
    transitionStatus && !legacyLinked && relationshipCreated
      ? Issue.updateOne({ _id: issue._id, status: { $in: ['OPEN', 'IN_PROGRESS'] } }, { $set: { status: 'IN_REVIEW' } })
      : Promise.resolve(),
  ]);

  if (!pullRequest.issue) {
    const firstRelationship = await IssuePullRequest.findOne({
      project: pullRequest.project,
      pullRequest: pullRequest._id,
    }).sort({ createdAt: 1 });
    if (firstRelationship) {
      await PullRequest.updateOne(
        { _id: pullRequest._id, project: pullRequest.project },
        { $set: { issue: firstRelationship.issue } }
      );
      pullRequest.issue = firstRelationship.issue;
    }
  }

  const [updatedIssue, updatedPullRequest] = await Promise.all([
    Issue.findById(issue._id),
    PullRequest.findById(pullRequest._id),
  ]);
  return { created: !legacyLinked && relationshipCreated, issue: updatedIssue, pullRequest: updatedPullRequest };
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
    const relationship = await linkIssueToPullRequest({
      issue,
      pullRequest,
      actorId,
      repositoryOwner: pullRequest.repositoryOwner,
      repositoryName: pullRequest.repositoryName,
    });
    if (!relationship.created) continue;

    linkedIssues.push(issue);
    await Activity.findOneAndUpdate(
      {
        project: projectId,
        issue: issue._id,
        entityType: 'PR',
        entityId: pullRequest._id.toString(),
        action: 'LINKED_PR',
      },
      {
        $setOnInsert: {
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
          project: projectId,
          issue: issue._id,
          type: 'PR_LINKED',
          title: `PR #${pullRequest.prNumber} Linked`,
        },
        {
          $setOnInsert: {
            recipient: notifyTarget,
            sender: actorId || issue.reporter,
            project: projectId,
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
    pullRequest = await PullRequest.findOne({ _id: strVal, project: issue.project });
  }

  if (!pullRequest) {
    const error = new Error(`Pull Request "${prIdentifier}" not found for this project.`);
    error.statusCode = 404;
    throw error;
  }

  const relationship = await linkIssueToPullRequest({ issue, pullRequest, actorId });
  if (!relationship.created) return relationship;

  await Activity.findOneAndUpdate(
    {
      project: issue.project,
      issue: issue._id,
      entityType: 'PR',
      entityId: pullRequest._id.toString(),
      action: 'LINKED_PR',
    },
    {
      $setOnInsert: {
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
        timestamp: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

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

  const issueWasLinked = (issue.linkedPullRequests || []).some((id) => sameId(id, pullRequest._id));
  const pullRequestWasLinked = (pullRequest.linkedIssues || []).some((id) => sameId(id, issue._id));
  const legacyWasLinked = sameId(pullRequest.issue, issue._id);
  const relationship = await IssuePullRequest.exists({
    project: issue.project,
    issue: issue._id,
    pullRequest: pullRequest._id,
  });
  if (!issueWasLinked && !pullRequestWasLinked && !legacyWasLinked && !relationship) {
    return { issue, pullRequest, removed: false };
  }

  await Promise.all([
    IssuePullRequest.deleteOne({
      project: issue.project,
      issue: issue._id,
      pullRequest: pullRequest._id,
    }),
    Issue.updateOne(
      { _id: issue._id, project: issue.project },
      { $pull: { linkedPullRequests: pullRequest._id } }
    ),
    PullRequest.updateOne(
      { _id: pullRequest._id, project: issue.project },
      { $pull: { linkedIssues: issue._id } }
    ),
  ]);

  const updatedPullRequest = await PullRequest.findById(pullRequest._id);
  if (legacyWasLinked) {
    await PullRequest.updateOne(
      { _id: pullRequest._id, issue: issue._id },
      { $set: { issue: updatedPullRequest.linkedIssues?.[0] || null } }
    );
  }
  const updatedIssue = await Issue.findById(issue._id);

  await Activity.create({
    project: issue.project,
    issue: issue._id,
    actor: actorId,
    action: 'UNLINKED_PR',
    entityType: 'PR',
    entityId: pullRequest._id.toString(),
    metadata: { prNumber: pullRequest.prNumber },
  });

  return {
    issue: updatedIssue,
    pullRequest: await PullRequest.findById(pullRequest._id),
    removed: true,
  };
}
