# Research dossier — Extended thinking / reasoning

**Status:** research-only. Drives a future Part II chapter.
**Date:** 2026-05-17.
**Audience:** see GOAL.md — daily Claude user, knows surface terms, no ML background.

---

## 1. Plain-language premise (~200 words)

Most of the time you type a message to Claude and a reply starts appearing in a second or two. Sometimes — especially on hard tasks — there is a longer pause first, and then you might see a collapsible "Thinking…" section before the actual answer arrives.

The question this chapter answers: what is that pause? Is Claude doing something fundamentally different? Is there a second model hidden inside the first one?

The short answer is no. There is one model, and it is doing exactly what Chapter 5 described: generating tokens, one at a time, left to right. The difference is that when thinking mode is on, the model first generates a stretch of tokens labeled as "thinking" — a scratchpad — before generating the tokens labeled as "answer." You are watching the same autoregressive loop from Chapter 5, just split into two labeled phases.

The longer answer involves why that matters: a model that writes out intermediate steps before committing to a final answer tends to make fewer errors on tasks that require multi-step reasoning. The mechanism is the same; the consequence is real. This chapter explains both.

Frame for the reader: "It is not magic. It is more tokens spent before the answer tokens start. The question is whether those tokens are worth spending."

---

## 2. What extended thinking is, mechanically

### 2.1 The same decoder, a different label

Extended thinking does not add a second model, a separate reasoning engine, or any hidden computation. It extends the normal autoregressive decode sequence with a block of tokens that the API tags as `type: "thinking"` rather than `type: "text"`. The model runs the same forward passes, through the same layers, producing one token at a time — exactly as described in Ch 5 (Generation).

The distinction to hammer home for this audience: there is no "inner life" or "silent reasoning" happening in parallel with generation. Whatever computation the model does happens in the tokens you can observe (or at least observe the cost of). Before extended thinking existed, that computation had to happen implicitly, compressed into the attention heads at each layer. With extended thinking on, the model is explicitly allocated token budget to write out intermediate steps before producing the final answer.

**Important caveat (label as inference):** The claim "thinking tokens help because they allow intermediate steps" is the standard explanation and is consistent with the research literature on chain-of-thought prompting, but Anthropic has not published mechanistic proof that this is the only reason it helps. Treat it as a well-supported working model, not a verified internal fact.

### 2.2 Thinking tokens vs. chain-of-thought prompting

These look similar but differ in a key way:

- **Chain-of-thought prompting:** You ask the model to "think step by step" in your prompt. The model produces step-by-step reasoning as part of its normal text output, visible in the `text` content block.
- **Extended thinking:** A dedicated API parameter (`thinking`) causes the model to emit reasoning in a separate, tagged `thinking` content block before the `text` response. The thinking block has its own encrypted signature, cannot be injected or modified by the user, and is handled differently in pricing and caching.

The key practical difference: with extended thinking, Anthropic controls the thinking format and verifies (via the signature) that the thinking was genuinely produced by the model during that request, not inserted afterward. This matters for multi-turn use: the model can rely on its own prior thinking in a way it cannot rely on user-inserted "reasoning."

### 2.3 Connection to Ch 5 (Generation)

In Ch 5 terms: prefill still happens once (your prompt goes through all layers in one forward pass). Decode is where thinking lives. The decode sequence now looks like:

```
[thinking token 1] → [thinking token 2] → … → [thinking token N]
→ [answer token 1] → [answer token 2] → …
```

Every thinking token is autoregressive: the model attends to all prior tokens (including your prompt and all prior thinking tokens) before generating the next one. The thinking block is not a lookup or a retrieval — it is generation. This means it costs output-tier pricing and takes real wall-clock time.

---

## 3. The Anthropic API surface — current 2026 state

All claims in this section are documented behavior. Sources cited at the end.

### 3.1 The `thinking` parameter

**Source:** Anthropic extended thinking docs, fetched 2026-05-17.
URL: `https://platform.claude.com/docs/en/build-with-claude/extended-thinking`

The `thinking` field is an object on the Messages API request body. Three modes:

```json
{ "type": "adaptive" }
{ "type": "enabled", "budget_tokens": 10000 }
{ "type": "disabled" }
```

Additional optional field:

```json
{ "type": "adaptive", "display": "summarized" }
{ "type": "enabled", "budget_tokens": 10000, "display": "omitted" }
```

**`type` values:**
- `"adaptive"` — Claude decides when and how much to think based on request complexity. The recommended mode for Claude Opus 4.7, Opus 4.6, and Sonnet 4.6. Automatically enables interleaved thinking (thinking between tool calls).
- `"enabled"` — Manual mode. Requires `budget_tokens`. Deprecated on Opus 4.6 and Sonnet 4.6. **Rejected with a 400 error on Opus 4.7.**
- `"disabled"` — No thinking. Equivalent to omitting the parameter.

**`budget_tokens` (manual mode only):**
- Sets the maximum number of tokens the model may use for its thinking phase.
- Must be less than `max_tokens` (the overall output cap).
- Cannot be combined with `max_tokens: 0` (which is used for cache pre-warming, a different feature).
- The model may not use the entire budget, especially above 32k tokens — the docs note diminishing returns above that range.
- Changing `budget_tokens` between requests invalidates message-level cache entries (see Section 5).

