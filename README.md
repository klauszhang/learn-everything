# learn-claude-code

A small interactive learning site that teaches transformer architecture from first principles, ending at a deep practical understanding of Claude Code's prompt caching feature. Designed for daily Claude users with no formal ML background.

## How to run

Install dependencies with Bun:

```bash
bun install
```

Start the local dev server:

```bash
bun run dev
```

Build a static site to `dist/`:

```bash
bun run build
```

Preview the built site locally:

```bash
bun run preview
```

Note: This project uses **Bun only** for all package management and scripts. Do not use npm, yarn, or pnpm.

## Chapter overview

The site is organized as 8 chapters, each teaching one core concept and ending with an explanation of how it connects to prompt caching.

- **Ch 0: Why caching matters** (`/`) — Sets up the problem: every Claude Code turn re-reads the whole conversation. Prompt caching is the solution, but to understand what's reused, you need to know transformers.
- **Ch 1: Tokens** (`/01-tokens`) — Text gets tokenized into word-pieces. Learn how tokens work and why a one-character change can shift token boundaries and invalidate the cache.
- **Ch 2: Embeddings** (`/02-embeddings`) — Each token maps to a fixed input vector. Understand why embeddings are deterministic at the embedding layer but context-dependent thereafter.
- **Ch 3: Attention** (`/03-attention`) — How each token "looks at" earlier tokens via Query, Key, and Value matrices. Learn why the causal mask restricts what a token can see.
- **Ch 4: Layers** (`/04-layers`) — Transformers are stacks of attention + feed-forward blocks connected by a residual stream. Different layers learn different patterns.
- **Ch 5: Generation** (`/05-generation`) — How models produce text one token at a time via autoregressive decoding. Prefill once, then decode step-by-step.
- **Ch 6: KV cache (internal)** (`/06-kv-cache`) — The runtime optimization: store Key and Value for each past token, so new tokens only compute K/V for themselves.
- **Ch 7: Claude Code prompt cache** (`/07-prompt-cache`) — The product feature that persists prefix state across API requests. Learn what gets cached, what invalidates it, and how to maximize hit rates.

## Project layout

```
src/
├── pages/              # Eight MDX chapters (file-based routing)
│   ├── index.mdx       # Ch 0
│   ├── 01-tokens.mdx   # Ch 1
│   └── ...
├── layouts/            # ChapterLayout.astro provides site shell and navigation
├── components/         # React islands and Astro components
│   ├── TokenChunks.tsx
│   ├── EmbeddingScatter.tsx
│   ├── AttentionMatrix.tsx
│   ├── LayerStack.tsx
│   ├── AutoregressiveStep.tsx
│   ├── KVCacheGrid.tsx
│   ├── RequestAnatomy.tsx
│   └── CacheCallout.astro
├── data/               # Hand-authored example data
│   ├── tokens.ts
│   ├── embeddings.ts
│   ├── attention.ts
│   ├── layers.ts
│   ├── generation.ts
│   ├── cache.ts
│   └── prompt-cache.ts
└── styles/             # Global CSS and CSS modules
```

## Multi-agent workflow

This site is built by multiple agents working in parallel on isolated Git worktrees, coordinated through a shared `tasks/` directory.

Each feature (scaffold, skeleton, each chapter, README) gets its own branch (`feat/<slug>`) and worktree (`.worktrees/feat-<slug>/`). Agents use `scripts/new-worktree.sh <slug>` to initialize. Commits form a granular changelog; branches merge back to main with `--no-ff` to preserve history. Inter-agent coordination happens through gitignored `tasks/<branch>.md` files and a shared `tasks/_shared.md` for cross-cutting decisions.

For full details on the workflow and implementation strategy, see `GOAL.md` and `AGENTS.md`.

## Non-goals

- Not a full machine learning course — no backprop, training, fine-tuning, rotary embeddings, or mixture-of-experts.
- No mathematical rigor beyond intuition — no matrix multiplication walk-throughs, no linear algebra proofs.
- No real tokenizer or model inference — all demo data is hand-authored and illustrative.
- No multi-language support, mobile-first design, or comprehensive accessibility audit.
- No dark mode, automated tests, backend, analytics, or telemetry in v1.
- No Tailwind, CSS-in-JS libraries, or component libraries — plain CSS only.
