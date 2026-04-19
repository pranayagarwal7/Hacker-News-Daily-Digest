# Baseline Comparison

## Setup

Two prompt strategies tested against the same 5 representative questions using the 2026-04-13 digest.

**Baseline (naive):** Flat prompt. No digest context injected at all. Just the question sent to Gemini cold.

```
Answer this question about Hacker News: {question}
```

**Current system (smart context):** Full digest context injected. Smart comment inclusion: comments added only when question keyword matches regex.

```
You are an assistant analyzing today's Hacker News top stories.

Here are today's top 10 posts:
{context}

Answer the following question concisely and insightfully.
Use plain text — no markdown formatting.

Question: {question}
```

---

## Results

| # | Question | Baseline score | System score | Delta |
|---|----------|---------------|--------------|-------|
| 1 | What is the top story today? | 1 — hallucinated a post not in digest | 5 — correct title + score | +4 |
| 2 | Which post has the highest score? | 1 — made up a score | 5 — correct | +4 |
| 3 | What are the main tech themes today? | 2 — generic "tech/AI/software" with no grounding | 4 — referenced actual post titles | +2 |
| 4 | What are people saying about AI in the comments? | 2 — generic opinion, no real content | 4 — referenced actual comment text | +2 |
| 5 | Summarize today's digest in 3 sentences | 2 — generic summary of "typical HN" not today's data | 5 — accurate to actual posts | +3 |

**Baseline average: 1.6 / 5**
**System average: 4.6 / 5**

---

## Why the gap is so large

Baseline fails completely on factual lookups (Q1, Q2) because it has no access to today's data. It can only draw on training knowledge of "typical Hacker News", which is both stale and wrong for any specific day.

The system's smart context injection is the single most important architectural decision. Without it, the app is not meaningfully better than asking raw Gemini.

---

## Metric justification

**Rubric scoring (1–5)** chosen over BLEU/ROUGE because:
- No ground-truth reference answers exist
- The task is open-ended Q&A, not fixed-format extraction
- Rubric captures factual accuracy + specificity, which matter most here

Rubric criteria per question type:
- **Factual lookup** (Q1, Q2): 5 = exact match to digest data, 1 = wrong/hallucinated
- **Theme extraction** (Q3): 5 = cites specific post titles, 1 = generic non-grounded themes
- **Comment summarization** (Q4): 5 = references actual comment text, 1 = fabricated opinions
- **Summarization** (Q5): 5 = accurate to today's posts, 1 = generic not grounded in today's data
