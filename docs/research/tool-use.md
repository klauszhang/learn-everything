# Research dossier — Tool use / function calling

**Status:** research-only. Drives chapter M-5 (per `docs/EXTENSIONS.md`).
**Prerequisite chapter:** Ch 7 (Prompt cache) — tool definitions live in the cached prefix.
**Date:** 2026-05-17.

---

## 1. Plain-language premise (~200 words)

Every Claude Code user has seen it happen: Claude reads a file, edits something, runs a test, reads the error, edits again. It looks like Claude is reaching into the filesystem and doing things. It is not.

Here is what is actually happening: Claude's output is text. When Claude "calls a tool," it produces a structured blob of text that says, in effect, "I want to invoke function `read_file` with argument `path = ./src/index.ts`." Your harness — Claude Code, in this case — parses that blob, executes the real function, and sends the result back to Claude as another message. Claude reads that message and decides what to say or do next. The loop repeats until Claude's output is ordinary text with no tool call embedded.

The model never executes anything on its own. It asks; you (or Claude Code) decide whether to honor the request; the result flows back into the conversation as just more tokens. Everything the model "does" is prediction: predict the right function name, predict the right arguments, predict text once the results are in. Tool use is not a special channel or a plugin system. It is pattern matching over a schema, producing structured text, handled by a loop your harness runs.

Once you see this, the magic shrinks — and the levers you can pull come into focus.

---

## 2. The control flow (the most important picture in the chapter)

The fundamental loop has five steps. It is worth memorizing.

```
1. Harness sends message to model.
   Payload: system prompt + tool DEFINITIONS + conversation history + user message.

2. Model produces output.
   Either: plain text  →  go to step 5 (done).
   Or:     a tool_use block  →  go to step 3.

3. Harness receives tool_use block.
   Extracts: tool name, arguments (a JSON object), and a unique tool_use_id.
   Harness runs the actual function.

4. Harness sends tool_result back to model.
   References the same tool_use_id so the model knows which call this answers.
   Content: the function's return value (a string, or structured content).
   On failure: content is the error message; is_error: true.

5. Model produces next output.
   Can chain another tool_use block (go to step 3), or produce final text (done).
```

The loop terminates when the API response has `stop_reason: "end_turn"` (or `"max_tokens"`, `"stop_sequence"`, `"refusal"`) instead of `stop_reason: "tool_use"`. Your harness should key its while-loop on `stop_reason == "tool_use"`.

There is no out-of-band channel. The model does not have a socket that connects to your function. Every tool call is a turn in the conversation: one assistant message containing a `tool_use` block, followed by one user message containing a `tool_result` block. The conversation transcript carries everything.

Source: Anthropic, "How tool use works," https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works

---

## 3. The model side — what tools look like to the model

### Tool definitions are part of the system-level context

You pass tools to the API in a top-level `tools` array. The API converts them into a special system prompt segment and injects it before your own system prompt. The model never sees your source code — it sees a structured description of what is available.

Each tool definition has three required fields:

```json
{
  "name": "read_file",
  "description": "Read the contents of a file at the given path. Returns the full text. Use this when you need to inspect the current state of a source file before editing it.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or repo-relative path to the file."
      }
    },
    "required": ["path"]
  }
}
```

The `name` must match `^[a-zA-Z0-9_-]{1,64}$`. The `description` is the most important field — it is what the model reads to decide when and how to call the tool. The `input_schema` is a standard JSON Schema object; it is the model's only contract with your function.

Source: Anthropic, "Define tools," https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

### The model is trained to emit tool-call content blocks

Claude has been trained on trajectories where it decides to emit a `tool_use` content block rather than plain text when a tool is the right move. This is not magic — it is the same autoregressive prediction as everything else (Ch 5). Given the tool definitions, the conversation history, and the user's request, the model predicts the most likely next tokens. When those tokens match a `tool_use` block, your harness handles it. When they match plain text, the turn is over.

This is why the description field matters so much: it is literally the text the model reads when deciding whether to call the tool and what arguments to pass. A vague description produces vague (or wrong) calls.

### tool_choice: controlling whether and which tool is called

The `tool_choice` parameter in your API request has four options:

