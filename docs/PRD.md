# PRD: Hacker News Daily Digest

## Problem Statement

Keeping up with Hacker News is valuable for engineers and tech-curious readers, but the firehose of posts and comment threads makes it time-consuming to extract signal. There's no lightweight, zero-login way to get a daily summary of what's trending, read key discussion excerpts, and ask natural-language questions like "What are people saying about AI today?" without switching between multiple tabs or building a complex backend.

## Solution

A statically-deployed web app that automatically fetches the top 10 Hacker News stories every morning, commits a structured JSON digest to the repository, and serves it through a clean Next.js UI. Users can read post titles, scores, and top comments at a glance, ask Gemini 1.5 Flash questions about the day's content via a chat-style interface, and manually re-fetch the latest HN data from the browser at any time — all with no accounts, no database, and no infrastructure beyond Vercel and GitHub Actions.

---

## User Stories

1. As a reader, I want to see today's top 10 Hacker News posts on page load, so that I get an instant overview without opening HN.
2. As a reader, I want to see each post's score, author, and comment count, so that I can gauge community interest at a glance.
3. As a reader, I want to click a post title and go directly to the source article, so that I can read the full content when interested.
4. As a reader, I want a direct "discuss" link to the HN thread for each post, so that I can jump into the comment section.
5. As a reader, I want to expand and collapse the top 5 comments for each post, so that I can sample discussion without leaving the page.
6. As a reader, I want comments to be truncated at a readable length, so that the page doesn't overflow with wall-of-text comment dumps.
7. As a reader, I want to see the domain name of each linked article next to the title, so that I know the source before clicking.
8. As a reader, I want to see when the digest was last fetched, so that I know how fresh the data is.
9. As a reader, I want the page to load with content immediately (no loading spinner), so that the experience feels instant.
10. As a reader, I want the page to work on mobile and desktop, so that I can read it anywhere.
11. As a reader, I want a minimalist, distraction-free design, so that the focus stays on the content.
12. As a reader, I want to ask a free-form question like "What's the most controversial post today?", so that I can get AI-generated insights without crafting complex queries.
13. As a reader, I want to ask "Summarize the AI discussions", so that I can quickly understand the theme of relevant threads.
14. As a reader, I want to ask follow-up questions in the same session, so that I can dig deeper into topics without starting over.
15. As a reader, I want my chat history to persist for the current session, so that I can scroll back through previous answers.
16. As a reader, I want my questions and answers displayed in a chat-style bubble layout, so that the conversation is easy to follow.
17. As a reader, I want a visual loading indicator while Gemini is generating an answer, so that I know the request is in progress.
18. As a reader, I want to submit a question by pressing Enter, so that I don't have to reach for the mouse.
19. As a reader, I want to write multi-line questions using Shift+Enter, so that I can compose longer prompts comfortably.
20. As a reader, I want a Refresh button that re-fetches the latest HN stories in the browser, so that I can get live data without waiting for the next scheduled run.
21. As a reader, I want the Refresh button to show a loading state, so that I know the fetch is happening.
22. As a reader, I want the chat history to reset on refresh, so that old Gemini answers about stale data don't persist.
23. As a reader, I want to see an empty-state message when no digest is available, so that the page gracefully handles a first-run scenario.
24. As a reader, I want Gemini answers in plain readable prose, so that markdown symbols don't clutter the response.
25. As a site operator, I want the digest JSON committed to the repo automatically every morning at 8am UTC, so that the Vercel deploy always has current data.
26. As a site operator, I want to trigger the digest fetch manually from the GitHub Actions tab, so that I can update the data outside the scheduled window.
27. As a site operator, I want the ETL script to skip deleted or dead HN items, so that the digest doesn't include junk content.
28. As a site operator, I want HTML stripped from comment text, so that the JSON is clean plain text.
29. As a site operator, I want the ETL to exit with a non-zero status on failure, so that GitHub Actions marks the run as failed and I'm notified.
30. As a site operator, I want the digest committed only when content actually changes, so that the commit history isn't polluted with no-op commits.
31. As a site operator, I want the Gemini API key stored as a Vercel environment variable, so that it's never exposed in the repo.
32. As a site operator, I want the GitHub PAT stored as a GitHub Actions secret, so that it's never hardcoded.
33. As a site operator, I want a placeholder `digest.json` committed to the repo, so that the first Vercel build doesn't crash before Actions has run.

