# Skill: /grill-me
**Date used:** 2026-04-09
**Invocation:** User asked Claude to write both the PRD and grill-me output as .md files for future reference.

## What it did
- Interviewed the user on every architectural and product decision before any code was written
- Covered 15 decision areas: stack, ETL strategy, data storage, AI model, UI scope, secrets, refresh mechanism, caching, rate limiting, and deployment
- Forced explicit answers on trade-offs (e.g. static JSON vs database, Gemini Flash vs Pro, pre-generated vs on-demand summaries)
- Output was saved to `docs/design-decisions.md` as a permanent Q&A record

## Decision areas covered

| Area | Decision made |
|------|---------------|
| Frontend | Next.js 14 App Router on Vercel |
| Styling | Tailwind CSS only, no component library |
| ETL trigger | GitHub Actions cron, 0 8 * * * UTC |
| Data storage | Single overwritten `public/data/digest.json` committed to repo |
| HN data | /topstories endpoint, top 10 posts, top 5 comments each |
| AI model | Gemini 2.5 Flash Lite, server-side only |
| Summaries | On-demand per question, not pre-generated in Actions |
| Context | Full titles + scores + authors + comment counts + top comments |
| Caching | No caching on AI responses |
| Refresh | Browser re-fetch from HN API, no workflow trigger |
| Secrets | GEMINI_API_KEY in Vercel, GH_PAT in GitHub Actions |
| Chat | Message history in component state, chat-style UI |
| Scope | No auth, no database, no admin panel |

## Output files
- `docs/design-decisions.md` — full Q&A record of every architectural trade-off

## Lessons learned
- Running grill-me BEFORE /write-a-prd means the PRD has zero ambiguity — every decision is already resolved
- Saving design-decisions.md alongside the PRD creates two complementary artifacts: *what* we build (PRD) and *why* we made each call (design decisions)
- Explicit trade-off reasoning (e.g. "why /topstories not /beststories") is invaluable when revisiting decisions months later