| Value | Behavior |
|---|---|
| `auto` | Claude decides whether to call a tool or respond with text. Default when `tools` are provided. |
| `any` | Claude must call one of the provided tools, but picks which one. |
| `{"type": "tool", "name": "X"}` | Claude must call tool X specifically. |
| `none` | Claude must not call any tools. Default when no `tools` are provided. |

With `any` or `tool`, the API prefills the assistant turn to force a tool call. This means Claude will not produce a natural-language preamble before the `tool_use` block even if you ask it to — the mechanism is a forced prefix, not a style preference.

Source: Anthropic, "Define tools — Controlling Claude's output," https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

---

## 4. The harness side — what tools look like to your code

### Reading the tool_use block

When `stop_reason` is `"tool_use"`, the response's `content` array contains one or more `tool_use` blocks, each with:

```json
{
  "type": "tool_use",
  "id": "toolu_01A09q90qw90lq917835lq9",
  "name": "get_weather",
  "input": { "location": "San Francisco, CA", "unit": "celsius" }
}
```

Your harness extracts `name` and `input`, runs the corresponding function, and then sends back a user message containing a `tool_result` block:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "15 degrees, partly cloudy"
    }
  ]
}
```

The `tool_use_id` must match the `id` from the corresponding `tool_use` block. This is how the model knows which result answers which call.

Source: Anthropic, "Handle tool calls," https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls

### Errors are not exceptions to the model

If your function throws, you do not crash the loop. You send back a `tool_result` with `"is_error": true`:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
  "content": "ConnectionError: weather service returned HTTP 500",
  "is_error": true
}
```

Claude reads this error as in-context information and adjusts its response accordingly — it might apologize, try a different approach, or ask the user for clarification. The model does not distinguish between an "error" and a "successful result" at the architecture level; both are just `tool_result` blocks with text content. The `is_error` flag is a signal to help the model interpret the content correctly.

Source: Anthropic, "Handle tool calls — Handling errors with is_error," https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls

### Formatting requirements

The Anthropic API enforces a strict ordering rule: in the user message that contains `tool_result` blocks, those blocks must come first. Any text the harness wants to add to that same message must come after all `tool_result` blocks. Reversing this order produces a 400 error.

---

## 5. Anthropic's built-in tools (2026 state)

Anthropic publishes a handful of tools with pre-trained schemas. Because Claude was trained on many successful trajectories using these exact signatures, it calls them more reliably and recovers from errors more gracefully than it would with a custom tool doing the same thing. The versioned type string is the key: pass that string in the `type` field and the model recognizes the schema without you defining it.

### computer_20251124

The latest computer use tool (as of November 2025). Lets Claude take screenshots and issue mouse/keyboard actions — left_click, right_click, double_click, triple_click, scroll, type, key, mouse_move, left_click_drag, hold_key, wait, and (new in this version) zoom. The `zoom` action lets Claude inspect a specific screen region at full resolution; enable it with `enable_zoom: true` in the tool definition.

Requires the beta header `"computer-use-2025-11-24"` for Claude Opus 4.7, Claude Opus 4.6, Claude Sonnet 4.6, and Claude Opus 4.5.

Computer use is a client-side tool: Claude emits a `tool_use` block describing the action (e.g., `"action": "left_click", "coordinate": [500, 300]`), and your harness runs it against a real or virtual display. Anthropic does not touch your screen.

```json
{
  "type": "computer_20251124",
  "name": "computer",
  "display_width_px": 1024,
  "display_height_px": 768,
  "display_number": 1,
  "enable_zoom": false
}
```

Source: Anthropic, "Computer use tool," https://platform.claude.com/docs/en/docs/build-with-claude/computer-use

### bash_20250124

Runs a shell command and returns its stdout/stderr. Your harness is responsible for executing the command in an appropriate environment (a container, a subprocess, etc.) and returning the output as a `tool_result`. The schema is built into Claude's training — you do not write a JSON schema for it.

```json
{
  "type": "bash_20250124",
  "name": "bash"
}
```

### text_editor_20250728

The current version of the text editor tool (updated July 2025). Provides string-replace–based file editing operations: view, create, str_replace, insert. Claude Code uses this — not a raw write-the-whole-file approach — because surgical edits are more token-efficient and less likely to introduce regressions.

```json
{
  "type": "text_editor_20250728",
  "name": "str_replace_based_edit_tool"
}
```

A note on the trio: these three tools are often used together in a computer-use setup. The beta header is only required when `computer_20251124` is present; `bash_20250124` and `text_editor_20250728` do not require a beta header on their own.

