# Contributing

Thanks for your interest in contributing to HN Daily Digest.

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Hacker-News-Daily-Digest.git`
3. Install dependencies: `npm install`
4. Copy env file: `cp .env.local.example .env.local` and fill in `GEMINI_API_KEY`
5. Run dev server: `npm run dev`

## Making Changes

- Create a branch: `git checkout -b feat/your-feature`
- Write tests for any new behavior
- Run `npm test` — all 39 tests must pass before submitting
- Run `npm run lint` — no lint errors

## Submitting a Pull Request

1. Push your branch and open a PR against `main`
2. Describe what changed and why
3. Link any related GitHub issue

## Running Tests

```bash
npm test              # Jest unit + component tests
npm run test:etl      # ETL script tests (ESM)
npm run test:e2e      # Playwright end-to-end tests
```

## Project Structure

```
scripts/          ETL script (Node.js, runs in GitHub Actions)
src/app/api/      Next.js API routes (ask, refresh)
src/app/          Page and client component
src/lib/          Shared utilities and types
__tests__/        Jest tests
tests/e2e/        Playwright tests
docs/             PRD, design decisions, skills log
```

## Questions

Open a GitHub issue or check `docs/design-decisions.md` for architectural context.
