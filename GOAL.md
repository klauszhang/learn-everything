# Project Goal — Transformer & Claude Code Cache Learning Site

This file is the source of truth for the project. Read it at the start of every session. It is intentionally self-contained — no external docs are required to execute the work described here.

## Mission

Build a small, locally-served interactive website that teaches transformer architecture, ending at a deep practical understanding of **Claude Code's prompt caching feature** — what it is, what gets reused, what invalidates it, and how to use it well.

## Audience

A reader who uses Claude / ChatGPT daily and knows surface terms (tokens, context window) but has no formal ML background. Do not assume linear algebra, neural network internals, or familiarity with attention.

## Success criteria

After reading the site end-to-end, the reader should be able to answer in their own words:

1. What is a token, and why are cache hits token-level?
2. What is an embedding? Why are embeddings deterministic per token at the input layer?
3. What does an attention layer do? What are Q, K, V?
4. Why does generation work one token at a time?
5. What is a KV cache, and why does it speed up generation?
6. What is Claude Code's prompt cache, what gets cached, what invalidates it, and how do TTL and pricing work?
7. Why does putting stable content early and mutable content late maximize cache hits?

---

## Tech stack

- **Astro** with file-based routing (one `.mdx` file per chapter under `src/pages/`).
- **React islands** (`.tsx`) for interactive widgets only, hydrated via `client:load` / `client:visible`.
- **MDX** as the chapter authoring format — markdown prose with embedded React components.
- **TypeScript** for components and example data.
- **Bun** for install, run, build, scripts. Lockfile is `bun.lockb` (committed). **Never use npm / yarn / pnpm in this project.**
- **No** Tailwind, no CSS-in-JS library, no component library (Radix / Headless UI / etc.) for v1. Plain CSS in `src/styles/global.css` plus CSS modules where useful.
- **No Mermaid.** Diagrams are inline SVG (for geometric content: attention matrices, embedding scatters, cache grids) or HTML+CSS (for flow / sequence diagrams).
- **No backend, no analytics, no telemetry, no automated tests for v1.** The build output is a static site that can be served by any static host or via `bun run preview`.

---

## Content — 8 chapters

Each chapter is one MDX page with one core diagram, one small interactive demo, and a closing **"How this connects to the cache"** callout box.

### Ch 0 — Why caching matters (`index.mdx`)

Hook: every Claude Code turn re-reads the whole conversation (system prompt, tools, files, history). Prompt caching is the workaround — but to understand what's reused, you need to understand transformers. Promise: by Ch 7 the reader knows exactly what bytes are reused and what is recomputed.

- **Diagram:** 3-turn timeline highlighting the identical prefix (HTML/CSS).
- **Demo:** hover later turns to highlight the identical prefix.

### Ch 1 — Tokens (`01-tokens.mdx`)

Text gets chopped into tokens (≈word-pieces). The model never sees individual characters. One-sentence preview of byte-pair / subword tokenization so the long-word example feels motivated.

- **Diagram:** sentence broken into colored token boxes (HTML/CSS).
- **Demo:** switch between 3 pre-tokenized examples to see how casing, punctuation, and word length change chunks.
- **Cache link:** cache hits are token-by-token — a one-char change can shift tokens and invalidate the cache.

### Ch 2 — Embeddings (`02-embeddings.mdx`)

Each token ID maps to a fixed input vector. Similar meanings sit near each other.

- **Diagram:** SVG 2D scatter — king/queen/man/woman style cluster plus a few extra points.
- **Demo:** hover a token to see its (truncated) vector and nearest neighbors.
- **Cache link:** same token ID → same *embedding-layer* vector — deterministic at the input. Caveat: after layer 1, the representation of a token becomes context-dependent. What stays cacheable is the work that depends only on prefix tokens, not "the model's view of a word."

### Ch 3 — Attention (`03-attention.mdx`)

Each token "looks at" earlier tokens. Q (query) / K (key) / V (value) intuition. Causal mask = you can only see the past.

- **Diagram:** SVG attention matrix grid; cell shading = mock attention weight.
- **Demo:** click a token to highlight its matrix row and which earlier tokens it attends to.
- **Cache link:** K and V are *layer-specific* — computed per layer from that layer's inputs, not a fixed property of a token. What's true: during one generation pass, once a token has been processed at layer L, that layer's K and V for that token won't change as later tokens are generated. That's the property the KV cache exploits.

