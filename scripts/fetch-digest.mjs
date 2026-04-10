import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const HN = 'https://hacker-news.firebaseio.com/v0';

// ─── Pure, exported functions (used by tests) ────────────────────────────────

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
    by: c.by,
    text: cleanHtml(c.text),
    time: c.time,
  };
}

export function shapePost(story, comments) {
  return {
    id: story.id,
    title: story.title,
    url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
    score: story.score,
    by: story.by,
    time: story.time,
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

// ─── Network helpers ──────────────────────────────────────────────────────────

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} — status ${res.status}`);
  return res.json();
}

async function fetchComments(kids = [], limit = 5) {
  const ids = kids.slice(0, limit);
  const items = await Promise.all(ids.map((id) => get(`${HN}/item/${id}.json`)));
  return items;
}

// ─── Entry point (only runs when invoked directly) ────────────────────────────

async function main() {
  console.log('Fetching top story IDs…');
  const topIds = await get(`${HN}/topstories.json`);
  const top10 = topIds.slice(0, 10);

  console.log('Fetching story details…');
  const stories = await Promise.all(top10.map((id) => get(`${HN}/item/${id}.json`)));

  console.log('Fetching top comments for each story…');
  const posts = await Promise.all(
    stories.map(async (s) => {
      const rawComments = await fetchComments(s.kids ?? [], 5);
      return shapePost(s, rawComments);
    })
  );

  const digest = buildDigest(posts);

  const dir = join(process.cwd(), 'public', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'digest.json'), JSON.stringify(digest, null, 2));
  console.log(`Done. Wrote ${posts.length} posts to public/data/digest.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
