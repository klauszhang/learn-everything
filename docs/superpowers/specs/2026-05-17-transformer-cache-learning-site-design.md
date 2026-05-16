# Transformer & Claude Code Cache Learning Site — Design

**Date:** 2026-05-17
**Status:** Draft (awaiting review)

## Goal

A small, local-only static website that walks a Claude/ChatGPT user (familiar with AI as a user, not deep ML) through transformer architecture in a linear journey that lands at understanding **Claude Code's prompt caching** — what it is, what gets reused, what invalidates it, and how to make it work for you.

## Audience and assumed background

- Comfortable using Claude/ChatGPT day-to-day.
- Knows surface terms (tokens, context window) but not their internals.
- Not assumed to know: linear algebra, neural networks, attention math, KV cache, or prompt caching as a product feature.

## Success criteria

After reading the site end-to-end, the reader can answer in their own words:

1. What is a token, and why are cache hits token-level?
2. What's an embedding? Why are embeddings deterministic per token?
3. What does an attention layer do? What are Q, K, V?
4. Why does generation work one token at a time?
5. What is a KV cache and why does it speed up generation?
6. What is Claude Code's prompt cache, what gets cached, what invalidates it, and how do TTL and pricing work?
7. Why is putting stable content early (system prompt, tools, files) and mutable content late (the user's new message) the right shape for cache hits?

## Non-goals

- Not a full ML course. No backprop, no training, no fine-tuning, no rotary embeddings, no MoE.
- No mathematical rigor beyond intuition (no matrix multiplication walk-throughs, no formal proofs).
- No real tokenizer or model inference. All example data is hand-authored.
- No multi-language i18n, no mobile-first design, no accessibility audit (basic semantic HTML only), no analytics, no telemetry.
- No dark mode for v1.
- No build step, bundler, framework, or backend.
- No automated tests.

## Architecture

### Stack

Vanilla HTML + CSS + JS. No framework, no build step, no server, no CDN. The site opens by double-clicking `index.html` and works fully offline.

### Diagrams

Mixed strategy, no Mermaid:

- **Inline SVG** for geometric diagrams: embedding scatter plot, attention matrix, KV-cache fill grid.
- **HTML + CSS boxes** for flow / sequence diagrams: turn-by-turn re-read, layer stack, autoregressive append, prompt prefix structure.

This keeps the site dependency-free and gives every diagram native hover/click interactivity.

### File layout

```
learn-claude-code/
├── index.html              # Ch 0 — Why caching matters
├── 01-tokens.html
├── 02-embeddings.html
├── 03-attention.html
├── 04-layers.html
├── 05-generation.html
├── 06-kv-cache.html
├── 07-prompt-cache.html
├── assets/
│   ├── styles.css          # shared styling
│   └── nav.js              # prev/next, sidebar TOC highlight, arrow-key nav
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-17-transformer-cache-learning-site-design.md
└── README.md               # one-paragraph description + how to open
```

Each chapter loads the same `styles.css` and `nav.js` via relative paths.

### Per-chapter template

Every chapter HTML has the same skeleton:

1. `<header>` — site title, sticky.
2. `<aside>` — TOC sidebar listing all chapters; the current one is highlighted by `nav.js` based on `location.pathname`.
3. `<main>` —
   - `<h1>` chapter title
   - One-line "what you'll learn"
   - 2–4 short explanation paragraphs
   - One core diagram (inline SVG or styled HTML)
   - One small interactive demo (hover or click reveal — see below)
   - A "How this connects to the cache" callout box at the bottom
4. `<footer>` — prev/next chapter links.

### Interactivity model

All interactivity is vanilla JS, no async.

- `nav.js` (shared): highlights current chapter in TOC, wires up prev/next links, registers `ArrowLeft` / `ArrowRight` key handlers.
- Per-page inline `<script>` blocks: hover/click reveals using `data-*` attributes and small hand-authored JS arrays of example data (tokens, mock attention weights, mock cache states).
- No `fetch`, no `import`, no module system.

### Visual style

- Light theme. Neutral grey palette. One soft-blue accent for highlights and links. One warm color (amber / soft orange) reserved for "cache hit" markings to keep that concept visually consistent across chapters.
- System sans-serif (`system-ui, sans-serif`) for body, monospace (`ui-monospace, monospace`) for tokens, IDs, code.
- Main column capped around 720px. Sticky left sidebar TOC at ≥1024px viewport; collapses above the content at narrower widths.
- All callouts ("how this connects to the cache") share one CSS class for visual consistency.

## Content outline

### Ch 0 — Why caching matters (`index.html`)

**Hook:** every Claude Code turn re-reads the whole conversation: same system prompt, same tools list, same read files, same chat history. Prompt caching is the workaround, but to understand it you need to know what *is* being processed — that's what the rest of the site builds up.

- **Diagram:** turn 1 / turn 2 / turn 3 timeline (HTML/CSS) highlighting the identical prefix that gets re-processed each turn.
- **Demo:** hover later turns to highlight the identical prefix.
- **Cache callout:** "By Ch 7 you'll know exactly which bytes are reused and which are recomputed."

### Ch 1 — Tokens (`01-tokens.html`)

Text gets chopped into tokens (≈word-pieces). The model never sees individual characters.

- **Diagram:** a sentence broken into colored token boxes (HTML/CSS).
- **Demo:** switch between 3 pre-tokenized examples ("hello world", "Hello world!", "antidisestablishmentarianism") to see how casing, punctuation, and word length change the chunks.
- **Cache callout:** cache hits are matched token-by-token — a one-character change can shift tokens and invalidate the cache.

### Ch 2 — Embeddings (`02-embeddings.html`)

Each token ID maps to a fixed vector. Similar meanings sit near each other.

- **Diagram:** SVG 2D scatter plot — king/queen/man/woman style cluster with a few other points for variety.
- **Demo:** hover a token in the scatter or in a sentence to see its (truncated) vector and nearest neighbors.
- **Cache callout:** the same token ID always maps to the same vector — deterministic-per-token is what makes the prefix reusable across turns.

### Ch 3 — Attention (`03-attention.html`)

Each token "looks at" earlier tokens. Q/K/V intuition: Q = what I'm looking for; K = what I offer; V = what I'd contribute if you picked me. Causal mask = you can only see the past.

- **Diagram:** SVG attention matrix grid — one row per query token, one column per key token, cell shading = mock attention weight.
- **Demo:** click a token in a sentence to highlight the row of the matrix and which earlier tokens it attends to.
- **Cache callout:** K and V for past tokens never change as you generate more — that's exactly what gets cached.

### Ch 4 — Layers (`04-layers.html`)

Real transformers stack many attention + FFN blocks. Residual stream is the data flowing up the stack.

- **Diagram:** stacked layer boxes (HTML/CSS) showing residual stream flowing from input embeddings up through layers to the output.
- **Demo:** hover a layer for a toy one-sentence description of what it might learn (e.g., low layers = syntax-ish, mid = semantic, high = task-ish). Explicitly framed as a rough intuition, not literal truth.
- **Cache callout:** every layer has its own K and V — total cache size scales with layer count × tokens × hidden size.

### Ch 5 — Generation (`05-generation.html`)

Generation is autoregressive: produce one token, append it, produce the next. Distinguishes prefill (run the prompt through the model once) from decode (one token at a time).

- **Diagram:** step-by-step token append (HTML/CSS, driven by a "step" button).
- **Demo:** "step" button walks through the first ~6 generated tokens, growing the sequence visibly.
- **Cache callout:** without a KV cache, every new token re-processes the entire prefix through every layer.

### Ch 6 — KV cache (internal) (`06-kv-cache.html`)

Store K and V vectors for every past token. At each decode step, only compute K/V for the new token and reuse the rest.

- **Diagram:** SVG grid of cache cells filling up across decode steps (rows = layers, cols = tokens; cells fill in as decode progresses).
- **Demo:** side-by-side mock cost comparison "no cache" vs "with cache" — FLOPs counter (mock numbers) growing quadratically vs linearly.
- **Cache callout:** this is the engine. Claude Code's prompt cache (Ch 7) is a *product feature* built on top of this internal optimization.

### Ch 7 — Claude Code prompt cache (`07-prompt-cache.html`)

The product-level feature:

- Cache breakpoints (developer-marked prefixes).
- What counts as a hit (exact token-level prefix match).
- TTL: 5 minutes default, 1 hour extended.
- Pricing: cache writes cost more than uncached input; cache reads cost much less. Net win when prefix is read more times than it's written.
- What invalidates: any change anywhere in the cached prefix.
- How Claude Code uses it: system prompt + tools + read files + history are all cached; only the user's new message and new tool outputs are uncached.

- **Diagram:** anatomy of a Claude Code request — labeled, colored segments (system prompt, tools, files, history, new turn) with cache breakpoint markers (HTML/CSS).
- **Demo:** two consecutive requests side-by-side; hover segments to see "hit" vs "miss". Toggle: edit something in the early prefix → watch the whole cache go cold.
- **Practical takeaways:** keep stable content early, mutable content late; avoid small edits to early text; cache TTL is short, so back-to-back turns benefit most.

## Implementation order

1. Skeleton: `assets/styles.css`, `assets/nav.js`, and one chapter (Ch 0) wired up end-to-end. Verify navigation, TOC highlight, callout styling, prev/next, arrow keys.
2. Author the remaining 7 chapters in order (Ch 1 → Ch 7). Each chapter is small and isolated; can be done independently once the skeleton works.
3. `README.md` describing how to open the site and what each chapter covers.
4. Manual review: open each page in a browser, confirm diagrams render, interactions work, prev/next chain is intact, no console errors.

Chapters 1–7 are independent of each other after the skeleton lands and can be parallelized across subagents during implementation.

## Risks and unresolved questions

- **Pedagogical accuracy.** "How this connects to the cache" callouts must stay honest — e.g., the layer-role intuitions in Ch 4 are not literally true; we frame them as rough intuition. Worth a sanity pass during review to make sure no claim is misleading.
- **TTL / pricing details.** Ch 7 cites "5-min default, 1-hour extended" and "cache writes cost more, reads cost less." These are accurate as of Anthropic's published prompt-caching docs; the spec deliberately keeps numbers qualitative so the site doesn't go stale on a price tweak.
- **Hand-authored data quality.** All example attention weights / embeddings / cache states are fake. The risk is that a fake example accidentally implies something untrue (e.g., an "attention pattern" that wouldn't actually occur). Mitigation: keep demos simple and labeled as illustrative.