### Ch 4 — Layers (`04-layers.mdx`)

Stacked attention + FFN blocks. Residual stream = data flowing up the stack.

- **Diagram:** stacked layer boxes (HTML/CSS), residual stream rising.
- **Demo:** hover a layer for a one-sentence note that different layers learn different patterns. **Avoid** the contested "low=syntax / mid=semantic / high=task" taxonomy — frame it as "research shows layers specialize in different ways, but the mapping isn't tidy."
- **Cache link:** every layer has its own K and V — cache size scales with layer count × tokens × hidden size.

### Ch 5 — Generation (`05-generation.mdx`)

Autoregressive decoding: produce one token, append, produce the next. Prefill (run the prompt through the model once) vs decode (one token at a time).

- **Diagram:** step-by-step token append (HTML/CSS, driven by "step" button).
- **Demo:** "step" button walks through the first ~6 generated tokens.
- **Cache link:** without a KV cache, every new token re-processes the entire prefix through every layer.

### Ch 6 — KV cache (internal) (`06-kv-cache.mdx`)

The internal optimization: store K and V for every past token; at each decode step, only compute K/V for the new token.

- **Diagram:** SVG grid of cache cells filling across decode steps (rows = layers, cols = tokens).
- **Demo:** side-by-side mock cost comparison "no cache" vs "with cache" (FLOPs counter, mock numbers).
- **Cache link:** this is the engine. Ch 7 is a *product feature* built on top.

### Ch 7 — Claude Code prompt cache (`07-prompt-cache.mdx`)

**Bridge paragraph (opens the chapter):** the KV cache from Ch 6 is an *intra-request* optimization living in runtime memory during one generation. The prompt cache is a *product feature* that persists prefix state across separate API requests — same underlying idea ("don't redo work on the prefix"), different mechanism, different scope, different lifetime, different invalidation rules.

Product-level details:

- **Cache breakpoints.** Developer-marked points saying "try to write a cache entry up to here." API currently allows **up to 4 breakpoints per request**. System caches up to and including each breakpoint; on read, the longest matching cached prefix wins. **Claude Code manages its own breakpoints internally** — the reader does not place them by hand.
- **Hit = exact token-level prefix match** up to a breakpoint.
- **TTL:** 5-minute default and 1-hour extended. **1-hour tier has a higher cache-write price** in exchange for longer life — only a net win when reads are spaced out.
- **Pricing direction (qualitative):** cache writes cost more than uncached input; cache reads cost much less. Net win when a prefix is read many times relative to writes. The 1-hour tier amplifies both.
- **Surprising invalidators:** changes to the **system prompt**, **tool definitions**, or **segment order** all blow the cache cold even if the visible conversation is unchanged.
- **How Claude Code uses it:** system prompt + tool definitions + read files + history are cached; only the user's new message and latest tool outputs are uncached on each turn.

- **Diagram:** anatomy of a Claude Code request — labeled, colored segments (system prompt, tools, files, history, new turn) with breakpoint markers.
- **Demo:** two consecutive requests side-by-side; hover segments to see "hit" vs "miss". Toggle: edit something in the early prefix (or change a tool definition) → watch the whole cache go cold.
- **Practical takeaways:** stable content early, mutable late; avoid small edits to early text; tool/system-prompt churn silently nukes the cache; 5-minute TTL means back-to-back turns benefit most.

---

## Per-chapter MDX template

```mdx
---
layout: ../layouts/ChapterLayout.astro
title: "Chapter N — Title"
chapterNumber: N
takeaway: "One-line what you'll learn."
prev: "/previous-slug"
next: "/next-slug"
---

import SomeWidget from '../components/SomeWidget.tsx';
import CacheCallout from '../components/CacheCallout.astro';

Short prose paragraph 1.

Short prose paragraph 2.

<SomeWidget client:load />

<CacheCallout>
  How this connects to the cache: …
</CacheCallout>
```

The layout reads `title`, `chapterNumber`, `prev`, `next` from frontmatter to render the header, the sidebar TOC highlight, and the footer prev/next links — no per-chapter boilerplate beyond frontmatter.

