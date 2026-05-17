// src/data/tool-use.ts
// Hand-authored illustrative data for the tool-use chapter.
// All tool calls, results, and conversations are fabricated for teaching purposes.

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const mockTools: ToolDefinition[] = [
  {
    name: "read_file",
    description:
      "Read the contents of a source file. Returns full text. Use before editing.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repo-relative path to the file.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_codebase",
    description:
      "Grep the codebase for a pattern. Returns matching lines with file and line number.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex or literal string to search for.",
        },
        file_glob: {
          type: "string",
          description: "Optional glob to restrict search (e.g. '*.ts').",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_tests",
    description:
      "Run the test suite and return a pass/fail summary with any error output.",
    input_schema: {
      type: "object",
      properties: {
        test_path: {
          type: "string",
          description:
            "Optional path to a specific test file or directory.",
        },
      },
      required: [],
    },
  },
];

export type StepKind =
  | "user"
  | "assistant_text"
  | "tool_use"
  | "tool_result"
  | "assistant_final";

export interface ConversationStep {
  kind: StepKind;
  /** Display label for the left (conversation) panel */
  label: string;
  /** Main content — prose, JSON snippet, or file output */
  content: string;
  /** Optional annotation for the right (harness) panel */
  harnessNote?: string;
  /** Optional sub-label (e.g. tool name) */
  subLabel?: string;
}

// A scripted 6-turn conversation:
//  1 user message → 1 tool_use (read_file) → 1 tool_result → 1 tool_use (run_tests)
//  → 1 tool_result → 1 final assistant text
export const toolUseSteps: ConversationStep[] = [
  {
    kind: "user",
    label: "User message",
    content:
      "The validateEmail function looks broken. Can you check the source and run the tests?",
    harnessNote: "Request sent to API with tools array + conversation history.",
  },
  {
    kind: "tool_use",
    label: "Model emits tool_use",
    subLabel: "read_file",
    content: JSON.stringify(
      {
        type: "tool_use",
        id: "toolu_01abc",
        name: "read_file",
        input: { path: "src/utils/email.ts" },
      },
      null,
      2
    ),
    harnessNote:
      "stop_reason: \"tool_use\" — harness extracts name + input, calls read_file().",
  },
  {
    kind: "tool_result",
    label: "Harness sends tool_result",
    subLabel: "read_file result",
    content: `export function validateEmail(email: string): boolean {
  // BUG: missing + after [a-zA-Z0-9._-]
  return /^[a-zA-Z0-9._-]@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/.test(email);
}`,
    harnessNote:
      "tool_use_id: \"toolu_01abc\" — result injected as user message back to API.",
  },
  {
    kind: "tool_use",
    label: "Model emits tool_use",
    subLabel: "run_tests",
    content: JSON.stringify(
      {
        type: "tool_use",
        id: "toolu_02def",
        name: "run_tests",
        input: { test_path: "src/utils/email.test.ts" },
      },
      null,
      2
    ),
    harnessNote:
      "stop_reason: \"tool_use\" — harness calls run_tests(). Loop continues.",
  },
  {
    kind: "tool_result",
    label: "Harness sends tool_result",
    subLabel: "run_tests result",
    content: `FAIL src/utils/email.test.ts
  ✕ accepts valid email (8ms)
    Expected: true
    Received: false

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total`,
    harnessNote:
      "tool_use_id: \"toolu_02def\" — error output returned. Model now has both results in context.",
  },
  {
    kind: "assistant_final",
    label: "Model final reply",
    content:
      "Found the bug. The regex in validateEmail is missing a + quantifier — it only allows exactly one character before the @. The fix is to change [a-zA-Z0-9._-] to [a-zA-Z0-9._-]+ on line 3. The test confirms it: a valid address like user@example.com fails because \"user\" is more than one character.",
    harnessNote:
      "stop_reason: \"end_turn\" — harness exits the loop and returns the final reply.",
  },
];