**`display` values:**
- `"summarized"` — The `thinking` field in the response contains a summary of the model's full reasoning. You are billed for the full reasoning tokens, not the summary tokens. Default on Opus 4.6, Sonnet 4.6, and earlier Claude 4 models.
- `"omitted"` — The `thinking` field is an empty string. The `signature` field still carries encrypted full reasoning for multi-turn continuity. Reduces streaming latency (first text token arrives sooner) because thinking tokens are not transmitted. Does **not** reduce cost. Default on Opus 4.7 and Claude Mythos Preview.

**The `effort` parameter (adaptive mode only):**

When using `thinking: {type: "adaptive"}`, you can add `output_config: {effort: "<level>"}` to guide thinking depth:

| Level | Behavior |
|---|---|
| `max` | Always thinks with no depth constraint |
| `xhigh` | Always thinks deeply (Opus 4.7 only) |
| `high` (default) | Always thinks |
| `medium` | Moderate thinking; may skip on simple queries |
| `low` | Minimizes thinking |

**Source:** Anthropic adaptive thinking docs, fetched 2026-05-17.
URL: `https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`

### 3.2 Model support

**Source:** Anthropic models overview, fetched 2026-05-17.
URL: `https://platform.claude.com/docs/en/about-claude/models/overview`

| Model | Manual (`enabled`) | Adaptive | Notes |
|---|---|---|---|
| Claude Opus 4.7 (`claude-opus-4-7`) | Rejected (400 error) | Only supported mode | Latest flagship |
| Claude Opus 4.6 (`claude-opus-4-6`) | Deprecated (functional) | Recommended | Legacy |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Deprecated (functional) | Recommended | Current mid-tier |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | Supported | Not supported | Fast/cheap tier |
| Claude Sonnet 4.5, Opus 4.5, 4.1 | Supported | Not supported | Legacy |
| Claude Mythos Preview | Supported | Default (always on) | Research preview; invite-only |

As of 2026-05-17, Claude Haiku 4.5 does **not** support adaptive thinking; only manual extended thinking. Claude Opus 4.7 does **not** support manual extended thinking; only adaptive.

### 3.3 Response content blocks

A response with thinking enabled returns two content blocks in order:

```json
{
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me work through this step by step...",
      "signature": "WaUjzkypQ2mUEVM36O2TxuC06KN..."
    },
    {
      "type": "text",
      "text": "The answer is 42."
    }
  ]
}
```

The `signature` is an encrypted representation of the full thinking. It must be passed back unmodified in multi-turn conversations; the API verifies it. The `signature` is the same whether `display` is `"summarized"` or `"omitted"` — only the visible `thinking` text differs.

### 3.4 Streaming behavior

Streaming with thinking enabled produces events in this order:

1. `content_block_start` (type: `thinking`)
2. Multiple `content_block_delta` events with `type: "thinking_delta"` (the thinking text, chunk by chunk)
3. `content_block_delta` with `type: "signature_delta"` (the encrypted signature)
4. `content_block_stop`
5. `content_block_start` (type: `text`)
6. Multiple `content_block_delta` events with `type: "text_delta"`
7. `content_block_stop`

With `display: "omitted"`, step 2 is skipped entirely — no `thinking_delta` events are emitted. The text response starts streaming as soon as the signature is sent, reducing time-to-first-text-token. Cost is unchanged.

### 3.5 Tool use interaction (interleaved thinking)

Extended thinking can be combined with tool use, but with constraints.

**Constraint on `tool_choice`:** When thinking is enabled, only `tool_choice: {type: "auto"}` or `tool_choice: {type: "none"}` are allowed. Forced tool selection (`any`, `tool`) is not supported.

**Interleaved thinking:** In adaptive mode (and in manual mode on Sonnet 4.6 with a beta header), Claude can produce thinking blocks *between* tool calls, not just before the first response. This means Claude can reason about a tool's result before deciding what to call next. In pure manual mode on Opus 4.6, interleaved thinking is not available.

**Preserving thinking blocks in tool loops:** When Claude responds with a thinking block plus a `tool_use` block, you must pass the thinking block back unchanged when sending the tool result. Stripping or modifying the thinking block breaks the conversation. The signature verifies authenticity.

```python
# Required pattern for tool loops with thinking:
messages = [
    {"role": "user", "content": "..."},
    # Must include both blocks from Claude's response:
    {"role": "assistant", "content": [thinking_block, tool_use_block]},
    {"role": "user", "content": [{"type": "tool_result", ...}]}
]
```

**Source:** Anthropic extended thinking docs (tool use section), fetched 2026-05-17.

### 3.6 Pricing

**Source:** Anthropic pricing page, fetched 2026-05-17.
URL: `https://platform.claude.com/docs/en/about-claude/pricing`

Thinking tokens are billed as **output tokens** at the standard output rate for the model. There is no separate "thinking token" price tier. For Claude Opus 4.7: $25 / MTok (same as any other output token).

Key billing nuance: when `display: "summarized"`, you are billed for the **full thinking tokens generated**, not the shorter summary you see in the response. The visible token count and the billed token count will not match. This is documented behavior, not a bug.

Reference pricing (as of 2026-05-17):

