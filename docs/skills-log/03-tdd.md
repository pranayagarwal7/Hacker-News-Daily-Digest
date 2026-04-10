# Skill: /tdd
**Date used:** 2026-04-09
**Invocation:** User specified exact test files, test names, and frameworks upfront

## What it did
- Read source files before writing tests (DigestClient.tsx, ask/route.ts, fetch-digest.mjs)
- Refactored scripts/fetch-digest.mjs to export pure functions (needed for unit testing)
- Created src/app/api/digest/route.ts (new route the tests needed)
- Wrote 5 test files covering ETL, API routes, components, and e2e

## Test files written
- `__tests__/scripts/fetch-digest.test.mjs` — Jest ESM, tests cleanHtml/isValidComment/shapePost/buildDigest
- `__tests__/api/digest.test.ts` — Jest node env, mocks fs.readFileSync
- `__tests__/api/ask.test.ts` — Jest node env, mocks @google/generative-ai
- `__tests__/components/DigestClient.test.tsx` — Jest jsdom + RTL, 30+ behavior tests
- `tests/e2e/digest.spec.ts` — Playwright, mocks /api/refresh and /api/ask via page.route()

## Config files added
- `jest.config.ts`, `jest.setup.ts`, `playwright.config.ts`
- Added test scripts to package.json: test, test:watch, test:etl, test:e2e, test:e2e:ui

## Errors encountered and fixed (5 rounds)
1. ts-node missing → `npm install --save-dev ts-node`
2. setupFilesAfterEnv wrong key name (tried setupFilesAfterFramework, setupFilesAfterEach)
3. next.config.ts unsupported by next/jest → renamed to next.config.mjs
4. window is not defined in node env → guarded polyfills with `typeof window` check
5. scrollIntoView not a function in jsdom → added mock to jest.setup.ts
6. jest.spyOn(global, 'fetch') fails when fetch absent → use `global.fetch = jest.fn()` directly
7. generateContent mock but route uses generateContentStream → updated mock to async generator
8. `/by author1/` regex matches author10 → switched to exact string match
9. Streaming Response incompatible with jsdom → manual reader mock object

## Final result: 39/39 tests passing

## Lessons learned
- Read source files first — tests must match actual function signatures and behavior
- Refactor source to be testable BEFORE writing tests (export pure functions from ETL)
- jsdom requires manual polyfills for ReadableStream, scrollIntoView, fetch
- Node-env tests (@jest-environment node) must not reference window in setup files
- Streaming responses need manual reader mocks in jsdom, not native ReadableStream