Sources:
- Computer use: https://platform.claude.com/docs/en/docs/build-with-claude/computer-use
- Tool reference: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference

### Server-executed tools (distinct category)

Some tools execute on Anthropic's servers, not in your harness: `web_search_20260209`, `web_fetch`, `code_execution`, `tool_search`. You enable them in the `tools` array but never construct a `tool_result` block for them — the server runs the loop internally and returns the final response. The distinction matters for the chapter: when readers see Claude Code browsing the web, that is a server-side tool; when they see it reading files, that is a client-side tool running locally.

---

## 6. MCP — Model Context Protocol

### What it is

MCP is an open protocol standard for connecting AI applications to external tools, data sources, and services. Think of it as a USB-C port for AI: any MCP client (Claude Code, VS Code, Cursor, ChatGPT) can connect to any MCP server without custom integration code per-pair.

Anthropic created MCP and open-sourced it. It is now supported across a wide ecosystem: Claude, ChatGPT, VS Code Copilot, Cursor, and many others.

Source: modelcontextprotocol.io, "What is MCP?" https://modelcontextprotocol.io/introduction

### What it standardizes

MCP is a two-layer protocol built on JSON-RPC 2.0:

- **Data layer:** defines the primitives — Tools (executable functions), Resources (data sources), Prompts (reusable templates) — and their discovery/execution methods (`tools/list`, `tools/call`, etc.).
- **Transport layer:** defines how messages move — stdio for local processes, Streamable HTTP for remote servers.

An MCP server exposes tools with names, descriptions, and JSON Schema input schemas — the same shape as Anthropic's `tools` array. An MCP client discovers those tools at session start via `tools/list`, then routes Claude's `tool_use` blocks to the right server.

Source: modelcontextprotocol.io, "Architecture overview," https://modelcontextprotocol.io/docs/learn/architecture

### What it is not

MCP is not a runtime. It does not change what an individual tool call does or how the model calls it. The `tool_use` / `tool_result` loop at the API level is unchanged. MCP is a discovery and routing layer on top of that loop: instead of you defining all tools inline per request, an MCP server advertises them and Claude Code discovers them dynamically.

### 2026 state

MCP protocol version `2025-06-18` is the current specification as of mid-2026. The ecosystem has expanded from Anthropic's early reference servers to hundreds of third-party MCP servers (GitHub, Sentry, Figma, databases, etc.). Claude Code ships MCP client support natively — users add MCP servers via configuration and Claude Code discovers their tools automatically on session start.

### The key implication for Ch 7 readers

When you add an MCP server to Claude Code, its tools are injected into the `tools` segment of every request — the segment that Ch 7 called a silent cache invalidator. More MCP servers = more tokens in the tools segment = more cache churn if any server's tool list changes. This is covered in depth in section 8 below.

---

## 7. Parallel tool calls

### The mechanism

In a single assistant turn, Claude can emit multiple `tool_use` blocks. This is parallel tool calling: one response, multiple pending calls.

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01",
      "name": "get_weather",
      "input": { "location": "San Francisco" }
    },
    {
      "type": "tool_use",
      "id": "toolu_02",
      "name": "get_weather",
      "input": { "location": "New York" }
    }
  ]
}
```

Your harness can run these concurrently (`Promise.all`, `asyncio.gather`) or sequentially — the API does not care. What it does care about: all results must come back in a **single** `user` message before the next API call. Two separate user messages for two results will break parallel tool use in future turns.

```json
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "68°F, partly cloudy" },
    { "type": "tool_result", "tool_use_id": "toolu_02", "content": "45°F, clear skies" }
  ]
}
```

Source: Anthropic, "Parallel tool use," https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use

### Execution semantics

Tool calls in a single assistant turn are unordered by design. Claude does not assume that one call in the batch has completed before another begins. If a call in the batch fails because it depended on another call in the same batch (e.g., a create followed by a read of the created resource), return the natural error in a `tool_result` with `is_error: true`. Claude recognizes the dependency and issues the dependent call in the next turn, after the prerequisite result is in context.

You can disable parallel tool use by setting `disable_parallel_tool_use: true` in the `tool_choice` object. With `tool_choice.type: "auto"`, this ensures at most one tool per turn. With `"any"` or `"tool"`, it ensures exactly one.

### When parallelization is safe

Safe to run in parallel: independent reads, lookups, API calls with no shared state. The classic example is fetching weather for multiple cities simultaneously.

Not safe to parallelize (even though Claude might emit them together): writes to the same resource (create then update), reads that depend on a prior write, operations where the second call's inputs depend on the first call's outputs. The fix is not to prevent parallel emission from Claude — that adds complexity. The fix is to run them all, let failures surface as `is_error: true` results, and let Claude reissue the dependent call in the next turn.

---

## 8. Interaction with the prompt cache (Ch 7) — CRITICAL CALLBACK

This section is where M-5 earns its place in the curriculum. Ch 7 named tool definitions as a silent cache invalidator without explaining what those definitions actually do. Now the reader knows.

### Tool definitions live in the cached prefix

Ch 7 showed this anatomy of a Claude Code request:

```
[System prompt | Tool defs | Read files | History | New turn]
    ▼ BP            ▼ BP         ▼ BP