---

## Implementation Decisions

### Architecture & Data Flow

```
[HN Firebase API]
      │
      ▼ (8am UTC daily, or manual trigger)
[GitHub Actions]
  └─ scripts/fetch-digest.mjs
        │ strips HTML, shapes JSON
        ▼
  public/data/digest.json  ──commit/push──▶  [GitHub repo]
                                                    │
                                              auto-deploy
                                                    ▼
                                             [Vercel build]
                                           page.tsx reads JSON
                                           via fs at build time
                                                    │
                                                    ▼
                                          [Static Next.js page]
                                          DigestClient (React)
                                           │             │
                               [Refresh btn]         [Chat input]
                                    │                     │
                             GET /api/refresh      POST /api/ask
                                    │                     │
                             live HN fetch        Gemini 1.5 Flash
                             (no commit)          (server-side, no cache)
```

### Modules

| Module | Type | Responsibility |
|---|---|---|
| `scripts/fetch-digest.mjs` | Node CLI | Fetch HN top 10, resolve comments, strip HTML, write JSON |
| `GET /api/refresh` | API route | Live HN fetch at request time, returns `Digest` to browser |
| `POST /api/ask` | API route | Build Gemini prompt from digest + question, return answer |
| `page.tsx` | Server component | Read `digest.json` via `fs` at build time, pass to client |
| `DigestClient` | Client component | Post list, expandable comments, chat panel, refresh state |
| `src/types/digest.ts` | Types | `Digest`, `Post`, `Comment` shared across all modules |

### API Contracts

**`GET /api/refresh`**

```
Response 200:
{
  "date": "YYYY-MM-DD",
  "fetchedAt": "ISO8601",
  "posts": [
    {
      "id": number,
      "title": string,
      "url": string,
      "score": number,
      "by": string,
      "time": number,
      "descendants": number,
      "comments": [
        { "id": number, "by": string, "text": string, "time": number }
      ]
    }
  ]
}

Response 500: { "error": string }
```

**`POST /api/ask`**

```
Request:  { "question": string, "digest": Digest }

Response 200: { "answer": string }
Response 400: { "error": "Missing question or digest." }
Response 500: { "error": "GEMINI_API_KEY not configured." }
```

### Digest JSON Schema (`public/data/digest.json`)

```
{
  date:       string       // YYYY-MM-DD (UTC)
  fetchedAt:  string       // ISO8601
  posts:      Post[10]
}

Post {
  id:          number
  title:       string
  url:         string      // falls back to HN item URL for Ask HN / Show HN
  score:       number
  by:          string
  time:        number      // unix timestamp
  descendants: number      // total comment count on HN
  comments:    Comment[0..5]
}

Comment {
  id:   number
  by:   string
  text: string             // HTML-stripped plain text
  time: number
}
```

### GitHub Actions Pipeline

| Step | Detail |
|---|---|
| Trigger | `schedule: cron: '0 8 * * *'` + `workflow_dispatch` |
| Checkout | `actions/checkout@v4` with `token: ${{ secrets.GH_PAT }}` |
| Node setup | `actions/setup-node@v4`, Node 20 |
| Fetch | `node scripts/fetch-digest.mjs` |
| Commit guard | `git diff --staged --quiet \|\| git commit -m "chore: daily digest YYYY-MM-DD"` |
| Push | `git push` (PAT enables Vercel deploy trigger) |

### Folder Structure

