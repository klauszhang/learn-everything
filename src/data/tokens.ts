// tokens.ts — illustrative pre-tokenized examples for Ch 1 demo.
// These are hand-authored to show how casing, punctuation, and word length
// affect token boundaries. They are NOT output from a real tokenizer.

export interface TokenExample {
  id: string;
  label: string;
  description: string;
  /** Each string is one token as it would appear to the model. */
  chunks: string[];
  /** Plausible token IDs, one per chunk (illustrative, not from a real tokenizer). */
  ids: number[];
}

export const TOKEN_EXAMPLES: TokenExample[] = [
  {
    id: "simple",
    label: "Simple sentence",
    description: "Common words each map to a single token.",
    chunks: ["The", " cat", " sat", " on", " the", " mat", "."],
    ids: [791, 5765, 7731, 389, 279, 2619, 13],
  },
  {
    id: "casing",
    label: "Casing and punctuation",
    description:
      "Uppercase and punctuation create extra splits — 'Hello' and 'hello' are different tokens.",
    chunks: [
      "Hello",
      ",",
      " world",
      "!",
      " It",
      "'s",
      " a",
      " sunny",
      " day",
      ".",
    ],
    ids: [9906, 11, 1917, 0, 1102, 596, 264, 40798, 1938, 13],
  },
  {
    id: "longword",
    label: "Long and rare words",
    description:
      "Uncommon or long words are split into sub-word pieces by the tokenizer.",
    chunks: [
      "Un",
      "token",
      "izable",
      " hyper",
      "parameter",
      " opt",
      "im",
      "ization",
      " is",
      " non",
      "trivial",
      ".",
    ],
    ids: [1844, 5765, 11588, 17508, 14066, 2709, 318, 2065, 374, 2536, 99584, 13],
  },
  {
    id: "special",
    label: "With special tokens",
    description:
      "The full sequence includes structural markers the model uses internally.",
    chunks: ["<BOS>", "The", " cat", " sat", ".", "<EOS>"],
    ids: [1, 791, 5765, 7731, 13, 2],
  },
];