| Model | Input | Output (incl. thinking) | 5m cache write | Cache read |
|---|---|---|---|---|
| Claude Opus 4.7 | $5 / MTok | $25 / MTok | $6.25 / MTok | $0.50 / MTok |
| Claude Sonnet 4.6 | $3 / MTok | $15 / MTok | $3.75 / MTok | $0.30 / MTok |
| Claude Haiku 4.5 | $1 / MTok | $5 / MTok | $1.25 / MTok | $0.10 / MTok |

A request that generates 8,000 thinking tokens and 500 answer tokens on Opus 4.7 costs 8,500 × $25 / 1,000,000 = $0.2125 in output charges, plus input charges. The thinking tokens dominate.

---

## 4. When extended thinking actually helps

Anthropic's documented guidance is sparse — the docs describe what extended thinking does more than when to use it. The following framing synthesizes Anthropic's stated use-case examples with the broader research literature on chain-of-thought reasoning. Claims from the research literature are labeled as such and hedged.

### 4.1 Tasks where it consistently helps

**Multi-step reasoning:** Math problems, logic puzzles, and coding challenges where each step depends on the previous one. The research literature on chain-of-thought (Wei et al., 2022, and subsequent work) shows consistent gains on these tasks — inference: this generalizes to extended thinking, though mechanistically different from user-prompted CoT.

**Planning under constraints:** Tasks that require laying out a sequence of actions before executing any of them — debugging a complex system, designing a schema, writing a legal argument. Writing out a plan first reduces backtracking in the generated answer.

**Careful editing:** Tasks where "read first, then write" is the right strategy. Extended thinking lets the model process and evaluate the input at length before producing output, rather than generating output concurrently with reading.

**Multi-turn tool use:** With interleaved thinking enabled, Claude can reason about a tool result before deciding the next tool call. This tends to reduce "call the wrong tool next" errors in complex agentic workflows.

**Source (Anthropic docs):** The docs cite "complex reasoning tasks, math, logic, code analysis, multi-step problems requiring intermediate verification" as the primary use cases. URL: `https://platform.claude.com/docs/en/build-with-claude/extended-thinking`, fetched 2026-05-17.

### 4.2 Tasks where it does not help (and should be skipped)

**Factual recall:** "What is the capital of France?" Thinking does not give the model access to facts it does not already have. A recall task does not benefit from self-generated intermediate steps. At low effort (`effort: "low"` or `effort: "medium"` in adaptive mode), Claude will often skip thinking for simple factual queries — this is the intended behavior.

**Simple text extraction or formatting:** Structured-output extraction, format conversion, template filling. These tasks are typically solved in one pass without needing intermediate reasoning.

**Latency-sensitive UIs:** Thinking adds real latency (the full thinking-token sequence must complete before the answer starts, in non-streaming contexts; in streaming, text begins only after the thinking phase). For interactive applications, the default `display: "omitted"` on Opus 4.7 reduces streaming latency, but thinking still prolongs time-to-first-text relative to no thinking.

**Tasks already solved well without thinking:** Short code completion, paraphrasing, translation of a sentence. If the standard model already gets these right, spending thinking tokens buys nothing.

### 4.3 Where it can actively hurt

**Structured output reliability:** In some workflows, extended thinking can cause the model to reason itself into a different format than requested. If you need guaranteed JSON or a fixed schema, test carefully — the thinking phase does not guarantee format adherence.

**Cost at scale:** At $25 / MTok for Opus 4.7 output, a 16k thinking budget generates $0.40 in thinking charges per request before any answer tokens. At scale, an always-on thinking mode is a significant cost choice. The adaptive mode with `effort: "medium"` or `effort: "low"` is a better default for bimodal workloads (mix of easy and hard requests).

### 4.3 Calibrating expectations: the "harder task" heuristic

A practical heuristic for the chapter: extended thinking helps when the task has a structure where "more scratchpad" meaningfully changes the answer. Tasks with this property tend to share a few characteristics:

- **State accumulation:** The answer at step 10 depends on a fact established at step 3 (e.g., a math derivation, a debugging trace).
- **Self-correction opportunity:** The model can recognize a wrong intermediate step and revise it before committing to an answer.
- **Constraint satisfaction:** The final answer must satisfy multiple requirements simultaneously (e.g., "write a function that is O(n log n), uses no external libraries, and handles empty input").

Tasks without these properties — where the answer is "one lookup away" or the model already produces the right answer without self-correction — do not benefit, and the latency and cost are pure overhead.

### 4.4 A note on benchmarks

Anthropic has published benchmark improvements (HLE, AIME 2025) for Claude 3.7 Sonnet with extended thinking enabled, showing large percentage-point gains on these specific tests. The chapter author should be cautious about citing these numbers directly:

- HLE and AIME are specifically designed to reward careful multi-step reasoning — exactly the category where extended thinking helps most. They may not represent typical workloads.
- Benchmark numbers are model-specific and version-specific. By the time this chapter is read, the numbers will have changed.
- The improvement on benchmarks does not linearly predict improvement on a given production task.

Recommendation: cite the existence of published benchmark gains and point to Anthropic's blog posts, but do not anchor any specific percentage in chapter prose. Use illustrative, hand-authored examples instead.

### 4.5 The adaptive mode resolution