```
/
├── .github/
│   └── workflows/
│       └── daily-digest.yml
├── docs/
│   ├── PRD.md                  ← this file
│   └── design-decisions.md     ← grill-me Q&A record
├── public/
│   └── data/
│       └── digest.json         ← committed by Actions
├── scripts/
│   └── fetch-digest.mjs        ← ETL script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask/route.ts
│   │   │   └── refresh/route.ts
│   │   ├── DigestClient.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── types/
│       └── digest.ts
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

## Testing Decisions

**What makes a good test:** Tests should verify externally observable behavior — what the module returns given controlled inputs — not internal implementation details like how many `fetch` calls were made or which helper function was invoked.

**Modules to test:**

- **`/api/refresh`** — Mock the HN Firebase endpoints; assert the response matches the `Digest` shape, that deleted/dead/text-less items are filtered from comments, and that HTML is stripped from comment text.
- **`/api/ask`** — Mock `@google/generative-ai`; assert that a well-formed request returns `{ answer }`, that a missing question returns 400, and that a missing `GEMINI_API_KEY` returns 500 without leaking the key in the response body.
- **`scripts/fetch-digest.mjs`** — Integration-level test with mocked `fetch`; assert that `public/data/digest.json` is written with the correct shape and that the process exits non-zero when the HN API is unreachable.

**Suggested tooling:** `vitest` for unit/route tests; `msw` (Mock Service Worker) to intercept HN and Gemini HTTP calls; `@testing-library/react` for component behavior tests.

---

## Out of Scope

- Historical digests (no dated archives, no calendar view)
- User accounts, authentication, or personalization
- Real-time updates or WebSocket streaming
- Comments search or full-text indexing
- Gemini response caching or rate-limit handling
- Pre-generating summaries in GitHub Actions (all AI is on-demand in Next.js)
- Triggering a Vercel deployment or GitHub workflow from the browser Refresh button
- Markdown rendering in Gemini chat responses
- Push notifications or email delivery
- Multiple digest sources beyond HN `/topstories`
- Mobile app

---

## Child Issues

- [ ] Scaffold Next.js 14 App Router project with Tailwind CSS
- [ ] Define `Digest`, `Post`, and `Comment` TypeScript types
- [ ] Implement `scripts/fetch-digest.mjs` ETL (HN fetch + HTML strip + JSON write)
- [ ] Add GitHub Actions workflow (`daily-digest.yml`) with cron + manual trigger
- [ ] Commit placeholder `public/data/digest.json` for first-build safety
- [ ] Implement `GET /api/refresh` route (live HN fetch, returns `Digest`)
- [ ] Implement `POST /api/ask` route (Gemini 1.5 Flash Q&A with full digest context)
- [ ] Build `page.tsx` server component (reads digest via `fs` at build time)
- [ ] Build `DigestClient` component (post list, expandable comments, chat panel)
- [ ] Style with Tailwind: header, numbered posts, metadata row, comment expander, chat bubbles
- [ ] Wire Refresh button to `/api/refresh` with loading state + chat reset
- [ ] Wire chat input to `/api/ask` with Enter-to-submit, Shift+Enter newline, auto-scroll
- [ ] Add empty-state UI for missing or empty digest
- [ ] Add `.env.local.example` and document `GEMINI_API_KEY` + `GH_PAT` setup
- [ ] Connect repo to Vercel, configure `GEMINI_API_KEY` environment variable
- [ ] Add `GH_PAT` secret to GitHub Actions secrets
- [ ] Write tests for `/api/refresh` (shape, filtering, HTML stripping)
- [ ] Write tests for `/api/ask` (happy path, 400, 500 on missing key)
- [ ] End-to-end smoke test: run ETL locally, verify `digest.json` shape, run `npm run build`

---

## Further Notes

- The placeholder `public/data/digest.json` (with `posts: []`) must be committed so the first Vercel build succeeds before any Actions run has occurred. The UI shows a friendly empty-state message when `posts` is empty.
- Vercel's GitHub integration auto-deploys on every push. Each daily Actions commit is the mechanism that delivers fresh content — no explicit deploy step is needed.
- `GITHUB_TOKEN` cannot push commits that trigger downstream Vercel deploys in some configurations; a scoped PAT (`GH_PAT`) is used to ensure the push reliably triggers Vercel.
- Comment text from HN is HTML-encoded (`<p>`, `<a>`, etc.) and must be stripped before storage. Both the ETL script and `/api/refresh` apply the same stripping logic so output is consistent regardless of path.
- Gemini is prompted to respond in plain text (no markdown) because the chat UI renders raw strings.
