// generation.ts — illustrative data for Ch 5 (05-generation.mdx)
// This data is hand-authored for teaching purposes — not real model output.

export interface GenerationStep {
  /** Tokens in the sequence at this step (prompt + generated so far) */
  tokens: string[];
  /** Phase: "prefill" = processing the full prompt, "decode" = adding a new token */
  phase: "prefill" | "decode";
  /** Brief description of what the model is doing at this step */
  note: string;
}

/** The initial prompt tokens (prefill phase) */
export const PROMPT_TOKENS: string[] = ["The", " sky", " is"];

/** Tokens generated one at a time during the decode phase */
export const GENERATED_TOKENS: string[] = [" blue", " and", " full", " of", " bright", " stars"];

/**
 * Full sequence of generation steps, starting from prefill and walking
 * through each decode step. Illustrative — not real model output.
 */
export const GENERATION_STEPS: GenerationStep[] = [
  {
    tokens: [...PROMPT_TOKENS],
    phase: "prefill",
    note: "Prefill: the entire prompt is processed through all layers in one forward pass.",
  },
  {
    tokens: [...PROMPT_TOKENS, GENERATED_TOKENS[0]],
    phase: "decode",
    note: `Decode step 1: the model predicts "${GENERATED_TOKENS[0].trim()}" and appends it to the sequence.`,
  },
  {
    tokens: [...PROMPT_TOKENS, ...GENERATED_TOKENS.slice(0, 2)],
    phase: "decode",
    note: `Decode step 2: the model predicts "${GENERATED_TOKENS[1].trim()}" and appends it.`,
  },
  {
    tokens: [...PROMPT_TOKENS, ...GENERATED_TOKENS.slice(0, 3)],
    phase: "decode",
    note: `Decode step 3: the model predicts "${GENERATED_TOKENS[2].trim()}" and appends it.`,
  },
  {
    tokens: [...PROMPT_TOKENS, ...GENERATED_TOKENS.slice(0, 4)],
    phase: "decode",
    note: `Decode step 4: the model predicts "${GENERATED_TOKENS[3].trim()}" and appends it.`,
  },
  {
    tokens: [...PROMPT_TOKENS, ...GENERATED_TOKENS.slice(0, 5)],
    phase: "decode",
    note: `Decode step 5: the model predicts "${GENERATED_TOKENS[4].trim()}" and appends it.`,
  },
  {
    tokens: [...PROMPT_TOKENS, ...GENERATED_TOKENS.slice(0, 6)],
    phase: "decode",
    note: `Decode step 6: the model predicts "${GENERATED_TOKENS[5].trim()}" and appends it.`,
  },
];
