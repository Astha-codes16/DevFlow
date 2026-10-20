import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { PullRequest } from '../models/PullRequest.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

const CONFIRMATION = 'DELETE_DEVFLOW_DEMO_DATA';

const seededUsers = [
  { email: 'demo@devflow.ai', name: 'Demo Lead', role: 'ADMIN', githubUsername: 'devflow-demo' },
  { email: 'astha@devflow.ai', name: 'Astha Sharma', role: 'ADMIN', githubUsername: 'astha-devflow' },
  { email: 'rahul@devflow.ai', name: 'Rahul Verma', role: 'DEVELOPER', githubUsername: 'rahulverma-code' },
  { email: 'ananya@devflow.ai', name: 'Ananya Iyer', role: 'DEVELOPER', githubUsername: 'ananya-iyer' },
  { email: 'vikram@devflow.ai', name: 'Vikram Patel', role: 'DEVELOPER', githubUsername: 'vikram-patel' },
  { email: 'dev@devflow.ai', name: 'Dev Malik', role: 'VIEWER', githubUsername: 'dev-malik-qa' },
];

const seededProjects = {
  FLOW: {
    name: 'DevFlow Core Platform',
    description: 'AI-assisted developer workspace and issue resolution pipeline',
    issueNumbers: [118, 124, 125, 126, 127, 128, 129, 130, 131],
    prNumbers: [42, 48, 55],
  },
  SYNC: {
    name: 'CloudSync Microservice',
    description: 'High-performance distributed file synchronization engine and edge storage worker',
    issueNumbers: [1, 2, 3, 4],
    prNumbers: [],
  },
};

const seededIssueTitles = new Map([
  ['FLOW:118', 'Slow query on Kanban board load under high issue volume'],
  ['FLOW:124', 'Fix JWT expiration bug returning HTTP 500 instead of 401'],
  ['FLOW:125', 'Add GitHub webhook HMAC signature verification'],
  ['FLOW:126', 'Command palette (Ctrl+K) does not focus search input on Safari'],
  ['FLOW:127', 'Support fine-grained GitHub Personal Access Tokens (PAT)'],
  ['FLOW:128', 'Rate limiter blocks legitimate Server-Sent Event (SSE) updates'],
  ['FLOW:129', 'Kanban cards jitter when dragged over empty columns'],
  ['FLOW:130', 'Document webhook setup instructions and payload schemas'],
  ['FLOW:131', 'Audit and upgrade vulnerable npm dependencies in server'],
  ['SYNC:1', 'S3 multipart upload timeout on large assets (>500MB)'],
  ['SYNC:2', 'Implement WebSocket heartbeat for distributed edge nodes'],
  ['SYNC:3', 'Memory leak in chunk streaming buffer during backpressure'],
  ['SYNC:4', 'Benchmark and optimize Redis pub/sub queue throughput'],
]);

const seededPullRequestTitles = new Map([
  [42, 'Add compound database index on Issue collection (Resolves #118)'],
  [48, 'Fix JWT expiration handling in authMiddleware (Fixes #124)'],
  [55, 'feat: add GitHub webhook signature verification (Fixes #125)'],
]);

const seededCommentContent = [
  'I reproduced this in Postman. The TokenExpiredError is thrown by jwt.verify in authMiddleware and hits errorHandler which defaults to 500. I am opening PR #48 with the fix.',
  'Great find Rahul! Please make sure to check that refresh token endpoints still function as expected.',
  'Reviewed PR #48 with AI analysis test cases. Signature verification and expiration envelope look solid!',
];

const seededNotificationContent = [
  ['Assigned to Issue #124', 'Astha Sharma assigned you to "Fix JWT expiration bug returning HTTP 500 instead of 401"'],
  ['PR #48 Linked to Issue #124', 'Rahul Verma linked Pull Request #48 "Fix JWT expiration handling in authMiddleware"'],
  ['New Comment on #124', 'Demo Lead replied to your comment on #124'],
  ['AI Security Alert on #125', 'AI Issue Triage flagged #125 as CRITICAL severity with 98% confidence'],
];

const record = (model, document, reason) => ({
  collection: model.collection.name,
  id: document._id.toString(),
  reason,
});

const ids = (records) => records.map((item) => item.id);

const hasOnlySeededUsers = (members, seededUserIds) =>
  members.every((member) => seededUserIds.has(member.user?.toString?.() || member.user?.toString()));

