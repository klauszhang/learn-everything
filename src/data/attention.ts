// attention.ts — Ch 3 attention matrix data.
// Derived from the same Q/K vectors used in QKVProjection.tsx,
// with a causal mask applied (token i can only attend to positions 0..i).
//
// Sentence: "The cat sat on the mat"
// Weights are computed via: softmax(Q_i · K_j for j <= i, -∞ for j > i)

export type AttentionData = {
  tokens: string[];
  weights: number[][];
};

// Display labels (leading BPE spaces omitted for readability in the matrix UI)
const TOKENS: string[] = [
  "The",   // 0
  "cat",   // 1
  "sat",   // 2
  "on",    // 3
  "the",   // 4
  "mat",   // 5
];

// Causal attention weights computed from QKVProjection's Q/K vectors:
//   The:  Q=[0.30,-0.10,0.20,0.15]  K=[0.80,0.10,-0.20,0.30]
//   cat:  Q=[0.90,0.50,0.10,-0.30]  K=[0.20,0.90,0.60,-0.10]
//   sat:  Q=[0.10,0.80,0.50,0.20]   K=[0.50,0.30,0.80,0.40]
//   on:   Q=[0.40,0.20,0.70,0.50]   K=[-0.10,0.60,0.30,0.70]
//   the:  Q=[-0.20,0.30,0.60,0.80]  K=[0.70,0.20,-0.10,0.40]
//   mat:  Q=[0.60,0.70,0.30,-0.20]  K=[-0.30,0.40,0.50,0.90]
const WEIGHTS: number[][] = [
  // "The" — only sees itself
  [1.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  // "cat" — attends to "The" (49%) and itself (51%), its determiner
  [0.49, 0.51, 0.00, 0.00, 0.00, 0.00],
  // "sat" — attends most to "cat" (46%), its subject
  [0.19, 0.46, 0.35, 0.00, 0.00, 0.00],
  // "on" — attends to "sat" (35%), the verb it modifies
  [0.18, 0.24, 0.35, 0.23, 0.00, 0.00],
  // "the" — attends to "on" (30%) and "sat" (26%)
  [0.11, 0.19, 0.26, 0.30, 0.14, 0.00],
  // "mat" — attends most to "cat" (26%) and "sat" (19%)
  [0.15, 0.26, 0.19, 0.14, 0.16, 0.10],
];

export const attentionData: AttentionData = {
  tokens: TOKENS,
  weights: WEIGHTS,
};
