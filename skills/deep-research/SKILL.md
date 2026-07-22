---
name: deep-research
description: Investigate a question against high-trust primary sources. Use when user wants a topic researched, API facts gathered, or reading delegated to background agent.
---

# Deep Research Skill

## Protocol
1. Decompose question into 3-5 sub-questions
2. Search primary sources (docs, specs, source code) for each
3. Cross-reference claims where sources disagree
4. Synthesize findings into structured Markdown

## Output
- Save to `research/<topic>-<date>.md`
- Include sources with URLs and retrieval dates
- Note confidence level per claim

## Anti-patterns
- NO AI-generated filler or hallucinated examples
- NO citing blog posts when official docs exist
- MUST verify code snippets against actual API docs