export const buildCleanupReport = async () => {
  const userDocs = await User.find({ email: { $in: seededUsers.map((user) => user.email) } }).lean();
  const seededUserIds = new Set(userDocs.map((user) => user._id.toString()));
  const userByEmail = new Map(userDocs.map((user) => [user.email, user]));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    candidates: [],
    ambiguous: [],
    preserved: [],
  };

  const projectDocs = await Project.find({ key: { $in: Object.keys(seededProjects) } }).lean();
  const eligibleProjects = [];
  const eligibleIssues = [];
  const eligiblePullRequests = [];

  for (const project of projectDocs) {
    const fingerprint = seededProjects[project.key];
    const isFingerprintMatch = fingerprint &&
      project.name === fingerprint.name &&
      project.description === fingerprint.description &&
      seededUserIds.has(project.owner.toString()) &&
      hasOnlySeededUsers(project.members || [], seededUserIds);

    const projectIssues = await Issue.find({ project: project._id }).lean();
    const projectPullRequests = await PullRequest.find({ project: project._id }).lean();
    const expectedIssueNumbers = new Set(fingerprint?.issueNumbers || []);
    const expectedPrNumbers = new Set(fingerprint?.prNumbers || []);
    const matchingIssues = projectIssues.filter((issue) =>
      expectedIssueNumbers.has(issue.issueNumber) &&
      seededIssueTitles.get(`${project.key}:${issue.issueNumber}`) === issue.title
    );
    const matchingPullRequests = projectPullRequests.filter((pullRequest) =>
      expectedPrNumbers.has(pullRequest.prNumber) &&
      seededPullRequestTitles.get(pullRequest.prNumber) === pullRequest.title
    );
    const hasUnexpectedChildren =
      projectIssues.length !== matchingIssues.length ||
      projectPullRequests.length !== matchingPullRequests.length;

    if (!isFingerprintMatch || hasUnexpectedChildren) {
      report.ambiguous.push({
        collection: 'projects',
        id: project._id.toString(),
        key: project.key,
        reason: !isFingerprintMatch
          ? 'Project profile, owner, or membership differs from the seed fingerprint.'
          : 'Project contains issues or pull requests outside the seed fingerprint.',
      });
      continue;
    }

    eligibleProjects.push(project);
    report.candidates.push(record(Project, project, `Exact seeded project fingerprint: ${project.key}`));
    matchingIssues.forEach((issue) => {
      eligibleIssues.push(issue);
      report.candidates.push(record(Issue, issue, `Exact seeded issue fingerprint: ${project.key}#${issue.issueNumber}`));
    });
    matchingPullRequests.forEach((pullRequest) => {
      eligiblePullRequests.push(pullRequest);
      report.candidates.push(record(PullRequest, pullRequest, `Exact seeded pull request fingerprint: ${project.key}#${pullRequest.prNumber}`));
    });
  }

  const eligibleIssueIds = new Set(eligibleIssues.map((issue) => issue._id.toString()));
  const eligibleProjectIds = new Set(eligibleProjects.map((project) => project._id.toString()));
  const eligiblePrIds = new Set(eligiblePullRequests.map((pullRequest) => pullRequest._id.toString()));

  const comments = await Comment.find({ issue: { $in: eligibleIssues.map((issue) => issue._id) } }).lean();
  for (const comment of comments) {
    if (seededCommentContent.includes(comment.content) && seededUserIds.has(comment.author.toString())) {
      report.candidates.push(record(Comment, comment, 'Exact seeded comment content and seeded author.'));
    } else {
      report.ambiguous.push({ collection: 'comments', id: comment._id.toString(), reason: 'Comment is attached to a candidate issue but does not match the seed fingerprint.' });
    }
  }

  const activities = await Activity.find({ project: { $in: eligibleProjects.map((project) => project._id) } }).lean();
  for (const activity of activities) {
    const isSeedActivity = seededUserIds.has(activity.actor.toString()) &&
      ((activity.action === 'CREATED_ISSUE' && activity.entityType === 'ISSUE' && activity.metadata?.issueNumber === 124 && activity.metadata?.title === seededIssueTitles.get('FLOW:124')) ||
        (activity.action === 'AI_ANALYZED' && activity.entityType === 'ISSUE' && activity.metadata?.confidence === 0.94) ||
        (activity.action === 'ASSIGNED_USER' && activity.entityType === 'ISSUE' && activity.metadata?.assignee === 'Demo Lead') ||
        (activity.action === 'GENERATED_FIX_PROMPT' && activity.entityType === 'ISSUE') ||
        (activity.action === 'LINKED_PR' && activity.entityType === 'PR' && activity.metadata?.prNumber === 48 && activity.metadata?.prTitle === seededPullRequestTitles.get(48)) ||
        (activity.action === 'UPDATED_STATUS' && activity.entityType === 'ISSUE' && activity.metadata?.from === 'IN_PROGRESS' && activity.metadata?.to === 'IN_REVIEW') ||
        (activity.action === 'CONNECTED_GITHUB' && activity.entityType === 'PROJECT' && activity.metadata?.repository === 'devflow-ai/devflow-core')) &&
      (!activity.issue || eligibleIssueIds.has(activity.issue.toString())) &&
      (!activity.entityId || eligibleIssueIds.has(activity.entityId) || eligiblePrIds.has(activity.entityId) || eligibleProjectIds.has(activity.entityId));
    if (isSeedActivity) {
      report.candidates.push(record(Activity, activity, 'Activity is scoped only to eligible seeded records and has a seeded actor.'));
    } else {
      report.ambiguous.push({ collection: 'activities', id: activity._id.toString(), reason: 'Activity is attached to a candidate project but cannot be proven seeded.' });
    }
  }

  const notifications = await Notification.find({ project: { $in: eligibleProjects.map((project) => project._id) } }).lean();
  for (const notification of notifications) {
    const isSeedNotification = seededNotificationContent.some(([title, message]) =>
      notification.title === title && notification.message === message
    ) && seededUserIds.has(notification.recipient.toString()) && seededUserIds.has(notification.sender?.toString());
    if (isSeedNotification) {
      report.candidates.push(record(Notification, notification, 'Exact seeded notification title, message, and seeded participants.'));
    } else {
      report.ambiguous.push({ collection: 'notifications', id: notification._id.toString(), reason: 'Notification is attached to a candidate project but cannot be proven seeded.' });
    }
  }

  const candidateIdsByCollection = new Map();
  for (const candidate of report.candidates) {
    if (!candidateIdsByCollection.has(candidate.collection)) candidateIdsByCollection.set(candidate.collection, new Set());
    candidateIdsByCollection.get(candidate.collection).add(candidate.id);
  }

  for (const user of seededUsers) {
    const document = userByEmail.get(user.email);
    if (!document) {
      report.preserved.push({ collection: 'users', email: user.email, reason: 'No matching account exists.' });
      continue;
    }

    const userId = document._id;
    const [ownedProjects, memberProjects, issues, commentsByUser, activitiesByUser, notificationsByUser] = await Promise.all([
      Project.find({ owner: userId }).select('_id').lean(),
      Project.find({ 'members.user': userId }).select('_id').lean(),
      Issue.find({ $or: [{ reporter: userId }, { assignee: userId }] }).select('_id').lean(),
      Comment.find({ author: userId }).select('_id').lean(),
      Activity.find({ actor: userId }).select('_id').lean(),
      Notification.find({ $or: [{ recipient: userId }, { sender: userId }] }).select('_id').lean(),
    ]);
    const allReferences = [
      ...ownedProjects.map((item) => ['projects', item._id.toString()]),
      ...memberProjects.map((item) => ['projects', item._id.toString()]),
      ...issues.map((item) => ['issues', item._id.toString()]),
      ...commentsByUser.map((item) => ['comments', item._id.toString()]),
      ...activitiesByUser.map((item) => ['activities', item._id.toString()]),
      ...notificationsByUser.map((item) => ['notifications', item._id.toString()]),
    ];
    const hasNonCandidateReference = allReferences.some(([collection, id]) => !candidateIdsByCollection.get(collection)?.has(id));

    if (hasNonCandidateReference) {
      report.ambiguous.push({ collection: 'users', id: userId.toString(), email: user.email, reason: 'Account participates in records outside the exact seeded cleanup set; user and all associated data are preserved.' });
    } else {
      report.candidates.push(record(User, document, `Known seeded account with no non-seeded references: ${user.email}`));
    }
  }

  report.counts = report.candidates.reduce((counts, candidate) => {
    counts[candidate.collection] = (counts[candidate.collection] || 0) + 1;
    return counts;
  }, {});
  report.ambiguousCounts = report.ambiguous.reduce((counts, candidate) => {
    counts[candidate.collection] = (counts[candidate.collection] || 0) + 1;
    return counts;
  }, {});
  return report;
};

