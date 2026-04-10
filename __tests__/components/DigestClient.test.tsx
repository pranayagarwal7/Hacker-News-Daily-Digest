import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DigestClient from '@/app/DigestClient';
import { Digest } from '@/types/digest';

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

// ─── Mock fetch ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
    const urlStr = url.toString();
    if (urlStr.includes('/api/refresh')) {
      return {
        ok: true,
        json: async () => ({ ...mockDigest, fetchedAt: new Date().toISOString() }),
      } as Response;
    }
    if (urlStr.includes('/api/ask')) {
      return {
        ok: true,
        json: async () => ({ answer: 'Gemini says: the top post is about AI.' }),
      } as Response;
    }
    throw new Error(`Unexpected fetch: ${urlStr}`);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── DigestFeed (via DigestClient) ───────────────────────────────────────────

describe('DigestFeed (via DigestClient)', () => {
  it('renders 10 post cards when given valid digest data', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    // Each post title appears exactly once
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Post Title ${i}`)).toBeInTheDocument();
    }
  });

  it('shows an empty-state message when no digest is provided', () => {
    render(<DigestClient initialDigest={null} />);
    expect(screen.getByText(/no digest yet/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when digest has no posts', () => {
    const emptyDigest: Digest = { date: '2025-04-09', fetchedAt: '2025-04-09T08:00:00.000Z', posts: [] };
    render(<DigestClient initialDigest={emptyDigest} />);
    // No post items rendered
    expect(screen.queryByText(/Post Title/)).not.toBeInTheDocument();
  });

  it('renders posts in numbered order', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1.');
    expect(items[1]).toHaveTextContent('2.');
  });
});

// ─── PostCard (via DigestClient) ─────────────────────────────────────────────

describe('PostCard (via DigestClient)', () => {
  it('renders the post title as a link to the source URL', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const link = screen.getByRole('link', { name: 'Post Title 1' });
    expect(link).toHaveAttribute('href', 'https://example.com/post-1');
  });

  it('renders the post score', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByText(/▲ 101/)).toBeInTheDocument();
  });

  it('renders the post author', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByText(/by author1/)).toBeInTheDocument();
  });

  it('renders the total comment count', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByText(/51 comments/)).toBeInTheDocument();
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

  it('shows a toggle button when the post has comments', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getAllByText(/show top/i).length).toBeGreaterThan(0);
  });

  it('expands comments when the toggle is clicked', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const toggle = screen.getAllByText(/show top/i)[0];
    await userEvent.click(toggle);
    expect(screen.getByText('Top comment on post 1')).toBeInTheDocument();
  });

  it('collapses comments when toggle is clicked a second time', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const toggle = screen.getAllByText(/show top/i)[0];
    await userEvent.click(toggle);
    const hideToggle = screen.getByText(/hide comments/i);
    await userEvent.click(hideToggle);
    expect(screen.queryByText('Top comment on post 1')).not.toBeInTheDocument();
  });

  it('renders without crashing when a post has no comments', () => {
    const digestNoComments: Digest = {
      ...mockDigest,
      posts: [{ ...makePost(1), comments: [] }],
    };
    expect(() => render(<DigestClient initialDigest={digestNoComments} />)).not.toThrow();
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
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'What is trending?');
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('displays the user message in the chat after submit', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'What is the top post?');
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
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'What is the top post?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText('Gemini says: the top post is about AI.')).toBeInTheDocument();
    });
  });

  it('shows "Thinking…" while waiting for the API response', async () => {
    let resolve: (value: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    (global.fetch as jest.Mock).mockImplementationOnce(async (url: string) => {
      if (url.includes('/api/ask')) {
        await pending;
        return { ok: true, json: async () => ({ answer: 'Done.' }) };
      }
    });

    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'Question?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/thinking/i)).toBeInTheDocument();
    resolve!(null);
  });

  it('submits the question when Enter is pressed', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'Enter question{Enter}');
    await waitFor(() => {
      expect(screen.getByText('Enter question')).toBeInTheDocument();
    });
  });

  it('does not submit when Shift+Enter is pressed (inserts newline)', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, 'line one{shift}{enter}');
    // No user message bubble should appear
    expect(screen.queryByRole('button', { name: /send/i })).not.toHaveBeenCalled?.();
    expect(screen.queryByText(/line one/)).not.toBeInTheDocument();
  });

  it('does not show the chat panel when digest is null', () => {
    render(<DigestClient initialDigest={null} />);
    expect(screen.queryByPlaceholderText(/ask a question/i)).not.toBeInTheDocument();
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe('Refresh button', () => {
  it('renders the Refresh button', () => {
    render(<DigestClient initialDigest={mockDigest} />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('calls /api/refresh when clicked', async () => {
    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(global.fetch).toHaveBeenCalledWith('/api/refresh');
  });

  it('shows "Refreshing…" text while loading', async () => {
    let resolve: (value: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    (global.fetch as jest.Mock).mockImplementationOnce(async (url: string) => {
      if (url.includes('/api/refresh')) {
        await pending;
        return { ok: true, json: async () => mockDigest };
      }
    });

    render(<DigestClient initialDigest={mockDigest} />);
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(await screen.findByText(/refreshing/i)).toBeInTheDocument();
    resolve!(null);
  });
});
