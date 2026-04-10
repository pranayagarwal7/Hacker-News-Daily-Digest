import { NextResponse } from 'next/server';

const HN = 'https://hacker-news.firebaseio.com/v0';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HN API error: ${url}`);
  return res.json();
}

async function fetchComments(kids: number[] = [], limit = 5) {
  const ids = kids.slice(0, limit);
  const items = await Promise.all(ids.map((id) => get<any>(`${HN}/item/${id}.json`)));
  return items
    .filter((c) => c && !c.deleted && !c.dead && c.text)
    .map((c) => ({
      id: c.id as number,
      by: c.by as string,
      text: (c.text as string).replace(/<[^>]*>/g, ''),
      time: c.time as number,
    }));
}

export async function GET() {
  const topIds = await get<number[]>(`${HN}/topstories.json`);
  const stories = await Promise.all(
    topIds.slice(0, 10).map((id) => get<any>(`${HN}/item/${id}.json`))
  );

  const posts = await Promise.all(
    stories.map(async (s) => ({
      id: s.id as number,
      title: s.title as string,
      url: (s.url as string) ?? `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score as number,
      by: s.by as string,
      time: s.time as number,
      descendants: (s.descendants as number) ?? 0,
      comments: await fetchComments(s.kids, 5),
    }))
  );

  return NextResponse.json({
    date: new Date().toISOString().split('T')[0],
    fetchedAt: new Date().toISOString(),
    posts,
  });
}