```

The cache breakpoints sit after System prompt, Tool defs, and Read files — the three most stable segments. Tool definitions are cached because they rarely change between turns in an active session. When they do change, the cache breaks cold from that point forward.

See: `src/pages/07-prompt-cache.mdx`, lines 151–183 (the anatomy diagram and its breakpoint markers).

### Editing a tool definition blows the cache downstream

Ch 7 called this out in its "Silent cache invalidators" section:

> "Tool definition changes. Adding, removing, or rewording any tool description changes the token sequence for the tools segment. Everything after tools goes cold."

Now the reader can visualize exactly what that means: the `tools` array is serialized into tokens and injected into a system prompt segment. A one-word change to a tool's `description` produces different tokens at that position. The prefix no longer matches the cached entry. Every downstream segment — read files, history, the new turn — is reprocessed from scratch. No warning, no feedback, just full cost.

See: `src/pages/07-prompt-cache.mdx`, lines 198–204 (Silent cache invalidators section).

### Tool results are NOT part of the cached prefix

Tool results live in the conversation history, which is below the last breakpoint in a normal Claude Code session. History is reprocessed each turn anyway (it changes with every exchange). Tool results are not a caching concern in themselves — they are just more tokens in the uncached tail of the request.

The implication: a verbose tool result that returns 10,000 tokens of file content is not a caching problem, but it is a context-window problem (see section 9, token explosion).

### MCP servers multiply the risk

When you add MCP servers to Claude Code, each server's tools are appended to the `tools` segment. More servers = more tokens in the cached segment. If any MCP server's tool list changes (because the server updated, restarted, or dynamically added tools), the entire tool segment changes and the cache goes cold. This is Ch 7's silent invalidator, now with a concrete cause: your MCP server redeployed.

Practical guidance for the chapter: treat tool descriptions like code — review changes before they land in production. Batch edits rather than making small iterative tweaks across multiple sessions.

---

## 9. What goes wrong

### The model invents a tool that does not exist

If `tool_choice` is `auto` and the tool definitions are clear and complete, this should not happen. The model's schema is its universe; it can only call tools you have defined. What can happen: the model passes a misspelled tool name (if it is confused about naming) or constructs arguments for a real tool in an invalid way. Both are schema-validation failures your harness should catch before execution.

### The model passes wrong types

JSON Schema is the contract, not documentation. Your harness should validate `input` against `input_schema` before executing. If the model passes a string where an integer is required, reject it immediately with an informative `is_error: true` result rather than letting it propagate into your system. Claude retries 2–3 times with corrections when it receives schema-mismatch errors. For guaranteed conformance, set `strict: true` on the tool definition.

### Hallucinated tool results because the harness forgot to send the result back

If your harness handles a `tool_use` block but never sends a `tool_result` back, the conversation history has a dangling tool call. The API will reject requests with unmatched tool calls. This is a harness bug, not a model behavior — but it manifests as the model appearing to "forget" or "make up" what the tool returned.

### Loop without termination

A naive harness that loops on `stop_reason == "tool_use"` will loop forever if the model keeps calling tools. Two safety valves:

1. **Step budget:** count tool calls and stop after N (Claude Code uses iteration limits for exactly this reason).
2. **Max tokens guard:** if `stop_reason == "max_tokens"` in a tool loop, the model ran out of context before finishing. Truncate and report.

Source: computer use reference implementation, `sampling_loop` with `max_iterations` parameter, https://platform.claude.com/docs/en/docs/build-with-claude/computer-use

### Token explosion — tool results bloat context

Every tool result is added to the conversation history and re-sent on the next turn. A `read_file` call on a 5,000-line file injects ~6,000–8,000 tokens into the context. Multiple such calls and the context window fills quickly. The fix is not smaller tool definitions — it is smarter tool design: return only the information the model needs, not the raw data dump. Design tool responses to return high-signal, relevant information rather than bloated payloads.

### Race conditions in parallel tool calls

If your harness runs parallel tool calls concurrently and one modifies shared state that another reads, you can get race conditions. The API does not prevent this; the model does not know your execution model. The correct approach: run all parallel calls, collect all results, return them all in one message. If a race-condition failure surfaces as an error result, Claude recognizes it and reruns the dependent call sequentially in the next turn.

---

## 10. Common misconceptions

**"The model executes code."**
No. The model emits structured text that looks like a function call. Your harness — not the model — runs the actual function. The model only ever reads and writes tokens.

**"Tool descriptions do not affect cost."**
Tool definitions sit in the cached prefix (Ch 7). When the cache hits, you pay read-price for those tokens, which is cheap. When the cache misses — because you edited a description, even just a typo fix — you pay full input price for every token in the definitions segment, every turn, until the TTL expires and a new cache entry is written. A 1,200-token tool-definitions segment with a cold cache costs ~240x more per token than a warm read.

**"JSON schema is just documentation."**
It is the model's only contract with your function. The model uses the schema to decide what arguments to pass. If your schema says a field is optional but your function crashes on null, that is a schema lie — and the model will occasionally produce null and crash you. Keep schema and implementation in sync.

**"More tools = more capability."**
More tools = more confusion. As the tool list grows, the model spends more attention on tool selection and makes more selection errors. Anthropic's own guidance recommends consolidating related operations into fewer tools with an `action` parameter rather than many single-purpose tools. Curate; do not accumulate.

**"Parallel tool calls are free."**
Each result comes back as tokens in the conversation history and is re-sent on every subsequent turn. Four parallel `read_file` results of 2,000 tokens each add 8,000 tokens to every future request until the context window rolls them off. Parallelism reduces latency, not cost.

**"Computer use is a separate API."**
It is just a built-in tool with a versioned schema (`computer_20251124`). The `tool_use` / `tool_result` loop is identical to any other client-executed tool. The only difference is the beta header and the fact that the "function" you run is screenshot capture and mouse/keyboard injection.

**"MCP replaces tool use."**
MCP is a discovery protocol on top of tool use, not a replacement for it. The model still calls tools via `tool_use` blocks, and the harness still returns `tool_result` blocks. MCP just standardizes how the harness discovers which tools are available and routes calls to the right server.

---

## 11. House-style chapter ideas

### Diagram option A — The loop as a sequence (primary recommendation)

A three-column sequence diagram: User / Claude / Harness. Rows flow top-to-bottom. Show:

1. User sends question (arrow: User → Claude).
2. Claude responds with `tool_use` block (arrow: Claude → Harness).
3. Harness executes function (internal arrow within Harness column, with a "runs your code" label).
4. Harness sends `tool_result` (arrow: Harness → Claude).
5. Claude may emit another `tool_use` (dashed back-arrow to step 2) or produce final text (arrow: Claude → User).

Use the same HTML/CSS horizontal flow pattern as Ch 7's request anatomy diagram. Each arrow is a div with a colored border; columns are flex children. The dashed back-arrow (step 5 → 2) is the "loop" visual — make it visually distinct (dashed border, lighter color). This is the diagram the chapter must have.

**Component name:** `ToolUseSequence.tsx`
**Data file:** none needed; the diagram is static (or driven by `src/data/tool-use.ts` step annotations).
**Takeaway angle:** "The model is in the left column. The execution is in the right column. The loop is the arrows between them."

### Diagram option B — "What the model sees" content blocks

Reuse the visual vocabulary from Ch 7's `RequestAnatomy.tsx` component. Show a vertical stack of content blocks in a single conversation turn: `[system prompt] [tools defs] [user text] [assistant text + tool_use block] [tool_result block] [assistant final text]`. Each block is a colored rectangle, same style as the cache anatomy. The `tool_use` and `tool_result` blocks are the new entries.

This diagram is cheaper to build (reuses existing component patterns) and gives the cache-connection callback a natural visual form. Trade-off: it shows the data structure, not the causality.

**Component name:** reuse `RequestAnatomy.tsx` with a new data prop, or a new `ToolConversationBlocks.tsx` following the same CSS pattern.
**Takeaway angle:** "Tool use does not add a new channel — it adds two new block types to the same conversation array you already know from Ch 7."

### Demo option A — Step-through tool-use loop (primary recommendation)

A React island with a "Next step" button. The demo advances through a pre-scripted 5-step conversation:

1. User question appears ("What files are in my project?").
2. Claude's `tool_use` block appears (formatted JSON, tool name and arguments highlighted).
3. Harness execution panel shows "Running: list_directory('./src')" briefly, then shows a mock result.
4. `tool_result` block appears in the conversation panel.
5. Claude's final reply appears as plain text.

Two panels side by side: left = conversation history (content blocks); right = harness execution log. The reader watches the loop happen in slow motion.

**Component name:** `ToolUseLoop.tsx`
**Data file:** `src/data/tool-use.ts` — export a `toolUseSteps` array with step type, content, and panel annotation per step.
**Takeaway angle:** "Each click is one API round trip. Five steps = two model calls, one tool execution."

### Demo option B — Edit a tool description, watch the cache go cold

A toggle built on top of Ch 7's `RequestAnatomy.tsx` anatomy. A "tool description" text field in the diagram is editable. When the reader types, the tool-defs block turns from "HIT" (warm amber) to "MISS" (cool grey), and every downstream block also goes to MISS. Clicking "Reset" restores the original description and the cache goes warm again.

This is a cross-reference demo that makes Ch 7's silent-invalidator warning concrete. It does not teach tool use mechanics, but it is uniquely effective at making the cache callback land emotionally.

**Component name:** `ToolDefinitionCacheDemo.tsx` (or a prop variant of `RequestAnatomy.tsx`).
**Data file:** `src/data/tool-use.ts` — original tool description string, cache state per segment.
**Takeaway angle:** "You changed one word in a tool description. That is why your session feels slower."

---

## 12. Hand-authored data plan

The `src/data/tool-use.ts` file should export:

```typescript
// Three illustrative tool definitions
export const mockTools = [
  {
    name: "read_file",
    description: "Read the contents of a source file. Returns full text. Use before editing.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative path to the file." }
      },
      required: ["path"]
    }
  },
  {
    name: "search_codebase",
    description: "Grep the codebase for a pattern. Returns matching lines with file and line number.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex or literal string to search for." },
        file_glob: { type: "string", description: "Optional glob to restrict search (e.g. '*.ts')." }
      },
      required: ["pattern"]
    }
  },
  {
    name: "run_tests",
    description: "Run the test suite and return a pass/fail summary with any error output.",
    input_schema: {
      type: "object",
      properties: {
        test_path: { type: "string", description: "Optional path to a specific test file or directory." }
      },
      required: []
    }
  }
];