The introduction of adaptive mode with effort levels (`max`, `xhigh`, `high`, `medium`, `low`) is Anthropic's answer to the "when to think" problem. Rather than requiring developers to decide per-request, adaptive mode delegates the decision to the model, with effort as a soft guide.

This matters pedagogically: the chapter can frame the "when does thinking help" question not just as a developer decision, but as something the model can reason about itself when given the latitude to do so. At `effort: "medium"`, the model will skip thinking for "What is the capital of France?" and invoke it for a multi-step planning task — because the model's internal estimate of task complexity drives the decision, not a hardcoded rule.

**Caveat (inference):** Anthropic has not published details of how the model decides whether to think in adaptive mode — the docs say it "evaluates the complexity of each request." Treat this as a soft guideline, not a mechanical specification.

---

## 5. The cache interaction (CRITICAL — verified against current docs)

This section is the most pedagogically tricky. The behavior is non-obvious and changed with model generations.

**Sources:** Anthropic extended thinking docs (prompt caching section) and adaptive thinking docs (prompt caching note), both fetched 2026-05-17.

### 5.1 Can thinking output be cached?

**Thinking blocks cannot be explicitly marked with `cache_control`.** You cannot put a `cache_control: {type: "ephemeral"}` annotation on a thinking block the way you can on a text block or system prompt segment.

**However, thinking blocks are automatically cached as part of request content in tool-use workflows.** When Claude's response to a tool-call request includes `[thinking_block] + [tool_use_block]`, and you pass that full assistant turn back as part of the next request, those blocks become part of the input context for the next request. The prompt cache treats them as regular input tokens — they can be cached if the prefix is stable.

This is a subtle but important distinction: thinking blocks cannot be *explicitly* cache-marked, but they *do* participate in the cache as ordinary content blocks when they appear in prior conversation turns.

### 5.2 Does enabling thinking break the rest of the cache?

**System prompt:** No. Changing the thinking parameter (including changing `budget_tokens`) does **not** invalidate system prompt cache entries. A cached system prompt survives a switch from `budget_tokens: 4000` to `budget_tokens: 8000`.

**Message blocks:** Yes, with nuance.
- Changing `budget_tokens` (in manual mode) **does** invalidate message-level cache entries.
- Switching between `thinking: {type: "adaptive"}` and `thinking: {type: "enabled"}` or `{type: "disabled"}` also breaks message-block cache breakpoints.
- Switching `display` between `"summarized"` and `"omitted"` does **not** invalidate cache (the underlying signature is identical).
- In adaptive mode: consecutive requests using the same `type: "adaptive"` configuration preserve message cache breakpoints. Mixing modes breaks them.

**Practical implication:** If you are running a multi-turn conversation with thinking enabled and want to keep message-block cache hits, do not change `budget_tokens` or toggle thinking mode mid-conversation. This is a silent invalidator analogous to the tool-definition changes described in Ch 7.

### 5.3 Thinking blocks in multi-turn conversations

Whether prior thinking blocks stay in context (and therefore accumulate in the prompt cache as input tokens) depends on the model:

**On Opus 4.5+ and Sonnet 4.6+:** Thinking blocks from prior turns are **kept in context by default.** They count as input tokens on subsequent requests and can be cache-read if the prefix matches.

**On earlier Opus/Sonnet models and all Haiku models:** Prior thinking blocks are **stripped from context** when non-tool-result user content is added. They do not accumulate in the prompt.

This means: on older models, you pay for thinking tokens during the turn they are generated, and then they disappear. On newer models (Opus 4.5+, Sonnet 4.6+), thinking tokens from prior turns accumulate as input tokens in subsequent turns — which increases input cost but also means those blocks can be cache-read.

### 5.4 The 1-hour cache and extended thinking

The docs recommend using the **1-hour cache duration** for extended thinking tasks. The stated reason: thinking sessions often exceed 5 minutes (the default TTL), especially for complex multi-step agentic workflows. A 5-minute TTL cache entry for a long system prompt could expire mid-task, forcing a full rewrite.

The trade-off remains: 1-hour cache writes cost 2x the standard input rate ($10 / MTok for Opus 4.7 vs. $5 base). Only worth it if the prefix is read back more than once within the hour.

### 5.4b Worked example — cache behavior across three requests

To make the rules concrete, here is an illustrative scenario (documented behavior, not measured cost):

```
Request 1: thinking: {type: "enabled", budget_tokens: 4000}
           system: [large_text, cache_control: ephemeral]
           messages: [user: "Plan a 3-step deployment."]
→ Result: system prompt cached. Messages processed uncached.

Request 2: thinking: {type: "enabled", budget_tokens: 4000}  ← same
           system: [same large_text, cache_control: ephemeral]
           messages: [same user message]
→ Result: system prompt: CACHE HIT. Messages: CACHE HIT.

Request 3: thinking: {type: "enabled", budget_tokens: 8000}  ← changed
           system: [same large_text, cache_control: ephemeral]
           messages: [same user message]
→ Result: system prompt: CACHE HIT (parameter change doesn't affect it).
          Messages: CACHE MISS (budget_tokens changed).
```

This example is based on the documented pattern in the extended thinking docs (fetched 2026-05-17). The key lesson for Ch 7 readers: `budget_tokens` is a silent cache invalidator for message blocks, just as tool definition changes are. System prompt cache is insulated from it.

### 5.5 What is undocumented

