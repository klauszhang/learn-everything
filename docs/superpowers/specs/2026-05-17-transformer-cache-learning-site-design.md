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
- No backend.
- No automated tests.
- No Tailwind, no CSS-in-JS library, no component library (Radix, Headless UI, etc.) for v1 — plain CSS is enough for this surface area.

## Architecture

### Stack

**Astro + React islands + MDX.**

- **Astro** handles routing (file-based: one `.mdx` file per chapter), static-site generation, the layout/shell, and ships zero JS for purely static content.
- **React** is used only inside interactive widgets (the "islands"). Components are written as `.tsx` files and dropped into MDX with the `client:load` (or `client:visible`) directive so they hydrate in the browser.
- **MDX** is the authoring format for every chapter — markdown for prose, React components inline for diagrams and demos. This keeps chapter authoring fast and consistent without writing raw HTML.
- **TypeScript** for React components.
- **Dev experience:** `npm run dev` for hot-reloading dev server; `npm run build` produces a static `dist/` of plain HTML/JS that can be served by any static host or opened locally with a simple `npm run preview`.

No Tailwind for v1 — plain CSS modules or a single global stylesheet keeps the surface small. Can reconsider if styling gets verbose.

### Diagrams

Mixed strategy, no Mermaid:

- **Inline SVG inside React components** for geometric diagrams: embedding scatter plot, attention matrix, KV-cache fill grid. SVG plays well with React's declarative rendering and lets diagrams react to component state (hover, click, step number).
- **JSX + CSS** for flow / sequence diagrams: turn-by-turn re-read, layer stack, autoregressive append, prompt prefix structure. Just styled `<div>` elements with React handling state.

### File layout

```
learn-claude-code/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── pages/                       # Astro file-based routing
│   │   ├── index.mdx                # Ch 0 — Why caching matters
│   │   ├── 01-tokens.mdx
│   │   ├── 02-embeddings.mdx
│   │   ├── 03-attention.mdx
│   │   ├── 04-layers.mdx
│   │   ├── 05-generation.mdx
│   │   ├── 06-kv-cache.mdx
│   │   └── 07-prompt-cache.mdx
│   ├── layouts/
│   │   └── ChapterLayout.astro      # site shell, TOC sidebar, prev/next, arrow-key nav
│   ├── components/                  # React islands (.tsx)
│   │   ├── TokenChunks.tsx
│   │   ├── EmbeddingScatter.tsx
│   │   ├── AttentionMatrix.tsx
│   │   ├── LayerStack.tsx
│   │   ├── AutoregressiveStep.tsx
│   │   ├── KVCacheGrid.tsx
│   │   ├── RequestAnatomy.tsx
│   │   └── CacheCallout.astro       # static callout, no JS
│   ├── data/                        # hand-authored example data
│   │   ├── tokens.ts
│   │   ├── embeddings.ts
│   │   ├── attention.ts
│   │   └── cache.ts
│   └── styles/
│       └── global.css
├── public/                          # static assets if any
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-17-transformer-cache-learning-site-design.md
└── README.md                        # how to run, what each chapter covers
```

Each chapter's `.mdx` declares `layout: ../layouts/ChapterLayout.astro` in frontmatter; the layout renders the header, sidebar TOC, the chapter's MDX content, the "how this connects to the cache" callout slot, and prev/next nav at the bottom.

### Per-chapter template

Every chapter MDX has the same shape:

```mdx
---
layout: ../layouts/ChapterLayout.astro
title: "Chapter N — Title"
chapterNumber: N
takeaway: "One-line what you'll learn."
prev: "/previous-slug"
next: "/next-slug"
---

import TokenChunks from '../components/TokenChunks.tsx';
import CacheCallout from '../components/CacheCallout.astro';

Short prose paragraph 1.

Short prose paragraph 2.

<TokenChunks client:load />

More prose if needed.

<CacheCallout>
  How this connects to the cache: ...
</CacheCallout>
```

The layout uses frontmatter (`title`, `chapterNumber`, `prev`, `next`) to render the header, sidebar highlight, and footer nav without per-chapter boilerplate.

### Interactivity model

