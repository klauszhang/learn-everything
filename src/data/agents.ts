/**
 * src/data/agents.ts — Hand-authored data for the agents chapter.
 *
 * IMPORTANT: All token counts, costs, and timings are ILLUSTRATIVE.
 * These are not real API measurements. Do not represent them as actual costs.
 *
 * Three sections:
 *   1. agentTrace       — scripted 8-step auth-fix debug session
 *   2. patternExamples  — prompt-chaining, routing, evaluator-optimizer
 *   3. stepBudgetData   — step-budget slider demo (budget levels 1–4)
 */

// ---------------------------------------------------------------------------
// Section 1: Multi-step agent trace (auth-fix debug session)
// ---------------------------------------------------------------------------

export type TurnType = "assistant" | "user" | "final";

export interface AgentTurn {
  /** Whether this is a model output, a tool result, or the final text-only response */
  type: TurnType;
  /** Tool invoked (null for user/tool-result turns and final turn) */
  toolName: string | null;
  /** Short label for what was called / returned */
  toolInput: string | null;
  /** One-sentence description of what this turn contains */
  content: string;
  /**
   * Running total of context tokens at the START of this turn (illustrative).
   * Grows by ~300–600 tokens per turn as conversation history accumulates.
   */
  totalContextTokens: number;
  /**
   * Tokens in the stable cached prefix (system prompt + tool defs).
   * Constant across all turns — this is what the prompt cache keeps warm.
   */
  cachedTokens: number;
}

/**
 * A scripted 8-turn trace of Claude Code fixing three failing auth tests.
 * Models the example from the dossier §1.
 *
 * Turn structure:
 *   assistant → tool call
 *   user      → tool result
 *   assistant → tool call
 *   user      → tool result
 *   ... repeat ...
 *   final     → plain text response, no tool call (loop exits)
 */
export const agentTrace: AgentTurn[] = [
  {
    type: "assistant",
    toolName: "Bash",
    toolInput: "npm test",
    content: "Claude decides to see current test output first — emits Bash tool call.",
    totalContextTokens: 2200,
    cachedTokens: 2000,
  },
  {
    type: "user",
    toolName: null,
    toolInput: null,
    content: "Test runner returns: 3 failures in auth.test.ts (token expiry, refresh, logout).",
    totalContextTokens: 2620,
    cachedTokens: 2000,
  },
  {
    type: "assistant",
    toolName: "Read",
    toolInput: "src/auth.ts",
    content: "Claude traces failures to auth.ts — emits Read tool call to inspect source.",
    totalContextTokens: 2780,
    cachedTokens: 2000,
  },
  {
    type: "user",
    toolName: null,
    toolInput: null,
    content: "File contents returned: 147 lines; token expiry check visible on line 83.",
    totalContextTokens: 5100,
    cachedTokens: 2000,
  },
  {
    type: "assistant",
    toolName: "Read",
    toolInput: "src/auth.test.ts",
    content: "Claude reads the test file to confirm expected behavior for expiry boundary.",
    totalContextTokens: 5280,
    cachedTokens: 2000,
  },
  {
    type: "user",
    toolName: null,
    toolInput: null,
    content: "Test file returned: tests assert >= boundary; source uses > (off-by-one).",
    totalContextTokens: 6700,
    cachedTokens: 2000,
  },
  {
    type: "assistant",
    toolName: "Edit",
    toolInput: "src/auth.ts line 83: > → >=",
    content: "Claude identifies the bug and emits an Edit tool call to fix the comparison.",
    totalContextTokens: 6880,
    cachedTokens: 2000,
  },
  {
    type: "user",
    toolName: null,
    toolInput: null,
    content: "Edit confirmed. Claude Code applies the change and returns success.",
    totalContextTokens: 7020,
    cachedTokens: 2000,
  },
  {
    type: "assistant",
    toolName: "Bash",
    toolInput: "npm test",
    content: "Claude runs tests again to verify the fix.",
    totalContextTokens: 7180,
    cachedTokens: 2000,
  },
  {
    type: "user",
    toolName: null,
    toolInput: null,
    content: "Test runner returns: all 3 tests now pass.",
    totalContextTokens: 7440,
    cachedTokens: 2000,
  },
  {
    type: "final",
    toolName: null,
    toolInput: null,
    content:
      'Fixed. The token expiry comparison on line 83 used ">" instead of ">=". All three tests now pass.',
    totalContextTokens: 7560,
    cachedTokens: 2000,
  },
];

// ---------------------------------------------------------------------------
// Section 2: Pattern examples
// ---------------------------------------------------------------------------

export type PatternName = "prompt-chaining" | "routing" | "evaluator-optimizer";

export interface PatternTurn {
  role: "system" | "call" | "result" | "final";
  label: string;
  content: string;
}

export interface PatternExample {
  patternName: PatternName;
  title: string;
  description: string;
  turns: PatternTurn[];
}