Anthropic does not document:
- The exact mechanism by which the cache decides whether a thinking block from a prior turn is "kept" or "stripped" when mixed user content is present. The docs describe the outcome but not the rule in detail.
- Whether thinking blocks cached as input tokens receive the 10x read discount or are treated differently. Based on the docs saying "they count as input tokens," inference is that standard cache-read pricing applies — but this could not be verified from a primary source.

---

## 6. Common misconceptions / pedagogical traps

**1. "Thinking is a separate inner model."**
False. Extended thinking is the same decoder producing tagged tokens. There is no second model, no hidden inference engine, no parallel process. The model runs one forward pass per token regardless of whether thinking is on or off.

**2. "More thinking budget always means better answers."**
Documented behavior says no: "Claude may not use the entire budget allocated, especially at ranges above 32k." Setting a 100k budget on a 3-step math problem wastes money and time. The model uses roughly the budget it needs for the problem at hand. Adaptive mode exists precisely to avoid manual over-budgeting.

**3. "The model automatically knows when to think and when not to."**
With `thinking: {type: "disabled"}` (the default if you omit the parameter), the model never thinks. Nothing is automatic unless you use adaptive mode. With adaptive mode at `effort: "high"` (the default), Claude thinks on almost every request — including simple ones. This is correct behavior for the effort level, but it means "adaptive" is not a free optimizer; it is a soft tuning knob.

**4. "Thinking tokens are free or cheap."**
They are billed at the standard output rate — the most expensive token category. On Opus 4.7, every thinking token costs the same as every answer token: $25 / MTok. A 16,000-token thinking budget costs $0.40 in thinking charges alone, before any answer is produced. This is the dominant cost in many thinking-enabled requests.

**5. "Hidden thinking is private."**
The thinking block is encrypted (via the `signature` field) in the sense that you cannot inject fake thinking and have the model trust it. But the API *does* return the thinking content (as a summary or full text depending on model and `display` setting). It is not hidden from the API caller. If you surface the API response to end users, they can see the thinking. Hiding thinking from users is a product decision, not a default guarantee.

**6. "If I see the thinking output, I'm seeing the model's true reasoning."**
This is a calibration warning. Thinking tokens are generated tokens — produced by the same probabilistic process as the answer. They can confabulate, express false confidence, or arrive at a wrong intermediate conclusion and then correct it. The thinking output is a window into how the model approached the problem, but it is not a ground-truth log of a deterministic computation. Treat it as informative, not infallible.

**7. "Thinking is the same as asking the model to 'think step by step'."**
Related but different. User-prompted chain-of-thought ("think step by step") produces reasoning inside the `text` block. Extended thinking produces it in a separate, signed `thinking` block that the API handles differently (caching rules, pricing, multi-turn preservation). The model cannot modify or inject into its own thinking block post-hoc; user-prompted reasoning has no such protection.

**8. "Switching to summarized vs. omitted display changes what I'm billed for."**
False. Billing is for the full thinking tokens generated, regardless of `display`. `display: "omitted"` reduces streaming latency, not cost. The billed token count and the visible token count diverge whenever thinking is on and summarized or omitted — this is documented and intentional.

**9. "I can use any tool_choice setting with thinking."**
False. With thinking enabled, `tool_choice: {type: "any"}` and `tool_choice: {type: "tool", name: "..."}` are rejected. Only `auto` and `none` are supported. This is a current API constraint, not a model limitation.

---

## 7. House-style chapter ideas

One diagram, one React island, matching the MDX template from GOAL.md.

### Diagram option A — Token timeline (recommended)

**What:** An HTML/CSS sequence diagram showing a single request as a horizontal token stream, split into labeled phases:

```
[Prompt tokens] → [Thinking tokens…] → [Answer tokens]
      ↑                    ↑                  ↑
   (input,              (output,            (output,
  prefill)             decode phase 1)     decode phase 2)
```

Below it, a "No thinking" row for the same prompt:

```
[Prompt tokens] → [Answer tokens]
```

Arrows indicate where billing categories switch. A small cost breakdown appears below each row (illustrative numbers, clearly labeled).

**Why this first:** It connects directly to Ch 5's prefill/decode diagram. The reader already has a mental model of the token stream; this extends it with a labeled thinking segment.

**Component name:** `ThinkingTimeline.tsx`
**Data file:** `src/data/extended-thinking.ts` (two scenario objects: with-thinking and without-thinking, each with illustrative token counts, phase labels, and mock costs)
**Takeaway angle:** Thinking tokens are decode-phase tokens. They cost the same as answer tokens. They extend the time before the answer starts.

---

### Diagram option B — Side-by-side panel (alternative)

**What:** Two cards, same prompt on both. Left card: no thinking, fast, possibly wrong answer (illustrative). Right card: with thinking, slower, more thorough answer (illustrative). Token count bar at bottom of each card. Latency estimate label.

**Why second:** More intuitive for a non-technical reader ("left vs. right, fast vs. slow, shallow vs. deep") but requires more illustrative data and risks implying thinking always gives a better answer, which oversimplifies.

**Component name:** `ThinkingComparison.tsx`

---

### Demo option A — Budget slider (recommended)

