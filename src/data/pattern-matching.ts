// pattern-matching.ts — hand-authored, illustrative data for PatternMatchStepper.
// All traces are manually computed, clearly labeled as illustrative.

export const haystack = "ABABABCABABABABCABABC";
export const needle   = "ABABC";

export type AlgorithmStep = {
  textPos: number;     // alignment start in text (leftmost char of pattern window)
  patternPos: number;  // which pattern char is being compared right now
  isMatch: boolean;    // did this specific character comparison succeed?
  jumped?: number;     // positions shifted after mismatch (KMP/BM only)
  note?: string;       // optional annotation shown in UI
};

// ──────────────────────────────────────────────────────────────
// NAIVE — restart at textPos+1 on every mismatch
// ──────────────────────────────────────────────────────────────
export const naiveSteps: AlgorithmStep[] = [
  // alignment 0: ABABC vs ABABC[0..4] — full match
  { textPos: 0, patternPos: 0, isMatch: true },
  { textPos: 0, patternPos: 1, isMatch: true },
  { textPos: 0, patternPos: 2, isMatch: true },
  { textPos: 0, patternPos: 3, isMatch: true },
  { textPos: 0, patternPos: 4, isMatch: false, note: "text[4]='B' ≠ 'C'" },
  // alignment 1
  { textPos: 1, patternPos: 0, isMatch: false, note: "text[1]='B' ≠ 'A'" },
  // alignment 2
  { textPos: 2, patternPos: 0, isMatch: true },
  { textPos: 2, patternPos: 1, isMatch: true },
  { textPos: 2, patternPos: 2, isMatch: true },
  { textPos: 2, patternPos: 3, isMatch: true },
  { textPos: 2, patternPos: 4, isMatch: true, note: "MATCH at 2" },
  // alignment 3 (continue scanning)
  { textPos: 3, patternPos: 0, isMatch: false, note: "text[3]='B' ≠ 'A'" },
  // alignment 4
  { textPos: 4, patternPos: 0, isMatch: true },
  { textPos: 4, patternPos: 1, isMatch: true },
  { textPos: 4, patternPos: 2, isMatch: true },
  { textPos: 4, patternPos: 3, isMatch: false, note: "text[7]='C' ≠ 'B'" },
  // alignment 5
  { textPos: 5, patternPos: 0, isMatch: false, note: "text[5]='B' ≠ 'A'" },
  // alignment 6
  { textPos: 6, patternPos: 0, isMatch: false, note: "text[6]='C' ≠ 'A'" },
  // alignment 7
  { textPos: 7, patternPos: 0, isMatch: false, note: "text[7]='C' ≠ 'A'" },
  // alignment 8 — second MATCH
  { textPos: 8, patternPos: 0, isMatch: true },
  { textPos: 8, patternPos: 1, isMatch: true },
  { textPos: 8, patternPos: 2, isMatch: true },
  { textPos: 8, patternPos: 3, isMatch: true },
  { textPos: 8, patternPos: 4, isMatch: true, note: "MATCH at 8" },
];

// ──────────────────────────────────────────────────────────────
// KMP — failure table for ABABC: [0, 0, 1, 2, 0]
// ──────────────────────────────────────────────────────────────
export const kmpSteps: AlgorithmStep[] = [
  // textPos=0, match ABAB then fail on C vs B
  { textPos: 0, patternPos: 0, isMatch: true },
  { textPos: 0, patternPos: 1, isMatch: true },
  { textPos: 0, patternPos: 2, isMatch: true },
  { textPos: 0, patternPos: 3, isMatch: true },
  { textPos: 0, patternPos: 4, isMatch: false, jumped: 2, note: "fail[3]=2 → skip to pattern[2]" },
  // now textPos advances to 2, patternPos resumes at 2
  { textPos: 2, patternPos: 2, isMatch: true },
  { textPos: 2, patternPos: 3, isMatch: true },
  { textPos: 2, patternPos: 4, isMatch: true, note: "MATCH at 2" },
  // continue from textPos=7, patternPos=0
  { textPos: 7, patternPos: 0, isMatch: false, note: "text[7]='C' ≠ 'A'" },
  { textPos: 8, patternPos: 0, isMatch: true },
  { textPos: 8, patternPos: 1, isMatch: true },
  { textPos: 8, patternPos: 2, isMatch: true },
  { textPos: 8, patternPos: 3, isMatch: true },
  { textPos: 8, patternPos: 4, isMatch: true, note: "MATCH at 8" },
];

// ──────────────────────────────────────────────────────────────
// BOYER-MOORE — right-to-left comparison, bad-char skip
// ──────────────────────────────────────────────────────────────
export const bmSteps: AlgorithmStep[] = [
  // align at 0, compare from right: pattern[4]='C' vs text[4]='B' → mismatch
  { textPos: 0, patternPos: 4, isMatch: false, jumped: 2, note: "bad-char 'B': rightmost in ABABC is pos 3 → shift 1; good-suffix shifts 2" },
  // align at 2, compare right-to-left
  { textPos: 2, patternPos: 4, isMatch: true },
  { textPos: 2, patternPos: 3, isMatch: true },
  { textPos: 2, patternPos: 2, isMatch: true },
  { textPos: 2, patternPos: 1, isMatch: true },
  { textPos: 2, patternPos: 0, isMatch: true, note: "MATCH at 2" },
  // resume from 7
  { textPos: 7, patternPos: 4, isMatch: false, jumped: 5, note: "bad-char 'C': not useful → shift full pattern length" },
  // align at 8
  { textPos: 8, patternPos: 4, isMatch: true },
  { textPos: 8, patternPos: 3, isMatch: true },
  { textPos: 8, patternPos: 2, isMatch: true },
  { textPos: 8, patternPos: 1, isMatch: true },
  { textPos: 8, patternPos: 0, isMatch: true, note: "MATCH at 8" },
];

// ──────────────────────────────────────────────────────────────
// Regex-engine family attributes table
// ──────────────────────────────────────────────────────────────
export type RegexFamily = {
  family: "RE2 / Thompson NFA" | "PCRE / Backtracking";
  linearTime: boolean;
  backreferences: boolean;
  lookaround: boolean;
  tools: string[];
};

export const regexFamilies: RegexFamily[] = [
  {
    family: "RE2 / Thompson NFA",
    linearTime: true,
    backreferences: false,
    lookaround: false,
    tools: ["RE2 (C++)", "Go regexp", "Rust regex", "ripgrep"],
  },
  {
    family: "PCRE / Backtracking",
    linearTime: false,
    backreferences: true,
    lookaround: true,
    tools: ["Perl", "Python re", "JS RegExp", "Java java.util.regex", "PCRE2"],
  },
];
