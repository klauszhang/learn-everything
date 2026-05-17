/**
 * Long-context behavior chapter data.
 * All data is hand-authored and illustrative — not from real model evaluations.
 */

/**
 * Needle-position × recall data.
 * Illustrative U-curve consistent with Liu et al. (2023) direction.
 * Numbers are NOT from a real model evaluation.
 */
export type NeedleRecallPoint = {
  /** Position in context: 0.0 = start, 1.0 = end */
  position: number;
  /** Illustrative recall percentage (0–100) */
  recall: number;
};

/**
 * Distractor count × recall data.
 * Illustrative monotonic decline consistent with multi-document QA literature.
 * Numbers are NOT from a real model evaluation.
 */
export type DistractorRecallPoint = {
  /** Number of irrelevant but topically similar documents */
  distractors: number;
  /** Illustrative recall percentage (0–100) */
  recall: number;
};

/**
 * KV cache memory scaling by context length.
 * Relative sizes are mathematically exact (linear scaling).
 * Absolute memory values are model-dependent and not stated.
 */
export type KVScalePoint = {
  /** Context length in tokens */
  tokens: number;
  /** Memory relative to the 32K baseline (32K = 1.0) */
  relative: number;
  /** Human-readable label */
  label: string;
};

// Illustrative — U-curve direction from Liu et al. (2023); numbers are not from a real model evaluation.
export const needleRecall: NeedleRecallPoint[] = [
  { position: 0.00, recall: 91 },
  { position: 0.05, recall: 89 },
  { position: 0.10, recall: 86 },
  { position: 0.15, recall: 82 },
  { position: 0.20, recall: 76 },
  { position: 0.25, recall: 70 },
  { position: 0.30, recall: 65 },
  { position: 0.35, recall: 61 },
  { position: 0.40, recall: 58 },
  { position: 0.45, recall: 56 },
  { position: 0.50, recall: 55 }, // midpoint nadir
  { position: 0.55, recall: 57 },
  { position: 0.60, recall: 60 },
  { position: 0.65, recall: 65 },
  { position: 0.70, recall: 71 },
  { position: 0.75, recall: 78 },
  { position: 0.80, recall: 83 },
  { position: 0.85, recall: 87 },
  { position: 0.90, recall: 90 },
  { position: 1.00, recall: 92 },
];

// Illustrative — direction consistent with multi-document QA literature; numbers are not from a real model evaluation.
export const distractorRecall: DistractorRecallPoint[] = [
  { distractors: 0,  recall: 94 },
  { distractors: 2,  recall: 86 },
  { distractors: 5,  recall: 76 },
  { distractors: 10, recall: 66 },
  { distractors: 20, recall: 57 },
  { distractors: 40, recall: 50 },
];

// KV cache memory scales linearly with context length; relative sizes are exact given the linear relationship.
export const kvScaleData: KVScalePoint[] = [
  { tokens: 32_000,    relative: 1.00,  label: '32K' },
  { tokens: 128_000,   relative: 4.00,  label: '128K' },
  { tokens: 500_000,   relative: 15.63, label: '500K' },
  { tokens: 1_000_000, relative: 31.25, label: '1M' },
];