export const patternExamples: PatternExample[] = [
  {
    patternName: "prompt-chaining",
    title: "Prompt Chaining",
    description:
      "Sequential API calls where each step feeds the prior output to the next. Developer controls the sequence; the model fills in each step.",
    turns: [
      {
        role: "call",
        label: "Call 1 — Outline",
        content: 'System: "Produce a three-section outline for an article on prompt caching."',
      },
      {
        role: "result",
        label: "Result 1",
        content: "1. What is prompt caching? 2. Cache breakpoints and TTL. 3. Silent invalidators.",
      },
      {
        role: "call",
        label: "Call 2 — Expand",
        content: "System: \"Expand each section into two paragraphs.\" (Prior outline injected.)",
      },
      {
        role: "result",
        label: "Result 2",
        content: "Full 6-paragraph draft produced from the outline.",
      },
      {
        role: "call",
        label: "Call 3 — Translate",
        content: 'System: "Translate the draft into French, preserving technical terms." (Draft injected.)',
      },
      {
        role: "final",
        label: "Final",
        content: "French article delivered. Three calls, three sequential model invocations.",
      },
    ],
  },
  {
    patternName: "routing",
    title: "Routing",
    description:
      "A classifier call reads the input and routes it to one of several specialized downstream paths. Your code branches on the label.",
    turns: [
      {
        role: "call",
        label: "Call 1 — Classify",
        content:
          'System: "Is this query about billing, technical support, or account management?" Input: "Why was I charged twice?"',
      },
      {
        role: "result",
        label: "Result 1 — Label",
        content: 'Label: "billing"',
      },
      {
        role: "call",
        label: "Call 2 — Billing handler",
        content:
          'System: "You are the billing specialist…" (Different system prompt.) Input: routed query.',
      },
      {
        role: "final",
        label: "Final",
        content:
          "Billing-specific answer returned. The developer's code selected Call 2 based on the label from Call 1.",
      },
    ],
  },
  {
    patternName: "evaluator-optimizer",
    title: "Evaluator-Optimizer",
    description:
      "A generator produces output; an evaluator checks it against explicit criteria; the loop continues until the evaluator approves or a retry limit is hit.",
    turns: [
      {
        role: "call",
        label: "Call 1 — Generate",
        content:
          'System: "Write a function that validates a JWT token. It must handle null inputs." Tests provided.',
      },
      {
        role: "result",
        label: "Result 1 — Draft function",
        content: "Function generated — but omits null check on the payload field.",
      },
      {
        role: "call",
        label: "Call 2 — Evaluate",
        content:
          'Evaluator system: "Score this function against the rubric: handles null? yes/no…" Draft injected.',
      },
      {
        role: "result",
        label: "Result 2 — Critique",
        content: 'Verdict: "FAIL — missing null check on payload."',
      },
      {
        role: "call",
        label: "Call 3 — Revise",
        content: 'System: "Revise based on this critique." Critique injected.',
      },
      {
        role: "result",
        label: "Result 3 — Revised function",
        content: "Function revised with null guard added.",
      },
      {
        role: "call",
        label: "Call 4 — Evaluate again",
        content: "Evaluator re-runs on revised function.",
      },
      {
        role: "final",
        label: "Final — Approved",
        content: 'Verdict: "PASS — all criteria met." Loop exits.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Section 3: Step-budget demo data
// ---------------------------------------------------------------------------

export interface StepBudgetEntry {
  /** Budget level 1–4 */
  budget: 1 | 2 | 3 | 4;
  /** Human label for this budget tier */
  label: string;
  /** Steps the agent completes at this budget */
  completedSteps: string[];
  /** Final output the agent produces at this budget */
  outputSummary: string;
  /** Whether the task is fully done at this budget */
  accomplished: boolean;
}

/**
 * Four budget levels for a "fix failing auth tests" task.
 * Shows that step budgets are design parameters, not just safety valves.
 */
export const stepBudgetData: StepBudgetEntry[] = [
  {
    budget: 1,
    label: "Observer",
    completedSteps: ["Run tests → see failures"],
    outputSummary:
      "Found 3 failing tests in auth.test.ts. I need to inspect the source file to understand the cause.",
    accomplished: false,
  },
  {
    budget: 2,
    label: "Diagnoser",
    completedSteps: ["Run tests → see failures", "Read src/auth.ts → spot bug on line 83"],
    outputSummary:
      'The bug is on line 83: the token expiry check uses ">" instead of ">=". I would fix it by changing the operator.',
    accomplished: false,
  },
  {
    budget: 3,
    label: "Fixer",
    completedSteps: [
      "Run tests → see failures",
      "Read src/auth.ts → spot bug on line 83",
      'Edit src/auth.ts → change ">" to ">="',
    ],
    outputSummary:
      'Applied the fix. Changed ">" to ">=" on line 83. I should verify the tests pass before declaring done.',
    accomplished: false,
  },
  {
    budget: 4,
    label: "Verified fixer",
    completedSteps: [
      "Run tests → see failures",
      "Read src/auth.ts → spot bug on line 83",
      'Edit src/auth.ts → change ">" to ">="',
      "Run tests again → all 3 pass",
    ],
    outputSummary:
      'Done. All three tests pass. The token expiry comparison was using ">" instead of ">=". Fixed.',
    accomplished: true,
  },
];