**What:** A React island with a slider from 0 (no thinking) to 16,000 tokens (high budget). Three positions have hand-authored illustrative outputs: 0 (direct, fast, slightly incomplete), 4,000 (structured, one round of self-correction), 16,000 (more thorough, catches an edge case). The slider snaps to these three positions. A cost display updates (illustrative numbers).

**Why this first:** Interactive, tactile, makes the budget-vs-quality trade-off concrete without requiring real API calls.

**Component name:** `ThinkingBudgetSlider.tsx`
**Data file:** `src/data/extended-thinking.ts` — three budget levels, each with a sample prompt and three illustrative responses (one for each level). Clearly labeled "Illustrative — hand-authored for teaching."
**Takeaway angle:** Budget is a cost dial, not a quality guarantee. The model uses what it needs. Over-budgeting wastes money; under-budgeting on hard tasks loses quality.

---

### Demo option B — Thinking-with-tools walkthrough (alternative)

**What:** A step-through demo of a tool-call conversation with interleaved thinking. The UI shows four "turns" as expanding panels:
1. User message
2. Claude's thinking block (showing reasoning about which tool to call)
3. Claude's tool_use block
4. Tool result + Claude's next thinking block + final answer

Each panel is collapsed by default; clicking "Next step" reveals the next panel.

**Component name:** `ThinkingToolWalkthrough.tsx`
**Data file:** `src/data/extended-thinking.ts` — a pre-scripted 4-step exchange. Tool: "search_docs(query)". Mock query, mock result, mock reasoning in thinking blocks.
**Takeaway angle:** Interleaved thinking means the model reasons about tool results before deciding the next step, not just before the first call. This is what makes agentic thinking qualitatively different from single-shot thinking.

---

## 8. Hand-authored data plan

All data in `src/data/extended-thinking.ts`. Everything labeled "Illustrative — not from a real API call."

**Scenario 1: Multi-step math problem**
- Prompt: "A train leaves city A at 9:00 AM traveling at 60 mph. Another train leaves city B (240 miles away) at 10:00 AM traveling at 80 mph toward city A. At what time do they meet?"
- Response (no thinking): "They meet at approximately 11:24 AM." (correct, but no reasoning shown)
- Response (thinking, ~4k tokens illustrative): Thinking block shows distance-rate-time setup, solving for intersection. Answer: "They meet at 11:20 AM." (intentionally slightly different to show the thinking corrects a rounding error)
- Response (thinking, ~16k illustrative): Same answer, additional verification step shown in thinking
- Token counts: prompt ~60, thinking ~400 (illustrative, not real), answer ~20
- Illustrative cost at Opus 4.7 rates: shown as "$0.01 thinking + $0.0005 answer" (rough illustration)

**Scenario 2: Simple factual question (thinking wastes budget)**
- Prompt: "What is the capital of France?"
- Response (no thinking): "Paris." — 1 token, instant
- Response (thinking, 4k budget): Thinking block shows "The capital of France is Paris, this is a well-known fact..." — Answer: "Paris." Same result, extra latency
- Illustrative cost delta: thinking version costs ~200x more for identical output

**Scenario 3: Tool-use walkthrough (for Demo B)**
- User: "Find the most recent entry in our docs about cache invalidation."
- Turn 1 thinking: "I should search the docs for 'cache invalidation'. Let me call search_docs."
- Tool use: `{"name": "search_docs", "input": {"query": "cache invalidation"}}`
- Tool result: `"Found 3 entries. Most recent: 2026-03-14 — Prompt cache TTL behavior."`
- Turn 2 thinking: "The tool returned the most recent entry. I can now answer directly."
- Final answer: "The most recent documentation entry on cache invalidation is from 2026-03-14: 'Prompt cache TTL behavior.'"

All mock. All labeled illustrative.

---

## 9. Connections to existing chapters

**Ch 5 — Generation** (`src/pages/05-generation.mdx`, line 19):
> "Language models don't generate a full sentence in one shot. They predict one token, then append it to the sequence…"

Extended thinking is a direct extension of this: the thinking block is a stretch of tokens generated by the same process before the answer tokens begin. The ThinkingTimeline diagram should visually continue the ch5 prefill/decode diagram, using the same token-box visual language.

**Ch 5, line 24 — prefill/decode distinction:**
The ch5 diagram shows "Prefill → Decode 1 → Decode 2 → …". The thinking chapter's diagram should show the same structure but with decode steps labeled as `[thinking…]` then `[answer…]` to make the continuity concrete.

**Ch 7 — Prompt cache** (`src/pages/07-prompt-cache.mdx`, line 34):
> "A cache hit is an exact token-level prefix match up to a breakpoint."

Section 5 of this dossier is the thinking-specific extension of that rule. The key additions:
- System prompt cache survives thinking parameter changes (documented).
- Changing `budget_tokens` invalidates message-block cache (documented, analogous to the "silent invalidators" callout in Ch 7 line 197).
- Thinking blocks in prior turns count as input tokens and participate in cache on Opus 4.5+ / Sonnet 4.6+.

**Ch 7, line 47 — TTL:**
> "Both tiers charge a premium to write a cache entry."

The 1-hour TTL recommendation for thinking tasks (long sessions > 5 min) maps directly to this. The chapter can cross-reference: "If your thinking-enabled session spans more than a few minutes, use the 1-hour TTL — but only if you'll read the cached prefix more than once. See Ch 7 for the math."