- **React islands** hydrate only the demo components. Each island manages its own state with `useState` (selected token, current step, hovered cell). No global state, no context.
- **Example data** lives in `src/data/*.ts` as typed exports, imported by both components and (where needed) by MDX prose snippets.
- **Keyboard navigation** (`ArrowLeft` / `ArrowRight` between chapters) is wired up once in `ChapterLayout.astro` via a tiny inline `<script>` — no React needed for that.
- No `fetch`, no async, no real model. All demos render hand-authored data from `src/data/`.

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

Text gets chopped into tokens (≈word-pieces). The model never sees individual characters. One-sentence preview of byte-pair / subword tokenization: common chunks ("the", "ing") get their own token; rare words get split into pieces. This makes the `antidisestablishmentarianism` split feel motivated rather than arbitrary.

- **Diagram:** a sentence broken into colored token boxes (HTML/CSS).
- **Demo:** switch between 3 pre-tokenized examples ("hello world", "Hello world!", "antidisestablishmentarianism") to see how casing, punctuation, and word length change the chunks.
- **Cache callout:** cache hits are matched token-by-token — a one-character change can shift tokens and invalidate the cache.

### Ch 2 — Embeddings (`02-embeddings.html`)

Each token ID maps to a fixed vector. Similar meanings sit near each other.

- **Diagram:** SVG 2D scatter plot — king/queen/man/woman style cluster with a few other points for variety.
- **Demo:** hover a token in the scatter or in a sentence to see its (truncated) vector and nearest neighbors.
- **Cache callout:** the same token ID always maps to the same *embedding-layer* vector — deterministic at the input. Important caveat to land here: after layer 1, the representation of a token becomes context-dependent (it has attended to its neighbors). What stays cacheable is the work that depends only on the prefix tokens, not "the model's view of a word."

### Ch 3 — Attention (`03-attention.html`)

Each token "looks at" earlier tokens. Q/K/V intuition: Q = what I'm looking for; K = what I offer; V = what I'd contribute if you picked me. Causal mask = you can only see the past.

- **Diagram:** SVG attention matrix grid — one row per query token, one column per key token, cell shading = mock attention weight.
- **Demo:** click a token in a sentence to highlight the row of the matrix and which earlier tokens it attends to.
- **Cache callout:** K and V are *layer-specific* — each layer computes its own K and V from that layer's inputs. They are not a fixed property of a token. What *is* true: during one generation pass, once a token has been processed at layer L, that layer's K and V for that token won't change as you generate later tokens. That's the property the KV cache exploits (Ch 6).

### Ch 4 — Layers (`04-layers.html`)

Real transformers stack many attention + FFN blocks. Residual stream is the data flowing up the stack.

- **Diagram:** stacked layer boxes (HTML/CSS) showing residual stream flowing from input embeddings up through layers to the output.
- **Demo:** hover a layer for a one-sentence note that different layers learn different kinds of patterns. Avoid claiming a specific "low = syntax, mid = semantic, high = task" taxonomy — that's contested in the literature. Frame it as "research shows layers specialize in different ways, but the mapping isn't tidy."
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

**Bridge from Ch 6 (first thing in the chapter):** the KV cache from Ch 6 is an *intra-request* optimization that lives in the model's runtime memory during one generation. The prompt cache is a different beast: a *product feature* that persists prefix state across separate API requests, with its own lifetime, pricing, and invalidation rules. Same underlying idea ("don't redo work on the prefix"), different mechanism and different scope.

The product-level details:

