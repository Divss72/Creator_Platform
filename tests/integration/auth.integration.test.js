'use strict';

const { createTestApi } = require('../helpers/api');
const { resetDb } = require('../helpers/db');
const { createCreator, createSubscriber } = require('../helpers/factories');

describe('Integration: Authentication & Authorization Flow', () => {
  let api;

  beforeAll(() => {
    api = createTestApi();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('Registration', () => {
    test('successfully registers a new subscriber user', async () => {
      const res = await api.request.post('/api/auth/register').send({
        email: 'newsub@test.local',
        password: 'Password123!',
        role: 'subscriber',
        name: 'New Sub'
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('subscriber');
      expect(res.body.user.email).toBe('newsub@test.local');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    test('successfully registers a new creator user with creator profile', async () => {
      const res = await api.request.post('/api/auth/register').send({
        email: 'newcreator@test.local',
        password: 'Password123!',
        role: 'creator',
        name: 'New Creator'
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('creator');
      expect(res.body.user.name).toBe('New Creator');
      expect(res.body.user.displayName).toBe('New Creator');
    });

    test('rejects duplicate email with 409 Conflict', async () => {
      await createSubscriber({ email: 'taken@test.local' });

      const res = await api.request.post('/api/auth/register').send({
        email: 'taken@test.local',
        password: 'Password123!',
        role: 'subscriber',
        name: 'Duplicate'
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    test('rejects weak password with 400 Validation Error', async () => {
      const res = await api.request.post('/api/auth/register').send({
        email: 'weakpass@test.local',
        password: '123',
        role: 'subscriber',
        name: 'Weak'
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Login', () => {
    test('authenticates valid credentials and issues JWT token', async () => {
      const sub = await createSubscriber({
        email: 'logintest@test.local',
        password: 'Password123!'
      });

      const res = await api.request.post('/api/auth/login').send({
        email: 'logintest@test.local',
        password: 'Password123!'
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBe(sub.id);
    });

    test('rejects invalid password with 401 Unauthenticated', async () => {
      await createSubscriber({ email: 'loginfail@test.local', password: 'Password123!' });

      const res = await api.request.post('/api/auth/login').send({
        email: 'loginfail@test.local',
        password: 'WrongPassword!'
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Current User Profile /api/auth/me', () => {
    test('returns authenticated user profile when token is valid', async () => {
      const creator = await createCreator({ displayName: 'My Profile' });

      const res = await api.request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(creator.id);
      expect(res.body.user.role).toBe('creator');
      expect(res.body.user.displayName).toBe('My Profile');
    });

    test('returns 401 when token is missing or invalid', async () => {
      const resNoToken = await api.request.get('/api/auth/me');
      expect(resNoToken.status).toBe(401);

      const resBadToken = await api.request
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(resBadToken.status).toBe(401);
    });
  });
});
