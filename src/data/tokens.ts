// tokens.ts — illustrative pre-tokenized examples for Ch 1 demo.
// These are hand-authored to show how casing, punctuation, and word length
// affect token boundaries. They are NOT output from a real tokenizer.

export interface TokenExample {
  id: string;
  label: string;
  description: string;
  /** Each string is one token as it would appear to the model. */
  chunks: string[];
}

export const TOKEN_EXAMPLES: TokenExample[] = [
  {
    id: "simple",
    label: "Simple sentence",
    description: "Common words each map to a single token.",
    chunks: ["The", " cat", " sat", " on", " the", " mat", "."],
  },
  {
    id: "casing",
    label: "Casing and punctuation",
    description:
      "Uppercase and punctuation create extra token splits — 'Hello' and 'hello' are different tokens.",
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
  },
];
