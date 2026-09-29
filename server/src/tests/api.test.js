import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { verifyGitHubSignature } from '../services/github/webhookHandler.js';
import { heuristicAnalyzeIssue } from '../services/ai/issueAnalyzer.js';
import { normalizeRepoInput } from '../services/github/repositoryService.js';
import { githubClient } from '../services/github/githubClient.js';
import { pullRequestService } from '../services/github/pullRequestService.js';

let mongoServer;
let authToken = '';
let testUserId = '';
let testProjectId = '';

describe('DevFlow AI Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key_12345';
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
      authToken = res.body.token;
      testUserId = res.body.user.id;
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
      assert.strictEqual(res.body.issue.status, 'OPEN');
      createdIssueId = res.body.issue._id;
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
  });

  describe('6. GitHub Webhook Security, Idempotency & Issue Synchronization', () => {
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

      assert.strictEqual(res.status, 403);
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
});
