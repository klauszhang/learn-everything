/**
 * src/data/data-search.ts
 *
 * Hand-authored illustrative data for the Data Search Strategies chapter.
 * All examples are ILLUSTRATIVE — not derived from a real database or index.
 *
 * Covers:
 *  - Binary search worked example
 *  - Inverted index example (4 docs, 7 terms)
 *  - Strategy matrix (query type × data size → winning strategy)
 */

// ---------------------------------------------------------------------------
// Binary search worked example
// ---------------------------------------------------------------------------

export const binarySearchExample = {
  array: [3, 7, 9, 12, 18, 23, 31, 45],
  target: 23,
  steps: [
    { lo: 0, hi: 7, mid: 3, midVal: 12, action: "23 > 12 → go right" },
    { lo: 4, hi: 7, mid: 5, midVal: 23, action: "23 == 23 → found" },
  ],
};

// ---------------------------------------------------------------------------
// Inverted index example
// ---------------------------------------------------------------------------

export const invertedIndexExample = {
  docs: [
    { id: "d1", text: "the quick brown fox" },
    { id: "d2", text: "the slow brown dog" },
    { id: "d3", text: "the quick red fox" },
    { id: "d4", text: "a quick brown dog jumps" },
  ],
  terms: {
    quick: ["d1", "d3", "d4"],
    brown: ["d1", "d2", "d4"],
    fox:   ["d1", "d3"],
    slow:  ["d2"],
    dog:   ["d2", "d4"],
    red:   ["d3"],
    jumps: ["d4"],
  } as Record<string, string[]>,
  queries: [
    { q: "quick AND fox",  result: ["d1", "d3"] },
    { q: "slow OR red",    result: ["d2", "d3"] },
    { q: "brown AND dog",  result: ["d2", "d4"] },
  ],
};

// ---------------------------------------------------------------------------
// Strategy matrix
// ---------------------------------------------------------------------------

export type QueryType = "exact" | "range" | "prefix" | "fulltext" | "fuzzy";
export type DataSize  = "1K" | "1M" | "1B";

export type StrategyMatrixEntry = {
  queryType: QueryType;
  dataSize:  DataSize;
  medium?:   string;
  winner:    string;
  why:       string;
};

/**
 * Hand-authored decision matrix: query type × data size → recommended strategy.
 * Illustrative — the real answer depends on hardware, access patterns, and
 * update rates, but this captures the dominant recommendation in each cell.
 */
export const strategyMatrix: StrategyMatrixEntry[] = [
  // --- exact ---
  {
    queryType: "exact", dataSize: "1K", medium: "memory",
    winner: "Linear scan",
    why: "N is tiny. An index costs more to build than you'd ever save. Just loop.",
  },
  {
    queryType: "exact", dataSize: "1M", medium: "memory",
    winner: "Hash table",
    why: "O(1) average lookup. At 1 M rows the hash overhead is negligible.",
  },
  {
    queryType: "exact", dataSize: "1B", medium: "disk",
    winner: "B+-tree",
    why: "5 disk hops finds any row. Hash can't range-scan; B+-tree is the safe default.",
  },

  // --- range ---
  {
    queryType: "range", dataSize: "1K", medium: "memory",
    winner: "Linear scan",
    why: "Same as exact at 1 K: the sort cost outweighs the range benefit.",
  },
  {
    queryType: "range", dataSize: "1M", medium: "memory",
    winner: "Sorted array + binary search",
    why: "Binary-search the start, walk forward. Cache-friendly sequential read.",
  },
  {
    queryType: "range", dataSize: "1B", medium: "disk",
    winner: "B+-tree",
    why: "Leaf-chain is a doubly-linked list: find start, walk to end. No random hops.",
  },

  // --- prefix ---
  {
    queryType: "prefix", dataSize: "1K", medium: "memory",
    winner: "Linear scan",
    why: "Trie construction costs more than scanning 1 K strings.",
  },
  {
    queryType: "prefix", dataSize: "1M", medium: "memory",
    winner: "Trie / radix tree",
    why: "O(key length) lookup — cost scales with prefix length, not dataset size.",
  },
  {
    queryType: "prefix", dataSize: "1B", medium: "disk",
    winner: "Trie / radix tree",
    why: "Same advantage: prefix match depth is bounded by key length, not 1 B.",
  },

  // --- full-text ---
  {
    queryType: "fulltext", dataSize: "1K", medium: "memory",
    winner: "Linear scan",
    why: "At 1 K docs, scanning raw text is instant. Inverted index overhead isn't worth it.",
  },
  {
    queryType: "fulltext", dataSize: "1M", medium: "disk",
    winner: "Inverted index (BM25)",
    why: "Postings-list intersection returns candidates in milliseconds. BM25 ranks them.",
  },
  {
    queryType: "fulltext", dataSize: "1B", medium: "disk",
    winner: "Inverted index + two-stage rerank",
    why: "Stage 1: BM25 recall over postings lists. Stage 2: reranker precision over top-100.",
  },

  // --- fuzzy ---
  {
    queryType: "fuzzy", dataSize: "1K", medium: "memory",
    winner: "Linear scan + edit distance",
    why: "1 K comparisons with edit distance is fast enough; no specialized index needed.",
  },
  {
    queryType: "fuzzy", dataSize: "1M", medium: "memory",
    winner: "BK-tree or n-gram index",
    why: "BK-tree prunes by triangle inequality. N-gram index on trigrams also works well.",
  },
  {
    queryType: "fuzzy", dataSize: "1B", medium: "disk",
    winner: "N-gram inverted index + rerank",
    why: "Stage 1: trigram postings for candidate recall. Stage 2: edit-distance rerank.",
  },
];