**Future module M-5 — Tool Use** (EXTENSIONS.md, line 93):
Extended thinking's interleaved tool-call behavior is the advanced form of the M-5 tool loop. Thinking between tool calls = the model reasons about intermediate results before deciding the next action. The thinking dossier should note: "Full coverage of tool use belongs in M-5; this chapter focuses on how thinking interacts with the tool loop, not on tool use itself."

---

## 10. Closing-takeaway angle

The chapter's closing beat should land here:

> Extended thinking trades latency and cost for reliability on hard tasks. It is not magic — it is more tokens, generated before the answer, billed at the same output rate. The mechanism is identical to ordinary generation: one token at a time, left to right, the model attending to everything written so far. What changes is that the model is explicitly allocated budget to write down intermediate steps before committing to an answer.
>
> Knowing when to spend that budget is half the value of the feature. On simple lookups, you pay for thinking tokens and get the same answer you would have gotten without them. On multi-step reasoning tasks — planning, debugging, careful analysis — those tokens do real work.
>
> Adaptive mode exists to automate the when. Budget sizing and effort level exist to control the how much. Neither frees you from understanding the trade-off: every thinking token costs the same as every answer token, and latency scales with their count. Use thinking on the problems that deserve it.

---

## 11. Up-to-date facts (with citations)

| Claim | Source URL | Fetched | Verified |
|---|---|---|---|
| `thinking` parameter has `type`, `budget_tokens`, `display` fields | `https://platform.claude.com/docs/en/build-with-claude/extended-thinking` | 2026-05-17 | Yes |
| `type: "enabled"` rejected on Opus 4.7 with 400 error | Same URL | 2026-05-17 | Yes |
| `type: "adaptive"` is only supported mode on Opus 4.7 | Same URL + adaptive thinking docs | 2026-05-17 | Yes |
| Adaptive thinking docs URL | `https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking` | 2026-05-17 | Yes |
| `budget_tokens` must be < `max_tokens` | Extended thinking docs | 2026-05-17 | Yes |
| `budget_tokens` cannot combine with `max_tokens: 0` | Extended thinking docs | 2026-05-17 | Yes |
| Thinking tokens billed as output tokens at standard output rate | `https://platform.claude.com/docs/en/about-claude/pricing` | 2026-05-17 | Yes |
| Billed for full thinking tokens, not summary tokens | Extended thinking docs + adaptive thinking docs | 2026-05-17 | Yes |
| `display: "omitted"` reduces latency, not cost | Adaptive thinking docs | 2026-05-17 | Yes |
| Opus 4.7 price: $5 input / $25 output per MTok | Pricing page | 2026-05-17 | Yes |
| Sonnet 4.6 price: $3 input / $15 output per MTok | Pricing page | 2026-05-17 | Yes |
| Haiku 4.5 price: $1 input / $5 output per MTok | Pricing page | 2026-05-17 | Yes |
| 5m cache write: 1.25x base input; 1h cache write: 2x base input | Pricing page | 2026-05-17 | Yes |
| Cache read: 0.1x base input | Pricing page | 2026-05-17 | Yes |
| Thinking blocks cannot be explicitly `cache_control`-marked | Prompt caching docs (extended thinking section) | 2026-05-17 | Yes |
| Changing `budget_tokens` invalidates message-level cache | Extended thinking docs (caching section) | 2026-05-17 | Yes |
| Changing `display` does NOT invalidate cache | Extended thinking docs | 2026-05-17 | Yes |
| System prompt cache survives thinking parameter changes | Extended thinking docs | 2026-05-17 | Yes |
| Switching adaptive ↔ enabled/disabled breaks message cache | Adaptive thinking docs | 2026-05-17 | Yes |
| Opus 4.5+ and Sonnet 4.6+: prior thinking blocks kept in context | Extended thinking docs + adaptive thinking docs | 2026-05-17 | Yes |
| Earlier models + Haiku: prior thinking blocks stripped | Same | 2026-05-17 | Yes |
| `tool_choice: "any"` and forced `tool` not supported with thinking | Extended thinking docs | 2026-05-17 | Yes |
| Interleaved thinking auto-enabled in adaptive mode | Adaptive thinking docs | 2026-05-17 | Yes |
| Model Haiku 4.5 supports manual thinking, not adaptive | Models overview page | 2026-05-17 | Yes |
| Model Haiku 4.5 context window: 200k tokens | Models overview page | 2026-05-17 | Yes |
| Model Opus 4.7 context window: 1M tokens | Models overview page | 2026-05-17 | Yes |
| Opus 4.7 uses a new tokenizer (up to 35% more tokens for same text) | Pricing page note | 2026-05-17 | Yes |
| Diminishing returns on `budget_tokens` above 32k | Extended thinking docs | 2026-05-17 | Yes |
| 1-hour cache recommended for extended thinking sessions | Extended thinking docs | 2026-05-17 | Yes |
| `effort` parameter levels: max, xhigh, high, medium, low | Adaptive thinking docs | 2026-05-17 | Yes |
| `effort: "xhigh"` is Opus 4.7 only | Adaptive thinking docs | 2026-05-17 | Yes |
| Thinking eligible for Zero Data Retention arrangements | Adaptive thinking docs | 2026-05-17 | Yes |
| Thinking blocks from prior turns count as input tokens when cached | Prompt caching docs (extended thinking section) | 2026-05-17 | Yes |

