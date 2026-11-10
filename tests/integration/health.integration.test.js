'use strict';

const { createTestApi } = require('../helpers/api');

describe('Integration: Health & Version Gate', () => {
  let api;

  beforeAll(() => {
    api = createTestApi();
  });

  test('GET /health returns 200 { status: "ok", db: "up" } when DB is connected', async () => {
    const res = await api.request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  test('GET /version returns 404 when unauthenticated or without token', async () => {
    const resNoToken = await api.request.get('/version');
    expect(resNoToken.status).toBe(404);

    const resWrongToken = await api.request
      .get('/version')
      .set('Authorization', 'Bearer totally-wrong-token');
    expect(resWrongToken.status).toBe(404);
  });
});

