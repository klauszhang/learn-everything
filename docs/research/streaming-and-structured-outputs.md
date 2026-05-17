# Research dossier — Streaming + structured outputs

**Status:** research-only.
**Date:** 2026-05-17.

---

## 1. Plain-language premise

You have watched words appear in ChatGPT one by one — that is streaming. You have told Claude to "return JSON" and it did — that is structured output. These are two different things, often discussed in the same breath, occasionally confused. This dossier separates them.

Streaming is about *when* you see the output. The model generates one token at a time regardless (Ch 5 — autoregressive decoding). Streaming means each token is sent to you as soon as it is produced, instead of waiting for the entire response to finish. Nothing about the output shape changes; only the timing changes.

Structured output is about *what* the output looks like. It is a constraint on shape: the response must be valid JSON, or must match a particular schema. Several mechanisms can enforce this — ranging from "ask nicely in the prompt" to "compile a grammar and restrict the token sampler." The mechanisms are not equivalent, and providers differ substantially in which one they use.

The confusion arises because: (1) both are "output concerns," (2) when streaming meets structured output, new edge cases appear (you cannot safely parse a streamed JSON object until it is complete), and (3) the phrase "JSON mode" means different things on different platforms. This dossier names those differences.

A framing that helps: streaming is a property of the HTTP connection, not of the model's generation. Structured output is a property of the generation, not of the connection. You can have either without the other:

- Non-streaming + no structured output: wait for completion, receive free text, parse manually.
- Non-streaming + structured output: wait for completion, receive guaranteed-schema text (or tool output).
- Streaming + no structured output: watch text appear token-by-token, no shape guarantee.
- Streaming + structured output: watch tokens appear, tokens are constrained to valid schema paths, cannot parse until the block closes.

All four combinations are valid. The last one is what most production systems use when they need both fast perceived response time and reliable data extraction.

---

## 2. Streaming — what is actually on the wire

### The model generates one token at a time

As Ch 5 establishes, autoregressive decoding is sequential. The model runs a forward pass through every layer, produces a probability distribution over the vocabulary, samples one token, appends it, and repeats. This is not changed by streaming. The model is not "thinking faster" because you enabled streaming. It is generating exactly the same tokens in the same order.

Without streaming: the server collects every generated token, assembles the full response, then sends it to you in one HTTP response body. If the model generates 400 tokens and each takes 50 ms, you wait 20 seconds, then see all 400 tokens at once.

With streaming: the server sends each token (or a small batch of tokens) to you as soon as it is sampled. You see text appearing progressively. Total generation time is unchanged; what changes is the time to your first visible token — called **time to first token (TTFT)**.

### Server-Sent Events (SSE)

The transport mechanism is almost universally Server-Sent Events, a standard browser API for long-lived HTTP connections where the server pushes data. The client keeps the HTTP connection open; the server writes text in the format `event: <name>\ndata: <json>\n\n`. The client reads each chunk as it arrives.

SSE was chosen over WebSockets because it is simpler (one-directional, HTTP-native), works through standard proxies, and has native browser support. For streaming LLM responses, one-directional is all you need — the client sent the prompt at the start; everything after is server-to-client.

### Anthropic's SSE event types (verified 2026-05-17)

Source: Anthropic, "Streaming messages," https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17.

Each Anthropic stream follows this sequence: `message_start` (message envelope with empty content and `usage.input_tokens`) → for each content block: `content_block_start` (opens a block; type is `text`, `tool_use`, or `thinking`) → one or more `content_block_delta` events → `content_block_stop` (closes the block) → `message_delta` (top-level update with `stop_reason` and cumulative `output_tokens`) → `message_stop`. `ping` and `error` events may appear anywhere in the stream.

The delta types inside `content_block_delta` events differ by block type:

| Block type | Delta type | Field |
|---|---|---|
| `text` | `text_delta` | `text` (string fragment) |
| `tool_use` | `input_json_delta` | `partial_json` (string fragment of JSON) |
| `thinking` | `thinking_delta` | `thinking` (string fragment) |
| `thinking` | `signature_delta` | `signature` (integrity token, sent before block closes) |

A real text stream (abbreviated) looks like this:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01...","content":[],"stop_reason":null,"usage":{"input_tokens":25,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

The `index` field in `content_block_start/stop/delta` events corresponds to the block's position in the final `content` array. When Claude produces both text and a tool call in one response, they appear as separate indexed blocks: index 0 is the text block, index 1 is the tool_use block.

### What a developer does with each event

Most developers either use the SDK's high-level stream helpers or write a manual event loop. For those writing manual event loops, here is the complete operational guide for each event type:

| Event | What to do |
|---|---|
| `message_start` | Initialize your accumulator. Note `usage.input_tokens` for cost tracking. |
| `content_block_start` | Create a new block entry keyed on `index`. Note `content_block.type` — `text`, `tool_use`, or `thinking`. |
| `content_block_delta` (text_delta) | Append `delta.text` to the text accumulator for this block. Optionally render to UI. |
| `content_block_delta` (input_json_delta) | Append `delta.partial_json` to the JSON string accumulator for this block. Do NOT parse yet. |
| `content_block_delta` (thinking_delta) | Append `delta.thinking` to the thinking accumulator for this block. |
| `content_block_delta` (signature_delta) | Store `delta.signature` for the thinking block. Do not render. |
| `content_block_stop` | If the block was `tool_use`, parse the accumulated JSON string now. If `tool_use`, check `stop_reason` in the subsequent `message_delta` to decide whether to execute the tool. |
| `message_delta` | Read `delta.stop_reason` — this is your signal for what to do next: `"end_turn"` (done), `"tool_use"` (execute tools and send results), `"max_tokens"` (truncated), `"refusal"` (safety stop). |
| `message_stop` | The stream is complete. Close the connection if necessary. |
| `ping` | Ignore. (Keepalive only.) |
| `error` | Log and handle. Implement backoff for `overloaded_error`. |

The `stop_reason` field is the most important value in the entire stream. It is the fork in your application's logic: tool call loop, done, or error handling.

A minimal correct streaming consumer in pseudocode:

```
initialize: text_accumulators = {}, json_accumulators = {}
for each SSE event:
  if message_start: record input_tokens
  if content_block_start: create accumulator keyed on index; note block type
  if content_block_delta:
    if text_delta: append delta.text to text_accumulators[index]
    if input_json_delta: append delta.partial_json to json_accumulators[index]
    if thinking_delta: append delta.thinking to text_accumulators[index]
    if signature_delta: store (do not render)
  if content_block_stop:
    if block was tool_use: json_accumulators[index] = JSON.parse(json_accumulators[index])
  if message_delta: act on delta.stop_reason
  if message_stop: done
```

This pseudocode is the skeleton for Demo A's event log panel. It is also what the Anthropic SDK implements internally — the high-level `.stream()` and `.finalMessage()` helpers are this loop, abstracted away.

### TTFT vs. throughput — two different bottlenecks