---

## 12. Comparison context — OpenAI o-series and DeepSeek R1

This section is brief by design. The chapter is about Claude's extended thinking, not a competitive comparison. This is context only.

### 12.1 OpenAI o-series

OpenAI's o1, o3, and o4-mini models expose "reasoning" as an automatic behavior: the user cannot control whether reasoning occurs or how much budget it consumes via a direct `budget_tokens` equivalent. OpenAI's older o1 / o3 models returned reasoning summaries; o4 and later may expose more. Key difference from Claude: OpenAI's reasoning is more opaque by default — less API-surface control — whereas Claude 4.x exposes `budget_tokens`, `effort`, and `display` as first-class parameters.

Both charge reasoning tokens at output rates. OpenAI calls them "reasoning tokens"; Anthropic calls them thinking tokens. The economic model is identical: you pay for every token the model generates internally, whether or not you see the output.

**Source note:** OpenAI API docs were not fetched for this dossier. The above is background knowledge; do not cite it with a date unless verified. The chapter author should verify against current OpenAI docs before including any specific claim. The comparison here is intentionally kept at the structural level (exists / opaque vs. controllable), not numerical.

### 12.2 DeepSeek R1

DeepSeek R1 (open-weight reasoning model released January 2025) exposes chain-of-thought reasoning by default. The reasoning is visible in the response as a `<think>…</think>` block, which is structurally similar to Claude's `type: "thinking"` content block. Key differences: DeepSeek R1 is open-weight (can be self-hosted), the chain-of-thought is not encrypted or signature-verified (can be stripped or injected), and the model is not available via an Anthropic-style API with integrated caching features.

**Source note:** DeepSeek R1 paper is cited as arxiv.org/abs/2501.12948 (January 2025). Not fetched for this dossier; use as background only. The chapter author should verify current deployment state before including specifics.

### 12.3 What this comparison is for in the chapter

One paragraph of context maximum. The point to make: extended thinking / reasoning is a category-level shift across frontier model providers in 2025–2026. Claude's implementation is notable for its degree of API control (budget, effort, display mode) and its integration with prompt caching and tool use. The chapter should not position Claude's implementation as superior — it is different, and the trade-offs depend on use case.

---

## 13. Open questions for the chapter author

**Q1: Real benchmark numbers or illustrative only?**
Anthropic has published gains on HLE, AIME 2025 for extended thinking. These numbers are model-version-specific and will drift. Recommendation: stay illustrative. If the author wants to cite Anthropic's benchmark blog posts, do so with the full caveat that the numbers apply to a specific model snapshot and test distribution. Do not reproduce the numbers as if they generalize.

**Q2: How deeply to cover adaptive vs. manual thinking?**
The split between `type: "adaptive"` (current recommendation) and `type: "enabled"` (deprecated on current models, still supported on older ones) may confuse readers if the chapter tries to cover both fully. Recommendation: lead with adaptive, use manual as the historical context that explains what `budget_tokens` is (since the concept is still useful for understanding cost). A sidebar or callout for "older models" is enough.

**Q3: Should the demo use Opus 4.7 or Sonnet 4.6?**
Opus 4.7 only supports adaptive thinking; Sonnet 4.6 supports both manual and adaptive. If the demo needs `budget_tokens` (e.g., for the slider), it should target Sonnet 4.6, not Opus 4.7. Document this choice clearly in `src/data/extended-thinking.ts`.

**Q4: Thinking block preservation — is it worth explaining the model-version split in chapter prose?**
The Opus 4.5+ / Sonnet 4.6+ vs. earlier models split in Section 5.3 is real and documented, but it is a subtle detail that may overwhelm a first-time reader. Recommendation: put it in a "Details for agentic use" callout box that readers can skip, rather than in the main prose flow.

**Q5: How to handle the "billed vs. visible tokens" discrepancy for summarized thinking?**
This is confusing for users who try to reconcile the API usage field with the token count in the response. The chapter should acknowledge this explicitly with a simple example: "You see 150 thinking tokens in the response. Your invoice shows 8,000. Both numbers are correct." A small callout box is probably the right format.

**Q6: Should the cache section cross-reference Ch 7's silent invalidators callout?**
Yes, strongly recommended. The `budget_tokens` → message-cache-invalidation behavior is the extended-thinking analogue of the tool-definition → cache-invalidation behavior in Ch 7. Cross-referencing keeps the mental model consistent and avoids repeating the cache fundamentals from scratch.

**Q7: Does Claude Haiku 4.5 support thinking well enough to include in examples?**
Haiku 4.5 supports manual extended thinking but not adaptive. It is the cheapest model that supports thinking. Including it in a pricing comparison ($5 / MTok output vs. $25 / MTok for Opus 4.7) is useful for making the cost point concrete. Caveat: Haiku with thinking may be less impressive on hard tasks — worth noting.

**Q8: Thinking encryption / signature — how deep?**
The `signature` field is opaque and non-parseable. For this audience, one sentence is enough: "The signature lets the API verify that the thinking block is genuine — you cannot substitute fake reasoning. Pass it back unchanged; the API ignores any changes you make to the text, but will reject a missing or corrupted signature." No need to explain cryptographic details.
