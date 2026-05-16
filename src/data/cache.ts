// cache.ts — data for Ch 6 (06-kv-cache.mdx) KV cache internal demo.
// Ch 7 owns src/data/prompt-cache.ts — no conflict.
//
// All numbers are illustrative and hand-authored. They are NOT real model measurements.

/** Number of transformer layers in the illustrative model. */
export const LAYER_COUNT = 4;

/**
 * The token sequence used in the demo.
 * Index 0 = prompt tokens (prefill); the rest are generated one at a time.
 */
export const TOKENS: readonly string[] = [
  "The",
  "cat",
  "sat",
  "on",
  "the",
  "mat",
  "quietly",
  "and",
];

/** Number of prompt tokens (fixed prefix — processed during prefill). */
export const PREFILL_TOKEN_COUNT = 4;

/**
 * Illustrative relative FLOPs per decode step.
 * "No cache" re-processes all previous tokens through all layers at every step.
 * "With cache" only processes the single new token at every step.
 *
 * Values are proportional to (tokens_seen × LAYER_COUNT).
 * Labeled illustrative in the demo UI.
 */
export type StepCost = {
  step: number;
  /** Token being generated at this step (index into TOKENS). */
  tokenIndex: number;
  /** Display label for the token being added. */
  token: string;
  /**
   * Relative FLOPs without KV cache: must re-process all tokens seen so far
   * through every layer. Grows as O(t × L) per step.
   */
  noCacheFlops: number;
  /**
   * Relative FLOPs with KV cache: only the new token needs Q/K/V computed.
   * Cached K/V for prior tokens are read from memory, not recomputed.
   * Stays O(L) per step regardless of sequence length.
   */
  withCacheFlops: number;
};

/**
 * Per-step cost table for the decode phase.
 * Step 0 = generating TOKENS[PREFILL_TOKEN_COUNT], etc.
 *
 * Unit: arbitrary "FLOPs units" where 1 unit = cost of processing 1 token through 1 layer.
 * No-cache cost at step s = (PREFILL_TOKEN_COUNT + s + 1) * LAYER_COUNT
 * With-cache cost at step s = LAYER_COUNT (only the new token)
 */
export const STEP_COSTS: readonly StepCost[] = (() => {
  const decodeTokens = TOKENS.slice(PREFILL_TOKEN_COUNT);
  return decodeTokens.map((token, s) => ({
    step: s,
    tokenIndex: PREFILL_TOKEN_COUNT + s,
    token,
    noCacheFlops: (PREFILL_TOKEN_COUNT + s + 1) * LAYER_COUNT,
    withCacheFlops: LAYER_COUNT,
  }));
})();

/** Total FLOPs across all decode steps, no cache. */
export const TOTAL_NO_CACHE_FLOPS: number = STEP_COSTS.reduce(
  (acc, s) => acc + s.noCacheFlops,
  0
);

/** Total FLOPs across all decode steps, with cache. */
export const TOTAL_WITH_CACHE_FLOPS: number = STEP_COSTS.reduce(
  (acc, s) => acc + s.withCacheFlops,
  0
);