Two metrics matter for streaming UX, and they have different root causes:

**Time to first token (TTFT)** is the delay between sending your request and seeing the first token appear. The bottleneck here is the *prefill* phase: the model must process your entire prompt through every layer before it can produce the first output token. A long system prompt or large context window means longer TTFT. Streaming does not improve TTFT — it is determined entirely by prompt length and model size.

**Throughput (tokens/sec)** is how fast tokens arrive after the first one. This is determined by the *decode* phase and by server-side hardware. A faster GPU cluster gives you more tokens per second. Streaming exposes this to you progressively rather than delivering it all at the end.

The practical implication: if your TTFT is high, the problem is prompt length (or cold-start latency on the server). If your throughput is low, the problem is decode-phase compute. These require different fixes, and neither is addressed by toggling `stream: true` or `false`.

### Error recovery during streaming

What happens if the HTTP connection drops mid-stream? The response is lost. You have a partial accumulation of `text_delta` events and no `message_stop`. The Anthropic documentation (fetched 2026-05-17) describes a recovery pattern that differs by model version:

For Claude 4.5 and earlier: capture the partial accumulated text as a partial assistant message and submit a new API request that includes this partial message. The model will continue from where it left off.

For Claude 4.6 and later: the continuation strategy is a user message containing the partial response with an instruction to continue. The model is prompted, not prefilled. Example continuation prompt: "Your previous response was interrupted. It ended with [partial text]. Please continue from where you left off."

Neither recovery strategy is perfect. Tool use and thinking blocks cannot be partially recovered — if the stream interrupts inside a `tool_use` or `thinking` block, you must restart the turn from scratch. The documentation is explicit: "Tool use and extended thinking blocks cannot be partially recovered."

The practical implication for application developers: implement exponential backoff and full-restart logic for tool-use and thinking requests. Implement the continuation pattern only for plain-text streaming where partial recovery is possible.

### Why streaming is almost always on in production

Even if you do not display the streamed tokens to a user, enabling streaming in your HTTP client prevents connection timeouts. Standard HTTP clients have configurable timeouts; a large generation (say, 4,000 tokens) can easily take 60–90 seconds of wall time. Many HTTP clients default to timeouts shorter than that. Streaming keeps the connection alive with a continuous trickle of data — each SSE event resets the inactivity clock — so the connection does not drop on long generations.

The Anthropic SDK documentation explicitly notes this pattern: for requests with large `max_tokens` values, the SDKs require streaming under the hood to avoid HTTP timeouts, even if the developer calls `.get_final_message()` (Python) or `.finalMessage()` (TypeScript) and never processes individual events. Streaming is the transport; whether you *observe* the stream or just use it as a keepalive is up to you.

### The "tokens vs. characters" question for streaming consumers

A question that comes up in practice: are `text_delta` events aligned to tokens, or to characters, or to something else? The answer from Anthropic's documentation is that the event format supports any granularity and the server may send multiple tokens per event or one character per event depending on implementation. The format spec says "one or more `content_block_delta` events per block" — not "one per token." In practice, modern Claude models typically send small bursts of a few characters or a partial word per event. This means:

- Do not assume `event.delta.text` is a single token.
- Do not assume it is a single character.
- Concatenate all `text_delta` values for a block to get the full text; process at the block level.

This also means streaming text is safe to progressively render in a UI — the chunks are small enough to feel token-by-token to a human, even if the underlying granularity is not exactly one token per event.

---

## 3. Streaming meets thinking, tools, and structured outputs

### Thinking blocks stream before the answer

When extended thinking is enabled, the stream produces a `thinking` content block before any `text` block. The thinking block streams via `thinking_delta` events. A `signature_delta` event arrives just before the `content_block_stop` for the thinking block — this signature is a cryptographic integrity token Anthropic uses to verify the thinking content has not been tampered with.

After the thinking block closes, the answer streams normally as a `text` block. The thinking arrives first; the visible answer arrives second. This ordering is fixed: thinking before answer, always.

If you set `display: "omitted"` in the thinking config, the thinking block still opens and closes (with a signature delta) but no `thinking_delta` events are emitted. The block appears but is empty from the client's perspective. This matters for code that counts on block indices — the thinking block still occupies index 0.

Source: Anthropic, "Streaming messages — Thinking delta," https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17.

### Tool use streams as partial JSON

When Claude decides to call a tool, the stream produces a `tool_use` content block. The block opens with `content_block_start` — type `tool_use`, tool id, name, and an empty `input: {}` placeholder. The actual tool arguments arrive as `input_json_delta` events, each carrying a `partial_json` string fragment. For a simple tool call with `{"location": "San Francisco, CA"}`, you would receive a `content_block_start` (empty input), then two `input_json_delta` events (`{"location":` and ` "San Francisco, CA"}`), then `content_block_stop`. Concatenate the `partial_json` strings to get the full JSON; parse on `content_block_stop`.

The design note in Anthropic's documentation says: "current models only support emitting one complete key and value property from `input` at a time." This means there may be noticeable pauses between delta events while the model generates a complete key-value pair before any JSON fragment is sent. The streaming format can handle finer granularity in future models, but today's behavior is whole key-value chunks.

**Critical implication:** you cannot safely parse or act on a tool call's input until `content_block_stop` has arrived for that block. Attempting to parse `{"location": "San Fra` will fail. Accumulate; then parse.

### Fine-grained tool streaming (eager_input_streaming)