export const printCleanupReport = (report) => {
  console.log(JSON.stringify(report, null, 2));
  console.log(`Dry-run summary: ${report.candidates.length} exact candidates; ${report.ambiguous.length} ambiguous records preserved.`);
}

const executeCleanup = async (report) => {
  if (report.ambiguous.length > 0) {
    throw new Error('Deletion refused because ambiguous records require manual verification.');
  }

  const byCollection = new Map();
  for (const candidate of report.candidates) {
    if (!byCollection.has(candidate.collection)) byCollection.set(candidate.collection, []);
    byCollection.get(candidate.collection).push(candidate.id);
  }

  for (const collection of ['comments', 'notifications', 'activities', 'pullrequests', 'issues', 'projects', 'users']) {
    const model = {
      comments: Comment,
      notifications: Notification,
      activities: Activity,
      pullrequests: PullRequest,
      issues: Issue,
      projects: Project,
      users: User,
    }[collection];
    const collectionIds = byCollection.get(collection) || [];
    if (collectionIds.length > 0) {
      await model.deleteMany({ _id: { $in: collectionIds } });
    }
  }
};

const isDirectRun = () => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun()) {
  (async () => {
    const execute = process.argv.includes('--execute');
    const confirmation = process.argv.find((argument) => argument.startsWith('--confirm='))?.split('=')[1];
    dotenv.config();

    if (execute && process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_DEMO_CLEANUP !== 'true') {
      throw new Error('Production deletion requires ALLOW_PRODUCTION_DEMO_CLEANUP=true in addition to --execute and the confirmation token.');
    }
    if (execute && confirmation !== CONFIRMATION) {
      throw new Error(`Deletion requires --confirm=${CONFIRMATION}.`);
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('Cleanup requires an explicit MONGODB_URI and never uses the application memory fallback.');
    }
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
      const report = await buildCleanupReport();
      report.mode = execute ? 'execute' : 'dry-run';
      printCleanupReport(report);
      if (execute) await executeCleanup(report);
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error(`[Cleanup] ${error.message}`);
    process.exitCode = 1;
  });
}
