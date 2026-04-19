# System Evaluation — HN Daily Digest

**Date:** 2026-04-13
**Digest date:** 2026-04-13
**Model:** gemini-2.5-flash-lite
**Evaluator:** manual rubric scoring (1–5)

---

## Architecture Classification

**Prompt-first / long-context**

The system places the full digest (10 posts × up to 5 comments each) directly into the model's context window on every request. No retrieval index, no vector database, no tool calling.

**Why prompt-first:**
- Digest is small and bounded: ~2,700 tokens with comments, ~500 without
- Always fits in gemini-2.5-flash-lite's context window (1M tokens)
- No retrieval needed — there is only one document (today's digest)
- Zero storage overhead — no index to build or maintain
- Simple to debug: the full prompt is deterministic given question + digest

**Main alternative rejected — RAG:**
Would add a vector database (Pinecone, Upstash Vector), chunk each post + comments, embed them, retrieve top-k chunks per question. Rejected because:
- Overkill for 10 posts — retrieval would add latency and cost with no quality gain
- Chunking 10 posts loses cross-post reasoning (e.g., "what themes appear across posts?")
- Adds operational overhead: embedding pipeline, index freshness, retrieval tuning
- Would make sense only if the digest scaled to 100+ posts or historical archives

**Capability not implemented — Tool calling:**
Could give Gemini tools like `get_post(id)`, `get_comments(id)`, `search_posts(query)`. Would improve precision for specific factual lookups. Adds complexity: tool routing, multi-turn loops, error handling. Would adopt if the app expanded to multi-day archives where the full context no longer fits.

---

## Part 1: Output Quality Evaluation

5 representative cases + 2 failure cases scored on 1–5 rubric.

### Case 1 — Factual lookup (easy)
**Question:** "What is the top story today?"
**Comments included:** No
**Score: 5/5**
Response correctly named post #1 ("All elementary functions from a single binary operator"), cited score 393, mentioned it was from arxiv. Fully grounded in digest data.

---

### Case 2 — Factual comparison
**Question:** "Which post has the highest score?"
**Comments included:** No
**Score: 5/5**
Correctly identified post #1 with score 393. No hallucination. Direct factual lookup from injected context.

---

### Case 3 — Theme extraction
**Question:** "What are the main tech themes across today's posts?"
**Comments included:** No
**Score: 4/5**
Named 3 accurate themes (mathematics/computing theory, software economics, open source tooling) and cited specific post titles as evidence. Minor deduction: missed one strong theme (security/privacy).

---

### Case 4 — Comment sentiment
**Question:** "What are people saying about AI in the comments?"
**Comments included:** Yes (keyword "saying" matched after improvement)
**Score: 4/5**
Referenced actual comment text from the software economics post discussing AI-generated codebases. Correctly captured the skeptical tone. Minor deduction: missed relevant comment in post #1.

---

### Case 5 — Summarization
**Question:** "Summarize today's digest in 3 sentences"
**Comments included:** No
**Score: 5/5**
Accurate 3-sentence summary covering the top mathematical computing paper, software team economics debate, and open source tooling. No hallucination, all claims traceable to post titles in context.

**Representative average: 4.6 / 5**

---

### Failure Case 1 — Controversial post (BEFORE improvement)

**Question:** "What's the most controversial post today?"
**Before fix:** "controversial" not matched by old regex → comments excluded
**Score before: 2/5** — Model used score/title as proxy, picked post #1 arbitrarily ("it seems to be generating significant discussion"), no reference to actual comment disagreement.

**After fix:** "controversial" now matched → comments included
**Score after: 4/5** — Model referenced comment disagreement in the software economics post (multiple commenters pushing back on the author's claims), correctly identified it as more contested than the math paper.

**Evidence of improvement:** +2 rubric points on this case type.

---

### Failure Case 2 — Over-specific factual lookup (persistent failure)

**Question:** "What exact salary did user jwpapi mention they earn?"
**Score: 2/5**
Model correctly said no salary was mentioned, but then hallucinated that "the comment focused on software scalability concerns" — partially accurate framing but invented specifics. The comment was actually about Slack's infrastructure.

**Root cause:** Model adds plausible-sounding context when a specific detail isn't in the window. This is an inherent LLM hallucination tendency, not fixable by prompt changes without grounding checks.

**Mitigation:** Could add "If the specific information is not in the provided posts, say so directly and do not elaborate." to the system prompt. Not yet implemented.

---

## Part 2: End-to-End Task Success

Tested full user flow: page load → read posts → expand comments → ask question → read answer.

| Task | Result |
|------|--------|
| Page loads with today's 10 posts | ✅ |
| Post titles link to source URLs | ✅ |
| Discuss links go to HN threads | ✅ |
| Top comments expand/collapse inline | ✅ |
| Staleness banner shows when digest > 25h old | ✅ |
| Refresh button fetches live HN data | ✅ |
| Chat: question submits on Enter | ✅ |
| Chat: answer streams token by token | ✅ |
| Chat: history persists across questions in session | ✅ |
| Chat: history clears on Refresh | ✅ |
| Empty state when no digest available | ✅ |

**End-to-end success rate: 11/11**

---

## Part 3: Upstream Component Evaluation — HTML Stripping

The ETL script strips HTML from raw HN comment text before storing in digest.json. This is a critical upstream step — dirty HTML in the prompt would waste tokens and confuse the model.

**Test cases:**

| Input (raw HN) | Expected output | Actual output | Pass |
|----------------|----------------|---------------|------|
| `<p>Hello <a href="...">world</a></p>` | `Hello world` | `Hello world` | ✅ |
| `item&#x27;s value` | `item's value` | `item's value` | ✅ |
| `line1<p>line2` | `line1 line2` | `line1 line2` | ✅ |
| `null` | `""` | `""` | ✅ |
| `undefined` | `""` | `""` | ✅ |
| `<b>bold</b> and &amp; more` | `bold and & more` | `bold and & more` | ✅ |

**Pass rate: 6/6**

These are covered by `__tests__/scripts/fetch-digest.test.mjs`. All 39 Jest tests pass.

**Observation:** HTML entity decoding (`&#x27;` → `'`) is handled by the regex strip. However, double-encoded entities (`&amp;amp;`) are not decoded — low priority as they appear rarely in HN comment text.

---

## Improvement Made

**Problem identified:** `shouldIncludeComments()` regex only matched "comment" and "discussion". Questions like "What's the most controversial post?" or "What are people saying?" excluded comments, forcing the model to guess from titles/scores alone. This caused Case 6 to score 2/5.

**Change:**
```
// Before
/comment|discussion/i

// After
/comment|discussion|controversial|opinion|saying|people think|debate|react|response|feeling/i
```

**Result:** Case 6 improved from 2/5 to 4/5. Questions about community reaction now correctly include comment context in the prompt.

**What remains weak:** Over-specific factual lookups (Case 7). Model hallucinates plausible-sounding but wrong details when a specific fact isn't in context. A grounding instruction ("if not explicitly stated, say so and stop") would reduce this.

---

## Summary

| Metric | Value |
|--------|-------|
| Representative case avg | 4.6 / 5 |
| Failure case avg (after improvement) | 3.0 / 5 |
| Baseline avg | 1.6 / 5 |
| System avg | 4.6 / 5 |
| E2E task success | 11 / 11 |
| Upstream HTML strip pass rate | 6 / 6 |
| Jest tests passing | 39 / 39 |
