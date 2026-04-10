import { test, expect, Page } from '@playwright/test';

// ─── Fixtures & helpers ───────────────────────────────────────────────────────

const mockPosts = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: `E2E Test Post ${i + 1}`,
  url: `https://example.com/post-${i + 1}`,
  score: 100 + i,
  by: `e2euser${i}`,
  time: 1700000000 + i,
  descendants: 50 + i,
  comments: [
    {
      id: 100 + i,
      by: `commenter${i}`,
      text: `Top comment on e2e post ${i + 1}`,
      time: 1700000001 + i,
    },
  ],
}));

const mockDigest = {
  date: '2025-04-09',
  fetchedAt: '2025-04-09T08:00:00.000Z',
  posts: mockPosts,
};

/** Intercept HN API and Gemini so e2e tests run fully offline */
async function mockAPIs(page: Page) {
  // Mock /api/refresh (live HN fetch)
  await page.route('**/api/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...mockDigest, fetchedAt: new Date().toISOString() }),
    });
  });

  // Mock /api/ask (Gemini Q&A)
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: 'E2E mock answer: the top post is about testing.' }),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Digest page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
  });

  test('page loads and displays "HN Daily Digest" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /hn daily digest/i })).toBeVisible();
  });

  test('at least 10 post cards are visible on load', async ({ page }) => {
    // Each post title rendered as a link
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByRole('link', { name: `E2E Test Post ${i}` })).toBeVisible();
    }
  });

  test('post cards show title, score, author, and comment count', async ({ page }) => {
    await expect(page.getByText('E2E Test Post 1')).toBeVisible();
    await expect(page.getByText(/▲ 100/)).toBeVisible();
    await expect(page.getByText(/by e2euser0/)).toBeVisible();
    await expect(page.getByText(/50 comments/)).toBeVisible();
  });

  test('expanding a post shows its top comments', async ({ page }) => {
    await page.getByText(/show top/i).first().click();
    await expect(page.getByText('Top comment on e2e post 1')).toBeVisible();
  });
});

test.describe('Chat Q&A', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
  });

  test('typing a question and clicking Send shows the user message in chat', async ({ page }) => {
    const input = page.getByPlaceholder(/ask a question/i);
    await input.fill('What is the most popular post today?');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText('What is the most popular post today?')).toBeVisible();
  });

  test('after Send, an assistant reply appears within 15 seconds', async ({ page }) => {
    const input = page.getByPlaceholder(/ask a question/i);
    await input.fill('Summarize the top stories.');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(
      page.getByText('E2E mock answer: the top post is about testing.')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('pressing Enter in the input submits the question', async ({ page }) => {
    const input = page.getByPlaceholder(/ask a question/i);
    await input.fill('Enter key question');
    await input.press('Enter');
    await expect(page.getByText('Enter key question')).toBeVisible();
  });

  test('Shift+Enter does not submit (adds a newline)', async ({ page }) => {
    const input = page.getByPlaceholder(/ask a question/i);
    await input.fill('First line');
    await input.press('Shift+Enter');
    // Input should still contain text (not cleared/submitted)
    await expect(input).not.toBeEmpty();
    // No chat bubble for the partial text
    const chatBubbles = page.locator('.bg-orange-500');
    await expect(chatBubbles).toHaveCount(0);
  });

  test('chat history persists across multiple questions', async ({ page }) => {
    const input = page.getByPlaceholder(/ask a question/i);

    await input.fill('First question');
    await page.getByRole('button', { name: /send/i }).click();
    await page.waitForResponse('**/api/ask');

    await input.fill('Second question');
    await page.getByRole('button', { name: /send/i }).click();
    await page.waitForResponse('**/api/ask');

    await expect(page.getByText('First question')).toBeVisible();
    await expect(page.getByText('Second question')).toBeVisible();
  });
});

test.describe('Refresh button', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
  });

  test('Refresh button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('clicking Refresh triggers a re-fetch and posts reload', async ({ page }) => {
    const refreshPromise = page.waitForResponse('**/api/refresh');
    await page.getByRole('button', { name: /refresh/i }).click();
    await refreshPromise;
    // Posts should still be visible after refresh
    await expect(page.getByText('E2E Test Post 1')).toBeVisible();
  });

  test('Refresh button shows "Refreshing…" while loading', async ({ page }) => {
    // Intercept with a delay to observe the loading state
    await page.route('**/api/refresh', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDigest),
      });
    });

    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText(/refreshing/i)).toBeVisible();
  });
});
