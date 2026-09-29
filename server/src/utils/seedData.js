import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { PullRequest } from '../models/PullRequest.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

export const seedDatabase = async () => {
  try {
    console.log('[Seed] Checking existing database records...');
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('[Seed] Database already contains records. Skipping seed.');
      return;
    }

    console.log('[Seed] Seeding realistic demonstration data...');

    // 1. Create Users
    const usersData = [
      {
        name: 'Astha Sharma',
        email: 'astha@devflow.ai',
        password: 'password123',
        role: 'ADMIN',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'astha-devflow',
      },
      {
        name: 'Rahul Verma',
        email: 'rahul@devflow.ai',
        password: 'password123',
        role: 'DEVELOPER',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'rahulverma-code',
      },
      {
        name: 'Ananya Iyer',
        email: 'ananya@devflow.ai',
        password: 'password123',
        role: 'DEVELOPER',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'ananya-iyer',
      },
      {
        name: 'Vikram Patel',
        email: 'vikram@devflow.ai',
        password: 'password123',
        role: 'DEVELOPER',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'vikram-patel',
      },
      {
        name: 'Dev Malik',
        email: 'dev@devflow.ai',
        password: 'password123',
        role: 'VIEWER',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'dev-malik-qa',
      },
    ];

    const users = [];
    for (const u of usersData) {
      const created = await User.create(u);
      users.push(created);
    }
    const [astha, rahul, ananya, vikram, dev] = users;

    // 2. Create Project
    const project = await Project.create({
      name: 'DevFlow Core Platform',
      key: 'FLOW',
      description: 'AI-assisted developer workspace and issue resolution pipeline',
      owner: astha._id,
      issueCounter: 16,
      members: [
        { user: astha._id, role: 'ADMIN' },
        { user: rahul._id, role: 'DEVELOPER' },
        { user: ananya._id, role: 'DEVELOPER' },
        { user: vikram._id, role: 'DEVELOPER' },
        { user: dev._id, role: 'VIEWER' },
      ],
      githubRepository: {
        connected: true,
        owner: 'devflow-ai',
        repo: 'devflow-core',
        url: 'https://github.com/devflow-ai/devflow-core',
        defaultBranch: 'main',
        connectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      settings: {
        autoCloseOnMerge: true,
      },
    });

    // 3. Create Pull Requests
    const pr48 = await PullRequest.create({
      project: project._id,
      prNumber: 48,
      title: 'Fix JWT expiration handling in authMiddleware (Fixes #124)',
      body: 'Catch TokenExpiredError explicitly and return HTTP 401 instead of bubbling unhandled exception to 500.\n\nCloses #124',
      htmlUrl: 'https://github.com/devflow-ai/devflow-core/pull/48',
      author: { login: rahul.githubUsername, avatarUrl: rahul.avatar },
      status: 'OPEN',
      headBranch: 'fix/jwt-expiration',
      baseBranch: 'main',
      changedFilesCount: 3,
      additions: 38,
      deletions: 9,
      aiAnalysis: {
        issueAlignment: 'HIGH',
        confidence: 94,
        summary: 'PR properly intercepts TokenExpiredError in authMiddleware and returns 401 Unauthorized with standard error response envelope.',
        potentialConcerns: [
          'Verify refresh token endpoint still accepts expired access tokens for token rotation',
          'Ensure test suite covers tampered signature as well as expired timestamp',
        ],
        suggestedTests: [
          'GET /api/me with expired JWT -> Expect 401 { success: false, message: "Token expired" }',
          'GET /api/me with valid JWT -> Expect 200 { success: true }',
          'GET /api/me with malformed string -> Expect 401',
        ],
        analyzedAt: new Date(),
      },
    });

    const pr42 = await PullRequest.create({
      project: project._id,
      prNumber: 42,
      title: 'Add compound database index on Issue collection (Resolves #118)',
      body: 'Adds { project: 1, status: 1 } and { project: 1, issueNumber: 1 } compound indexes to eliminate slow table scans on Kanban load.\n\nResolves #118',
      htmlUrl: 'https://github.com/devflow-ai/devflow-core/pull/42',
      author: { login: ananya.githubUsername, avatarUrl: ananya.avatar },
      status: 'MERGED',
      headBranch: 'perf/issue-indexes',
      baseBranch: 'main',
      changedFilesCount: 2,
      additions: 18,
      deletions: 2,
      aiAnalysis: {
        issueAlignment: 'HIGH',
        confidence: 96,
        summary: 'Adds indexes directly targeting the queried fields identified in the performance bug report.',
        potentialConcerns: ['Verify background index build in production during high write throughput'],
        suggestedTests: ['Run EXPLAIN() query plan on getIssues to verify IXSCAN index hit'],
        analyzedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });

    const pr55 = await PullRequest.create({
      project: project._id,
      prNumber: 55,
      title: 'feat: add GitHub webhook signature verification (Fixes #125)',
      body: 'Validates HMAC-SHA256 signature using timingSafeEqual to protect against timing attacks.\n\nFixes #125',
      htmlUrl: 'https://github.com/devflow-ai/devflow-core/pull/55',
      author: { login: vikram.githubUsername, avatarUrl: vikram.avatar },
      status: 'OPEN',
      headBranch: 'feat/webhook-security',
      baseBranch: 'main',
      changedFilesCount: 4,
      additions: 64,
      deletions: 12,
      aiAnalysis: {
        issueAlignment: 'HIGH',
        confidence: 91,
        summary: 'Implements standard crypto.timingSafeEqual and verifies X-Hub-Signature-256 header.',
        potentialConcerns: ['Ensure raw request body is captured before JSON parser mutates whitespace'],
        suggestedTests: [
          'Send valid signature -> Expect 200',
          'Send invalid signature -> Expect 401',
          'Send missing signature header -> Expect 401',
        ],
        analyzedAt: new Date(),
      },
    });

    // 4. Create Issues
    const issuesData = [
      {
        issueNumber: 124,
        title: 'Fix JWT expiration bug returning HTTP 500 instead of 401',
        description: 'When an expired JWT access token is sent in the Authorization header to protected endpoints, the server returns an unhandled HTTP 500 Internal Server Error instead of HTTP 401 Unauthorized with a clean error message.',
        type: 'BUG',
        status: 'IN_REVIEW',
        priority: 'HIGH',
        labels: ['backend', 'authentication', 'security'],
        reporter: astha._id,
        assignee: rahul._id,
        project: project._id,
        linkedPullRequests: [pr48._id],
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'HIGH',
          suggestedLabels: ['backend', 'authentication', 'security'],
          summary: 'Expired JWT error is not intercepted by auth middleware, throwing an uncaught exception that triggers default Express 500 error handler.',
          possibleRootCause: 'The authMiddleware.js catches jwt.verify() without distinguishing TokenExpiredError from other runtime exceptions, letting it propagate to the general error handler.',
          confidence: 0.94,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/middleware/authMiddleware.js', confidence: 94, reason: 'Handles JWT token verification and error mapping' },
          { file: 'src/services/tokenService.js', confidence: 87, reason: 'Generates and decodes access tokens' },
          { file: 'src/controllers/authController.js', confidence: 71, reason: 'Dispatches auth responses' },
        ],
        aiFixPrompt: {
          content: `# ROLE
You are an experienced backend software engineer working on the DevFlow platform.

# PROBLEM
Issue #124: Fix JWT expiration bug returning HTTP 500 instead of 401
When an expired JWT is sent to protected endpoints, the server crashes with HTTP 500.

# EXPECTED BEHAVIOR
Return HTTP 401 with JSON: { "success": false, "message": "Token expired" }

# FILES TO INVESTIGATE
- \`src/middleware/authMiddleware.js\`
- \`src/services/tokenService.js\`

# IMPLEMENTATION REQUIREMENTS
1. Intercept TokenExpiredError and JsonWebTokenError specifically in authMiddleware.
2. Return status 401 rather than passing error to next(err).
3. Preserve token rotation support for refresh routes.`,
          generatedAt: new Date(),
          modelUsed: 'gemini-1.5-flash',
        },
      },
      {
        issueNumber: 118,
        title: 'Slow query on Kanban board load under high issue volume',
        description: 'Loading the project Kanban board with >500 issues takes over 1.8 seconds due to unindexed queries on { project, status } causing COLLSCAN collection scans.',
        type: 'IMPROVEMENT',
        status: 'RESOLVED',
        priority: 'MEDIUM',
        labels: ['database', 'performance', 'backend'],
        reporter: rahul._id,
        assignee: ananya._id,
        project: project._id,
        linkedPullRequests: [pr42._id],
        aiAnalysis: {
          issueType: 'IMPROVEMENT',
          priority: 'MEDIUM',
          suggestedLabels: ['database', 'performance'],
          summary: 'Missing compound MongoDB index on Issue collection causes full collection scan during Kanban column grouping.',
          possibleRootCause: 'The query Issue.find({ project, status }) lacks a compound index, forcing MongoDB to scan every document.',
          confidence: 0.96,
          analyzedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        relevantCode: [
          { file: 'src/models/Issue.js', confidence: 96, reason: 'Define compound schema index' },
          { file: 'src/controllers/issueController.js', confidence: 88, reason: 'Issue query pagination' },
        ],
      },
      {
        issueNumber: 125,
        title: 'Add GitHub webhook HMAC signature verification',
        description: 'Inbound GitHub webhook endpoints currently accept payloads without validating the X-Hub-Signature-256 header against GITHUB_WEBHOOK_SECRET, exposing the endpoint to spoofing.',
        type: 'BUG',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        labels: ['security', 'github', 'backend'],
        reporter: astha._id,
        assignee: vikram._id,
        project: project._id,
        linkedPullRequests: [pr55._id],
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'CRITICAL',
          suggestedLabels: ['security', 'github'],
          summary: 'Unauthenticated webhook endpoint allows arbitrary forged PR events to trigger issue state changes.',
          possibleRootCause: 'Missing HMAC-SHA256 signature check using crypto.timingSafeEqual on inbound webhook payload.',
          confidence: 0.98,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/services/github/webhookHandler.js', confidence: 98, reason: 'Verify signature before processing events' },
          { file: 'src/routes/githubRoutes.js', confidence: 85, reason: 'Apply verification middleware' },
        ],
      },
      {
        issueNumber: 126,
        title: 'Command palette (Ctrl+K) does not focus search input on Safari',
        description: 'Pressing Ctrl+K or Cmd+K on Safari opens the dialog backdrop, but the search text input does not autofocus due to a timing issue with ref.current.focus().',
        type: 'BUG',
        status: 'OPEN',
        priority: 'LOW',
        labels: ['frontend', 'ui/ux', 'accessibility'],
        reporter: dev._id,
        assignee: ananya._id,
        project: project._id,
        linkedPullRequests: [],
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'LOW',
          suggestedLabels: ['frontend', 'ui/ux'],
          summary: 'Focus is called before DOM repaint in Safari webkit engine, causing focus to be dropped.',
          possibleRootCause: 'RequestAnimationFrame or setTimeout(..., 50) needed to ensure modal transition finishes before calling focus().',
          confidence: 0.89,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/components/CommandPalette.jsx', confidence: 95, reason: 'Modal autofocus hook' },
        ],
      },
      {
        issueNumber: 127,
        title: 'Support fine-grained GitHub Personal Access Tokens (PAT)',
        description: 'Developers should be able to authenticate with fine-grained personal access tokens in addition to classic tokens for least-privilege repository access.',
        type: 'FEATURE',
        status: 'OPEN',
        priority: 'MEDIUM',
        labels: ['github', 'feature', 'integrations'],
        reporter: rahul._id,
        assignee: null,
        project: project._id,
        linkedPullRequests: [],
        aiAnalysis: {
          issueType: 'FEATURE',
          priority: 'MEDIUM',
          suggestedLabels: ['github', 'integrations'],
          summary: 'Extend GitHub client headers to support fine-grained token scopes with repository-level permissions.',
          possibleRootCause: 'API client expects classic token header format and scope response.',
          confidence: 0.91,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/services/github/githubClient.js', confidence: 92, reason: 'Configure token headers' },
        ],
      },
      {
        issueNumber: 128,
        title: 'Rate limiter blocks legitimate Server-Sent Event (SSE) updates',
        description: 'The global express-rate-limit middleware treats long-lived SSE connections as repeat requests, returning 429 Too Many Requests to active dashboard users.',
        type: 'BUG',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        labels: ['backend', 'networking', 'api'],
        reporter: astha._id,
        assignee: vikram._id,
        project: project._id,
        linkedPullRequests: [],
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'HIGH',
          suggestedLabels: ['backend', 'api'],
          summary: 'Express rate limiter count is incremented on streaming heartbeat pings, exhausting user rate limits.',
          possibleRootCause: 'Skip function in rate limit config does not exclude streaming or notification endpoints.',
          confidence: 0.93,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/app.js', confidence: 91, reason: 'Rate limiter setup' },
        ],
      },
      {
        issueNumber: 129,
        title: 'Kanban cards jitter when dragged over empty columns',
        description: 'When dragging an issue card over an empty column on the Kanban board, the column height collapses causing visual flickering and jumpy transitions.',
        type: 'IMPROVEMENT',
        status: 'RESOLVED',
        priority: 'LOW',
        labels: ['frontend', 'ui/ux'],
        reporter: dev._id,
        assignee: rahul._id,
        project: project._id,
        linkedPullRequests: [],
        aiAnalysis: {
          issueType: 'IMPROVEMENT',
          priority: 'LOW',
          suggestedLabels: ['frontend', 'ui/ux'],
          summary: 'Empty Kanban drop zone lacks minimum height, causing layout reflow during card drag.',
          possibleRootCause: 'Add min-h-[350px] or flex-1 to droppable column container.',
          confidence: 0.95,
          analyzedAt: new Date(),
        },
        relevantCode: [
          { file: 'src/components/KanbanBoard.jsx', confidence: 98, reason: 'Column dropzone CSS classes' },
        ],
      },
      {
        issueNumber: 130,
        title: 'Document webhook setup instructions and payload schemas',
        description: 'Add comprehensive developer documentation explaining how to set up GitHub webhooks with local forwarding and describe the payload structures for PR events.',
        type: 'DOCUMENTATION',
        status: 'CLOSED',
        priority: 'LOW',
        labels: ['documentation'],
        reporter: astha._id,
        assignee: astha._id,
        project: project._id,
        linkedPullRequests: [],
      },
      {
        issueNumber: 131,
        title: 'Audit and upgrade vulnerable npm dependencies in server',
        description: 'Run npm audit fix and review transitive dependencies for known CVEs across Express and parsing packages.',
        type: 'TASK',
        status: 'CLOSED',
        priority: 'MEDIUM',
        labels: ['security', 'maintenance'],
        reporter: vikram._id,
        assignee: vikram._id,
        project: project._id,
        linkedPullRequests: [],
      },
    ];

    const createdIssues = [];
    for (const item of issuesData) {
      const issue = await Issue.create(item);
      createdIssues.push(issue);

      // Associate issue back to PR
      if (item.linkedPullRequests && item.linkedPullRequests.length > 0) {
        for (const prId of item.linkedPullRequests) {
          await PullRequest.findByIdAndUpdate(prId, { issue: issue._id });
        }
      }
    }

    // 5. Create Comments
    const issue124 = createdIssues[0];
    await Comment.create({
      issue: issue124._id,
      author: rahul._id,
      content: 'I reproduced this in Postman. The TokenExpiredError is thrown by jwt.verify in authMiddleware and hits errorHandler which defaults to 500. I am opening PR #48 with the fix.',
    });
    await Comment.create({
      issue: issue124._id,
      author: astha._id,
      content: 'Great find Rahul! Please make sure to check that refresh token endpoints still function as expected.',
    });
    await Comment.create({
      issue: issue124._id,
      author: rahul._id,
      content: 'Tested with refresh token rotation and verified with the AI PR analyzer test cases. Looks solid!',
    });

    // 6. Create Activities
    const activityItems = [
      {
        project: project._id,
        issue: issue124._id,
        actor: astha._id,
        action: 'CREATED_ISSUE',
        entityType: 'ISSUE',
        entityId: issue124._id.toString(),
        metadata: { issueNumber: 124, title: issue124.title },
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        issue: issue124._id,
        actor: astha._id,
        action: 'AI_ANALYZED',
        entityType: 'ISSUE',
        entityId: issue124._id.toString(),
        metadata: { confidence: 0.94 },
        timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        issue: issue124._id,
        actor: astha._id,
        action: 'ASSIGNED_USER',
        entityType: 'ISSUE',
        entityId: issue124._id.toString(),
        metadata: { assignee: 'Rahul Verma' },
        timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        issue: issue124._id,
        actor: rahul._id,
        action: 'GENERATED_FIX_PROMPT',
        entityType: 'ISSUE',
        entityId: issue124._id.toString(),
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        issue: issue124._id,
        actor: rahul._id,
        action: 'LINKED_PR',
        entityType: 'PR',
        entityId: pr48._id.toString(),
        metadata: { prNumber: 48, prTitle: pr48.title },
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        issue: issue124._id,
        actor: rahul._id,
        action: 'UPDATED_STATUS',
        entityType: 'ISSUE',
        entityId: issue124._id.toString(),
        metadata: { from: 'IN_PROGRESS', to: 'IN_REVIEW' },
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        project: project._id,
        actor: astha._id,
        action: 'CONNECTED_GITHUB',
        entityType: 'PROJECT',
        entityId: project._id.toString(),
        metadata: { repository: 'devflow-ai/devflow-core' },
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    ];

    await Activity.insertMany(activityItems);

    // 7. Create Notifications
    await Notification.create({
      recipient: rahul._id,
      sender: astha._id,
      project: project._id,
      issue: issue124._id,
      title: 'Assigned to Issue #124',
      message: 'Astha Sharma assigned you to "Fix JWT expiration bug returning HTTP 500 instead of 401"',
      type: 'ASSIGNED',
      read: false,
    });
    await Notification.create({
      recipient: rahul._id,
      sender: astha._id,
      project: project._id,
      issue: issue124._id,
      title: 'New Comment on #124',
      message: 'Astha Sharma replied to your comment on #124',
      type: 'COMMENT',
      read: false,
    });
    await Notification.create({
      recipient: astha._id,
      sender: rahul._id,
      project: project._id,
      issue: issue124._id,
      title: 'PR #48 Linked to Issue #124',
      message: 'Rahul Verma linked Pull Request #48 "Fix JWT expiration handling in authMiddleware"',
      type: 'PR_LINKED',
      read: true,
    });

    console.log('[Seed] Database successfully seeded with 5 users, 9 realistic issues, 3 PRs, comments, activities, and notifications!');
  } catch (err) {
    console.error('[Seed] Error seeding data:', err);
  }
};
