'use client';

import { useState } from 'react';
import type { Digest, DigestPost } from '@/lib/types';
import ChatBox from '@/components/ChatBox';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const STALE_THRESHOLD_MS = 25 * 60 * 60 * 1000; // 25 hours

export default function DigestClient({
  initialDigest,
}: {
  initialDigest: Digest | null;
}) {
  const [digest, setDigest] = useState<Digest | null>(initialDigest);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isStale =
    !!digest?.fetchedAt &&
    Date.now() - new Date(digest.fetchedAt).getTime() > STALE_THRESHOLD_MS;

  const fetchedAt = digest?.fetchedAt
    ? new Date(digest.fetchedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh');
      if (!res.ok) throw new Error('Refresh failed');
      setDigest(await res.json());
      setBannerDismissed(false);
    } catch {
      alert('Failed to refresh. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Staleness banner */}
      {isStale && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <span>Digest may be out of date — click Refresh to update.</span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 text-yellow-500 hover:text-yellow-700 leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-orange-500">HN</span> Daily Digest
          </h1>
          {fetchedAt && (
            <p className="text-sm text-gray-500 mt-1">Fetched {fetchedAt}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Posts */}
      {!digest ? (
        <div className="text-gray-500 text-sm">
          No digest yet. Hit <strong>Refresh</strong> to fetch today&apos;s stories.
        </div>
      ) : (
        <ol className="space-y-4">
          {digest.posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              expanded={expandedPost === post.id}
              onToggle={() =>
                setExpandedPost(expandedPost === post.id ? null : post.id)
              }
            />
          ))}
        </ol>
      )}

      {/* Chat — wrapped in an error boundary so a crash here doesn't kill the feed */}
      {digest && (
        <ErrorBoundary>
          <ChatBox digest={digest} />
        </ErrorBoundary>
      )}
    </div>
  );
}

function PostCard({
  post,
  index,
  expanded,
  onToggle,
}: {
  post: DigestPost;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const domain = (() => {
    try {
      return new URL(post.url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  })();

  return (
    <li className="border border-gray-200 rounded-lg bg-white p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-gray-400 font-mono text-sm mt-0.5 w-5 shrink-0">
          {index + 1}.
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-orange-600 transition-colors leading-snug"
          >
            {post.title}
          </a>
          {domain && (
            <span className="ml-2 text-xs text-gray-400">({domain})</span>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>▲ {post.score}</span>
            <span>by {post.by}</span>
            <span>{post.descendants} comments</span>
            <a
              href={`https://news.ycombinator.com/item?id=${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              discuss
            </a>
          </div>
        </div>
      </div>

      {post.comments.length > 0 && (
        <>
          <button
            onClick={onToggle}
            className="ml-8 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {expanded
              ? '▾ Hide comments'
              : `▸ Show top ${post.comments.length} comments`}
          </button>
          {expanded && (
            <ul className="ml-8 space-y-2 mt-1">
              {post.comments.map((c) => (
                <li
                  key={c.id}
                  className="text-xs border-l-2 border-gray-100 pl-3 text-gray-600"
                >
                  <span className="font-medium text-gray-700">{c.by}: </span>
                  {c.text.length > 400 ? c.text.slice(0, 400) + '…' : c.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
