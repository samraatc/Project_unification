/**
 * Phase 1 — auth integration tests.
 *
 * Uses mongodb-memory-server (declared in apps/api/package.json devDependencies)
 * so the tests run in CI without an external Mongo. A local docker-compose Mongo
 * is also fine — set MONGO_URI to point at it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { createApp } from '../src/app.js';
import { seedIdentity } from '../src/db/seed/runSeed.js';

let mongo: MongoMemoryReplSet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await seedIdentity('000000000000000000000001');
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    if (key === 'permissions' || key === 'roles') continue; // keep seeds
    await collections[key]!.deleteMany({});
  }
});

describe('auth — register + verify', () => {
  it('registers a user, then activates after email-verify OTP', async () => {
    const app = createApp();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'asha@example.com',
      password: 'correct-horse-battery-staple',
      acceptedTermsAt: new Date().toISOString(),
    });
    expect(reg.status).toBe(201);
    expect(reg.body.userId).toBeTruthy();
    expect(reg.body.verifyChannel).toBe('email');
  });

  it('rejects breached passwords', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'leak@example.com',
      password: 'password1234',
      acceptedTermsAt: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
    expect(['WEAK_PASSWORD', 'BREACHED_PASSWORD']).toContain(res.body.code);
  });

  it('rejects duplicate email signups with 409', async () => {
    const app = createApp();
    const body = {
      email: 'dup@example.com',
      password: 'correct-horse-battery-staple',
      acceptedTermsAt: new Date().toISOString(),
    };
    await request(app).post('/api/v1/auth/register').send(body);
    const dup = await request(app).post('/api/v1/auth/register').send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');
  });
});

describe('auth — login', () => {
  it('rejects login on unverified account', async () => {
    const app = createApp();
    const body = {
      email: 'pending@example.com',
      password: 'correct-horse-battery-staple',
      acceptedTermsAt: new Date().toISOString(),
    };
    await request(app).post('/api/v1/auth/register').send(body);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: body.email, password: body.password });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('EMAIL_UNVERIFIED');
  });

  it('returns invalid-credentials for unknown identifier', async () => {
    const app = createApp();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'nope@example.com', password: 'correct-horse-battery-staple' });
    expect(login.status).toBe(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('me — permissions', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/me/permissions');
    expect(res.status).toBe(401);
  });
});

describe('rbac — permission guard', () => {
  it('blocks roles.read without permission', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/roles').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });
});

describe('jwks', () => {
  it('publishes a public RSA key', async () => {
    const app = createApp();
    const res = await request(app).get('/.well-known/jwks.json');
    expect(res.status).toBe(200);
    expect(res.body.keys).toBeInstanceOf(Array);
    expect(res.body.keys[0].kty).toBe('RSA');
    expect(res.body.keys[0].alg).toBe('RS256');
  });
});
