// attention.ts — illustrative (hand-authored) data for Ch 3 (03-attention.mdx)
// These are NOT real model outputs. They are simplified mock weights for teaching.
//
// Tokens represent a short English phrase: "The cat sat on the mat"
// plus a BOS marker and a separator — 8 tokens total.
//
// WEIGHTS[i][j] is the attention weight token i places on token j.
// Causal mask: only lower-triangular entries (j <= i) are non-zero.
// Each row sums to 1.0 (softmax-style). Upper triangle is 0 (masked).

export type AttentionData = {
  /** Token surface forms, in order. */
  tokens: string[];
  /**
   * Row-major attention weight matrix (N x N).
   * weights[i][j] = how much token i attends to token j.
   * Upper triangle (j > i) must be 0 — causal mask enforced.
   */
  weights: number[][];
};

const TOKENS: string[] = [
  "<s>",   // 0 — beginning-of-sequence marker
  "The",   // 1
  "cat",   // 2
  "sat",   // 3
  "on",    // 4
  "the",   // 5
  "mat",   // 6
  ".",     // 7 — period
];

// Hand-authored lower-triangular weight matrix.
// Rows sum to 1.0 within their visible (non-masked) positions.
// Weights reflect plausible (not model-computed) attention patterns:
//   - Verbs look back at their subject
//   - Articles strongly attend to their noun
//   - Punctuation distributes broadly across the sentence
const WEIGHTS: number[][] = [
  // <s> can only see itself
  [1.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  // "The" sees <s> and itself; article leans forward toward expected noun
  [0.20, 0.80, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  // "cat" — noun attends heavily to its determiner and <s>
  [0.10, 0.55, 0.35, 0.00, 0.00, 0.00, 0.00, 0.00],
  // "sat" — verb attends to subject "cat" most
  [0.05, 0.15, 0.50, 0.30, 0.00, 0.00, 0.00, 0.00],
  // "on" — preposition attends to verb "sat" and subject "cat"
  [0.05, 0.10, 0.25, 0.45, 0.15, 0.00, 0.00, 0.00],
  // "the" — article mostly attends to the preposition and itself
  [0.05, 0.10, 0.10, 0.20, 0.30, 0.25, 0.00, 0.00],
  // "mat" — noun attends to its determiner "the" and the verb "sat"
  [0.05, 0.05, 0.10, 0.25, 0.10, 0.35, 0.10, 0.00],
  // "." — punctuation distributes broadly; slight recency bias
  [0.05, 0.05, 0.10, 0.20, 0.10, 0.15, 0.25, 0.10],
];

export const attentionData: AttentionData = {
  tokens: TOKENS,
  weights: WEIGHTS,
};
