/**
 * Hand-authored data for the Sampling chapter.
 * All logit values are illustrative — not from a real model.
 * Prefix: "The cat sat on the ___"
 */

export const PREFIX = "The cat sat on the ___";

export interface TokenCandidate {
  token: string;
  logit: number;
}

/** ~10 candidate next-tokens with illustrative logit values. */
export const CANDIDATES: TokenCandidate[] = [
  { token: "mat",     logit: 4.5 },
  { token: "floor",   logit: 3.2 },
  { token: "couch",   logit: 2.8 },
  { token: "roof",    logit: 2.2 },
  { token: "table",   logit: 1.9 },
  { token: "stairs",  logit: 1.3 },
  { token: "fence",   logit: 0.8 },
  { token: "keyboard",logit: 0.3 },
  { token: "moon",    logit: -0.2 },
  { token: "concept", logit: -1.1 },
];

/** Compute softmax probabilities for an array of logits at a given temperature. */
export function softmax(logits: number[], temperature: number): number[] {
  const scaled = logits.map((l) => l / Math.max(temperature, 1e-6));
  const maxVal = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - maxVal)); // stable softmax
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Pre-computed probabilities at the four displayed temperatures. */
export const TEMPERATURES = [0.3, 0.5, 1.0, 2.0] as const;
export type Temperature = (typeof TEMPERATURES)[number];

const logits = CANDIDATES.map((c) => c.logit);

export const PROBS: Record<number, number[]> = Object.fromEntries(
  TEMPERATURES.map((t) => [t, softmax(logits, t)])
);

/**
 * Worked two-token example from the research dossier.
 * Token A logit = 3.0, Token B logit = 1.0.
 */
export interface WorkedRow {
  temperature: number;
  probA: number;
  probB: number;
}

export const WORKED_EXAMPLE: WorkedRow[] = [
  { temperature: 1.0, probA: 0.88, probB: 0.12 },
  { temperature: 0.5, probA: 0.98, probB: 0.02 },
  { temperature: 2.0, probA: 0.73, probB: 0.27 },
];
