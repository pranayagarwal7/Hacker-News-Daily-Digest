import type { HNItem, DigestComment, DigestPost } from './types';

const HN_BASE = 'https://hacker-news.firebaseio.com/v0';

// ─── Pure transform helpers ───────────────────────────────────────────────────

export function cleanHtml(html: string | null | undefined): string {
  if (html == null) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

export function isValidComment(c: HNItem | null | undefined): boolean {
  return Boolean(c && !c.deleted && !c.dead && c.text);
}

export function shapeComment(c: HNItem): DigestComment {
  return {
    id: c.id,
    by: c.by ?? 'unknown',
    text: cleanHtml(c.text),
    time: c.time ?? 0,
  };
}

export function shapePost(story: HNItem, comments: HNItem[]): DigestPost {
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

// ─── Shared network fetch (used by the refresh API route) ────────────────────

export async function fetchHNItem(id: number): Promise<HNItem> {
  const res = await fetch(`${HN_BASE}/item/${id}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HN item ${id} fetch failed: ${res.status}`);
  return res.json() as Promise<HNItem>;
}

export async function fetchTopStoryIds(): Promise<number[]> {
  const res = await fetch(`${HN_BASE}/topstories.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`topstories fetch failed: ${res.status}`);
  return res.json() as Promise<number[]>;
}