- **Cache breakpoints.** Developer-marked points in the prompt that say "try to write a cache entry up to here." Anthropic's API currently allows up to 4 breakpoints per request. The system caches *up to and including* each breakpoint; on read, the longest matching cached prefix wins. **Claude Code manages its own breakpoints internally** — the end-user reading this site does not place them by hand; the chapter explains them so the reader can reason about cache behavior, not to teach them an API.
- **What counts as a hit.** Exact token-level prefix match up to a breakpoint.
- **TTL.** Two options: 5-minute default and 1-hour extended. The 1-hour option has a *higher cache-write price* in exchange for the longer lifetime — so it's only a net win when reads are spaced out over many minutes.
- **Pricing direction (qualitative).** Cache writes cost more than uncached input; cache reads cost much less than uncached input. Net win when a prefix is read many times relative to how often it's written. The 1-hour tier shifts this balance — the write is even more expensive, the read is the same discount, but you get more time to amortize.
- **What invalidates.** Any change anywhere in the cached prefix. Notably surprising sources of invalidation: changes to the **system prompt**, the **tool definitions**, or the **order** of cached segments — even if the visible conversation hasn't changed.
- **How Claude Code uses it.** System prompt + tool definitions + read files + history are all part of the cached prefix; only the user's new message and the latest tool outputs are uncached on each turn.

- **Diagram:** anatomy of a Claude Code request — labeled, colored segments (system prompt, tools, files, history, new turn) with cache breakpoint markers (HTML/CSS).
- **Demo:** two consecutive requests side-by-side; hover segments to see "hit" vs "miss". Toggle: edit something in the early prefix (or change a tool definition) → watch the whole cache go cold.
- **Practical takeaways:** keep stable content early, mutable content late; avoid small edits to early text; tool/system-prompt churn silently nukes the cache; 5-minute TTL means back-to-back turns benefit most, longer pauses lose the cache unless you pay for the 1-hour tier.

## Implementation order

1. **Project scaffold.** `npm create astro@latest` with the React + MDX integrations. Configure `astro.config.mjs`, add TypeScript paths, set up `src/styles/global.css`. Verify `npm run dev` serves a hello-world page.
2. **Skeleton.** `ChapterLayout.astro` (header, sidebar TOC, prev/next, arrow-key nav), `CacheCallout.astro`, `src/data/*.ts` stubs, and Ch 0 (`index.mdx`) wired end-to-end. Verify in dev server: layout renders, TOC highlights the current chapter, prev/next chain works, arrow keys move between chapters.
3. **Chapters 1–7.** Each chapter is independent of the others after the skeleton lands. Each one is: write the `.mdx` prose + frontmatter, build the one React island that chapter needs, populate `src/data/<topic>.ts`. These can be parallelized across subagents.
4. **README.md** — how to run the site (`npm install`, `npm run dev`), what each chapter covers, and a short note on the non-goals.
5. **Manual review.** Run `npm run build && npm run preview`, open each chapter, confirm diagrams render, all interactions work, prev/next chain is intact, no console errors, no broken imports.

Chapters 1–7 are intentionally independent — same layout, same data folder, separate components — so the implementation phase can fan out to one subagent per chapter.

## Risks and unresolved questions

- **Pedagogical accuracy.** "How this connects to the cache" callouts must stay honest. The Ch 4 hover note deliberately avoids a "low = syntax, mid = semantic, high = task" taxonomy because that mapping is contested. Reviewer should sanity-check that no other claim across chapters is over-stated.
- **TTL / pricing details.** Ch 7 cites "5-min default, 1-hour extended" plus a qualitative pricing direction. Spec deliberately keeps numbers qualitative so the page doesn't go stale on a price change. The 1-hour tier's *higher* write multiplier is called out so readers don't think "longer TTL is free."
- **Hand-authored data quality.** All attention weights, embeddings, and cache states in the demos are fabricated. Risk: a fake example accidentally implies something untrue (e.g., an attention pattern that wouldn't actually occur). Mitigation: label demos as illustrative; keep them simple.
- **Embedding determinism nuance.** Ch 2's "same token → same vector" is true *at the embedding layer*. Post-layer-1 representations are context-dependent. The Ch 2 callout now states this explicitly so readers don't carry away the wrong intuition into Ch 3 and Ch 6.
- **Silent cache invalidators in Claude Code.** Tool definitions and system-prompt changes can invalidate the cache even when the visible conversation hasn't changed. This often surprises users. Ch 7 calls it out explicitly in both the prose and the demo (toggling a tool definition blows the cache cold).
- **Ch 6 → Ch 7 conceptual handoff.** The leap from "intra-request KV cache" to "inter-request product feature" is the whole point of the site. The spec now opens Ch 7 with an explicit bridge paragraph; reviewer should check it lands.
