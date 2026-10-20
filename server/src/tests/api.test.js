import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { Comment } from '../models/Comment.js';
import { PullRequest } from '../models/PullRequest.js';
import { Notification } from '../models/Notification.js';
import { Activity } from '../models/Activity.js';
import { WebhookDelivery } from '../models/WebhookDelivery.js';
import { OAuthState } from '../models/OAuthState.js';
import { verifyGitHubSignature } from '../services/github/webhookHandler.js';
import { heuristicAnalyzeIssue } from '../services/ai/issueAnalyzer.js';
import { normalizeRepoInput } from '../services/github/repositoryService.js';
import { githubClient } from '../services/github/githubClient.js';
import { pullRequestService } from '../services/github/pullRequestService.js';

let mongoServer;
let authToken = '';
let testUserId = '';
let testProjectId = '';
let developerToken = '';
let developerId = '';
let outsiderToken = '';
let outsiderId = '';
let testIssueId = '';
let testPullRequestId = '';
let adminToken = '';

describe('DevFlow AI Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key_12345_long_enough';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Health Check & Public Endpoints', () => {
    test('GET /api/health returns 200 with service metadata', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'healthy');
      assert.strictEqual(res.body.service, 'DevFlow AI API');
    });
  });

  describe('2. Authentication Flow', () => {
    test('POST /api/auth/register creates user and returns JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Sharma',
          email: 'priya@test.com',
          password: 'password123',
          role: 'ADMIN',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.email, 'priya@test.com');
      assert.strictEqual(res.body.user.role, 'DEVELOPER');
      authToken = res.body.token;
      testUserId = res.body.user.id;
    });

    test('POST /api/auth/register defaults normal accounts to DEVELOPER', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Developer User',
          email: 'developer@test.com',
          password: 'password123',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.user.role, 'DEVELOPER');
      developerToken = res.body.token;
      developerId = res.body.user.id;
    });

    test('POST /api/auth/register creates a separate outsider fixture', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Outsider User',
          email: 'outsider@test.com',
          password: 'password123',
        });

      assert.strictEqual(res.status, 201);
      outsiderToken = res.body.token;
      outsiderId = res.body.user.id;
      assert.strictEqual(res.body.user.role, 'DEVELOPER');
    });

    test('administrator can provision a role through the protected endpoint', async () => {
      await User.create({
        name: 'Provisioning Admin',
        email: 'provisioning-admin@test.com',
        password: 'password123',
        role: 'ADMIN',
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'provisioning-admin@test.com', password: 'password123' });
      adminToken = loginRes.body.token;

      const res = await request(app)
        .patch(`/api/auth/users/${developerId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.role, 'VIEWER');
    });

    test('POST /api/auth/login succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test.com',
          password: 'password123',
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
    });

    test('POST /api/auth/login fails with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test.com',
          password: 'wrongpassword',
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('GET /api/auth/me returns current user profile with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.email, 'priya@test.com');
    });

    test('invalid and expired JWTs return controlled 401 responses', async () => {
      const invalidRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');
      assert.strictEqual(invalidRes.status, 401);

      const expiredToken = jwt.sign(
        { id: testUserId },
        process.env.JWT_SECRET,
        { expiresIn: -1 }
      );
      const expiredRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      assert.strictEqual(expiredRes.status, 401);
    });

    test('missing JWT secret returns a controlled 401 response', async () => {
      const originalSecret = process.env.JWT_SECRET;
      try {
        delete process.env.JWT_SECRET;
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`);
        assert.strictEqual(res.status, 401);
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });

  describe('3. Project Management', () => {
    test('POST /api/projects creates a new project with owner and key', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Payment Service',
          key: 'PAY',
          description: 'Payment gateway integration microservice',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.project.key, 'PAY');
      testProjectId = res.body.project._id;
    });

    test('GET /api/projects returns list of projects for authenticated user', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.projects));
      assert.strictEqual(res.body.projects.length, 1);
    });

    test('unauthorized users cannot read or manage a private project', async () => {
      const projectRes = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${developerToken}`);
      assert.strictEqual(projectRes.status, 404);

      const addMemberRes = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ userId: testUserId, role: 'DEVELOPER' });
      assert.strictEqual(addMemberRes.status, 403);

      const removeMemberRes = await request(app)
        .delete(`/api/projects/${testProjectId}/members/${testUserId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      assert.strictEqual(removeMemberRes.status, 403);
    });

    test('project owner can add a developer member', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: developerId, role: 'DEVELOPER' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.members.some((member) => member.user?._id?.toString() === developerId));
    });
  });

  describe('4. Issue Management & Workflow', () => {
    let createdIssueId = '';

    test('POST /api/issues creates issue with auto-incremented issueNumber', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Payment webhook drops signature header',
          description: 'The incoming webhook route drops the signature header when payload exceeds 1MB.',
          type: 'BUG',
          priority: 'HIGH',
          labels: ['payment', 'webhook', 'security'],
          project: testProjectId,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.issue.issueNumber, 1);

    test('deleting a project removes its dependent records', async () => {
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cascade Delete Project', key: 'CASCADE', description: 'Isolated deletion fixture' });
      assert.strictEqual(projectRes.status, 201);
      const projectId = projectRes.body.project._id;

      const issueRes = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project: projectId,
          title: 'Dependent issue',
          description: 'Dependent records are removed with their project',
        });
      assert.strictEqual(issueRes.status, 201);
      const issueId = issueRes.body.issue._id;

      const commentRes = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Dependent comment' });
      assert.strictEqual(commentRes.status, 201);

      await PullRequest.create({
        project: projectId,
        prNumber: 1,
        title: 'Dependent PR',
        htmlUrl: 'https://github.com/example/repo/pull/1',
      });
      await Notification.create({
        recipient: testUserId,
        project: projectId,
        title: 'Dependent notification',
        message: 'Dependent notification body',
      });

      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(await Issue.countDocuments({ project: projectId }), 0);
      assert.strictEqual(await Comment.countDocuments({ issue: issueId }), 0);
      assert.strictEqual(await PullRequest.countDocuments({ project: projectId }), 0);
      assert.strictEqual(await Activity.countDocuments({ project: projectId }), 0);
      assert.strictEqual(await Notification.countDocuments({ project: projectId }), 0);
    });
      assert.strictEqual(res.body.issue.status, 'OPEN');
      createdIssueId = res.body.issue._id;
      testIssueId = createdIssueId;
    });

    test('PUT /api/issues/:id updates status and tracks activity', async () => {
      const res = await request(app)
        .put(`/api/issues/${createdIssueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'IN_PROGRESS',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.issue.status, 'IN_PROGRESS');
    });

    test('POST /api/issues/:id/comments adds a comment to the issue', async () => {
      const res = await request(app)
        .post(`/api/issues/${createdIssueId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Investigating nginx proxy buffer size settings.',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.comment.content, 'Investigating nginx proxy buffer size settings.');
    });

    test('unauthorized users cannot read, update, delete, or comment on an issue', async () => {
      const headers = { Authorization: `Bearer ${outsiderToken}` };
      const getRes = await request(app).get(`/api/issues/${createdIssueId}`).set(headers);
      const updateRes = await request(app).put(`/api/issues/${createdIssueId}`).set(headers).send({ status: 'CLOSED' });
      const deleteRes = await request(app).delete(`/api/issues/${createdIssueId}`).set(headers);
      const commentRes = await request(app).post(`/api/issues/${createdIssueId}/comments`).set(headers).send({ content: 'Unauthorized comment' });

      assert.strictEqual(getRes.status, 404);
      assert.strictEqual(updateRes.status, 404);
      assert.strictEqual(deleteRes.status, 403);
      assert.strictEqual(commentRes.status, 404);
    });

    test('authorized project members can read and update issues', async () => {
      const headers = { Authorization: `Bearer ${developerToken}` };
      const getRes = await request(app).get(`/api/issues/${createdIssueId}`).set(headers);
      const updateRes = await request(app).put(`/api/issues/${createdIssueId}`).set(headers).send({ status: 'IN_REVIEW' });

      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.body.issue.status, 'IN_REVIEW');
    });

    test('issue assignment rejects users outside the project', async () => {
      const createRes = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project: testProjectId,
          title: 'Reject cross-project assignment',
          description: 'An issue must not notify or assign an outsider',
          assignee: outsiderId,
        });

      assert.strictEqual(createRes.status, 400);
      assert.match(createRes.body.message, /member of this project/);

      const issue = await Issue.findById(testIssueId);
      const updateRes = await request(app)
        .put(`/api/issues/${testIssueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignee: outsiderId });

      assert.strictEqual(updateRes.status, 400);
      assert.strictEqual(issue.assignee, null);
    });
  });

  describe('5. AI Issue Analysis & Fix Prompt Validation', () => {
    test('Heuristic analyzer categorizes BUG, suggested labels, and root cause', () => {
      const analysis = heuristicAnalyzeIssue({
        title: 'Fix JWT expiration bug returns 500 instead of 401',
        description: 'Expired token crashes auth middleware.',
      });

      assert.strictEqual(analysis.issueType, 'BUG');
      assert.strictEqual(analysis.priority, 'HIGH');
      assert.ok(analysis.suggestedLabels.includes('authentication'));
      assert.ok(analysis.relevantCode.length > 0);
      assert.ok(analysis.confidence >= 0.7);
    });

    test('POST /api/ai/analyze-issue returns structured JSON', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-issue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Unhandled rejection on token expiry',
          description: 'Sending an expired bearer token results in 500 status code.',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.analysis.summary);
      assert.ok(res.body.analysis.possibleRootCause);
    });

    test('AI handlers reject unauthorized project and issue references', async () => {
      const pullRequest = await PullRequest.create({
        project: testProjectId,
        prNumber: 12,
        title: 'Private project pull request',
        htmlUrl: 'https://github.com/example/private/pull/12',
      });
      testPullRequestId = pullRequest._id.toString();
      const headers = { Authorization: `Bearer ${outsiderToken}` };
      const analyzeRes = await request(app)
        .post('/api/ai/analyze-issue')
        .set(headers)
        .send({
          title: 'Unauthorized analysis',
          description: 'This must not access another project.',
          projectId: testProjectId,
        });
      const duplicateRes = await request(app)
        .post('/api/ai/detect-duplicates')
        .set(headers)
        .send({ projectId: testProjectId, title: 'Unauthorized duplicate check' });
      const promptRes = await request(app)
        .post('/api/ai/generate-fix-prompt')
        .set(headers)
        .send({ issueId: testIssueId });
      const prRes = await request(app)
        .post('/api/ai/analyze-pr')
        .set(headers)
        .send({ prId: testPullRequestId, issueId: testIssueId });

      assert.strictEqual(analyzeRes.status, 404);
      assert.strictEqual(duplicateRes.status, 404);
      assert.strictEqual(promptRes.status, 404);
      assert.strictEqual(prRes.status, 404);
    });
  });

  describe('6. GitHub Webhook Security, Idempotency & Issue Synchronization', () => {
    test('webhook route rejects missing and invalid signatures', async () => {
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
      const rawBody = '{"zen":"raw-body-check","nested":{"value":1}}';
      try {
        delete process.env.GITHUB_WEBHOOK_SECRET;
        const missingSecretRes = await request(app)
          .post('/api/github/webhook')
          .set('Content-Type', 'application/json')
          .send(rawBody);
        assert.strictEqual(missingSecretRes.status, 401);

        process.env.GITHUB_WEBHOOK_SECRET = 'test_webhook_secret_key';
        const invalidRes = await request(app)
          .post('/api/github/webhook')
          .set('Content-Type', 'application/json')
          .set('x-hub-signature-256', 'sha256=invalid')
          .send(rawBody);
        assert.strictEqual(invalidRes.status, 401);
      } finally {
        if (originalSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
        else process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
      }
    });

    test('webhook route verifies the exact raw request body', async () => {
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
      const secret = 'test_webhook_secret_key';
      const rawBody = '{"zen":"raw-body-check","nested":{"value":1}}';
      const signature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      try {
        process.env.GITHUB_WEBHOOK_SECRET = secret;
        const res = await request(app)
          .post('/api/github/webhook')
          .set('Content-Type', 'application/json')
          .set('x-github-event', 'ping')
          .set('x-hub-signature-256', signature)
          .send(rawBody);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.zen, 'raw-body-check');
      } finally {
        if (originalSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
        else process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
      }
    });

    test('concurrent delivery claims allow only one processor and failed deliveries can retry', async () => {
      await WebhookDelivery.deleteMany({ deliveryId: 'concurrent-delivery' });
      const claims = await Promise.all([
        (await import('../services/github/webhookService.js')).webhookService.claimDelivery({
          deliveryId: 'concurrent-delivery', event: 'ping', action: '', repository: 'test-org/test-repo',
        }),
        (await import('../services/github/webhookService.js')).webhookService.claimDelivery({
          deliveryId: 'concurrent-delivery', event: 'ping', action: '', repository: 'test-org/test-repo',
        }),
      ]);
      assert.strictEqual(claims.filter((claim) => claim.claimToken).length, 1);

      const { webhookService } = await import('../services/github/webhookService.js');
      await webhookService.failDelivery('concurrent-delivery', claims.find((claim) => claim.claimToken).claimToken);
      const retry = await webhookService.claimDelivery({
        deliveryId: 'concurrent-delivery', event: 'ping', action: '', repository: 'test-org/test-repo',
      });
      assert.ok(retry.claimToken);
    });

    test('webhookService correctly validates SHA256 HMAC digest', async () => {
      const { webhookService } = await import('../services/github/webhookService.js');
      const secret = 'test_webhook_secret_key';
      const payload = JSON.stringify({ action: 'opened', number: 42 });
      
      const hmac = crypto.createHmac('sha256', secret);
      const validSig = `sha256=${hmac.update(payload).digest('hex')}`;

      assert.strictEqual(webhookService.verifySignature(payload, validSig, secret), true);
      assert.strictEqual(webhookService.verifySignature(payload, 'sha256=invalidhash', secret), false);
    });

    test('extractIssueNumbers correctly parses both #124 and DEVFLOW-124 conventions', async () => {
      const { extractIssueNumbers } = await import('../services/github/issueLinker.js');
      
      const text1 = 'This PR fixes #124 and closes #125';
      const res1 = extractIssueNumbers(text1);
      assert.deepStrictEqual(res1.sort((a, b) => a - b), [124, 125]);

      const text2 = 'Resolves FLOW-124 and fixes DEVFLOW-99';
      const res2 = extractIssueNumbers(text2, 'FLOW');
      assert.deepStrictEqual(res2.sort((a, b) => a - b), [99, 124]);
    });

    test('Webhook processes PR closed & merged event and marks linked issue RESOLVED', async () => {
      const { webhookService } = await import('../services/github/webhookService.js');

      // Setup connected repo info on test project
      await Project.findByIdAndUpdate(testProjectId, {
        'github.connected': true,
        'github.owner': 'test-org',
        'github.repository': 'test-repo',
      });

      const payload = {
        action: 'closed',
        repository: {
          name: 'test-repo',
          owner: { login: 'test-org' },
          full_name: 'test-org/test-repo',
        },
        pull_request: {
          number: 105,
          title: 'Resolve payment issue (Fixes #1)',
          body: 'Fixes #1',
          html_url: 'https://github.com/test-org/test-repo/pull/105',
          state: 'closed',
          merged: true,
          user: { login: 'octocat' },
          head: { ref: 'fix-payment' },
          base: { ref: 'main' },
        },
      };

      const deliveryId = 'delivery-unique-uuid-101';
      const res = await webhookService.handleWebhook({
        event: 'pull_request',
        deliveryId,
        payload,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 'MERGED');

      // Verify that Issue #1 was moved to RESOLVED
      const updatedIssue = await Issue.findOne({ project: testProjectId, issueNumber: 1 });
      assert.strictEqual(updatedIssue.status, 'RESOLVED');

      // Test Idempotency: replay the same deliveryId
      const replayRes = await webhookService.handleWebhook({
        event: 'pull_request',
        deliveryId,
        payload,
      });

      assert.strictEqual(replayRes.success, true);
      assert.strictEqual(replayRes.duplicate, true);
    });

    test('Unauthorized user cannot access project GitHub resources', async () => {
      // Create second unprivileged user
      const unprivRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Stranger User',
          email: 'stranger@test.com',
          password: 'password123',
        });

      const unprivToken = unprivRes.body.token;

      // Attempt to access testProjectId branches
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/github/branches`)
        .set('Authorization', `Bearer ${unprivToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    test('normalizeRepoInput extracts owner and repo name from full GitHub URLs', () => {
      const result1 = normalizeRepoInput('Astha-codes16', 'https://github.com/Astha-codes16/BlogIt_mern_project');
      assert.strictEqual(result1.owner, 'Astha-codes16');
      assert.strictEqual(result1.repo, 'BlogIt_mern_project');

      const result2 = normalizeRepoInput('', 'https://github.com/facebook/react.git');
      assert.strictEqual(result2.owner, 'facebook');
      assert.strictEqual(result2.repo, 'react');

      const result3 = normalizeRepoInput('Astha-codes16/BlogIt_mern_project', '');
      assert.strictEqual(result3.owner, 'Astha-codes16');
      assert.strictEqual(result3.repo, 'BlogIt_mern_project');

      const result4 = normalizeRepoInput('Astha-codes16', 'BlogIt_mern_project');
      assert.strictEqual(result4.owner, 'Astha-codes16');
      assert.strictEqual(result4.repo, 'BlogIt_mern_project');
    });

    test('githubClient has getRepository and getPullRequests methods defined', () => {
      assert.strictEqual(typeof githubClient.getRepository, 'function');
      assert.strictEqual(typeof githubClient.getPullRequests, 'function');
      assert.strictEqual(typeof githubClient.request, 'function');
    });

    test('POST /api/issues/:issueId/github/link-pr rejects invalid PR number with 400', async () => {
      const res = await request(app)
        .post(`/api/issues/${testProjectId}/github/link-pr`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('POST /api/issues/:issueId/github/link-pr rejects non-existent issue with 404', async () => {
      const fakeIssueId = '6abb605157455d996a6da57e';
      const res = await request(app)
        .post(`/api/issues/${fakeIssueId}/github/link-pr`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ prNumber: 1 });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    test('POST /api/issues/:issueId/github/link-pr links real PR to issue and DELETE unlinks it', async () => {
      // 1. Create an issue
      const issueRes = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project: testProjectId,
          title: 'Manual PR link test issue',
          description: 'Testing manual linking of GitHub PR #1 to DevFlow issue',
        });
      assert.strictEqual(issueRes.status, 201);
      const targetIssueId = issueRes.body.issue.id || issueRes.body.issue._id;

      // 2. Connect repository on test project
      await Project.findByIdAndUpdate(testProjectId, {
        'github.connected': true,
        'github.owner': 'Astha-codes16',
        'github.repository': 'Task-manager-app',
      });

      // 3. Mock getPullRequestDetails for this unit test
      const origGetDetails = pullRequestService.getPullRequestDetails;
      pullRequestService.getPullRequestDetails = async () => ({
        prNumber: 1,
        title: 'Test DevFlow GitHub integration',
        body: 'Initial integration PR',
        status: 'OPEN',
        author: { login: 'Astha-codes16', avatarUrl: '' },
        headBranch: 'devflow-test',
        baseBranch: 'master',
        htmlUrl: 'https://github.com/Astha-codes16/Task-manager-app/pull/1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        // Link PR #1
        const linkRes = await request(app)
          .post(`/api/issues/${targetIssueId}/github/link-pr`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ prNumber: 1 });

        assert.strictEqual(linkRes.status, 200);
        assert.strictEqual(linkRes.body.success, true);
        assert.strictEqual(linkRes.body.pullRequest.prNumber, 1);
        assert.strictEqual(linkRes.body.issue.linkedPullRequests.length, 1);
        assert.strictEqual(linkRes.body.issue.status, 'IN_REVIEW');

        // Verify issue in DB has PR
        const dbIssue = await Issue.findById(targetIssueId);
        assert.strictEqual(dbIssue.linkedPullRequests.length, 1);

        // Unlink PR #1
        const unlinkRes = await request(app)
          .delete(`/api/issues/${targetIssueId}/github/link-pr/1`)
          .set('Authorization', `Bearer ${authToken}`);

        assert.strictEqual(unlinkRes.status, 200);
        assert.strictEqual(unlinkRes.body.success, true);
        assert.strictEqual(unlinkRes.body.issue.linkedPullRequests.length, 0);

        const dbIssueAfter = await Issue.findById(targetIssueId);
        assert.strictEqual(dbIssueAfter.linkedPullRequests.length, 0);
      } finally {
        pullRequestService.getPullRequestDetails = origGetDetails;
      }
    });
  });

  describe('7. GitHub OAuth state security', () => {
    test('OAuth state is random, bound, expiring, and single-use', async () => {
      const originalClientId = process.env.GITHUB_CLIENT_ID;
      const originalCallbackUrl = process.env.GITHUB_CALLBACK_URL;
      const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;
      const originalFetch = global.fetch;
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:5000/api/auth/github/callback';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

      try {
        const startRes = await request(app)
          .get('/api/auth/github')
          .set('Authorization', `Bearer ${authToken}`);
        assert.strictEqual(startRes.status, 200);
        const state = new URL(startRes.body.url).searchParams.get('state');
        assert.ok(state);
        assert.notStrictEqual(state, testUserId);

        const tamperedRes = await request(app)
          .get(`/api/auth/github/callback?code=code-1&state=${state}tampered`);
        assert.match(tamperedRes.headers.location, /github_error=invalid_state/);

        const expiredState = 'expired-oauth-state';
        await OAuthState.create({
          state: expiredState,
          user: testUserId,
          expiresAt: new Date(Date.now() - 1000),
        });
        const expiredRes = await request(app)
          .get(`/api/auth/github/callback?code=code-expired&state=${expiredState}`);
        assert.match(expiredRes.headers.location, /github_error=invalid_state/);

        global.fetch = async (url) => ({
          json: async () => url.includes('access_token')
            ? { access_token: 'github-access-token' }
            : { login: 'github-user', id: 123 },
        });
        const validStartRes = await request(app)
          .get('/api/auth/github')
          .set('Authorization', `Bearer ${authToken}`);
        const validState = new URL(validStartRes.body.url).searchParams.get('state');
        const callbackRes = await request(app)
          .get(`/api/auth/github/callback?code=code-valid&state=${validState}`);
        assert.match(callbackRes.headers.location, /github_connected=true/);

        const replayRes = await request(app)
          .get(`/api/auth/github/callback?code=code-valid&state=${validState}`);
        assert.match(replayRes.headers.location, /github_error=invalid_state/);
      } finally {
        global.fetch = originalFetch;
        if (originalClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
        else process.env.GITHUB_CLIENT_ID = originalClientId;
        if (originalCallbackUrl === undefined) delete process.env.GITHUB_CALLBACK_URL;
        else process.env.GITHUB_CALLBACK_URL = originalCallbackUrl;
        if (originalClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
        else process.env.GITHUB_CLIENT_SECRET = originalClientSecret;
      }
    });
  });

  describe('8. GitHub API cache isolation', () => {
    test('authenticated GitHub responses are never shared through the cache', async () => {
      const originalFetch = global.fetch;
      let requestCount = 0;
      githubClient.clearCache();
      global.fetch = async () => {
        requestCount += 1;
        return { ok: true, json: async () => ({ requestCount }) };
      };

      try {
        const first = await githubClient.request('/user', {}, 'token-a');
        const second = await githubClient.request('/user', {}, 'token-b');
        assert.strictEqual(first.requestCount, 1);
        assert.strictEqual(second.requestCount, 2);
      } finally {
        global.fetch = originalFetch;
        githubClient.clearCache();
      }
    });
  });

  describe('9. UI integration endpoints', () => {
    test('PATCH /api/notifications/mark-all-read marks the current user notifications read', async () => {
      const notification = await Notification.create({
        recipient: testUserId,
        sender: developerId,
        project: testProjectId,
        title: 'Unread notification',
        message: 'Mark this notification read',
        type: 'AI_ALERT',
      });

      const res = await request(app)
        .patch('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const updated = await Notification.findById(notification._id);
      assert.strictEqual(updated.read, true);
    });

    test('POST /api/github/simulate-webhook processes a merge through webhook synchronization', async () => {
      const issueRes = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project: testProjectId,
          title: 'Webhook simulator regression issue',
          description: 'Verifies simulated pull request merges update issues',
        });
      assert.strictEqual(issueRes.status, 201);
      const issue = issueRes.body.issue;

      const res = await request(app)
        .post('/api/github/simulate-webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          prNumber: 99,
          action: 'closed',
          merged: true,
          title: `Fix simulator regression (Fixes #${issue.issueNumber})`,
          body: 'Closes the simulator regression issue.',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const updatedIssue = await Issue.findById(issue._id);
      assert.strictEqual(updatedIssue.status, 'RESOLVED');
      assert.strictEqual(updatedIssue.linkedPullRequests.length, 1);
    });

    test('webhook simulator rejects invalid PR numbers and actions', async () => {
      const invalidNumber = await request(app)
        .post('/api/github/simulate-webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: testProjectId, prNumber: 0 });
      assert.strictEqual(invalidNumber.status, 400);
      assert.match(invalidNumber.body.message, /valid pull request number/);

      const invalidAction = await request(app)
        .post('/api/github/simulate-webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: testProjectId, prNumber: 100, action: 'deleted' });
      assert.strictEqual(invalidAction.status, 400);
      assert.match(invalidAction.body.message, /Unsupported pull request action/);
    });
  });
});
