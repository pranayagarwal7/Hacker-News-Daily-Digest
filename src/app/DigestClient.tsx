'use client';

import { useEffect, useRef, useState } from 'react';
import { Digest, Post } from '@/types/digest';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function DigestClient({ initialDigest }: { initialDigest: Digest | null }) {
  const [digest, setDigest] = useState<Digest | null>(initialDigest);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh');
      if (!res.ok) throw new Error('Refresh failed');
      setDigest(await res.json());
      setMessages([]);
    } catch {
      alert('Failed to refresh. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAsk() {
    const question = input.trim();
    if (!question || !digest || asking) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setAsking(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, digest }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer ?? data.error ?? 'No response.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
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

      {/* Chat */}
      {digest && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 border-b border-gray-200">
            Ask about today&apos;s digest
          </div>

          {/* Messages */}
          <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto bg-white">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                Try: &quot;What&apos;s the most controversial post?&quot; or &quot;Summarize the AI discussions.&quot;
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-lg text-sm italic">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 p-3 border-t border-gray-200 bg-white">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
              rows={2}
              className="flex-1 resize-none text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={handleAsk}
              disabled={!input.trim() || asking}
              className="shrink-0 px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
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
  post: Post;
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
            {expanded ? '▾ Hide comments' : `▸ Show top ${post.comments.length} comments`}
          </button>
          {expanded && (
            <ul className="ml-8 space-y-2 mt-1">
              {post.comments.map((c) => (
                <li key={c.id} className="text-xs border-l-2 border-gray-100 pl-3 text-gray-600">
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
