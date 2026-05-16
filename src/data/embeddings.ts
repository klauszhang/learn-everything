// embeddings.ts — illustrative data for Ch 2 (02-embeddings.mdx)
// These are hand-authored 2D coordinates and truncated 6-dim vectors.
// They do NOT come from a real model — they are chosen to demonstrate
// how semantically similar tokens cluster in embedding space.

export type EmbeddingPoint = {
  token: string;
  x: number; // 2D scatter coordinate (illustrative)
  y: number;
  vector: number[]; // 6-dim truncated embedding (illustrative)
  cluster: string;  // semantic group label
};

// Clusters:
//   "royalty"  — king, queen, prince (top-left region)
//   "gender"   — man, woman (center-left)
//   "science"  — atom, gravity (bottom-right)
//   "animal"   — cat, dog (top-right)
//   "number"   — one (center-bottom)

export const embeddings: EmbeddingPoint[] = [
  {
    token: "king",
    x: 1.2,
    y: 8.5,
    vector: [0.82, 0.76, 0.11, -0.31, 0.04, 0.55],
    cluster: "royalty",
  },
  {
    token: "queen",
    x: 1.8,
    y: 7.6,
    vector: [0.78, 0.71, -0.14, 0.29, 0.07, 0.52],
    cluster: "royalty",
  },
  {
    token: "prince",
    x: 2.4,
    y: 8.1,
    vector: [0.75, 0.68, 0.08, -0.18, -0.02, 0.49],
    cluster: "royalty",
  },
  {
    token: "man",
    x: 3.5,
    y: 5.8,
    vector: [0.41, 0.38, 0.09, -0.52, 0.13, 0.22],
    cluster: "gender",
  },
  {
    token: "woman",
    x: 3.9,
    y: 5.1,
    vector: [0.38, 0.35, -0.11, 0.48, 0.10, 0.20],
    cluster: "gender",
  },
  {
    token: "cat",
    x: 7.8,
    y: 8.2,
    vector: [-0.12, 0.15, 0.62, 0.57, -0.43, 0.08],
    cluster: "animal",
  },
  {
    token: "dog",
    x: 8.5,
    y: 7.5,
    vector: [-0.09, 0.18, 0.65, 0.61, -0.38, 0.11],
    cluster: "animal",
  },
  {
    token: "atom",
    x: 7.2,
    y: 2.1,
    vector: [0.05, -0.22, 0.14, -0.08, 0.71, -0.55],
    cluster: "science",
  },
  {
    token: "gravity",
    x: 8.1,
    y: 2.8,
    vector: [0.02, -0.19, 0.11, -0.05, 0.68, -0.52],
    cluster: "science",
  },
  {
    token: "one",
    x: 4.9,
    y: 2.4,
    vector: [0.11, 0.05, -0.08, 0.03, 0.16, -0.22],
    cluster: "number",
  },
];

// Nearest neighbors by Euclidean distance in 2D (pre-computed, illustrative)
export const nearestNeighbors: Record<string, string[]> = {
  king:    ["queen", "prince", "man"],
  queen:   ["king", "prince", "woman"],
  prince:  ["king", "queen", "man"],
  man:     ["woman", "king", "queen"],
  woman:   ["man", "queen", "king"],
  cat:     ["dog", "gravity", "atom"],
  dog:     ["cat", "gravity", "atom"],
  atom:    ["gravity", "dog", "cat"],
  gravity: ["atom", "dog", "cat"],
  one:     ["man", "woman", "atom"],
};

export const clusterColors: Record<string, string> = {
  royalty: "#6366f1", // indigo
  gender:  "#10b981", // emerald
  animal:  "#f97316", // orange
  science: "#8b5cf6", // violet
  number:  "#6b7280", // gray
};
