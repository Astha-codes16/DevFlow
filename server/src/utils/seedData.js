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

export const seedDatabase = async () => {
  try {
    const isDevelopmentOrTest = ['development', 'test'].includes(process.env.NODE_ENV);
    const isExplicitlyEnabled = process.env.ENABLE_DEMO_SEED === 'true';

    if (!isDevelopmentOrTest || !isExplicitlyEnabled) {
      console.log('[Seed] Demo seeding requires NODE_ENV=development (or test) and ENABLE_DEMO_SEED=true. Skipping.');
      return;
    }

    console.log('[Seed] Inspecting and verifying demonstration dataset...');

    const demoUserEmail = (process.env.DEMO_USER_EMAIL || 'demo@devflow.ai').toLowerCase().trim();
    const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'password123';

    // 1. Independent User Verification & Creation
    // Preserve existing users; create missing demo team accounts using existing User model and bcrypt hashing
    const usersData = [
      {
        name: 'Demo Lead',
        email: demoUserEmail,
        password: demoUserPassword,
        role: 'ADMIN',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        githubUsername: 'devflow-demo',
      },
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

    const userMap = new Map();
    for (const u of usersData) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        // User.create invokes userSchema.pre('save') which hashes password via bcrypt
        user = await User.create(u);
        console.log(`[Seed] Created demo user account: ${u.email} (${u.role})`);
      }
      userMap.set(u.email, user);
    }

    const demoUser = userMap.get(demoUserEmail);
    const astha = userMap.get('astha@devflow.ai');
    const rahul = userMap.get('rahul@devflow.ai');
    const ananya = userMap.get('ananya@devflow.ai');
    const vikram = userMap.get('vikram@devflow.ai');
    const dev = userMap.get('dev@devflow.ai');

    // 2. Independent Projects Verification & Creation
    // Project A: DevFlow Core Platform (Key: FLOW)
    let flowProject = await Project.findOne({ key: 'FLOW' });
    if (!flowProject) {
      flowProject = await Project.create({
        name: 'DevFlow Core Platform',
        key: 'FLOW',
        description: 'AI-assisted developer workspace and issue resolution pipeline',
        owner: demoUser._id,
        issueCounter: 131,
        members: [
          { user: demoUser._id, role: 'ADMIN' },
          { user: astha._id, role: 'ADMIN' },
          { user: rahul._id, role: 'DEVELOPER' },
          { user: ananya._id, role: 'DEVELOPER' },
          { user: vikram._id, role: 'DEVELOPER' },
          { user: dev._id, role: 'VIEWER' },
        ],
        github: {
          connected: true,
          owner: 'devflow-ai',
          repository: 'devflow-core',
          url: 'https://github.com/devflow-ai/devflow-core',
          defaultBranch: 'main',
          stars: 124,
          forks: 38,
          openIssues: 9,
          connectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          connectedBy: demoUser._id,
        },
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
      console.log('[Seed] Created FLOW project');
    } else {
      // Ensure demo user and demo team members are in FLOW project members list
      let modified = false;
      const requiredMembers = [
        { user: demoUser._id, role: 'ADMIN' },
        { user: astha._id, role: 'ADMIN' },
        { user: rahul._id, role: 'DEVELOPER' },
        { user: ananya._id, role: 'DEVELOPER' },
        { user: vikram._id, role: 'DEVELOPER' },
        { user: dev._id, role: 'VIEWER' },
      ];

      for (const reqMember of requiredMembers) {
        const isMember = flowProject.members.some(
          (m) => m.user.toString() === reqMember.user.toString()
        );
        if (!isMember) {
          flowProject.members.push(reqMember);
          modified = true;
        }
      }

      // Ensure GitHub repository metadata is configured for demo walkthroughs
      if (!flowProject.github?.connected || !flowProject.githubRepository?.connected) {
        flowProject.github = {
          connected: true,
          owner: 'devflow-ai',
          repository: 'devflow-core',
          url: 'https://github.com/devflow-ai/devflow-core',
          defaultBranch: 'main',
          stars: 124,
          forks: 38,
          openIssues: 9,
          connectedAt: flowProject.github?.connectedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          connectedBy: demoUser._id,
        };
        flowProject.githubRepository = {
          connected: true,
          owner: 'devflow-ai',
          repo: 'devflow-core',
          url: 'https://github.com/devflow-ai/devflow-core',
          defaultBranch: 'main',
          connectedAt: flowProject.githubRepository?.connectedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        };
        modified = true;
      }

      if (modified) {
        await flowProject.save();
        console.log('[Seed] Updated FLOW project membership and repository links');
      }
    }

    // Project B: CloudSync Microservice (Key: SYNC) - Demonstrates multi-project workspace switching
    let syncProject = await Project.findOne({ key: 'SYNC' });
    if (!syncProject) {
      syncProject = await Project.create({
        name: 'CloudSync Microservice',
        key: 'SYNC',
        description: 'High-performance distributed file synchronization engine and edge storage worker',
        owner: demoUser._id,
        issueCounter: 4,
        members: [
          { user: demoUser._id, role: 'ADMIN' },
          { user: rahul._id, role: 'DEVELOPER' },
          { user: ananya._id, role: 'DEVELOPER' },
        ],
        github: {
          connected: true,
          owner: 'devflow-ai',
          repository: 'cloud-sync',
          url: 'https://github.com/devflow-ai/cloud-sync',
          defaultBranch: 'main',
          stars: 87,
          forks: 14,
          openIssues: 4,
          connectedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          connectedBy: demoUser._id,
        },
        githubRepository: {
          connected: true,
          owner: 'devflow-ai',
          repo: 'cloud-sync',
          url: 'https://github.com/devflow-ai/cloud-sync',
          defaultBranch: 'main',
          connectedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
        settings: {
          autoCloseOnMerge: true,
        },
      });
      console.log('[Seed] Created SYNC project');
    } else {
      const isMember = syncProject.members.some(
        (m) => m.user.toString() === demoUser._id.toString()
      );
      if (!isMember) {
        syncProject.members.push({ user: demoUser._id, role: 'ADMIN' });
        await syncProject.save();
      }
    }

    // 3. Independent Pull Requests Verification & Creation
    const prsData = [
      {
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
      },
      {
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
      },
      {
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
      },
    ];

    const prMap = new Map();
    for (const prItem of prsData) {
      let pr = await PullRequest.findOne({ project: flowProject._id, prNumber: prItem.prNumber });
      if (!pr) {
        pr = await PullRequest.create({ ...prItem, project: flowProject._id });
        console.log(`[Seed] Created PR #${prItem.prNumber}`);
      }
      prMap.set(prItem.prNumber, pr);
    }

    // 4. Independent Issues Verification & Creation (FLOW)
    const flowIssuesData = [
      {
        issueNumber: 124,
        title: 'Fix JWT expiration bug returning HTTP 500 instead of 401',
        description: 'When an expired JWT access token is sent in the Authorization header to protected endpoints, the server returns an unhandled HTTP 500 Internal Server Error instead of HTTP 401 Unauthorized with a clean error message.',
        type: 'BUG',
        status: 'IN_REVIEW',
        priority: 'HIGH',
        labels: ['backend', 'authentication', 'security'],
        reporter: astha._id,
        assignee: demoUser._id, // Assigned to Demo Lead so active dashboard displays assigned issue
        linkedPullRequests: prMap.get(48) ? [prMap.get(48)._id] : [],
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
        linkedPullRequests: prMap.get(42) ? [prMap.get(42)._id] : [],
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
        reporter: demoUser._id,
        assignee: vikram._id,
        linkedPullRequests: prMap.get(55) ? [prMap.get(55)._id] : [],
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
        assignee: demoUser._id, // Also assigned to Demo Lead
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
        linkedPullRequests: [],
      },
    ];

    const issueMap = new Map();
    for (const item of flowIssuesData) {
      let issue = await Issue.findOne({ project: flowProject._id, issueNumber: item.issueNumber });
      if (!issue) {
        issue = await Issue.create({ ...item, project: flowProject._id });
        console.log(`[Seed] Created FLOW issue #${item.issueNumber}: ${item.title}`);
      }
      issueMap.set(item.issueNumber, issue);

      // Associate issue back to linked PR
      if (item.linkedPullRequests && item.linkedPullRequests.length > 0) {
        for (const prId of item.linkedPullRequests) {
          await PullRequest.findByIdAndUpdate(prId, { issue: issue._id });
        }
      }
    }

    // 5. Independent Issues Verification & Creation (SYNC)
    const syncIssuesData = [
      {
        issueNumber: 1,
        title: 'S3 multipart upload timeout on large assets (>500MB)',
        description: 'Large chunked uploads exceed the 30-second socket timeout when uploading to remote cloud storage on constrained edge connections.',
        type: 'BUG',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        labels: ['storage', 'aws', 'backend'],
        reporter: demoUser._id,
        assignee: rahul._id,
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'HIGH',
          suggestedLabels: ['storage', 'aws'],
          summary: 'S3 client timeout parameter is insufficient for sustained chunked streams.',
          possibleRootCause: 'Default HTTP agent keeps socket open without adjusting idle timeout for large multipart byte buffers.',
          confidence: 0.92,
          analyzedAt: new Date(),
        },
      },
      {
        issueNumber: 2,
        title: 'Implement WebSocket heartbeat for distributed edge nodes',
        description: 'Add a 15-second bidirectional ping-pong heartbeat mechanism so idle edge proxy nodes are not severed by upstream load balancer timeouts.',
        type: 'FEATURE',
        status: 'OPEN',
        priority: 'MEDIUM',
        labels: ['networking', 'realtime'],
        reporter: demoUser._id,
        assignee: ananya._id,
      },
      {
        issueNumber: 3,
        title: 'Memory leak in chunk streaming buffer during backpressure',
        description: 'When consumer write stream pauses on backpressure, the internal byte queue retains detached chunks in V8 heap.',
        type: 'BUG',
        status: 'RESOLVED',
        priority: 'CRITICAL',
        labels: ['memory', 'node.js', 'streams'],
        reporter: rahul._id,
        assignee: demoUser._id,
        aiAnalysis: {
          issueType: 'BUG',
          priority: 'CRITICAL',
          suggestedLabels: ['memory', 'streams'],
          summary: 'V8 heap memory accumulates because pause() event does not flush write buffers before receiving next chunk.',
          possibleRootCause: 'Missing highWaterMark backpressure flow control handler on readable stream pipeline.',
          confidence: 0.97,
          analyzedAt: new Date(),
        },
      },
      {
        issueNumber: 4,
        title: 'Benchmark and optimize Redis pub/sub queue throughput',
        description: 'Profile throughput under 10k concurrent pub/sub events per second to ensure sub-millisecond message delivery latency.',
        type: 'IMPROVEMENT',
        status: 'CLOSED',
        priority: 'LOW',
        labels: ['redis', 'performance'],
        reporter: demoUser._id,
        assignee: demoUser._id,
      },
    ];

    for (const item of syncIssuesData) {
      let syncIssue = await Issue.findOne({ project: syncProject._id, issueNumber: item.issueNumber });
      if (!syncIssue) {
        await Issue.create({ ...item, project: syncProject._id });
        console.log(`[Seed] Created SYNC issue #${item.issueNumber}: ${item.title}`);
      }
    }

    // 6. Independent Comments Verification & Creation
    const issue124 = issueMap.get(124);
    if (issue124) {
      const commentsData = [
        {
          issue: issue124._id,
          author: rahul._id,
          content: 'I reproduced this in Postman. The TokenExpiredError is thrown by jwt.verify in authMiddleware and hits errorHandler which defaults to 500. I am opening PR #48 with the fix.',
        },
        {
          issue: issue124._id,
          author: astha._id,
          content: 'Great find Rahul! Please make sure to check that refresh token endpoints still function as expected.',
        },
        {
          issue: issue124._id,
          author: demoUser._id,
          content: 'Reviewed PR #48 with AI analysis test cases. Signature verification and expiration envelope look solid!',
        },
      ];

      for (const c of commentsData) {
        const existingComment = await Comment.findOne({
          issue: c.issue,
          author: c.author,
          content: c.content,
        });
        if (!existingComment) {
          await Comment.create(c);
        }
      }
    }

    // 7. Independent Activities Verification & Creation
    if (issue124) {
      const pr48 = prMap.get(48);
      const activityItems = [
        {
          project: flowProject._id,
          issue: issue124._id,
          actor: astha._id,
          action: 'CREATED_ISSUE',
          entityType: 'ISSUE',
          entityId: issue124._id.toString(),
          metadata: { issueNumber: 124, title: issue124.title },
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
        {
          project: flowProject._id,
          issue: issue124._id,
          actor: astha._id,
          action: 'AI_ANALYZED',
          entityType: 'ISSUE',
          entityId: issue124._id.toString(),
          metadata: { confidence: 0.94 },
          timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000),
        },
        {
          project: flowProject._id,
          issue: issue124._id,
          actor: astha._id,
          action: 'ASSIGNED_USER',
          entityType: 'ISSUE',
          entityId: issue124._id.toString(),
          metadata: { assignee: 'Demo Lead' },
          timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000),
        },
        {
          project: flowProject._id,
          issue: issue124._id,
          actor: demoUser._id,
          action: 'GENERATED_FIX_PROMPT',
          entityType: 'ISSUE',
          entityId: issue124._id.toString(),
          timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
        },
        ...(pr48
          ? [
              {
                project: flowProject._id,
                issue: issue124._id,
                actor: rahul._id,
                action: 'LINKED_PR',
                entityType: 'PR',
                entityId: pr48._id.toString(),
                metadata: { prNumber: 48, prTitle: pr48.title },
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            ]
          : []),
        {
          project: flowProject._id,
          issue: issue124._id,
          actor: rahul._id,
          action: 'UPDATED_STATUS',
          entityType: 'ISSUE',
          entityId: issue124._id.toString(),
          metadata: { from: 'IN_PROGRESS', to: 'IN_REVIEW' },
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
        {
          project: flowProject._id,
          actor: demoUser._id,
          action: 'CONNECTED_GITHUB',
          entityType: 'PROJECT',
          entityId: flowProject._id.toString(),
          metadata: { repository: 'devflow-ai/devflow-core' },
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ];

      for (const act of activityItems) {
        const existingAct = await Activity.findOne({
          project: act.project,
          action: act.action,
          entityId: act.entityId,
        });
        if (!existingAct) {
          await Activity.create(act);
        }
      }
    }

    // 8. Independent Notifications Verification & Creation
    const issue125 = issueMap.get(125);
    const notificationsData = [
      ...(issue124
        ? [
            {
              recipient: demoUser._id,
              sender: astha._id,
              project: flowProject._id,
              issue: issue124._id,
              title: 'Assigned to Issue #124',
              message: 'Astha Sharma assigned you to "Fix JWT expiration bug returning HTTP 500 instead of 401"',
              type: 'ASSIGNED',
              read: false,
            },
            {
              recipient: demoUser._id,
              sender: rahul._id,
              project: flowProject._id,
              issue: issue124._id,
              title: 'PR #48 Linked to Issue #124',
              message: 'Rahul Verma linked Pull Request #48 "Fix JWT expiration handling in authMiddleware"',
              type: 'PR_LINKED',
              read: false,
            },
            {
              recipient: rahul._id,
              sender: demoUser._id,
              project: flowProject._id,
              issue: issue124._id,
              title: 'New Comment on #124',
              message: 'Demo Lead replied to your comment on #124',
              type: 'COMMENT',
              read: true,
            },
          ]
        : []),
      ...(issue125
        ? [
            {
              recipient: demoUser._id,
              sender: astha._id,
              project: flowProject._id,
              issue: issue125._id,
              title: 'AI Security Alert on #125',
              message: 'AI Issue Triage flagged #125 as CRITICAL severity with 98% confidence',
              type: 'AI_ALERT',
              read: false,
            },
          ]
        : []),
    ];

    for (const notif of notificationsData) {
      const existingNotif = await Notification.findOne({
        recipient: notif.recipient,
        project: notif.project,
        title: notif.title,
      });
      if (!existingNotif) {
        await Notification.create(notif);
      }
    }

    console.log('[Seed] Demonstration dataset verified and ready! Demo account: ' + demoUserEmail);
  } catch (err) {
    console.error('[Seed] Error checking or seeding demo data:', err);
  }
};

// Support running directly via `node src/utils/seedData.js` or `npm run seed`
const isDirectRun = () => {
  if (!process.argv[1]) return false;
  const scriptPath = path.resolve(process.argv[1]);
  const modulePath = path.resolve(fileURLToPath(import.meta.url));
  return scriptPath === modulePath;
};

if (isDirectRun()) {
  (async () => {
    try {
      dotenv.config();
      const { connectDB, closeDB } = await import('../config/db.js');
      await connectDB();
      await seedDatabase();
      await closeDB();
      console.log('[Seed] Standalone seed run completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Seed] Standalone seed run failed:', err);
      process.exit(1);
    }
  })();
}
