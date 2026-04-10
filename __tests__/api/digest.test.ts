/**
 * @jest-environment node
 */
import { GET } from '@/app/api/digest/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';

jest.mock('fs');

const mockDigest = {
  date: '2025-04-09',
  fetchedAt: '2025-04-09T08:00:00.000Z',
  posts: [
    {
      id: 1,
      title: 'Test Post',
      url: 'https://example.com',
      score: 200,
      by: 'testuser',
      time: 1700000000,
      descendants: 50,
      comments: [],
    },
  ],
};

describe('GET /api/digest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 with valid JSON containing date and posts', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockDigest));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('date', '2025-04-09');
    expect(body).toHaveProperty('posts');
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts).toHaveLength(1);
  });

  it('returns 200 with fetchedAt timestamp', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockDigest));

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveProperty('fetchedAt');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('returns 500 if digest.json is missing', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty('error');
  });

  it('returns 500 if digest.json contains invalid JSON', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('not valid json {{{{');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty('error');
  });
});