---

## File layout

```
learn-claude-code/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── bun.lockb                        # committed
├── .gitignore                       # see below
├── .worktrees/                      # gitignored; one subdir per active feature branch
├── tasks/                           # gitignored; inter-agent coordination scratchpad
│   ├── _shared.md
│   └── <branch-name>.md             # per-branch working notes
├── scripts/
│   └── new-worktree.sh
├── src/
│   ├── pages/
│   │   ├── index.mdx                # Ch 0
│   │   ├── 01-tokens.mdx
│   │   ├── 02-embeddings.mdx
│   │   ├── 03-attention.mdx
│   │   ├── 04-layers.mdx
│   │   ├── 05-generation.mdx
│   │   ├── 06-kv-cache.mdx
│   │   └── 07-prompt-cache.mdx
│   ├── layouts/
│   │   └── ChapterLayout.astro      # site shell, TOC sidebar, prev/next, arrow-key nav
│   ├── components/
│   │   ├── TokenChunks.tsx
│   │   ├── EmbeddingScatter.tsx
│   │   ├── AttentionMatrix.tsx
│   │   ├── LayerStack.tsx
│   │   ├── AutoregressiveStep.tsx
│   │   ├── KVCacheGrid.tsx
│   │   ├── RequestAnatomy.tsx
│   │   └── CacheCallout.astro       # static, no JS
│   ├── data/
│   │   ├── tokens.ts
│   │   ├── embeddings.ts
│   │   ├── attention.ts
│   │   └── cache.ts
│   └── styles/
│       └── global.css
├── public/                          # static assets if needed
├── GOAL.md                          # this file
└── README.md
```

`.gitignore` entries: `node_modules/`, `dist/`, `.astro/`, `tasks/`, `.worktrees/`. `bun.lockb` is **kept** (committed).

---

## Visual style

- Light theme. Neutral grey palette, one soft-blue accent, one warm color (amber / soft orange) reserved consistently for "cache hit" highlights.
- System sans-serif for body, monospace for tokens and code.
- Main column capped around 720px. Sticky left sidebar TOC at ≥1024px viewport; collapses above content on narrower viewports.
- All cache callouts share one CSS class for visual consistency.

---

## Development workflow

This project is implemented across multiple parallel agents working in isolated worktrees.

### Branch and worktree per feature

- **One feature = one branch = one worktree.** A "feature" is anything big enough to warrant its own integration step (scaffold, skeleton, each chapter, README).
- Worktrees live under `.worktrees/<branch-name>/` at the repo root. Directory is gitignored.
- Branch naming: `feat/<slug>` (e.g. `feat/scaffold`, `feat/skeleton`, `feat/ch-03-attention`, `feat/readme`).
- When a feature is complete and reviewed, the branch is merged back to `main` and its worktree removed.

### Commits as changelog

- Each commit captures **one logical change**. Present-tense summary in the first line (≤72 chars); rationale in the body when not obvious.
- Within a feature branch, commits form the granular changelog — reading `git log feat/<slug>` should let an outside reader follow what happened in order.
- **No squash-on-merge.** Merge with `git merge --no-ff` (or rebase + plain merge) so the feature's commit history stays visible on `main`.
- No "WIP" / "fix typo" noise in merged branches — clean up before merge.

### Shared `tasks/` for inter-agent coordination

When multiple agents work in parallel worktrees, they coordinate through a shared scratchpad:

- A **real** `tasks/` directory lives at the repo root in the main worktree.
- Every feature worktree exposes the same `tasks/` via a **relative symlink**: `.worktrees/<branch>/tasks → ../../tasks/`.
- `tasks/` is **gitignored**; coordination notes are not part of project history.
- File convention:
  - `tasks/<branch-name>.md` — one file per active branch; the agent owning that branch writes status, decisions, blockers, questions.
  - `tasks/_shared.md` — cross-cutting notes (style decisions, terminology, gotchas) any agent reads.
- Agents read `tasks/` at the start of work and update their own file as they go. The main agent reads everything to coordinate.

### Worktree helper script

`scripts/new-worktree.sh <branch-slug>`:

