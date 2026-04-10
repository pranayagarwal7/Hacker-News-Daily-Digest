/**
 * ETL unit tests for scripts/fetch-digest.mjs
 * Run with: npm run test:etl
 * (uses --experimental-vm-modules for ESM support)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  cleanHtml,
  isValidComment,
  shapeComment,
  shapePost,
  buildDigest,
} from '../../scripts/fetch-digest.mjs';

// ─── cleanHtml ────────────────────────────────────────────────────────────────

describe('cleanHtml', () => {
  it('strips anchor tags from comment text', () => {
    expect(cleanHtml('<a href="https://example.com">click here</a>')).toBe('click here');
  });

  it('strips paragraph tags', () => {
    expect(cleanHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('strips multiple nested tags', () => {
    expect(cleanHtml('<p>This is <i>italic</i> and <b>bold</b></p>')).toBe(
      'This is italic and bold'
    );
  });

  it('strips self-closing tags', () => {
    expect(cleanHtml('line one<br/>line two')).toBe('line oneline two');
  });

  it('returns an empty string for empty string input', () => {
    expect(cleanHtml('')).toBe('');
  });

  it('returns an empty string for null input', () => {
    expect(cleanHtml(null)).toBe('');
  });

  it('returns an empty string for undefined input', () => {
    expect(cleanHtml(undefined)).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(cleanHtml('just plain text')).toBe('just plain text');
  });
});

// ─── isValidComment ───────────────────────────────────────────────────────────

describe('isValidComment', () => {
  it('returns true for a comment with text', () => {
    expect(isValidComment({ id: 1, by: 'user', text: 'hello', time: 123 })).toBe(true);
  });

  it('returns false for a deleted comment', () => {
    expect(isValidComment({ id: 1, deleted: true, text: 'hello' })).toBe(false);
  });

  it('returns false for a dead comment', () => {
    expect(isValidComment({ id: 1, dead: true, text: 'hello' })).toBe(false);
  });

  it('returns false when text is missing', () => {
    expect(isValidComment({ id: 1, by: 'user' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidComment(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidComment(undefined)).toBe(false);
  });
});

// ─── shapeComment ─────────────────────────────────────────────────────────────

describe('shapeComment', () => {
  it('strips HTML from comment text', () => {
    const raw = { id: 42, by: 'alice', text: '<p>Hello <b>world</b></p>', time: 1700000000 };
    expect(shapeComment(raw).text).toBe('Hello world');
  });

  it('preserves id, by, and time fields', () => {
    const raw = { id: 42, by: 'alice', text: 'hi', time: 1700000000 };
    const result = shapeComment(raw);
    expect(result.id).toBe(42);
    expect(result.by).toBe('alice');
    expect(result.time).toBe(1700000000);
  });
});

// ─── shapePost ────────────────────────────────────────────────────────────────

describe('shapePost', () => {
  const rawStory = {
    id: 1,
    title: 'Test Post',
    url: 'https://example.com',
    score: 500,
    by: 'testuser',
    time: 1700000000,
    descendants: 120,
  };

  it('returns correct top-level keys', () => {
    const result = shapePost(rawStory, []);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('by');
    expect(result).toHaveProperty('time');
    expect(result).toHaveProperty('descendants');
    expect(result).toHaveProperty('comments');
  });

  it('maps raw HN fields to output fields correctly', () => {
    const result = shapePost(rawStory, []);
    expect(result.id).toBe(1);
    expect(result.title).toBe('Test Post');
    expect(result.url).toBe('https://example.com');
    expect(result.score).toBe(500);
    expect(result.by).toBe('testuser');
    expect(result.descendants).toBe(120);
  });

  it('falls back to HN item URL when story has no url', () => {
    const storyWithoutUrl = { ...rawStory, url: undefined };
    const result = shapePost(storyWithoutUrl, []);
    expect(result.url).toBe('https://news.ycombinator.com/item?id=1');
  });

  it('defaults descendants to 0 when absent', () => {
    const storyWithoutDescendants = { ...rawStory, descendants: undefined };
    const result = shapePost(storyWithoutDescendants, []);
    expect(result.descendants).toBe(0);
  });

  it('filters out deleted and dead comments', () => {
    const comments = [
      { id: 10, by: 'a', text: 'good comment', time: 1 },
      { id: 11, deleted: true, text: 'deleted', time: 2 },
      { id: 12, dead: true, text: 'dead', time: 3 },
      { id: 13, by: 'b', time: 4 }, // missing text
    ];
    const result = shapePost(rawStory, comments);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].id).toBe(10);
  });

  it('returns an empty comments array when no comments are provided', () => {
    const result = shapePost(rawStory, []);
    expect(result.comments).toEqual([]);
  });

  it('strips HTML from comments during shaping', () => {
    const comments = [{ id: 10, by: 'a', text: '<p>clean this</p>', time: 1 }];
    const result = shapePost(rawStory, comments);
    expect(result.comments[0].text).toBe('clean this');
  });
});

// ─── buildDigest ──────────────────────────────────────────────────────────────

describe('buildDigest', () => {
  it('returns an object with date and posts keys', () => {
    const result = buildDigest([]);
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('fetchedAt');
    expect(result).toHaveProperty('posts');
  });

  it('date is in YYYY-MM-DD format', () => {
    const result = buildDigest([]);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles an empty posts array', () => {
    const result = buildDigest([]);
    expect(result.posts).toEqual([]);
  });

  it('passes posts through unchanged', () => {
    const posts = [{ id: 1, title: 'Post', url: 'https://x.com', score: 1, by: 'u', time: 1, descendants: 0, comments: [] }];
    const result = buildDigest(posts);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].id).toBe(1);
  });
});
