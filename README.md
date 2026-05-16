# HN Daily Digest

A web app that fetches the top 10 Hacker News posts, lets you read them with expandable comments, and ask Gemini questions about today's tech news.

![HN Daily Digest screenshot](docs/screenshot.png)

---

## Features

- Reads today's top 10 Hacker News posts with scores, authors, and comment counts
- Expandable top 5 comments per post — no need to open the HN thread
- Chat-style Q&A powered by Gemini 2.5 Flash Lite ("What's the most controversial post?")
- Persistent chat history for follow-up questions within the session
- Refresh button re-fetches live HN data directly in the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS |
| AI | Gemini 2.5 Flash Lite via `@google/generative-ai` |
| Data source | HN Firebase REST API (free, no key) |
| Unit tests | Jest + React Testing Library |
| E2E tests | Playwright |

---

## Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com/) account with a Gemini API key

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/pranayagarwal7/Hacker-News-Daily-Digest.git
cd Hacker-News-Daily-Digest

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.local.example .env.local
# Edit .env.local and fill in GEMINI_API_KEY

# 4. Start the dev server
npm run dev
# → open http://localhost:3000
```

---

## Environment Variables

| Variable | Where to get it | Required |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) → Get API key | Yes |

Set this in `.env.local` for local development.

---

## Running Tests

**Unit tests (Jest + React Testing Library):**
```bash
npm test                    # run all Jest tests once
npm run test:watch          # watch mode
```

**ETL unit tests (ESM, requires `--experimental-vm-modules`):**
```bash
npm run test:etl            # tests for scripts/fetch-digest.mjs
```

**E2E tests (Playwright):**
```bash
npx playwright install      # first time only — installs browser binaries
npm run test:e2e            # headless
npm run test:e2e:ui         # Playwright UI mode (interactive)
```

> E2E tests start the dev server automatically (`npm run dev`) and mock all external API calls (HN and Gemini), so no live credentials are needed.

---

## Project Structure

```
hacker-news-daily-digest/
│
├── public/
│   └── data/
│       └── digest.json             # placeholder digest
│
├── scripts/
│   └── fetch-digest.mjs            # Node ETL: fetch HN → clean → write JSON
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask/
│   │   │   │   └── route.ts        # POST: Gemini Q&A (server-side)
│   │   │   ├── digest/
│   │   │   │   └── route.ts        # GET: read digest.json
│   │   │   └── refresh/
│   │   │       └── route.ts        # GET: live HN fetch
│   │   ├── DigestClient.tsx        # client component: posts + chat + refresh
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                # server component: reads JSON
│   └── types/
│       └── digest.ts               # TypeScript types
│
├── __tests__/
│   ├── api/
│   ├── components/
│   └── scripts/
│
├── tests/
│   └── e2e/
│       └── digest.spec.ts          # Playwright e2e tests
│
├── docs/
│   ├── PRD.md                      # product requirements document
│   ├── design-decisions.md        # architectural Q&A record
│   └── eval/                       # evaluation artifacts
│
├── jest.config.ts
├── jest.setup.ts
├── playwright.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Known Limitations

- **No Gemini caching** — every question makes a new API call
- **No rate limiting** on `/api/ask`
- **Mobile app** — web only

---

## Contributing

This is a personal project, but PRs are welcome. Open an issue first to discuss the change, keep PRs scoped to one concern, and make sure `npm test` and `npm run lint` pass before submitting. The [design decisions doc](docs/design-decisions.md) explains the major architectural trade-offs if you want context before proposing a change.

---

## License

MIT