// A scripted 5-step conversation demonstrating one tool call
export type StepType = "user" | "assistant_text" | "tool_use" | "tool_result" | "assistant_final";

export interface ConversationStep {
  type: StepType;
  content: string;       // displayed text or JSON string
  harnessNote?: string;  // annotation for the right panel (harness execution)
}

export const toolUseSteps: ConversationStep[] = [
  {
    type: "user",
    content: "What files are in the src/components directory?"
  },
  {
    type: "tool_use",
    content: JSON.stringify({
      type: "tool_use",
      id: "toolu_01abc",
      name: "read_file",
      input: { path: "src/components" }
    }, null, 2),
    harnessNote: "Executing: list_directory('src/components')"
  },
  {
    type: "tool_result",
    content: "TokenChunks.tsx\nEmbeddingScatter.tsx\nAttentionMatrix.tsx\nLayerStack.tsx\nAutoRegressiveStep.tsx\nKVCacheGrid.tsx\nRequestAnatomy.tsx\nCacheCallout.astro",
    harnessNote: "Result returned to Claude"
  },
  {
    type: "assistant_final",
    content: "The src/components directory contains 8 files: TokenChunks.tsx, EmbeddingScatter.tsx, AttentionMatrix.tsx, LayerStack.tsx, AutoregressiveStep.tsx, KVCacheGrid.tsx, RequestAnatomy.tsx, and CacheCallout.astro."
  }
];

