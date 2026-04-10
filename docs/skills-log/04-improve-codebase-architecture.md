# Skill: /improve-codebase-architecture
**Date used:** 2026-04-09
**Invocation:** User provided actual file structure, known pain points, and requested prioritized list before implementation

## What it did
- Reviewed all source files (ask/route.ts, refresh/route.ts, DigestClient.tsx, fetch-digest.mjs)
- Produced 10 prioritized improvements (P1/P2/P3) with effort estimates
- User approved all 10 → implemented in single commit

## Improvements implemented

### P1 (do now)
1. Shared HN utility module → `src/lib/hn.ts` (eliminates ETL/refresh duplication)
2. TypeScript interfaces → `src/lib/types.ts` (HNItem, DigestPost, DigestComment, Digest)
3. ETL retry logic → `withRetry(fn, 3, 500ms)` + Promise.allSettled in fetch-digest.mjs
4. Server-side input validation → try/catch req.json(), validate question + digest shape

### P2 (do soon)
5. Error boundaries → `src/app/error.tsx` + `src/components/ErrorBoundary.tsx`
6. Smart Gemini context → comments only if question contains "comment"/"discussion", 200 char limit
7. Rate limiting → @upstash/ratelimit + @upstash/redis, 20 req/hr by IP, optional

### P3 (nice to have)
8. Staleness warning banner → shows if fetchedAt > 25h, dismissible
9. ISR → `export const revalidate = 300` in page.tsx, fetch() instead of fs.readFileSync
10. Streaming Gemini → generateContentStream + ReadableStream + getReader() in ChatBox

## New packages added
- @upstash/ratelimit@^1.2.1
- @upstash/redis@^1.34.0

## New environment variables
- UPSTASH_REDIS_REST_URL (optional, rate limiting)
- UPSTASH_REDIS_REST_TOKEN (optional, rate limiting)
- VERCEL_URL (auto-set by Vercel, used for ISR fetch base URL)

## Lessons learned
- Streaming requires updating both the API route AND the test mock
- Rate limiting should be opt-in (skip gracefully when env vars absent) for local dev
- Smart context reduces token usage significantly without sacrificing answer quality
- ISR requires fetch() not fs.readFileSync — static file reads don't benefit from revalidate
- Extract ChatBox before implementing streaming — mixing streaming state into a 200-line component is unmanageable
