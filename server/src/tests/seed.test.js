import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { Notification } from '../models/Notification.js';
import { PullRequest } from '../models/PullRequest.js';
import { Activity } from '../models/Activity.js';
import { seedDatabase } from '../utils/seedData.js';

let mongoServer;

describe('Demo Account & Seed Data Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_DEMO_SEED = 'true';
    process.env.JWT_SECRET = 'test_secret_key_12345_long_enough';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('1. Pre-existing non-demo data does not prevent demo data seeding', async () => {
    // Create an existing real user before seed runs
    const existingUser = await User.create({
      name: 'Existing Engineer',
      email: 'recruiter@company.com',
      password: 'password123',
      role: 'DEVELOPER',
    });

    assert.ok(existingUser._id);
    const initialUserCount = await User.countDocuments();
    assert.strictEqual(initialUserCount, 1);

    // Run seedDatabase
    await seedDatabase();

    // Verify demo user was created despite existing records
    const demoUser = await User.findOne({ email: 'demo@devflow.ai' });
    assert.ok(demoUser, 'Demo user demo@devflow.ai should exist after seed');
    assert.strictEqual(demoUser.role, 'ADMIN');

    // Verify existing user was NOT deleted or overwritten
    const preservedUser = await User.findOne({ email: 'recruiter@company.com' });
    assert.ok(preservedUser, 'Pre-existing user must remain intact');
    assert.strictEqual(preservedUser.name, 'Existing Engineer');
  });

  test('2. Demo user can authenticate through existing login flow', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@devflow.ai',
        password: 'password123',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Should return valid JWT bearer token');
    assert.strictEqual(res.body.user.email, 'demo@devflow.ai');
    assert.strictEqual(res.body.user.role, 'ADMIN');
  });

  test('3. Demo user accesses seeded projects, issues, and notifications', async () => {
    // Log in as demo user to obtain token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@devflow.ai',
        password: 'password123',
      });

    const token = loginRes.body.token;

    // Fetch projects
    const projRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(projRes.status, 200);
    assert.ok(projRes.body.projects.length >= 2, 'Demo user should have access to FLOW and SYNC projects');
    const keys = projRes.body.projects.map((p) => p.key);
    assert.ok(keys.includes('FLOW'));
    assert.ok(keys.includes('SYNC'));

    const flowProj = projRes.body.projects.find((p) => p.key === 'FLOW');

    // Fetch issues for FLOW project
    const issuesRes = await request(app)
      .get(`/api/issues?projectId=${flowProj._id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(issuesRes.status, 200);
    assert.ok(issuesRes.body.issues.length >= 9, 'FLOW should contain seeded issues across statuses');

    // Verify statuses and priorities diversity
    const statuses = new Set(issuesRes.body.issues.map((i) => i.status));
    assert.ok(statuses.has('OPEN'));
    assert.ok(statuses.has('IN_PROGRESS'));
    assert.ok(statuses.has('IN_REVIEW'));
    assert.ok(statuses.has('RESOLVED'));
    assert.ok(statuses.has('CLOSED'));

    // Fetch notifications
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(notifRes.status, 200);
    assert.ok(notifRes.body.notifications.length >= 2, 'Demo user should have notifications');
    assert.ok(notifRes.body.unreadCount >= 1, 'Should have unread notifications');
  });

  test('4. Running seedDatabase repeatedly is idempotent and produces zero duplicates', async () => {
    const usersBefore = await User.countDocuments();
    const projectsBefore = await Project.countDocuments();
    const issuesBefore = await Issue.countDocuments();
    const prsBefore = await PullRequest.countDocuments();
    const activitiesBefore = await Activity.countDocuments();
    const notifsBefore = await Notification.countDocuments();

    // Run seed twice more
    await seedDatabase();
    await seedDatabase();

    const usersAfter = await User.countDocuments();
    const projectsAfter = await Project.countDocuments();
    const issuesAfter = await Issue.countDocuments();
    const prsAfter = await PullRequest.countDocuments();
    const activitiesAfter = await Activity.countDocuments();
    const notifsAfter = await Notification.countDocuments();

    assert.strictEqual(usersAfter, usersBefore, 'No duplicate users should be created');
    assert.strictEqual(projectsAfter, projectsBefore, 'No duplicate projects should be created');
    assert.strictEqual(issuesAfter, issuesBefore, 'No duplicate issues should be created');
    assert.strictEqual(prsAfter, prsBefore, 'No duplicate PRs should be created');
    assert.strictEqual(activitiesAfter, activitiesBefore, 'No duplicate activities should be created');
    assert.strictEqual(notifsAfter, notifsBefore, 'No duplicate notifications should be created');
  });

  test('5. Non-demo user data remains untouched and can still authenticate', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'recruiter@company.com',
        password: 'password123',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.email, 'recruiter@company.com');
  });
});
