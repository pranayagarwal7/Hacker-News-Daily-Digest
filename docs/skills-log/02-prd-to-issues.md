# Skill: /prd-to-issues
**Date used:** 2026-04-09
**Invocation:** User specified 11 exact issue titles with TYPE prefixes ([ETL], [API], [UI], [TEST], [DEPLOY])

## What it did
- Read the PRD as source of truth
- Created 11 GitHub issues via `gh issue create`
- Each issue included: What, Why, Acceptance Criteria (checkboxes), Dependencies

## Issues created
1. [ETL] Fetch top 10 HN posts and top 5 comments via HN Firebase API — #1
2. [ETL] Transform and clean raw JSON into gold digest format — #2
3. [ETL] GitHub Actions cron workflow — #3
4. [API] /api/digest route — #4
5. [API] /api/ask route — #5
6. [UI] Digest feed — #6
7. [UI] Chat-style Q&A interface — #7
8. [UI] Refresh button — #8
9. [TEST] Jest unit tests for ETL transform function — #9
10. [TEST] Playwright e2e tests — #10
11. [DEPLOY] Vercel deploy — #11

## Key patterns
- Each issue scoped to one unit of work
- Dependencies reference other issue titles explicitly
- Acceptance criteria are binary checkboxes, not vague descriptions

## Lessons learned
- Pre-specifying issue titles and TYPE prefixes produces tightly scoped, non-overlapping issues
- Dependency chains between issues make the implementation order clear
