import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const HN = 'https://hacker-news.firebaseio.com/v0';

// ─── Pure, exported functions (used by tests) ────────────────────────────────
// NOTE: Logic here intentionally mirrors src/lib/hn.ts.
// The ETL script is pure JS (ESM) and cannot directly import TypeScript modules
// without a compile step. Both implementations are covered by their respective
// test suites (__tests__/scripts/ and __tests__/api/).

export function cleanHtml(html) {
  if (html == null) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

export function isValidComment(c) {
  return Boolean(c && !c.deleted && !c.dead && c.text);
}

export function shapeComment(c) {
  return {
    id: c.id,
    by: c.by ?? 'unknown',
    text: cleanHtml(c.text),
    time: c.time ?? 0,
  };
}

export function shapePost(story, comments) {
  return {
    id: story.id,
    title: story.title ?? '(no title)',
    url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
    score: story.score ?? 0,
    by: story.by ?? 'unknown',
    time: story.time ?? 0,
    descendants: story.descendants ?? 0,
    comments: comments.filter(isValidComment).map(shapeComment),
  };
}

export function buildDigest(posts) {
  return {
    date: new Date().toISOString().split('T')[0],
    fetchedAt: new Date().toISOString(),
    posts,
  };
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

export async function withRetry(fn, retries = 3, delayMs = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`  ↳ attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms…`);
        await new Promise((r) => setTimeout(r, delayMs * attempt)); // exponential-ish back-off
      }
    }
  }
  throw lastErr;
}

// ─── Network helpers ──────────────────────────────────────────────────────────

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchItemWithRetry(id) {
  return withRetry(() => get(`${HN}/item/${id}.json`));
}

async function fetchComments(kids = [], limit = 5) {
  const ids = kids.slice(0, limit);
  const results = await Promise.allSettled(ids.map(fetchItemWithRetry));
  return results
    .filter((r) => r.status === 'fulfilled' && r.value != null)
    .map((r) => r.value);
}

// ─── Entry point (only runs when invoked directly) ────────────────────────────

async function main() {
  console.log('Fetching top story IDs…');
  const topIds = await withRetry(() => get(`${HN}/topstories.json`));
  const top10 = topIds.slice(0, 10);

  console.log('Fetching story details…');
  const storyResults = await Promise.allSettled(top10.map(fetchItemWithRetry));

  const posts = [];
  for (const [i, result] of storyResults.entries()) {
    if (result.status === 'rejected') {
      console.warn(`  ✗ Skipping story at index ${i}: ${result.reason?.message}`);
      continue;
    }
    const s = result.value;
    const rawComments = await fetchComments(s.kids ?? [], 5);
    posts.push(shapePost(s, rawComments));
  }

  if (posts.length === 0) {
    throw new Error('No posts fetched — aborting to avoid committing an empty digest.');
  }

  console.log(`Fetched ${posts.length} posts.`);
  const digest = buildDigest(posts);

  const dir = join(process.cwd(), 'public', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'digest.json'), JSON.stringify(digest, null, 2));
  console.log('Done. Wrote public/data/digest.json');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
