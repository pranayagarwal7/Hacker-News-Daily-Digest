/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ask/route';
import { NextRequest } from 'next/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStreamingMock(text: string) {
  async function* gen() {
    yield { text: () => text };
  }
  return { stream: gen() };
}

// Mock the Gemini SDK — no real API calls in tests
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContentStream: jest
        .fn()
        .mockResolvedValue(makeStreamingMock('Mocked Gemini answer.')),
    }),
  })),
}));

const mockDigest = {
  date: '2025-04-09',
  fetchedAt: '2025-04-09T08:00:00.000Z',
  posts: [
    {
      id: 1,
      title: 'Test Post About AI',
      url: 'https://example.com',
      score: 300,
      by: 'hacker',
      time: 1700000000,
      descendants: 80,
      comments: [{ id: 10, by: 'commenter', text: 'Great post!', time: 1700000001 }],
    },
  ],
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/ask', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 200 with streamed answer text for a valid question', async () => {
    const req = makeRequest({ question: 'What is the top post?', digest: mockDigest });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const text = await readStream(res);
    expect(text.length).toBeGreaterThan(0);
  });

  it('streams the Gemini response text', async () => {
    const req = makeRequest({ question: 'Summarize the AI discussions.', digest: mockDigest });
    const res = await POST(req);

    const text = await readStream(res);
    expect(text).toBe('Mocked Gemini answer.');
  });

  it('returns 400 when question is missing', async () => {
    const req = makeRequest({ digest: mockDigest });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when question is an empty string', async () => {
    const req = makeRequest({ question: '   ', digest: mockDigest });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when digest is missing', async () => {
    const req = makeRequest({ question: 'What is trending?' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when digest has no posts array', async () => {
    const req = makeRequest({ question: 'Any?', digest: { date: '2025-04-09' } });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = makeRequest({ question: 'Any question?', digest: mockDigest });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty('error');
    expect(JSON.stringify(body)).not.toContain('test-key');
  });
});
