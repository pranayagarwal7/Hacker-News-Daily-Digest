import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DigestClient from '@/app/DigestClient';
import type { Digest } from '@/lib/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePost(i: number) {
  return {
    id: i,
    title: `Post Title ${i}`,
    url: `https://example.com/post-${i}`,
    score: 100 + i,
    by: `author${i}`,
    time: 1700000000 + i,
    descendants: 50 + i,
    comments: [
      {
        id: 1000 + i,
        by: `commenter${i}`,
        text: `Top comment on post ${i}`,
        time: 1700000001 + i,
      },
    ],
  };
}

const mockDigest: Digest = {
  date: '2025-04-09',
  fetchedAt: '2025-04-09T08:00:00.000Z',
  posts: Array.from({ length: 10 }, (_, i) => makePost(i + 1)),
};

/**
 * Build a fake Response whose body is a manually-controlled reader.
 * Avoids depending on jsdom's ReadableStream compatibility.
 */
function makeStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  let consumed = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          read() {
            if (!consumed) {
              consumed = true;
              return Promise.resolve({ done: false as const, value: encoded });
            }
            return Promise.resolve({ done: true as const, value: undefined });
          },
          releaseLock() {},
        };
      },
    },
  } as unknown as Response;
}

// ─── Mock fetch globally ──────────────────────────────────────────────────────

beforeEach(() => {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const urlStr = url.toString();
    if (urlStr.includes('/api/refresh')) {
      return {
        ok: true,
        json: async () => ({ ...mockDigest, fetchedAt: new Date().toISOString() }),
      } as unknown as Response;
    }
    if (urlStr.includes('/api/ask')) {
      return makeStreamResponse('Gemini says: the top post is about AI.');
    }
    throw new Error(`Unexpected fetch: ${urlStr}`);
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
  // @ts-ignore
  delete global.fetch;
});

// ─── DigestFeed ───────────────────────────────────────────────────────────────

describe('DigestFeed (via DigestClient)', () => {
  it('renders 10 post cards when given valid digest data', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Post Title ${i}`)).toBeInTheDocument();
    }
  });

  it('shows an empty-state message when no digest is provided', () => {
    render(<DigestClient initialDigest={null} />);
    expect(screen.getByText(/no digest yet/i)).toBeInTheDocument();
  });

  it('shows no post cards when digest has empty posts array', () => {
    const empty: Digest = { ...mockDigest, posts: [] };
    render(<DigestClient initialDigest={empty} />);
    expect(screen.queryByText(/Post Title/)).not.toBeInTheDocument();
  });

  it('renders posts in numbered order', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1.');
    expect(items[1]).toHaveTextContent('2.');
  });
});

// ─── PostCard ─────────────────────────────────────────────────────────────────

describe('PostCard (via DigestClient)', () => {
  it('renders the post title as a link to the source URL', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const link = screen.getByRole('link', { name: 'Post Title 1' });
    expect(link).toHaveAttribute('href', 'https://example.com/post-1');
  });

  it('renders the post score', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    // ▲ + space + score — match first post exactly
    expect(screen.getAllByText(/▲ 101/)[0]).toBeInTheDocument();
  });

  it('renders the post author', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    // Use getAllBy because author10 would also partially match author1
    expect(screen.getAllByText('by author1').length).toBeGreaterThan(0);
  });

  it('renders the total comment count', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getAllByText(/51 comments/)[0]).toBeInTheDocument();
  });

  it('renders a "discuss" link to the HN thread', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const discussLinks = screen.getAllByRole('link', { name: 'discuss' });
    expect(discussLinks[0]).toHaveAttribute(
      'href',
      'https://news.ycombinator.com/item?id=1'
    );
  });

  it('renders the source domain next to the title', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getAllByText('(example.com)').length).toBeGreaterThan(0);
  });

  it('expands comments when the toggle is clicked', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.click(screen.getAllByText(/show top/i)[0]);
    expect(screen.getByText('Top comment on post 1')).toBeInTheDocument();
  });

  it('collapses comments when toggle is clicked twice', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.click(screen.getAllByText(/show top/i)[0]);
    await userEvent.click(screen.getByText(/hide comments/i));
    expect(screen.queryByText('Top comment on post 1')).not.toBeInTheDocument();
  });

  it('renders without crashing when a post has no comments', () => {
    const noComments: Digest = {
      ...mockDigest,
      posts: [{ ...makePost(1), comments: [] }],
    };
    expect(() => render(<DigestClient initialDigest={noComments} />)).not.toThrow();
    expect(screen.queryByText(/show top/i)).not.toBeInTheDocument();
  });
});

// ─── ChatBox (via DigestClient) ──────────────────────────────────────────────

describe('ChatBox (via DigestClient)', () => {
  it('renders the chat input textarea', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
  });

  it('renders the Send button', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('Send button is disabled when input is empty', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('Send button becomes enabled when user types a question', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.type(screen.getByPlaceholderText(/ask a question/i), 'What is trending?');
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('displays the user message in the chat after submit', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.type(screen.getByPlaceholderText(/ask a question/i), 'What is the top post?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(screen.getByText('What is the top post?')).toBeInTheDocument();
  });

  it('clears the input immediately after submission', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i) as HTMLTextAreaElement;
    await userEvent.type(input, 'Some question');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(input.value).toBe('');
  });

  it('displays an assistant reply after the API responds', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.type(screen.getByPlaceholderText(/ask a question/i), 'What is the top post?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(
        screen.getByText('Gemini says: the top post is about AI.')
      ).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('submits the question when Enter is pressed', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'Enter question');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByText('Enter question')).toBeInTheDocument();
    });
  });

  it('does not show the chat panel when digest is null', () => {
    render(<DigestClient initialDigest={null} />);
    expect(screen.queryByPlaceholderText(/ask a question/i)).not.toBeInTheDocument();
  });
});

// ─── Staleness banner ─────────────────────────────────────────────────────────

describe('Staleness banner', () => {
  it('does not show the banner when fetchedAt is recent', () => {
    const fresh: Digest = { ...mockDigest, fetchedAt: new Date().toISOString() };
    render(<DigestClient initialDigest={fresh} />);
    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument();
  });

  it('shows the staleness banner when fetchedAt is >25 hours ago', () => {
    const staleDate = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const stale: Digest = { ...mockDigest, fetchedAt: staleDate };
    render(<DigestClient initialDigest={stale} />);
    expect(screen.getByText(/out of date/i)).toBeInTheDocument();
  });

  it('dismisses the banner when the X button is clicked', async () => {
    const staleDate = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const stale: Digest = { ...mockDigest, fetchedAt: staleDate };
    render(<DigestClient initialDigest={stale} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument();
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe('Refresh button', () => {
  it('renders the Refresh button', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByRole('button', { name: /^refresh$/i })).toBeInTheDocument();
  });

  it('calls /api/refresh when clicked', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.click(screen.getByRole('button', { name: /^refresh$/i }));
    expect(global.fetch).toHaveBeenCalledWith('/api/refresh');
  });
});