Anthropic added an opt-in variant: set `eager_input_streaming: true` on a tool definition to receive argument fragments without buffering for JSON validation. This reduces the delay from tool-call start to first delta event (the documentation's example shows a 15-second delay dropping to 3 seconds for a large parameter). The tradeoff: you may receive incomplete or malformed JSON fragments if generation stops early (e.g., `stop_reason: "max_tokens"`). You still must accumulate until `content_block_stop`.

Source: Anthropic, "Fine-grained tool streaming," https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming, fetched 2026-05-17.

### Streaming + structured output

When `output_config.format` is set (see section 4), streaming is supported. The grammar compiler constrains what the model can emit, and that constraint applies token-by-token during the decode phase — so the streamed fragments are always on a valid path toward a schema-conformant document. The client still receives `text_delta` events, but the model cannot produce tokens that would violate the schema. You still should not parse the streamed JSON until the block closes and the output is complete, because a valid partial JSON prefix is not valid JSON.

---

## 4. Structured outputs — three different mechanisms

"JSON mode" is not a single thing. It is a marketing phrase that maps to at least three distinct mechanisms, and different providers use different ones. They matter because they have different reliability profiles, different failure modes, and different costs.

### Mechanism 1 — Prompt-constrained

**How it works:** You instruct the model in the system prompt or user message to output JSON. "Return your answer as a JSON object with fields name and score." The model attempts to comply. If it does, you parse the result. If it does not — because it prefaced the JSON with "Here is the JSON:" or because it got confused midway — parsing fails.

**Reliability:** Inconsistent. High for simple schemas; degrades as schema complexity grows, as the output approaches the token limit, or when the model decides to explain itself before producing the data.

**The specific failure modes:** Preamble ("Here is the JSON:"), postamble ("I hope this helps!"), incorrect field names (the model invents a close synonym), missing required fields, trailing commas in JSON, single-quoted strings instead of double-quoted (not valid JSON), and early truncation when `max_tokens` is hit. Each of these breaks `JSON.parse()`.

**When to use it:** Never for production pipelines. Useful for quick explorations or when the output is consumed by a human who can tolerate occasional formatting inconsistencies.

**Both Anthropic and OpenAI have offered this implicitly** whenever you just instruct the model without using any structured output API feature. This is what most users meant historically when they said "I told it to return JSON." It is also the fallback when no structured output feature is available — for example, older model versions or API tiers that do not support `output_config`.

### Mechanism 2 — Tool use as structured output

**How it works:** You define a tool whose `input_schema` is exactly the JSON structure you want. You set `tool_choice` to force that specific tool. Claude produces a `tool_use` block whose `input` matches the schema. You extract the `input` field and you have your structured data — no parsing of free text required.

This is the mechanism described in the tool-use dossier: Claude is trained to emit `tool_use` blocks that conform to the provided schema. The model predicts the most likely tokens given the schema definition, and those tokens form a structured JSON object. There is no text preamble to strip, no postamble to discard. The structured output is the `tool_use.input` field; you receive it as a Python dict or JavaScript object directly, not as a string you must parse.

**Reliability:** High. The model is trained specifically on tool-use trajectories where the `input` matches the schema. The `strict: true` flag (see below) further tightens this. Occasional failures still happen — the model might fill valid-shaped garbage for a semantically complex field — but schema-level compliance is reliable.

**Concretely:** to extract a structured contact from text, define a tool named `extract_contact` with an `input_schema` containing the fields you want. Pass `tool_choice: {"type": "tool", "name": "extract_contact"}` to force Claude to call it. The response `content` array will contain a `tool_use` block with `input: {"name": "...", "email": "..."}`. Your code reads `response.content[0].input` and you are done. No string parsing.

**Anthropic's historical recommendation (pre-2026):** Use tool-use as structured output. Define a tool whose schema is your desired output. Force it with `tool_choice: {"type": "tool", "name": "your_tool"}`. The tool-use dossier covers this in depth. In 2026, `output_config.format` is the more direct path — but the tool-use pattern remains valid and is sometimes preferable when the calling code naturally thinks of the operation as a function invocation.

**Cache interaction:** Tool definitions sit in the cached prefix (Ch 7). Using a tool definition as a structured output schema means schema changes are silent cache invalidators. Modifying a field name or adding a required property blows the cache for all downstream segments.

### Mechanism 3 — Grammar-constrained decoding (output_config.format)

**How it works:** The token sampler itself is restricted. Before sampling the next token, the engine filters out any token that would make the partial output invalid against the schema (compiled into a context-free grammar). Only tokens that keep the output on a valid path remain eligible. The result is mathematically guaranteed to be schema-conformant.

This is what open-source tools like Outlines (dottxt-ai/outlines), JSONFormer, and llama.cpp's `--grammar` flag implement. The mechanism: compile the JSON schema into a finite-state automaton or grammar; at each decode step, mask the logits of any token that the automaton would reject; sample from the remaining tokens.

**Token healing:** A subtlety specific to constrained decoding. Tokens in the model's vocabulary are not individual characters — they are subword units that depend on what came before. When the constraint kicks in mid-generation, the boundary between the last "free" token and the first "constrained" token may not align cleanly with any tokenization the model was trained on.

Here is the concrete problem: suppose the constraint says the next valid character must be `{` (opening a JSON object). The model's most likely next token might be ` {` (space + brace) — a common token in JSON generation contexts because JSON values are often preceded by a space. But the grammar may have already consumed the space and is expecting the bare `{`. The token ` {` (space-brace) would be masked out by the constraint even though it is semantically correct, because the grammar state expects `{` not ` {`. The model then picks the second-most-likely token, which may be a bare `{` — but if the model was not primed for bare `{` in that position, the logit for `{` without a leading space may be low, producing an unexpected or low-quality token.

Token healing addresses this by reconsidering the last generated token before the constraint starts. The library rolls back one token, then regenerates with the constraint active from that earlier position — effectively letting the constraint "absorb" the tokenization ambiguity at the boundary. The result is that the first constrained token is the one the model would have naturally produced if the constraint had been active from the start. Token healing costs one extra decode step at the constraint boundary but produces dramatically better outputs for constrained generation. (Source: Outlines documentation, https://dottxt-ai.github.io/outlines/latest/, fetched 2026-05-17.)

**The intuition for why this works.** The token sampler (Ch M-4 in the extensions track) normally picks from the full vocabulary. Constrained decoding narrows the eligible set before the pick. At step 1 of a JSON object, the only valid tokens are the ones that start a valid JSON object — specifically `{` and whitespace before `{`. At step 2, inside the object, valid tokens are whatever can start a key: `"` to begin a string key, or `}` to close an empty object. The grammar compiler pre-computes these valid sets for every state in the grammar, so the filter at each decode step is a fast lookup rather than a re-evaluation. The model still assigns probabilities to all tokens — the logits are unchanged — but only the valid tokens can be sampled. The highest-logit valid token wins (modulated by temperature).

This means constrained decoding is not "the model writes different text." It is "the sampler ignores tokens that would produce invalid output." The model's behavior, its "intent," is the same as it would be without the constraint. What changes is which of its preferred tokens survive to the sampling step. If the model's top choice happens to be invalid (which should be rare for a well-trained model generating JSON), the constraint forces it to its second or third choice. If the model's entire top-20 choices are all valid, the constraint has no effect on the output at all.

**Schema limits and the grammar formalism.** Not all JSON Schemas can be compiled into the kind of grammar a constrained-decoding system uses. The specific limitation relates to the computational class of the grammar: a finite-state automaton (the simplest form) can express regular constraints (no backtracking, no recursion). A pushdown automaton (one level up) can express context-free constraints (balanced brackets, finite-depth nesting). Recursive schemas — where an object contains an array of itself, indefinitely — require an unbounded automaton and cannot be finitely compiled. This is why Anthropic's `output_config.format` explicitly does not support recursive schemas: they exceed the computational class the system can compile and cache.

**Anthropic's implementation (2026):** Anthropic added `output_config.format` with `type: "json_schema"` to the Messages API. The documentation explicitly states the implementation uses "constrained decoding" with "compiled grammar artifacts" — not prompt tricks, not tool use. The schema is compiled on first use; compiled grammars are cached for 24 hours. Subsequent requests using the same schema hit the cache and pay no compilation latency. The schema change also invalidates the grammar cache, independently of the prompt cache.

Source: Anthropic, "Structured outputs," https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17.

**Schema limits (documented):** The `output_config.format` approach supports common JSON Schema features (object, array, string, integer, number, boolean, null, enum, const, anyOf, allOf, $ref, common string formats). Notably not supported: recursive schemas, numerical range constraints (minimum, maximum), string length constraints, or most array cardinality constraints. These limitations are inherent to grammar-based constrained decoding — some schemas cannot be compiled into the required finite-state form.

### What "JSON mode" means on each platform (summary)

| Platform | Feature name | Mechanism | Guarantee |
|---|---|---|---|
| Anthropic (historical) | Prompt instruction | Prompt-constrained | None |
| Anthropic (historical) | Tool-use pattern | Schema + training | High but not absolute |
| Anthropic (2026) | `output_config.format` | Grammar-constrained decoding | Absolute (within schema limits) |
| OpenAI | `response_format: {type: "json_object"}` | Prompt-constrained ("JSON mode") | None (prompt-level) |
| OpenAI | `response_format: {type: "json_schema", strict: true}` | Grammar-constrained decoding | Absolute (within schema limits) |

**The Anthropic answer in 2026 is specifically:** `output_config.format` with `type: "json_schema"` uses constrained decoding (grammar-compiled sampling) and guarantees schema-conformant output. This is a documented, first-class API feature — not the same as the historical recommendation of "use tool definitions."

The `strict: true` flag on tool definitions (separate feature) also uses constrained decoding to guarantee that tool *inputs* match the input_schema. These two features can be combined in the same request.

Source: Anthropic, "Structured outputs," https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17. Source: Anthropic, "Messages API," https://platform.claude.com/docs/en/api/messages, fetched 2026-05-17.

### How to choose between the three mechanisms

This is the practical question a developer actually has. Here is a decision tree:

**Step 1: Is your schema recursive?**
If yes: grammar-constrained (`output_config.format`) will not work. Use the tool-use pattern or prompt-constrained. Recursive schemas cannot be compiled into the grammar. You are in mechanism 1 or 2 territory regardless of preference.

**Step 2: Do you need absolute schema conformance?**
If yes: use `output_config.format` (mechanism 3). This is the only mechanism that provides a mathematical guarantee, not just a high-reliability promise. If a schema-invalid response would corrupt your database, break your downstream parser, or cause a security issue, pay the grammar compilation overhead and use constrained decoding.

**Step 3: Is the output naturally a function call?**
If yes: the tool-use pattern (mechanism 2) may read more naturally in your code. You are already handling a `tool_use` block; the structured output is just the `input` field. This is also the right choice if your schema contains features that `output_config.format` does not support (numerical range constraints, string length constraints) and you can live with the slightly lower reliability guarantee.

**Step 4: Is this a one-off exploration or human-consumed output?**
If yes: prompt-constrained (mechanism 1) is fine. Describe the schema in prose. Parse the result. If it fails once in twenty calls, rerun. This is not a production pattern, but it is a valid prototyping pattern.

**The practical default for production in 2026:** use `output_config.format` for new code unless your schema requires unsupported features. The grammar cache means the compilation cost is paid once per 24-hour window. The guarantee is worth it. Fall back to the tool-use pattern for schemas that `output_config.format` cannot compile.

---

## 5. Why "force JSON" can still go wrong

Even with schema-constrained decoding, failure modes exist. Schema compliance is not semantic correctness. A production pipeline that assumes schema-conformant = correct is going to have a bad day.

**The schema is valid; the content is wrong.** Constrained decoding guarantees that the output matches the schema shape. It does not guarantee that the values are correct. If your schema requires `{ "confidence": number }`, constrained decoding ensures you get a number. It does not ensure the number reflects the model's actual uncertainty. The model can fill `0.99` in a field where `0.4` is warranted. Schema = contract on shape, not truth.

This is the most practically important failure mode because it is invisible. The JSON parses. The types validate. The data goes into your database. The values are wrong. Downstream effects surface days later as data quality issues, not as parse errors. The fix is semantic validation — business-logic checks that enforce value constraints the schema cannot express ("confidence must be between 0 and 1 and must decrease for low-evidence claims"). Constrained decoding gets you to the door; semantic validation gets you through it.

**Output token budget hit.** If `stop_reason` is `"max_tokens"` and you are using prompt-constrained or tool-use JSON (not grammar-constrained), the output may be truncated mid-object. The JSON will be malformed. Even with grammar-constrained decoding, truncation forces the generation to stop at whatever valid partial state the grammar is in; the result is an incomplete JSON document that may not satisfy all required fields. The safe pattern: always check `stop_reason` before parsing. If `stop_reason` is not `"end_turn"`, treat the output as suspect and retry with a higher `max_tokens` or a simpler schema.

**Streaming consumer parsed too early.** Discussed in section 3. If you attempt to parse a `text_delta` accumulation before `content_block_stop`, you have a partial JSON string. No parser will accept it. Wait for the block to close. This is the second most common production bug after "I didn't check stop_reason" — the developer streams for UI responsiveness and then tries to use the streaming output as data before it is complete.

**Token healing missing (self-hosted inference).** If you are running your own inference stack with constrained decoding (not Anthropic's API) and have not implemented token healing, the first constrained token may be corrupted, producing syntactically invalid output that breaks your parser. Token healing is not optional for robust constrained decoding. The Outlines library includes token healing; llama.cpp's grammar mode has had partial token healing support in some releases but behavior varies. If you are rolling your own constrained decoding, token healing is non-negotiable.

**Tool definition edited, cache miss.** If you are using the tool-use pattern for structured outputs and you modify the tool definition between calls, the cache breaks cold from that segment forward. The cost jumps; the TTL clock resets. This is not a correctness problem, but it is a cost and latency surprise that commonly catches developers mid-iteration. "Why did this turn cost so much?" — because you added a field description two calls ago. Covered in section 6.

**Schema changed, grammar cache miss.** If you are using `output_config.format` and you change the schema, the compiled grammar is invalidated. The next request pays compilation latency (up to 180 seconds for complex schemas, per Anthropic's documentation). The 24-hour grammar cache is keyed on the schema content. This is independent of the prompt cache — you can have a prompt cache hit and a grammar cache miss simultaneously if the schema changed but the prefix did not. Unlike the prompt cache miss (which costs you more tokens), the grammar cache miss costs you latency, not tokens. Plan for this when iterating on schemas in a time-sensitive environment.

**Refusal takes precedence over schema.** If Claude refuses a request for safety reasons, `stop_reason` is `"refusal"` and the output may not match your schema. Schema enforcement does not override safety training. Budget for this in any application that passes sensitive or borderline prompts. The refusal response is still billable — you pay for the tokens used to produce the refusal.

**The "optional fields make the model uncertain" problem.** When a JSON schema has many optional fields, the model under grammar-constrained decoding must decide at each point whether to emit the next field or close the object. The constrained sampler restricts which tokens are valid but does not specify which of the valid options the model should choose. A schema with fifteen optional fields may produce sparse output — the model tends toward closing the object early because that is a valid and common continuation. Design schemas with required fields for the data you actually need; use optional fields sparingly.

---

## 6. The cache interaction (callback to Ch 7)

The intersection of structured output with prompt caching is where most production surprises live. This section is a focused extension of Ch 7 — read that chapter first for the full anatomy of the cache. Here we add the structured-output–specific layer.

**Tool definitions as structured output schema sit in the cached prefix.** Ch 7's anatomy of a Claude Code request places five segments in order — System prompt → Tool defs → Read files → History → New turn — with cache breakpoints (BP) after the first three. If you use the tool-use pattern for structured outputs, your output schema is embedded in the Tool defs segment. This segment has a cache breakpoint. When the session is warm, you pay cache-read price for those tokens (much cheaper than full input price). When you change the schema, the token sequence in that segment changes. The cache breaks cold from that breakpoint forward — Read files, History, and the new turn are all recomputed from scratch.

The invisibility of this is the problem. The API returns no warning. The response arrives correctly. The cost and latency on that turn increase with no observable signal except the usage numbers. A developer iterating on an output schema might make ten small edits across a morning session. Each edit busts the cache. Ten cache misses on a large context are meaningfully more expensive than ten cache hits. The developer does not notice until the billing statement.

**The `output_config.format` grammar cache is a second, independent cache.** If you use Anthropic's built-in structured outputs instead of the tool-use pattern, the schema does not live in the prompt — it is compiled separately and cached separately (24-hour TTL, keyed on schema content). Changing the schema invalidates the grammar cache but does not necessarily invalidate the prompt cache. These are two different caching systems with different TTLs, different keys, and different invalidation triggers.

In concrete terms: if you change your `output_config.format` schema but leave your system prompt, tool definitions, and conversation history unchanged:
- Prompt cache: still valid, still warm (the prefix tokens did not change).
- Grammar cache: invalid, must recompile (the schema content changed).
- Effect: the next request pays no extra token cost (prompt cache hit) but pays compilation latency (grammar cache miss). Subsequent requests with the same schema pay neither.

If you change the schema embedded in a tool definition (tool-use pattern):
- Prompt cache: invalid from the Tool defs segment forward.
- Grammar cache: not relevant (you are not using `output_config.format`).
- Effect: the next request pays full input token price for all tokens after the first cache breakpoint. No extra latency, but higher cost.

**Practical guidance:** Treat your output schema like you treat your tool definitions — stable content that you edit deliberately, not iteratively. Batch schema changes. Test schema changes in a non-production environment first. Note which cache each change affects (prompt cache vs. grammar cache vs. both). Version your schemas explicitly so you can trace which schema version caused a cache bust.

---

## 7. Common misconceptions

**"JSON mode means the model is constrained at the sampler level."**
Not always. On Anthropic historically, the recommendation was tool-use as structured output — which is training-based, not sampler-constrained. Anthropic's `output_config.format` (2026) does use constrained decoding. OpenAI's `json_object` mode does not — it is prompt-constrained. The phrase "JSON mode" has meant all three things on different platforms at different times. Ask which mechanism, not just the name.

**"Streaming makes the model faster."**
No. Streaming makes the *perceived* speed higher by reducing time-to-first-token from the user's perspective. Total generation time is identical. The model generates the same number of tokens at the same speed with or without streaming. Streaming is a delivery optimization, not a compute optimization.

**"I can parse the streamed JSON as it streams."**
Not safely, unless you implement an incremental JSON parser that understands partial inputs. Standard `JSON.parse()` requires a complete, valid JSON string. The Pydantic library (Python) has partial JSON parsing support; some streaming JSON libraries exist for other languages. For most use cases, accumulate until the block closes and then parse. The only exception is `eager_input_streaming`, which is specifically for when you want to act on parameter fragments before they are valid JSON — which requires custom handling of incomplete inputs.

**"Schema validation = correct content."**
Schema validation guarantees shape, not truth. The model can produce schema-conformant output that is factually wrong, semantically nonsensical, or deliberately misleading. A field typed as `string` can contain any string. A field typed as `number` can contain any number. Validation tells you the structure is correct; it says nothing about the values.

**"Force-JSON works the same on every model."**
Provider differences matter significantly. Anthropic's `output_config.format` uses constrained decoding with a compiled grammar cache. OpenAI's `json_schema` with `strict: true` also uses constrained decoding but with different schema support and different latency profiles. OpenAI's `json_object` mode is prompt-constrained with no schema guarantee. Open-source models via llama.cpp can use `--grammar` for grammar-constrained generation, but token healing support varies by implementation. These are not interchangeable.

**"Structured outputs and tool use are different features."**
On Anthropic historically, structured outputs were *built on* tool use — the recommended pattern was to define a tool whose schema was your desired output shape. In 2026, Anthropic added `output_config.format` as a first-class structured output mechanism separate from tool use. Both exist; they are now distinct features that can be combined. But the tool-use pattern remains valid and is sometimes preferable when you also need to capture the structured data as a "function call" your harness processes.

**"The grammar cache and the prompt cache are the same thing."**
They are independent systems. The prompt cache (Ch 7) is keyed on the token-level prefix of the request, has a 5-minute or 1-hour TTL, and is invalidated by any change to the cached prefix segments. The grammar cache (for `output_config.format`) is keyed on the schema content, has a 24-hour TTL, and is invalidated only by schema changes. Changing your system prompt does not invalidate the grammar cache. Changing the schema does not invalidate the prompt cache. You can have a prompt cache miss and a grammar cache hit, or vice versa.

**"The token counts in the stream tell me how many tokens were generated."**
Partially true, but read carefully. The `usage` field in `message_start` gives `input_tokens`. The `usage` field in `message_delta` gives cumulative `output_tokens` — not per-event token counts. Token counts in the stream are cumulative, not incremental. If you want to know how many tokens a specific content block used, you cannot compute it from the stream directly. You get the final total when `message_delta` arrives. This is documented: "The token counts shown in the `usage` field of the `message_delta` event are cumulative." (Source: Anthropic, streaming docs, fetched 2026-05-17.) If you need per-block token counts, you would need to reconstruct them from the text (approximate, since tokenization is not character-for-character) or use the non-streaming token counting endpoint.

**"Turning off streaming makes the model's output deterministic."**
Streaming mode vs. non-streaming mode does not affect sampling. The same temperature, the same model, the same prompt will produce statistically similar outputs regardless of whether `stream: true` or `stream: false`. Streaming is a delivery format, not a generation parameter. The non-determinism discussed in the sampling dossier (floating-point variance, batching effects) applies equally to both modes.

---

## 8. House-style chapter ideas

### Diagram option A — SSE event timeline (primary recommendation)

An HTML/CSS step-through showing the actual SSE events arriving as the model produces a `tool_use` block. Use the same visual vocabulary as Ch 7's `RequestAnatomy.tsx` — colored horizontal bands.

Timeline has three columns: **time** (vertical axis, vertical bar with tick marks at 250ms intervals), **event type** (pill badge with color coding by event type — message events in blue, content block events in green, delta events in amber), **data** (content preview, truncated). Events arrive in sequence: `message_start` → `content_block_start` (text) → several `text_delta` events → `content_block_stop` → `content_block_start` (tool_use) → several `input_json_delta` events → `content_block_stop` → `message_delta` → `message_stop`.

Color coding for event types:
- `message_start`, `message_delta`, `message_stop`: blue
- `content_block_start`, `content_block_stop`: green
- `content_block_delta` with `text_delta`: amber
- `content_block_delta` with `input_json_delta`: orange (distinct from text)
- `content_block_delta` with `thinking_delta`: purple
- `ping`: grey (faded, minor)

A "play/pause" button controls the playback. Speed slider (0.5x to 2x). The key moment: the pause between text block closing and tool_use block opening (shown as a gap in the timeline with a "model deciding" label), then the gradual accumulation of `partial_json` fragments, then the parser running once the block closes.

**Component name:** `SSETimeline.tsx`
**Data file:** `src/data/streaming.ts` — export `sseEvents: SseEvent[]` where each event has `{ timestampOffsetMs: number, eventType: string, data: object, annotation?: string }`. ~20 events for a tool_use response.
**Takeaway:** "You are watching the decode phase happen in real time. The tool call is just JSON being assembled, fragment by fragment."

### Diagram option B — Three mechanisms compared (side-by-side)

Three columns: Prompt-constrained / Tool-use / Grammar-constrained. Each column has a simplified stack showing where the constraint is applied: prompt (top, before the model), trained behavior (middle, in the model's logit prediction), sampler (bottom, post-logit token filter).

Boxes with arrows showing the flow. The prompt-constrained column shows the constraint at the top and a big "MAY FAIL" marker at the output. The tool-use column shows the constraint in the model's behavior and a "USUALLY WORKS" marker. The grammar-constrained column shows the constraint at the sampler and an "ALWAYS VALID" marker (with a footnote: within schema limits).

HTML/CSS, no SVG required. Three flex columns with vertically stacked boxes.

**Component name:** `StructuredOutputMechanisms.tsx`
**Data file:** none needed; static or driven by `src/data/streaming.ts` mechanism config.
**Takeaway:** "Same desired outcome — valid JSON. Three very different guarantees."

### Demo option A — Play/pause token stream

A "token stream player" that replays a hand-authored stream at controllable speed. Three preset scenarios:
- Plain text response (just `text_delta` events)
- Response with tool call (text + `input_json_delta` stream, parser runs on close)
- Response with thinking (thinking block first, then text block)

Toggle buttons switch scenarios. Speed slider (0.5x to 3x). A JSON parse status indicator shows "waiting..." during accumulation and "parsed!" when the block closes.

The UI has two panels. Left panel: a scrolling event log that shows each SSE event type and a truncated preview of its data as it arrives. Right panel: an accumulated text box (for text blocks) or an accumulated JSON box with syntax highlighting (for tool_use blocks). The JSON box is greyed out with "incomplete" styling until the block closes, then turns green when the parse succeeds.

A "parse now" button is disabled during accumulation and active once `content_block_stop` fires — clicking it early shows an error ("SyntaxError: Unexpected token"), clicking it after close shows the parsed object. This is the key pedagogical moment: the reader discovers viscerally why premature parsing fails.

**Component name:** `TokenStreamPlayer.tsx`
**Data file:** `src/data/streaming.ts` — three scripted event arrays with timing offsets.
**Takeaway:** "You see why you cannot parse mid-stream. The JSON is incomplete until the block closes."

### Demo option B — Schema enforcement sandbox

A text area where the user types a deliberate schema violation into a mock tool definition. When the tool definition mismatches the expected output, a "CACHE MISS" indicator fires and a "PARSE ERROR" indicator fires for the response. Resetting the schema restores both.

**Component name:** `SchemaEnforcementDemo.tsx`
**Data file:** `src/data/streaming.ts` — sample tool definition, correct output, deliberately mismatched output.
**Takeaway:** "The schema is a contract. Break it and two things break: the cache and your parser."

---

## 9. Hand-authored data plan

File: `src/data/streaming.ts`

The file exports four things:

**1. The `SseEvent` interface** — each event has `timestampOffsetMs: number`, `eventType` (one of the seven documented Anthropic event types), `data: Record<string, unknown>` (the event's JSON body), and an optional `annotation: string` shown as a tooltip in the diagram.

**2. Three scripted event arrays** — `textOnlyStream`, `toolUseStream`, `thinkingStream`. Each is an `SseEvent[]`. See timing notes below and in the data-authoring subsection. The `toolUseStream` includes a visible 500ms pause between the text block closing and the tool_use block opening, representing the model's tool-call decision. The `thinkingStream` includes both `thinking_delta` events and a `signature_delta` event with a realistic-length placeholder signature string.

**3. `sampleOutputTool`** — an illustrative tool definition with name `extract_contact`, a description, and a three-field `input_schema` with `name` (required), `email` (required), and `company` (optional). Used by the schema enforcement demo.

```typescript
export const sampleOutputTool = {
  name: "extract_contact",
  description: "Extract structured contact information from text.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Full name." },
      email: { type: "string", description: "Email address." },
      company: { type: "string", description: "Company or organization." }
    },
    required: ["name", "email"],
    additionalProperties: false
  }
};
```

**4. Sample structured outputs** — `conformantOutput` (all required fields, correct types), `nonConformantOutput` (wrong field names, missing required field), `semanticallyWrongOutput` (schema-valid but content is wrong — this is the "schema = shape, not truth" illustration).

All data is hand-authored, illustrative, and labeled as such in the chapter prose. No real API calls, no real inference.

### Data authoring notes

**Timing offsets should feel realistic.** TTFT for a Claude response is typically 500–2000ms depending on prompt length. Decode throughput is roughly 50–80 tokens/sec for large models. For a 10-token reply, that is 125–200ms of decode time after prefill. The `textOnlyStream` should have its first `content_block_delta` at ~500ms offset and space subsequent deltas ~50–100ms apart. This makes the timeline diagram feel like a real response, not an animation.

**The pause before a tool_use block is pedagogically important.** The `toolUseStream` should include a visible gap (400–600ms) between the text block closing and the tool_use block opening. This gap represents the model deciding to make a tool call — the moment where tokens are being generated that match the opening of a `tool_use` block. Making this gap visible in the demo helps the reader understand that the model's decision to call a tool is not instant; it is just another sequence of tokens, and those tokens happen to match the trained tool-call format.

**The `input_json_delta` fragments should be realistic subword chunks.** Do not split on key-value boundaries only. A realistic stream for `{"location": "San Francisco, CA"}` might produce: `{"`, `loc`, `ation`, `":`, ` "San`, ` Fran`, `cisco`, `,`, ` CA`, `"}`. Model this in the data file.

**The `signature_delta` in the thinking stream should be a realistic-length string.** Real signatures from the Anthropic API are base64-encoded strings of ~100–200 characters. Use a plausible-length placeholder rather than a short fake like `"sig123"`. This helps the reader understand that the signature is cryptographic material, not a label.

---

## 10. Connections to existing chapters

**Ch 5 — Generation (direct prerequisite).**
Streaming IS decode, delivered progressively. The autoregressive step that Ch 5 illustrates with the "step" button is the same step that produces each `text_delta` event. Streaming just sends you the step's output immediately rather than buffering until `message_stop`. The streaming chapter should open with an explicit reference: "In Ch 5, the 'step' button advanced one decode step at a time. Streaming is what happens when that step runs in real time on the server and the output is sent to you immediately."

The Ch 5 diagram shows: prompt tokens feed into prefill → first generated token emerges → decode step → second token → and so on. Map this directly to SSE events: `message_start` happens during prefill (the model is processing the prompt, no tokens visible yet), `content_block_delta` events fire during decode (one per generated chunk), `message_delta/stop` fire when decode terminates. The SSE timeline diagram (section 8, Diagram A) is the visual companion to Ch 5's autoregressive diagram.

**Ch 1 — Tokens (vocabulary and chunking).**
Ch 1 establishes that the model's vocabulary is a fixed set of token IDs, typically 32,000–128,000 entries. The streaming chapter should note: `text_delta` events carry character strings, not token IDs — the tokenization step happens inside the model, and by the time the server sends the SSE event, the sampled token ID has been decoded back to a string (its text representation). What streams to you is not tokens; it is the UTF-8 encoding of the token's text. One token ID produces one text string; that string may be a partial word, a full word, or a punctuation character with trailing space.

This matters for the streaming data plan: the hand-authored `SseEvent[]` arrays should model realistic chunking behavior (partial words, punctuation, spaces) not neat word-by-word splits. "Hello world" would not arrive as two events `{"text":"Hello"}` and `{"text":"world"}` — it might arrive as `{"text":"Hel"}`, `{"text":"lo "}`, `{"text":"wor"}`, `{"text":"ld"}`.

**Tool-use dossier (strong thematic overlap).**
Structured outputs on Anthropic are historically built on tool use. The tool-use dossier's section on `tool_choice` forcing and `input_schema` design is directly relevant. The streaming chapter should cross-reference the tool-use control flow and note that when streaming is enabled, the tool_use block accumulates via `input_json_delta` before the harness can act on it.

The tool-use dossier's section 4 describes the harness-side reading of `tool_use` blocks. The streaming version of that is the `input_json_delta` accumulation pattern: instead of receiving a complete `input` object in the `tool_use` block, you receive an empty `input: {}` placeholder in `content_block_start`, then accumulate `partial_json` strings from `input_json_delta` events, then parse once `content_block_stop` fires. This is a streaming-specific adaptation of the same control flow.

**Ch 7 — Prompt cache (cache interaction).**
Schema-as-tool-definition is a silent cache invalidator (Ch 7's "surprising invalidators" section). The structured outputs chapter makes this concrete: when you use the tool-use pattern for structured output, your schema change looks like an innocuous edit but is actually a cache bust. Section 6 of this dossier is the bridge between structured outputs and Ch 7.

Ch 7 also establishes that cache hits are token-level and prefix-exact. This is relevant to the grammar cache as well: the grammar cache is keyed on schema content, which means even whitespace changes in the JSON schema definition (a two-space indent vs. four-space) could invalidate the grammar cache if the schema is serialized including whitespace. The practical guidance: use a canonical serialization (e.g., `JSON.stringify(schema)` in JavaScript, which produces a compact no-whitespace form) as your schema representation; do not use human-readable pretty-printed JSON as the schema object you pass to the API.

**Sampling dossier (parallel concern).**
Sampling parameters (temperature, top-p) interact with both streaming and structured outputs. Temperature setting has no effect on which tokens are streamed — only on which token is sampled. With grammar-constrained decoding, temperature applies to the *filtered* logit distribution, not the full vocabulary distribution. This is a subtle but real interaction: constrained decoding + low temperature = strong convergence on the highest-probability valid token at each step; constrained decoding + high temperature = more variation within the set of valid-schema tokens. The schema constraint reduces the effective vocabulary at each decode step; temperature then shapes sampling within that reduced set.

This connection is noted here but the full treatment belongs in the sampling chapter. For the streaming/structured-outputs chapter, a one-sentence callout suffices: "Temperature still applies when using constrained decoding — it shapes the distribution among valid tokens, not the full vocabulary."

**Extended thinking (direct dependency on stream ordering).**
Thinking blocks arrive before text blocks in the stream. The streaming chapter must describe the `thinking_delta` and `signature_delta` event types and the guaranteed ordering: thinking block (index 0) fully closes before the text block (index 1) opens. The `signature_delta` event just before `content_block_stop` for a thinking block is specific to thinking content and has no analog in text or tool_use blocks. Code that iterates over `content_block_delta` events without checking `delta.type` will mishandle `signature_delta` events (they carry a `signature` field, not a `text` or `thinking` field).

---

## 11. Closing-takeaway angle

The cleanest frame for a reader who uses Claude daily:

"When you tell Claude to 'return JSON,' you are using one of three mechanisms, and you probably do not know which one. If you used `output_config.format`, the sampler itself was constrained — the model literally could not produce invalid JSON. If you used a tool definition, the model was steered by training, not by the sampler — it almost always works but occasionally does not. If you just asked in the prompt, you got no guarantee at all.

The streaming was always happening under the hood. Turning it on just lets you see the decode phase as it runs, one token at a time. The tokens are the same either way.

The practical takeaway: pick the right mechanism for your reliability requirement. Schema shape is always checked before content correctness. And if your session feels slower after you edited the schema, the cache is telling you why."

**An alternative closing angle that may land better for the site's audience:**

Most people who use ChatGPT or Claude have two distinct experiences: watching text appear word by word as the model generates it (that is streaming), and asking the model to "give me the output as JSON" and hoping it works (that is structured output). This chapter connects both to what you already know about how the model works.

Streaming is the decode phase made visible. Every `text_delta` event is one decode step arriving in real time. The model is doing the same work either way; streaming just moves the moment you see the result from "when it is all done" to "as each token is produced." The diagram from Ch 5 — prompt → prefill → decode → decode → decode → done — maps directly to the SSE event timeline: `message_start` at the end of prefill, a `content_block_delta` per decode step, `message_stop` at done.

Structured output is the decode phase constrained. Instead of sampling from the full vocabulary at each decode step, the model samples from the subset of tokens that keep the partial output valid against your schema. The schema is compiled into a grammar before generation starts. Each step, the grammar advances its state. Tokens that would put the grammar in an invalid state are masked out. The result is output that cannot be schema-invalid — but can absolutely be semantically wrong.

The interplay: when you stream structured output, you are watching a constrained decode unfold token by token. The output is always on a valid path, but you cannot parse it as JSON until the block closes because a valid JSON path is not a complete JSON document. You have to watch it all arrive before you can use it.

That is the mental model: streaming is timing, structured output is shape, and they compose cleanly once you have both concepts in place.

---

## 12. Suggested opening paragraph for the chapter (draft)

Not final prose — illustrative angle for the builder agent to adapt:

"In Ch 5, a 'step' button walked you through the decode phase one token at a time. Every time you click it in production, the server is generating that token and — if streaming is enabled — immediately sending it to you over an open HTTP connection. The button is just a teaching abstraction; the real thing is a stream of server-sent events.

Most Claude users have seen this. Tokens appear as they are generated; the cursor blinks; the text builds word by word. What you have not seen is what is happening to that stream when you ask Claude to 'return JSON.' That is where structured output enters — and where the two ideas need to be kept separate. Streaming is about timing: when you see the output. Structured output is about shape: what the output can contain. They compose, but they are not the same thing, and confusing them causes specific, frustrating bugs."

---

## 13. Up-to-date facts (citations and dates)

| Fact | Value | Source |
|---|---|---|
| Anthropic streaming transport | Server-Sent Events (SSE) over HTTP | https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17 |
| Anthropic SSE event types (2026) | message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop, ping, error | https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17 |
| Anthropic delta types | text_delta, input_json_delta, thinking_delta, signature_delta | https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17 |
| input_json_delta behavior | Partial JSON string fragments; accumulate until content_block_stop; current models emit one complete key-value at a time | https://platform.claude.com/docs/en/api/messages-streaming, fetched 2026-05-17 |
| eager_input_streaming | Per-tool opt-in flag; streams without JSON validation; reduces first-delta latency; may produce incomplete JSON on truncation | https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming, fetched 2026-05-17 |
| Anthropic structured output mechanism (2026) | `output_config.format` with `type: "json_schema"` uses constrained decoding (grammar-compiled sampling), not prompt tricks | https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17 |
| Grammar cache TTL | 24 hours from last use; invalidated on schema change | https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17 |
| Grammar compilation timeout | 180 seconds maximum | https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17 |
| Structured output + streaming | Supported; grammar constraint applies token-by-token during decode | https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17 |
| Anthropic structured output: unsupported schema features | Recursive schemas, numerical range constraints, string length constraints, most array cardinality constraints | https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs, fetched 2026-05-17 |
| strict: true on tool definitions | Also uses constrained decoding; guarantees tool inputs match schema | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview, fetched 2026-05-17 |
| Anthropic temperature range | 0.0 to 1.0; default 1.0 | https://platform.claude.com/docs/en/api/messages, fetched 2026-05-17 |
| Token healing | Reconsiders last free token to align tokenization boundary with constraint; required for correct constrained decoding | https://dottxt-ai.github.io/outlines/latest/, fetched 2026-05-17 |
| Outlines library | Open-source grammar-constrained generation for any LLM (vLLM, Transformers, Ollama, etc.) | https://dottxt-ai.github.io/outlines/latest/, fetched 2026-05-17 |
| Prompt cache breakpoints | Up to 4 per request; tool defs sit in cached prefix | Ch 7 / GOAL.md |

---

## 14. Open questions

**1. Does Anthropic publish the mechanism underlying `output_config.format` in full technical detail?**
The documentation says "constrained decoding" and "compiled grammar artifacts" — this is more explicit than most providers. However, the specific grammar formalism (finite automaton? pushdown automaton? parser combinator?) is not published. The schema limitation list (no recursive schemas, no numerical constraints) is consistent with a regular or context-free grammar backend, but this is inferred, not documented. The dossier treats the documented claim ("constrained decoding") as established and notes the schema limitations as confirmed behavior.

**2. OpenAI's `response_format: {type: "json_schema", strict: true}` — confirmed constrained decoding or not?**
The OpenAI documentation was not accessible during research (HTTP 403). The widely-cited community understanding is that OpenAI's structured outputs with `strict: true` also use constrained decoding, but this claim could not be verified from primary sources during this dossier's research window. The comparison table in section 4 reflects the prevailing community understanding, marked as unverified for OpenAI's mechanism specifically.

**3. The `output_config` parameter itself — is it shipping to all models and regions?**
The documentation lists availability for Claude Opus 4.7, 4.6, 4.5, Sonnet 4.6, 4.5, and Haiku 4.5. The parameter appears in the Messages API reference but the dossier fetched the Messages API docs via a model-inferred summary, not a raw parameter list. Before the chapter is written, the author should verify that `output_config` appears in the actual API reference, not just the structured outputs guide.

**4. Grammar cache and prompt cache interaction — is there a documented order of operations?**
If the prompt cache is checked first and misses, but the grammar cache hits, what happens? Presumably: the full prompt is reprocessed (no cache credit for the prefix) but the grammar compilation is skipped (grammar cache credit). This is the logical interpretation, but it is not explicitly stated in the documentation. A production developer designing a caching strategy should test this rather than assuming.

**5. Thinking + structured output (`output_config.format`) — is this combination supported?**
The documentation states `output_config.format` works with streaming and prompt caching. It does not explicitly state whether extended thinking can be combined with `output_config.format`. If thinking produces a thinking block followed by a text block, and the text block must be schema-conformant JSON, it is unclear whether the constrained grammar applies to the text block's generation while thinking is in the context. This should be tested before a chapter claims the combination works.

**6. What is the tokenization of the SSE event stream itself?**
The chapter's premise is that `text_delta` events carry the UTF-8 decoding of token IDs, not raw token IDs. This is the expected behavior based on how language model APIs work, but the Anthropic documentation does not explicitly confirm the per-event granularity. It says "one or more content_block_delta events per block" without specifying whether each event corresponds to exactly one token, multiple tokens, or a character boundary. The hand-authored data plan assumes realistic subword chunking. If the actual behavior is coarser (e.g., full-word chunks rather than subword chunks), the streaming demo's timing and chunking may not feel authentic. This should be validated against a live API call before the demo data is finalized.

**7. Does `eager_input_streaming` interact with `output_config.format`?**
`eager_input_streaming` is a per-tool flag that bypasses JSON validation buffering for tool arguments. `output_config.format` constrains the top-level response text. These appear to be orthogonal features — `eager_input_streaming` applies to `tool_use` block inputs, while `output_config.format` constrains the `text` block output. But no documentation explicitly confirms or denies their interaction. A response with both a tool call and a structured text output using `output_config.format` would exercise both simultaneously. This edge case is worth testing before the chapter makes any claim about combining them.

---

*Iterations used: 2 of 2. Stopping reason: done — all required sections complete, structure and content reviewed on second pass, no meaningful improvement available.*

*Remaining issues not fixed: OpenAI structured output mechanism could not be verified from primary sources (HTTP 403 on docs). The comparison table in section 4 reflects community consensus, not a primary-source citation for OpenAI's mechanism. The `output_config` parameter itself requires a secondary verification pass against the live API reference before the chapter is finalized. See Open Questions 2 and 3.*

*Reason for stopping: iteration limit reached with no unresolved correctness issues in Anthropic-specific claims.*
