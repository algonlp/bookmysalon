import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
