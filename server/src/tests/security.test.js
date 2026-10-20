import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { getJwtSecret, assertProductionSecurityConfig } from '../config/security.js';
import { connectDB } from '../config/db.js';

test('JWT configuration rejects missing and short secrets', () => {
  const originalSecret = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET is required/);
    process.env.JWT_SECRET = 'too-short';
    assert.throws(() => getJwtSecret(), /at least 32 characters/);
    process.env.JWT_SECRET = 'test_secret_key_12345_long_enough';
    assert.equal(getJwtSecret(), 'test_secret_key_12345_long_enough');
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('production configuration rejects missing security settings', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.MONGODB_URI;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    assert.throws(() => assertProductionSecurityConfig(), /JWT_SECRET, MONGODB_URI, GITHUB_WEBHOOK_SECRET/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
    if (originalWebhookSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

test('production MongoDB failure does not start an in-memory fallback', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMongoUri = process.env.MONGODB_URI;
  try {
    await mongoose.disconnect();
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:9/devflow-unavailable';
    await assert.rejects(connectDB, /in-memory fallback is disabled/);
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await mongoose.disconnect();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});