1. Creates branch `feat/<branch-slug>` off `main` (if it doesn't already exist).
2. Creates the worktree at `.worktrees/feat-<branch-slug>/`.
3. Creates the relative symlink `.worktrees/feat-<branch-slug>/tasks → ../../tasks/`.
4. Prints next-step instructions (`cd` path, suggested first commit).

---

## Implementation order

### 1. Bootstrap (on `main`, direct commits — one commit per logical unit)

- `bunx create-astro@latest` with React + MDX integrations; `bun install`.
- Configure `astro.config.mjs`, TypeScript paths, `src/styles/global.css`.
- Create `tasks/` directory with a starter `tasks/_shared.md` describing the coordination convention.
- Create empty `.worktrees/` directory.
- Write `.gitignore` with: `node_modules/`, `dist/`, `.astro/`, `tasks/`, `.worktrees/`. Keep `bun.lockb`.
- Write `scripts/new-worktree.sh` per the spec above.
- Verify `bun run dev` serves a hello-world page.

### 2. Skeleton (`feat/skeleton`)

- `src/layouts/ChapterLayout.astro` — header, sidebar TOC, prev/next, arrow-key navigation.
- `src/components/CacheCallout.astro` — static callout.
- `src/data/*.ts` stubs.
- Ch 0 (`index.mdx`) wired end-to-end.
- Verify in dev: layout renders, TOC highlights current chapter, prev/next works, arrow keys navigate between chapters.
- Merge back to `main` (`--no-ff`) before chapter work starts.

### 3. Chapters 1–7 (parallel)

One branch and worktree per chapter (`feat/ch-01-tokens`, …, `feat/ch-07-prompt-cache`). Each chapter is independent after the skeleton lands.

Per chapter, the owning agent:

- Writes the `.mdx` prose + frontmatter.
- Builds the one React island the chapter needs.
- Populates its slice of `src/data/<topic>.ts`.
- Updates `tasks/<branch>.md` as work progresses; reads `tasks/_shared.md` for cross-cutting decisions.
- Merges back to `main` (`--no-ff`) when done.

Subagents run in parallel and coordinate through `tasks/`.

### 4. README (`feat/readme`)

- How to run (`bun install`, `bun run dev`, `bun run build`, `bun run preview`).
- How to use the worktree workflow (`scripts/new-worktree.sh`).
- What each chapter covers, and the non-goals.

### 5. Manual review (on `main` after all merges)

- `bun run build && bun run preview`.
- Open each chapter: diagrams render, interactions work, prev/next chain intact, no console errors, no broken imports.

---

## Non-goals

- Not a full ML course — no backprop, no training, no fine-tuning, no rotary embeddings, no MoE.
- No mathematical rigor beyond intuition — no matrix multiplication walk-throughs, no proofs.
- No real tokenizer, no real model inference — all example data is hand-authored in `src/data/`.
- No multi-language i18n, no mobile-first design, no accessibility audit beyond basic semantic HTML.
- No dark mode in v1.
- No automated tests in v1 — manual review against the success criteria is the test.
- No backend, no analytics, no telemetry.
- No Tailwind, no CSS-in-JS library, no component library in v1.

---

## Risks to watch during implementation

- **Pedagogical accuracy.** Cache callouts and Ch 4's layer-role intuition must stay honest — explicitly avoid the contested "low=syntax / mid=semantic / high=task" taxonomy.
- **TTL / pricing.** Stated qualitatively where possible so the page doesn't go stale on a price tweak. Always flag the 1-hour tier's higher write multiplier so readers don't think "longer = free."
- **Hand-authored data.** All attention weights / embeddings / cache states in demos are fake. Label demos as illustrative. Keep them simple enough that the fakeness doesn't accidentally imply something untrue.
- **Embedding determinism nuance.** Ch 2's "same token → same vector" applies *only* at the embedding layer; post-layer-1 representations are context-dependent. Make this explicit so readers don't carry the wrong mental model into Ch 3 and Ch 6.
- **Silent cache invalidators.** Tool definition or system-prompt changes can invalidate the cache even when the visible conversation is unchanged. Ch 7 calls this out in both prose and demo.
- **Ch 6 → Ch 7 conceptual handoff.** The leap from intra-request KV cache to inter-request product feature is the whole point of the site. Ch 7 opens with an explicit bridge paragraph.
