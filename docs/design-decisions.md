# Design Decisions: Hacker News Daily Digest

A record of every architectural and product decision made during the initial design phase, including the reasoning behind each choice. Use this as a reference when revisiting trade-offs or onboarding new contributors.

---

## Stack

| Decision | Choice | Reason |
|---|---|---|
| Frontend framework | Next.js 14, App Router | Supports server components, static rendering, and API routes in one deployment unit |
| Deployment | Vercel | Zero-config GitHub integration; auto-deploys on every push |
| Styling | Tailwind CSS only | Minimalist aesthetic, no component library overhead |
| AI model | Gemini 2.5 Flash Lite | Fast, cost-efficient for Q&A; no paid tier needed for low traffic |
| Data storage | JSON file committed to repo | No database required; Vercel rebuild on every commit delivers fresh data |

---

## ETL Pipeline

**Q: Why commit `digest.json` to the repo instead of fetching at runtime?**
Static rendering at build time means zero per-request latency for the initial page load. Each Vercel deploy bakes in the latest JSON. The browser Refresh button covers the case where a user wants data fresher than the last build.

**Q: Why use `/topstories` instead of `/beststories`?**
`/topstories` reflects current momentum (votes + recency). `/beststories` is a longer-tail list optimised for all-time quality. For a daily digest, today's momentum is more relevant.

**Q: Why top 10 posts and top 5 comments?**
10 posts gives a full picture of the day without scrolling fatigue. 5 comments per post is enough to sample community sentiment without bloating the JSON or the Gemini prompt.

**Q: Why strip HTML from comments in the ETL script?**
HN wraps comment text in `<p>`, `<a>`, `<i>` tags. Storing raw HTML in JSON means every consumer (UI, Gemini prompt) must sanitize independently. Stripping once at ingest is cleaner.

**Q: Why does the ETL commit only when content changes?**
`git diff --staged --quiet || git commit` prevents no-op commits when HN stories haven't changed between runs (e.g., a manually triggered run shortly after a scheduled one). Clean git history.

**Q: Why use a PAT (`GH_PAT`) instead of the default `GITHUB_TOKEN`?**
`GITHUB_TOKEN` pushes do not trigger downstream Vercel deployments in some configurations. A scoped PAT with `repo` access reliably triggers the Vercel webhook on push.

---

## Rendering Strategy

**Q: Why is `page.tsx` a static server component (no `dynamic = 'force-dynamic'`)?**
Static rendering means the page is built once per deploy and served from Vercel's edge cache — instant load, no cold starts. The daily Actions commit triggers a new deploy, so the static page is always refreshed within minutes of the ETL run.

**Q: Why does `page.tsx` use `fs.readFileSync` instead of `fetch('/data/digest.json')`?**
`fetch` in a server component requires a base URL (not available during SSR builds). `fs.readFileSync` reads the file directly from disk at build time — simpler and zero network overhead.

**Q: What happens on first deploy before any Actions run?**
A placeholder `public/data/digest.json` with `posts: []` is committed to the repo. `page.tsx` handles the empty array gracefully; `DigestClient` shows an empty-state message prompting the user to hit Refresh.

---

## Browser Refresh

**Q: Why does Refresh fetch from HN API directly in the browser instead of triggering the GitHub Actions workflow?**
Triggering a workflow via the GitHub API requires authentication (PAT or OAuth), adds ~2–5 minutes of pipeline latency, and then requires polling for completion. A direct HN API call returns live data in seconds and requires no secrets on the client.

**Q: Does the Refresh button commit the new data?**
No. Refresh updates React state only — the authoritative committed file is only written by GitHub Actions. This keeps the repo clean and avoids race conditions from concurrent browser-triggered writes.

**Q: Why does chat history reset on Refresh?**
The previous Gemini answers are about the old digest snapshot. Retaining them after a refresh would create a confusing mix of answers about different data sets.

---

## Gemini Integration

**Q: Why generate summaries on-demand instead of pre-computing them in GitHub Actions?**
Pre-generating in Actions couples the ETL to the AI API, adds Gemini latency to the cron job, and produces static answers. On-demand generation lets users ask any question and always reflects the current digest state (including after a browser Refresh).

**Q: Why pass the full digest context on every `/api/ask` call instead of maintaining a session?**
Stateless requests are simpler to implement, easier to debug, and avoid session management complexity. Gemini 2.5 Flash Lite has a large context window; the full digest (10 posts × 5 comments) is well within limits.

**Q: Why no response caching?**
Different users ask different questions; the cache hit rate would be low. Caching adds infrastructure (Redis, in-memory store) that contradicts the zero-infrastructure goal. Gemini 2.5 Flash Lite is cheap enough that per-request calls are acceptable.

**Q: Why server-side Gemini calls instead of client-side?**
The `GEMINI_API_KEY` must never be exposed to the browser. Server-side API routes keep the key in Vercel's environment variables only.

**Q: Why instruct Gemini to respond in plain text, not markdown?**
The chat UI renders raw strings. Markdown symbols (`**bold**`, `##`, `-`) would appear as literal characters and degrade readability.

---

## UI

**Q: Why chat-style Q&A instead of a simple input + answer box?**
Chat history lets users ask follow-up questions and refer back to previous answers. A single-answer box would discard context between questions.

**Q: Why Enter to submit and Shift+Enter for newlines?**
Standard messaging app convention. Reduces friction for short questions (most common case) while still allowing multi-line prompts.

**Q: Why truncate comments at 400 characters in the UI?**
Full comments can be thousands of characters. The UI is for skimming; users who want the full thread can follow the "discuss" link to HN.

**Q: Why collapse comments by default?**
Most users want to scan headlines first. Expanding all comments by default would make the page feel overwhelming and increase initial render cost.

---

## Secrets & Security

| Secret | Where stored | Why |
|---|---|---|
| `GEMINI_API_KEY` | Vercel environment variable | Used only server-side in API routes; never in client bundle |
| `GH_PAT` | GitHub Actions secret | Used only in the workflow to push commits; never in app code |

Neither secret is committed to the repository or exposed to the browser at any point.

---

## Decisions That Were Explicitly Ruled Out

| Option | Ruled out because |
|---|---|
| GCP / Cloud Storage | Adds infrastructure cost and complexity; repo JSON is sufficient |
| Database (Postgres, SQLite, etc.) | No query patterns that justify a DB; JSON file is simpler |
| Historical digest archives | Out of scope; single overwritten file keeps storage trivial |
| User accounts | No personalisation features that require identity |
| Real-time updates (WebSocket, SSE) | HN data changes slowly; daily cadence is sufficient |
| Pre-generated Gemini summaries | Would couple ETL to AI API and produce static answers |
| Component libraries (shadcn, MUI) | Minimalist design preference; Tailwind is sufficient |
| Markdown rendering in chat | Plain text is cleaner for Gemini responses; no use case for rich formatting |
| Client-side Gemini calls | Would expose the API key in the browser |