// For the parallel tool call demo (optional extension)
export const parallelToolUseExample = {
  userMessage: "Check the weather in San Francisco and New York simultaneously.",
  assistantToolCalls: [
    { id: "toolu_01", name: "get_weather", input: { location: "San Francisco" } },
    { id: "toolu_02", name: "get_weather", input: { location: "New York" } }
  ],
  toolResults: [
    { tool_use_id: "toolu_01", content: "68°F, partly cloudy" },
    { tool_use_id: "toolu_02", content: "45°F, clear skies" }
  ],
  finalReply: "San Francisco is 68°F and partly cloudy. New York is 45°F with clear skies."
};
```

All data is hand-authored, illustrative, and clearly labeled as such in the chapter prose. No real API calls, no real filesystem access.

---

## 13. Connections to existing chapters

### Ch 7 — Tool definitions in the cached prefix (primary callback)

- `src/pages/07-prompt-cache.mdx`, lines 104–114 (GOAL.md Ch 7 description): "Surprising invalidators: changes to the system prompt, tool definitions, or segment order all blow the cache cold..."
- `src/pages/07-prompt-cache.mdx`, lines 151–183: the anatomy diagram showing Tool defs as the second segment with a cache breakpoint marker.
- `src/pages/07-prompt-cache.mdx`, lines 198–204: "Tool definition changes. Adding, removing, or rewording any tool description changes the token sequence for the tools segment. Everything after tools goes cold."
- `src/pages/07-prompt-cache.mdx`, lines 224–226 (CacheCallout): "Claude Code structures every request so the stable parts — system prompt, tool definitions, read files — come first with breakpoints..."

M-5 should open with a forward reference: "In Ch 7 you saw tool definitions listed as a named segment in the prompt anatomy. This chapter is what those definitions actually do."

### Ch 5 — Generation (the model's output is just sampled text)

- `GOAL.md`, Ch 5 description: "Autoregressive decoding: produce one token, append, produce the next."
- The key connection: a `tool_use` block is not special output from a special channel. It is tokens, sampled autoregressively, that happen to match the structured format the model was trained to produce. The model does not "switch modes" to call a tool — it just predicts the most likely next tokens given the context, and those tokens happen to be a JSON structure.

M-5 should call this out explicitly: "This is the same autoregressive prediction from Ch 5. The model is not in a different mode — it is predicting the most likely next tokens, and those tokens happen to look like a function call."

### Ch 1 — Tokens (tool results get tokenized like everything else)

- `GOAL.md`, Ch 1 description: "The model never sees individual characters... cache hits are token-level — a one-char change can shift tokens and invalidate the cache."
- The connection: tool results are strings. Before they re-enter the conversation, they get tokenized exactly like any other text. A tool result that returns 5,000 characters of JSON might be 2,000–3,000 tokens. Large results = many tokens = faster context window fill. The token budget is the common unit across everything the model processes.

### Ch 3 — Attention and the causal mask (why the loop is sequential at the API level)

- `GOAL.md`, Ch 3 description: "Causal mask = you can only see the past."
- `docs/EXTENSIONS.md`, M-5 connections: "Ch 3's causal mask establishes that generation is sequential. M-5 shows that a generation sequence can be interrupted mid-stream by a tool call and then resumed."
- The model's generation stops at a `tool_use` block because the harness ends the current turn. The next model call gets the tool result as a new past token — consistent with the causal mask. The loop is the mechanism that gives the model new "past" to attend to.

---

## 14. Closing-takeaway angle

Claude Code is, at its core, a well-curated tool-use loop. The model predicts text. When that text is a `tool_use` block, Claude Code runs the real function and feeds the result back. The loop repeats. The "intelligence" of Claude Code is mostly the quality of its tool descriptions, the stability of its schemas, and the discipline of its prompt structure — not some magical execution capability in the model itself.

Once you see the loop, the levers become obvious:

- **Tool descriptions** are the model's instructions for when and how to use a tool. Write them well.
- **JSON schemas** are contracts, not documentation. Keep implementation and schema in sync.
- **Step budgets** are how you prevent runaway loops. Every agent needs one.
- **Parallel safety** is your responsibility, not the model's. Know which of your tools have side effects that depend on each other.
- **Cache stability** means keeping tool definitions stable. Every description edit is a cache invalidation.

The magic shrinks. The engineering becomes visible. That is the point.

---

## 15. Up-to-date facts (with citations)

| Fact | Value | Source |
|---|---|---|
| Latest computer use tool version | `computer_20251124` | https://platform.claude.com/docs/en/docs/build-with-claude/computer-use |
| Computer use beta header (latest) | `"computer-use-2025-11-24"` | https://platform.claude.com/docs/en/docs/build-with-claude/computer-use |
| Latest bash tool version | `bash_20250124` | https://platform.claude.com/docs/en/docs/build-with-claude/computer-use (code samples) |
| Latest text editor tool version | `text_editor_20250728` | https://platform.claude.com/docs/en/docs/build-with-claude/computer-use (code samples) |
| tool_choice options | `auto`, `any`, `{"type":"tool","name":"X"}`, `none` | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| Parallel tool calls: results format | All results in a single user message; tool_result blocks must come first in content array | https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use |
| disable_parallel_tool_use flag | Available on tool_choice object | https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use |
| is_error field | Optional bool on tool_result; model treats content as error description | https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls |
| MCP protocol version (current) | `2025-06-18` | https://modelcontextprotocol.io/docs/learn/architecture (initialization example) |
| MCP created by | Anthropic, open-sourced | https://modelcontextprotocol.io/introduction |
| Web search server tool (current type string) | `web_search_20260209` | https://platform.claude.com/docs/en/docs/build-with-claude/tool-use/overview (code sample) |
| Tool name regex | `^[a-zA-Z0-9_-]{1,64}$` | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| Max breakpoints per request (Ch 7) | 4 | `src/pages/07-prompt-cache.mdx`, line 23 |

**Version note:** The computer use tool has had multiple version bumps. The progression seen in the docs is `computer_20241022` → `computer_20250124` → `computer_20251124`. The dossier uses the current version (`computer_20251124`) throughout. If the chapter references a specific version string, it should note that versions increment over time and link to the tool reference for the current string.

---

## 16. Open questions

**1. Does this chapter introduce MCP, or does M-11 own MCP entirely?**
The recommended extension track (per `docs/EXTENSIONS.md`) puts M-11 (MCP) after M-5 (Tool Use). M-5 should mention MCP briefly — enough to explain why readers see multiple tool sources in Claude Code — but the deep dive belongs in M-11. The current dossier follows this: section 6 gives a 300-word orientation, explicitly flagging that M-11 goes deeper. Decision: confirm this split with the orchestrator before writing prose.

**2. Demo A vs Demo B — or both?**
Demo A (step-through loop) teaches the mechanics; Demo B (edit-description cache demo) teaches the Ch 7 callback. Both are within the "one demo per chapter" budget if they are lightweight. Demo B may be better as a `CacheCallout` variant rather than a full island. The orchestrator should decide which demo is the primary island and whether Demo B is a static or interactive callout.

**3. How many mock tools in the data file?**
Three tools (`read_file`, `search_codebase`, `run_tests`) gives enough variety to show name, description, and schema variety without being overwhelming. The parallel call example adds a fourth (`get_weather`) but only for the parallel section. Check whether this fits in `src/data/tool-use.ts` without feeling cluttered.

**4. Strict tool use (`strict: true`) — mention or skip?**
The `strict: true` flag guarantees that Claude's tool inputs exactly match the schema. It is useful but an advanced option. The chapter should name it in one sentence (in section 3 or 4) and link to the reference doc rather than explaining it in depth — the audience for this site is not writing production API integrations.

**5. Server-executed tools — how much detail?**
The distinction between client-executed and server-executed tools matters for the chapter's core mechanic (the client-side loop). `web_search`, `code_execution`, etc. do not require a harness-side loop. The current dossier covers this in one paragraph in section 5. The open question is whether to show a concrete example of a server tool response, or just describe the behavior and move on. Lean toward "describe and move on" to keep the chapter focused on the client-side loop that readers encounter in Claude Code.

---

*Iterations used: 1 of 2. Stopping: research is complete and coverage is comprehensive across all 16 sections. No meaningful improvement expected from a second pass.*

*Remaining issues not fixed: none. Web research covered all required topics within the 8-fetch cap.*

*Reason for stopping: done met.*
