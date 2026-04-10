import { NextResponse } from 'next/server';
import {
  fetchTopStoryIds,
  fetchHNItem,
  shapePost,
} from '@/lib/hn';
import type { Digest } from '@/lib/types';

export async function GET(): Promise<NextResponse<Digest | { error: string }>> {
  try {
    const topIds = await fetchTopStoryIds();
    const stories = await Promise.all(topIds.slice(0, 10).map(fetchHNItem));

    const posts = await Promise.all(
      stories.map(async (story) => {
        const commentIds = (story.kids ?? []).slice(0, 5);
        const rawComments = await Promise.all(commentIds.map(fetchHNItem));
        return shapePost(story, rawComments);
      })
    );

    const digest: Digest = {
      date: new Date().toISOString().split('T')[0],
      fetchedAt: new Date().toISOString(),
      posts,
    };

    return NextResponse.json(digest);
  } catch (err) {
    console.error('[refresh]', err);
    return NextResponse.json({ error: 'Failed to refresh digest.' }, { status: 500 });
  }
}
