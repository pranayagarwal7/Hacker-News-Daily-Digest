import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import type { Digest } from '@/lib/types';

// ─── Optional rate limiter (disabled if Upstash env vars are absent) ─────────

let rateLimiter: import('@upstash/ratelimit').Ratelimit | null = null;

function initRateLimiter() {
  if (rateLimiter !== null) return;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[ask] Rate limiting disabled — UPSTASH_REDIS_REST_URL / TOKEN not set');
    return;
  }
  // Dynamic import so the build doesn't fail if packages aren't installed yet
  Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ]).then(([{ Ratelimit }, { Redis }]) => {
    const redis = new Redis({ url, token });
    rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      analytics: false,
    });
  }).catch((err) => {
    console.warn('[ask] Ratelimit init failed (packages missing?):', err.message);
  });
}

initRateLimiter();

// ─── Context builder ─────────────────────────────────────────────────────────

function shouldIncludeComments(question: string): boolean {
  return /comment|discussion|controversial|opinion|saying|people think|debate|react|response|feeling/i.test(question);
}

function buildContext(digest: Digest, includeComments: boolean): string {
  return digest.posts
    .map((post, i) => {
      const header =
        `${i + 1}. "${post.title}"\n` +
        `   Score: ${post.score} | By: ${post.by} | Comments: ${post.descendants}\n` +
        `   URL: ${post.url}`;

      if (!includeComments || post.comments.length === 0) return header;

      const commentLines = post.comments
        .map((c) => `    ${c.by}: ${c.text.slice(0, 200)}`)
        .join('\n');
      return `${header}\n   Top comments:\n${commentLines}`;
    })
    .join('\n\n');
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: { question?: unknown; digest?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // 2. Validate inputs
  const { question, digest } = body;
  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'Missing or empty question.' }, { status: 400 });
  }
  if (
    !digest ||
    typeof digest !== 'object' ||
    !Array.isArray((digest as Record<string, unknown>).posts)
  ) {
    return NextResponse.json({ error: 'Missing or invalid digest.' }, { status: 400 });
  }

  // 3. API key
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 });
  }

  // 4. Rate limiting
  if (rateLimiter) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'anonymous';
    const { success, reset } = await rateLimiter.limit(ip);
    if (!success) {
      const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many requests. Please wait before asking another question.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  // 5. Build smart prompt
  const digestTyped = digest as Digest;
  const includeComments = shouldIncludeComments(question.trim());
  const context = buildContext(digestTyped, includeComments);
  const estimatedTokens = Math.ceil(context.length / 4);
  console.log(`[ask] model=gemini-2.5-flash-lite tokens=~${estimatedTokens} comments=${includeComments} question="${question.trim().slice(0, 80)}"`);

  const prompt =
    `You are an assistant analyzing today's Hacker News top stories.\n\n` +
    `Here are today's top 10 posts:\n\n${context}\n\n` +
    `Answer the following question concisely and insightfully. ` +
    `Use plain text — no markdown formatting.\n\n` +
    `Question: ${question.trim()}`;

  // 6. Stream response
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const streamResult = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ask] Gemini error:', message);
    return NextResponse.json({ error: `Failed to generate answer: ${message}` }, { status: 500 });
  }
}
