import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const HN = 'https://hacker-news.firebaseio.com/v0';

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} — status ${res.status}`);
  return res.json();
}

async function fetchComments(kids = [], limit = 5) {
  const ids = kids.slice(0, limit);
  const items = await Promise.all(ids.map((id) => get(`${HN}/item/${id}.json`)));
  return items
    .filter((c) => c && !c.deleted && !c.dead && c.text)
    .map((c) => ({
      id: c.id,
      by: c.by,
      // strip HTML tags that HN wraps comment text in
      text: c.text.replace(/<[^>]*>/g, ''),
      time: c.time,
    }));
}

async function main() {
  console.log('Fetching top story IDs…');
  const topIds = await get(`${HN}/topstories.json`);
  const top10 = topIds.slice(0, 10);

  console.log('Fetching story details…');
  const stories = await Promise.all(top10.map((id) => get(`${HN}/item/${id}.json`)));

  console.log('Fetching top comments for each story…');
  const posts = await Promise.all(
    stories.map(async (s) => ({
      id: s.id,
      title: s.title,
      url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score,
      by: s.by,
      time: s.time,
      descendants: s.descendants ?? 0,
      comments: await fetchComments(s.kids ?? [], 5),
    }))
  );

  const digest = {
    date: new Date().toISOString().split('T')[0],
    fetchedAt: new Date().toISOString(),
    posts,
  };

  const dir = join(process.cwd(), 'public', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'digest.json'), JSON.stringify(digest, null, 2));
  console.log(`Done. Wrote ${posts.length} posts to public/data/digest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
