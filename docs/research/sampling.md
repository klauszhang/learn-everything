# Research dossier — Sampling

**Status:** research-only. Drives chapter M-4 (per docs/EXTENSIONS.md).
**Prerequisite chapter:** Ch 5 (Generation).
**Date:** 2026-05-17.

---

## 1. Plain-language premise

Ch 5 ended with a precise observation: the model runs a forward pass through every layer, and out the other end comes a probability distribution over the entire vocabulary — tens of thousands of possible next tokens, each with a probability score. Then one token is picked, appended, and the cycle repeats.

Ch 5 did not explain the picking step. That is this chapter.

Users notice the gap as a practical mystery: send the same prompt twice and you get different answers. Lower the "creativity dial" and the model sounds more robotic. The vocabulary for all of this — temperature, top-p, top-k — is everywhere in product UIs, but almost no one can explain what any of it actually does to the output.

The answer is mechanical and satisfying: these parameters reshape the probability distribution, or prune which tokens are even eligible, before a single token is drawn. The model's "opinion" about next tokens does not change. What changes is how the sampler reads that opinion.

Frame this chapter around one guiding question: *when two answers to the same prompt diverge, where exactly did the fork happen?*

---

## 2. From logits to a token — the actual picking step

Understanding the dials requires a working mental model of what they operate on.

### 2.1 Logits

The model's final layer produces a vector of raw scores, one per vocabulary token. These scores are called **logits**. They are not probabilities — they can be any number, positive or negative, with no constraint on their sum or range. A high logit means the model finds that token likely; a low or negative logit means unlikely. The vocabulary is typically 32,000 to 128,000 tokens, so this is a very large vector.

### 2.2 Softmax converts logits to probabilities

To turn logits into a proper probability distribution (all values between 0 and 1, summing to 1), the model applies a function called **softmax**. The one formula this chapter allows is the temperature-scaled version, because it makes the temperature dial concrete:

```
P(token i) = exp(logit_i / T) / sum_over_all_j( exp(logit_j / T) )
```

Read in plain English: divide every logit by the temperature T, exponentiate, then normalize so everything sums to 1. When T = 1 (the default), you get the "raw" probabilities the model produces. When T is something else, the distribution shifts — and the rest of §3 explains exactly how.

**A worked example for the chapter.** Suppose the model has two candidate tokens with logits 3.0 and 1.0.

At T = 1.0:
- exp(3.0 / 1) = exp(3.0) ≈ 20.1
- exp(1.0 / 1) = exp(1.0) ≈ 2.7
- Total ≈ 22.8
- P(token A) ≈ 20.1 / 22.8 ≈ **88%**, P(token B) ≈ **12%**

At T = 0.5 (lower, sharper):
- exp(3.0 / 0.5) = exp(6.0) ≈ 403
- exp(1.0 / 0.5) = exp(2.0) ≈ 7.4
- Total ≈ 410
- P(token A) ≈ 403 / 410 ≈ **98%**, P(token B) ≈ **2%**

At T = 2.0 (higher, flatter):
- exp(3.0 / 2) = exp(1.5) ≈ 4.5
- exp(1.0 / 2) = exp(0.5) ≈ 1.6
- Total ≈ 6.1
- P(token A) ≈ 4.5 / 6.1 ≈ **73%**, P(token B) ≈ **27%**

The gap between token A and token B shrinks dramatically as temperature rises. A bar chart in the chapter can show this numerically without requiring the reader to follow the arithmetic — but the worked example in the prose makes the direction of each change unambiguous. The chapter should include this example or a simplified version of it before the diagram.

### 2.3 Sampling draws one token from the distribution

Once you have a probability distribution, sampling is conceptually simple: imagine a biased die with one face per vocabulary token, where heavier faces correspond to higher probabilities. Roll it once. The token that comes up is the next token.

All of the "dials" discussed below either change the shape of the distribution before the die is cast, or throw out some faces so they cannot be rolled.

### 2.4 Why there is randomness at all

A common question: why not just always pick the most likely token? The answer is covered in §3.1 (greedy decoding) and §6 (diversity/quality tradeoff). The short version: a model that always picks argmax produces repetitive, formulaic text and gets stuck in loops. Some noise turns out to be necessary for natural-sounding language.

There is also a deeper point: the model's probability distribution does not always have a single dominant peak. For many prompts — especially open-ended ones — a dozen or more continuations are roughly equally plausible. The model is not "uncertain" in a bad sense; it is correctly representing that the world has multiple reasonable continuations of the sentence "She opened the door and saw". Forcing argmax in that situation does not find the single correct answer; it picks one arbitrarily and then commits to it, which looks like false confidence. Sampling from the distribution is the more honest behavior.

---

## 3. The dials — concept walkthroughs

### 3.1 Greedy decoding (temperature → 0)

Greedy decoding picks the token with the highest probability at every step — the argmax. There is no randomness. In theory, this should produce perfectly reproducible, deterministic output.

In practice, it does not. See §5 for why. But the conceptual model is sound: as temperature approaches zero, the distribution collapses onto the single most probable token, and sampling approaches argmax.

**When greedy helps:** structured output tasks where there is a clearly correct answer — parsing a date, completing a known format, extracting a labeled field. The model's distribution is sharp and the argmax is obviously right.

**When greedy hurts:** open-ended text, creative writing, conversational response. The model's distribution is flatter (several plausible continuations), and always picking the single most likely token produces text that sounds mechanical and loops back on itself. The classic failure mode is "the the the the the…" — once a common word has a slight edge, greedy locks in on it and never escapes.

**Key insight for the chapter:** greedy is not the "safe" or "correct" setting. It is a specific tradeoff — maximum consistency, minimum variation — and that tradeoff is wrong for many tasks.

### 3.2 Temperature

Temperature is the most central dial. It operates on the logits before softmax, by dividing them all by the temperature value T:

- **T = 1.0 (default):** logits are unchanged. You get the model's raw probability distribution.
- **T < 1.0 (e.g. 0.2, 0.5):** logits are divided by a number smaller than 1, which magnifies their differences. High-logit tokens become relatively more dominant; low-logit tokens are crushed toward zero. The distribution sharpens — the peaks get taller, the tails collapse. Sampling from a sharp distribution reliably picks from the small set of highly likely tokens.
- **T > 1.0 (e.g. 1.5, 2.0):** logits are divided by a number greater than 1, which shrinks their differences. Tokens that were slightly less likely become nearly as likely as the most probable token. The distribution flattens. Sampling from a flat distribution is more like a uniform random draw across a wider set.
- **T → 0:** the ratio between any two logits grows without bound; the highest-logit token absorbs all the probability mass. Approaches greedy.

**The intuition that works:** temperature is a dial between "decisive" (low T, picks the confident choice) and "exploratory" (high T, willing to try lower-ranked options). It is not a dial between "good" and "bad." A very low temperature on a creative writing task is a bad choice. A very high temperature on a JSON extraction task is a bad choice.

**Anthropic's default:** temperature 1.0. Range: 0.0 to 1.0 on the Messages API (as of 2026; source: `platform.claude.com/docs/en/api/messages`). Note the range cap at 1.0 — some other providers allow up to 2.0.

### 3.3 Top-K

Top-K is conceptually the simplest filter: after computing the full probability distribution, discard every token except the K most probable ones. Redistribute the probability mass among those K survivors. Sample from that restricted set.

If K = 5, only the five most likely next tokens are ever candidates. Everything else is zeroed out. If K = 1, only the single most likely token can be chosen — this is equivalent to greedy.

**The appeal:** easy to understand and reason about. You can say with certainty that no token outside the top 5 (or 50, or 500) will ever appear.

**The problem:** K is a fixed count, which makes it insensitive to the shape of the underlying distribution.

- When the model is very confident (one token has 80% probability, the rest trail off), top-50 still keeps 49 mediocre candidates in play, adding noise without benefit.
- When the model is genuinely uncertain (ten tokens all hover around 10%), top-5 throws out five perfectly reasonable options, artificially constraining diversity.

Top-K does not adapt. Top-P (next) does.

**Note on Claude's API:** Anthropic does not expose `top_k` as a public API parameter on the Messages API in 2026 (confirmed via `platform.claude.com/docs/en/api/messages`). Top-K is widely discussed because it is exposed in open-source inference frameworks (vLLM, llama.cpp, Hugging Face transformers) and because it is conceptually the stepping-stone to understanding top-P.

### 3.4 Top-P (nucleus sampling)

Top-P, also called **nucleus sampling**, solves the fixed-K problem by selecting tokens based on cumulative probability rather than rank.

The procedure: sort all tokens by probability (highest first). Walk down the list, summing probabilities as you go. Stop as soon as the running total reaches P. Keep only the tokens you visited. Sample from those.

Examples with the same P = 0.9:
- **Confident model:** token A has probability 0.85, token B has 0.08. After visiting just A and B, cumulative probability is 0.93 ≥ 0.90. Nucleus contains 2 tokens.
- **Uncertain model:** ten tokens each have probability around 0.09. You need to visit all ten before cumulative probability crosses 0.90. Nucleus contains 10 tokens.

The nucleus adapts automatically. When the model is sure, you sample from a small, focused set. When the model is genuinely uncertain, you allow more diversity. This is the key advantage over top-K.

**Typical values:** 0.9 to 0.99 in most applications. A value of 1.0 includes the full vocabulary (no filtering). A value of 0.01 is near-greedy.

**Common misconception to address:** "top-p 0.95 means keep the top 95% of tokens." No. It means keep the smallest set of tokens whose combined probability reaches 95%. When the model is confident, that might be 3 tokens; when uncertain, it might be hundreds.

**Note on Claude's API:** Anthropic's Messages API documentation (as of 2026) does not list `top_p` as an exposed parameter in its public reference — only `temperature` appears in the sampling section. The guidance is to set temperature OR leave it at default; `top_p` is not a user-facing dial on the Messages API. Some internal documentation recommends choosing one or the other, not both. Cite: `platform.claude.com/docs/en/api/messages`.

### 3.5 Min-P (newer, less broadly supported)

Min-P is a relatively recent sampling method that addresses a weakness of top-P at high temperatures.

**The problem with top-P at high T:** when temperature is high, even bad tokens get their probabilities lifted. Top-P's cumulative threshold can end up including tokens that are genuinely low-quality, because the flattened distribution means the threshold is reached only after sweeping in many marginal candidates.

**Min-P's approach:** instead of a cumulative threshold, use a relative threshold. Set a floor at `min_p × max_probability`, where `max_probability` is the probability of the single most likely token after temperature scaling. Any token with probability below that floor is discarded.

Concretely: if the top token has probability 0.4 and min-p = 0.05, then any token with probability below 0.4 × 0.05 = 0.02 is dropped. The floor scales with how confident the model is. When the model is decisive, the floor is high and the nucleus is small. When the model is uncertain (the top token itself has low probability), the floor drops and more candidates are eligible.

**The claimed benefit:** min-P tends to preserve diversity better than top-P at high temperatures without admitting obviously bad tokens, because the threshold is anchored to the model's confidence level rather than an absolute cumulative sum.

**Support as of 2026:** min-P is available in vLLM, llama.cpp, and Hugging Face text-generation pipelines. It is not exposed in the Anthropic Messages API or OpenAI's API. Users of Claude directly do not have access to this dial.

**Chapter recommendation:** cover min-P in a sidebar or brief aside. It is worth naming because curious readers will encounter it in open-source tools, but it is not actionable for most users of hosted APIs.

### 3.6 Repetition penalties (presence, frequency)

Several API providers — notably OpenAI — expose penalties that directly modify the logits of tokens based on their prior appearance in the generated text.

**Presence penalty:** if a token has appeared at least once, subtract a fixed amount from its logit. Discourages repeating any token that was already used, regardless of how many times.

**Frequency penalty:** subtract an amount proportional to how many times the token has appeared. The more often a token was used, the more its future probability is suppressed.

**Repetition penalty (Hugging Face convention):** divide the logit by a penalty factor (> 1.0) for tokens already in the sequence. Equivalent in spirit to the frequency penalty.

**Why they exist:** the classical failure mode of greedy or low-temperature sampling is getting stuck in loops — "the the the" or endlessly repeating a phrase. Repetition penalties are a blunt corrective. They work by modifying logits before sampling, so they interact with all other parameters.

**Drawbacks:** they are not targeted. A repetition penalty applied uniformly will also suppress tokens that legitimately need to repeat — variable names in code, proper nouns in a biography, keywords in a structured report. Frequency penalties can break code generation when a variable name needs to appear many times. They are heuristic patches, not principled solutions.

**Claude's API in 2026:** Anthropic does not expose repetition, frequency, or presence penalty parameters on the Messages API. These are primarily an OpenAI-style API surface. This is a deliberate design choice; users of Claude interact with temperature only.

**Chapter framing:** explain these parameters because readers will encounter them in OpenAI's API, playground UIs, and community discussions. But be clear that they are not a Claude lever.

---

## 4. The interaction trap

Sampling parameters compose. The problem is that their interactions are not always intuitive, and applying several at once can produce surprising results.

**The standard combination: temperature + top-P.** This is the most common combination in practice. Temperature reshapes the distribution first. Then top-P prunes it. The interaction matters: if temperature is high (flat distribution) and top-P is tight (e.g. 0.7), you end up sampling from a small nucleus of tokens whose probabilities have been artificially equalized. The quality of the candidates inside the nucleus matters, and high temperature may have promoted some mediocre tokens to near-equality with good ones.

**Temperature + top-K.** Temperature reshapes the distribution, then top-K keeps the top K regardless of how sharp or flat the distribution is. If temperature is low (sharp distribution) and K is large (e.g. 50), the effective sampling pool is much smaller than K because most of the top-50 tokens have negligible probability after sharpening. Top-K's fixed count becomes meaningless in practice.

**Top-K + top-P together.** When both are applied, whichever is more restrictive wins first. If top-K discards everything beyond rank 40, and top-P would have included only 20 tokens, the effective nucleus is 20. If top-P would have included 60 tokens, top-K constrains it to 40.

**Anthropic's recommendation:** set either `temperature` or leave defaults. Do not layer multiple parameters without understanding their interactions. The Anthropic API makes this easy by not exposing top-P or top-K as user dials — there is only temperature to adjust.

**For the chapter:** a concrete example helps. Take the same prompt, same model. Run 1: temperature 0.7, no other filters. Run 2: temperature 1.5, top-P 0.5. The second run has more "creative" temperature but a tighter nucleus — the net result can be less diverse than the first, not more, depending on the distribution shape.

**Order of operations matters.** When combining temperature and top-P, temperature scaling always happens first (it reshapes the logits before softmax), and top-P filtering happens second (after the distribution is formed). You cannot reverse this order. This means the nucleus selected by top-P is determined by the temperature-adjusted distribution, not the raw one. A user who raises temperature to "be more creative" while holding top-P at 0.5 may find that the temperature-flattened distribution causes top-P to admit the same tokens as before (since cumulative mass accrues more slowly when everything is nearly equal), or different tokens depending on which candidates got promoted by the flattening. Predicting the interaction requires knowing the actual distribution shape — which users almost never have access to.

---

## 5. "Determinism" — what temperature=0 actually buys you

This section deserves careful treatment because the misconception is pervasive and consequential.

### The claim: temperature 0 = deterministic output

The reasoning sounds airtight: at T = 0, sampling collapses to argmax. There is only one "most probable" token. No randomness. Same prompt → same output, every time.

### Why this is not reliably true in practice

**Floating-point arithmetic and GPU non-determinism.** Modern inference runs on GPUs with parallel floating-point operations. The order of operations in a parallel sum affects the final floating-point result due to rounding at each step. Two runs that should produce identical results can produce logits that differ in the last few decimal places. When two tokens are near-identical in probability, that tiny rounding difference can flip which one is argmax.

**Batched inference.** Model providers run requests in batches — multiple users' prompts processed together for efficiency. Batching changes the computation graph in ways that affect floating-point results. A request that runs alone in a batch of one may produce different logits than the "same" request in a batch of eight.

**Anthropic's explicit statement:** the Messages API documentation states directly: "Note that even with temperature of 0.0, the results will not be fully deterministic." (Source: `platform.claude.com/docs/en/api/messages`, confirmed 2026-05-17.)

**Kernel non-determinism.** GPU kernels (the low-level programs that do matrix multiplications) often have non-deterministic variants that run faster. Many inference systems use these by default. Reproducibility can be forced by using deterministic kernels, but at a performance cost that most providers do not pay.

### Practical implication

If you are building an evaluation pipeline that depends on bit-identical outputs to measure model drift or regression, you cannot rely on temperature 0 to give you a stable baseline. You need to run multiple samples and track distributions, not single outputs.

If you are building a product and want consistent, predictable responses (not necessarily bit-identical), temperature 0 is still the right choice — you will get reliably high-probability tokens, even if the exact token occasionally wobbles.

**The chapter framing:** do not say "temperature 0 is deterministic" or "temperature 0 is broken." Say: "temperature 0 makes responses as consistent as possible, but the model provider makes no guarantee of bit-identical outputs run to run. In practice, you will almost always get the same answer — but do not build a system that breaks if you do not."

---

## 6. The diversity / quality tradeoff

This is the conceptual payoff section — the reason these dials matter in practice.

### Higher temperature

- More diversity: the model will pick tokens it considers less likely. Continuations diverge more across runs.
- More surprise: lower-ranked candidates sometimes produce genuinely good, unexpected turns of phrase. A language model's second or third choice is not necessarily bad — it is just less predictable.
- More risk: at high temperature, genuinely wrong, incoherent, or off-topic tokens become candidates. The risk of nonsense rises.

### Lower temperature

- More consistency: responses converge. Two runs of the same prompt will read similarly.
- More formulaic: the model gravitates to its most common, most probable continuations. The writing sounds like an average of its training data.
- Less hallucination risk for factual queries: the model's most probable answer to "what is the capital of France?" is "Paris." Low temperature makes "Paris" nearly certain; high temperature opens the door to rare alternatives.

### Task-based guidance (specific, not vague)

**Code generation and JSON extraction:** use low temperature (0.0 to 0.3). There is usually a correct answer. Divergence from it is error, not creativity. A JSON field that "creatively" invents a new key name is broken code.

**Classification and structured extraction:** low temperature. Same reasoning. You want the model to commit to the most probable interpretation.

**Factual Q&A:** low to medium temperature (0.0 to 0.7). The model knows the answer and should be encouraged to say it; occasional diversity can help when the question has multiple valid answers.

**Open-ended writing, brainstorming, creative tasks:** medium to high temperature (0.7 to 1.0, within the Anthropic API's ceiling). Diversity is the point. A brainstorm that always returns the same five ideas is not a brainstorm.

**Conversational agents:** medium temperature (0.5 to 0.8). You want some naturalness and variation so the agent does not sound robotic, but not so much randomness that it gives surprising or incorrect answers.

### The most important clarification

Higher temperature means more *random*, not more *creative*. Creativity is a property of the model's knowledge and reasoning, encoded in the weights. Temperature determines how willing the sampler is to reach further from the center of the probability distribution. A highly capable model at temperature 0.7 will be more creative than a weak model at temperature 2.0, because the high-temperature weak model is just producing noise. The training determines the quality ceiling; temperature controls how close to that ceiling — or how far below it — you sample.

### A note on multi-sample strategies

One underused technique: instead of tuning temperature to balance consistency and diversity, generate multiple responses at a moderate temperature and select among them. This is the approach behind best-of-N sampling in research settings and the "generate three options" prompt pattern in practice. The diversity comes from running multiple independent samples; you then apply judgment to choose the best rather than hoping the single draw at the right temperature happens to be optimal. For high-stakes content (a critical email, a legal summary, code for a production system), generating two or three alternatives and comparing is often more effective than tuning a single temperature value.

---

## 7. Practical field guide — when to reach for the dial

This section is for the chapter author: concrete, scenario-specific guidance that translates §6's tradeoff framing into actionable advice. Write this as a quick-reference section in the chapter itself, or as a callout box.

### Scenarios where you almost certainly want low temperature (0.0 – 0.3)

**Data extraction from a document.** You gave Claude a contract and asked for the renewal date. There is one correct answer. Diversity is error. Low temperature makes the model commit to its most probable parse. If the model gets it wrong at low temperature, it will not get it right at high temperature — it will just get different wrong answers.

**Structured output (JSON, YAML, CSV).** The format is exact and machine-readable. A single "creative" token that adds a trailing comma or changes a field name breaks the downstream parser. Temperature 0 is the standard choice for structured extraction pipelines.

**Multiple choice and classification.** Pick A, B, C, or D. One answer is correct. The model's most probable choice is its best reasoning. Higher temperature adds noise that promotes wrong answers.

**Code completion inside a known pattern.** Autocompleting a function stub where the signature, imports, and logic are already heavily constrained. The model has a clear high-probability completion. Let it.

### Scenarios where you almost certainly want medium temperature (0.5 – 0.8)

**Conversational responses and chat.** You want the assistant to sound natural, varied, and responsive — not robotic and repetitive. A moderate temperature preserves the model's top-choice reasoning while allowing the sentence-level phrasings to vary across turns.

**Summarization.** The facts to include are constrained (the source document) but the phrasing is flexible. Medium temperature produces different summaries that are all accurate, avoiding the exact same summary if you re-run the same document.

**Code generation for open-ended problems.** The test-suite spec defines correctness, but there are many valid implementations. Medium temperature allows the model to explore alternative approaches while staying within plausible code patterns. Too low: always the same implementation, possibly suboptimal. Too high: syntax errors and made-up APIs.

**Factual Q&A where phrasing matters.** The answer is constrained but explanation style is flexible. Medium temperature produces the right answer with natural, non-robotic prose.

### Scenarios where you almost certainly want higher temperature (0.8 – 1.0)

**Brainstorming and ideation.** You need five different angles, not five slight variations of the same angle. High temperature is the point. The model's second and third choices — the ones it considers less canonical — are exactly what you are looking for.

**Creative writing, fiction, poetry.** The "most probable" continuation of a creative prompt is likely the cliche. High temperature promotes the less expected choices that can produce genuinely surprising prose. The risk of incoherence rises but is usually tolerable given editorial judgment.

**Persona simulation and roleplaying prompts.** When you want Claude to explore an unusual voice, style, or perspective, lower temperature narrows it toward its default register. Higher temperature allows more stylistic departure.

### The judgment call

No rule is universal. A code generation task for a highly constrained function (fill in the body of a `sum()` function) calls for low temperature. A code generation task for "build a small utility that solves problem X in an interesting way" benefits from medium-to-high temperature because the space of valid solutions is large.

The heuristic: ask yourself "how many correct answers are there?" If the answer is "one," use low temperature. If the answer is "many, and I want variety," use higher temperature. If you are unsure, run medium temperature (0.7) and adjust based on what you see.

---

## 8. Common misconceptions — the specific corrections

These are the specific corrections the chapter should make explicit.

**"Temperature 0 = deterministic."**
No. Batched GPU inference introduces floating-point nondeterminism that can occasionally flip near-tied tokens. Anthropic's own API documentation states this. Temperature 0 means "as consistent as possible," not "bit-identical."

**"Higher temperature = more creative."**
Higher temperature = more random. Randomness and creativity are not the same thing. Creativity comes from the model's training. Temperature only controls how willing the sampler is to deviate from the model's most probable path. You can randomize a bad model into incoherence; you cannot randomize a mediocre model into brilliance.

**"Temperature changes what the model knows."**
No. The logits are computed from the same forward pass regardless of temperature. Temperature is applied after the logits are produced, during sampling. The model's "opinions" about next tokens are identical at any temperature — you are only changing how you read those opinions.

**"Top-P of 0.95 means keep the top 95% of tokens."**
No. It means keep the smallest set of tokens whose cumulative probability reaches 95% of the total mass. If the model is very confident, 95% of the probability mass might be concentrated in 3 tokens. You keep 3 tokens, not 95% of the vocabulary.

**"Repetition penalty makes the model smarter."**
No. Repetition penalties suppress logits of previously seen tokens. They reduce loops, but they also suppress legitimate repetition — variable names, proper nouns, required keywords. They are a heuristic patch, not intelligence. They can silently break code generation.

**"Top-K = 1 is the same as greedy."**
Technically yes, but with a consequence: if you also set temperature, the temperature scaling happens before the top-K filter. Top-K = 1 after temperature scaling still picks the argmax of the temperature-adjusted distribution, which is the same as the argmax of the original distribution (because scaling by temperature is monotone). So yes, top-K = 1 is greedy — but you have now disabled temperature's entire effect on diversity, since only one token is ever eligible.

**"Setting temperature and top-P together gives you more control."**
It gives you more parameters, but not necessarily more control in the sense of better outcomes. They interact in non-obvious ways. Anthropic's API deliberately exposes only temperature; the recommendation is to pick one lever and understand it rather than combine them.

---

## 9. House-style chapter ideas

### Diagram option A — the live bar chart (primary recommendation)

A vertical bar chart of next-token probabilities for a single step in a short completion. Recommended prefix: `"The weather today is"` — natural, varied, non-political, and produces a genuinely interesting probability distribution across tokens like `"sunny"`, `"cold"`, `"rainy"`, `"warm"`, `"partly"`, `"not"`, `"great"`, `"awful"`.

Under the chart: two sliders (temperature, top-P cutoff line). As temperature changes, bars reshape — low T sharpens the tallest bar and crushes the rest; high T flattens everything. As top-P changes, a horizontal dashed line sweeps across the bars; tokens above the cumulative threshold are colored amber (eligible), tokens below are greyed out (discarded).

A third overlay toggle for top-K: instead of a probability line, a rank boundary highlights the top K bars in amber. This makes the difference between top-P (threshold) and top-K (fixed count) visually immediate.

**Component name:** `SamplingDistribution.tsx`
**Data file:** `src/data/sampling.ts`
**Takeaway angle:** makes abstract parameters physical. Users literally see the bars change when they move the slider. The difference between top-P and top-K is obvious at a glance — one is a horizontal probability line, the other is a vertical rank cutoff.

### Diagram option B — same-prefix divergent completions

Side-by-side panel: three columns. Same prompt prefix (`"The city was quiet until"`) continues differently at T = 0 / T = 0.7 / T = 1.5. All continuations are hand-authored to illustrate the character of each setting:
- T = 0: "The city was quiet until the alarm rang at 6 AM, as it did every morning."
- T = 0.7: "The city was quiet until a low rumble from the eastern bridge announced something unexpected."
- T = 1.5: "The city was quiet until the pigeons — all of them — vanished on a Tuesday."

The T = 1.5 example is deliberately slightly weird to illustrate that high temperature produces the unexpected, not necessarily the good.

**Takeaway angle:** shows the range of behavior rather than the mechanics. Pairs well with Diagram A rather than replacing it.

### Demo option A — the bar-chart sandbox (primary recommendation)

Extends Diagram A into an interactive widget. Key design decisions:
- Use 10–12 hand-authored candidate tokens with illustrative logit values, not real model outputs. Label clearly as illustrative.
- Apply a deterministic seeded random for the "Sample" button so the demo is repeatable — clicking "Sample" at the same slider positions always produces the same result. This avoids confusion ("why did it change?") and makes the demo predictable for instructional use.
- Show a short "completion so far" strip that appends each sampled token when "Sample" is clicked.
- Greyed-out tokens remain visible (not hidden) so users can see what was excluded and why.

**Component name:** `SamplingDistribution.tsx`
**Data file:** `src/data/sampling.ts` — hand-authored logit values, three preset scenario configurations (see §9)

### Demo option B — the stuck loop demo

A minimal demo showing the repetition-loop failure mode. Show a prompt being completed token by token at temperature 0 with a deliberately susceptible prefix. The completion gets stuck: "the model the model the model the model…". Then a temperature slider appears: raise it above ~0.4, hit "retry," and watch the completion escape the loop.

**Takeaway angle:** makes the abstract advice "raise temperature for open-ended tasks" visceral. You see exactly what goes wrong at temperature 0 on the wrong task.

**Component name:** could be a second panel within `SamplingDistribution.tsx` or a standalone `LoopDemo.tsx`.

**Implementation note:** both demos use hand-authored data. No real model inference. The "stuck" demo is fully scripted — the repetitive tokens and the "escape" path are pre-planned in the data file.

---

## 10. Hand-authored data plan

**File:** `src/data/sampling.ts`

### Token list for the bar chart

Prefix: `"The weather today is"`. Suggested candidate tokens and rough illustrative logit values (to be tuned for visual clarity — differences should be visible but not extreme):

| Token | Illustrative logit | Notes |
|---|---|---|
| `"sunny"` | 4.2 | Clear frontrunner at low temperature |
| `"cold"` | 3.1 | Second tier |
| `"warm"` | 2.8 | Second tier |
| `"partly"` | 2.5 | Medium probability |
| `"rainy"` | 2.1 | Medium probability |
| `"great"` | 1.6 | Lower — evaluative, less neutral |
| `"not"` | 1.2 | Grammatical but unusual here |
| `"awful"` | 0.8 | Low but non-zero |
| `"strange"` | 0.4 | Tail candidate |
| `"--"` | -0.5 | Very low; visible greyout |

These logits should be scaled so that at T = 1.0, the softmax produces visually distinct bar heights (not all near-equal, not 99% on one token). Adjust values in the data file until the chart looks instructive.

### Preset scenarios

Three configuration presets for the demo sliders, matching common use cases from §6:

| Scenario | Temperature | Top-P | Top-K | Label |
|---|---|---|---|---|
| Code / extraction | 0.2 | 0.9 | off | "Precise" |
| Conversational | 0.7 | 0.95 | off | "Balanced" |
| Creative writing | 1.0 | 1.0 | off | "Exploratory" |

### Pre-computed softmax values

For the three presets, pre-compute softmax outputs for each token and store them in the data file. This allows the chart animation (bars transitioning between presets) to use smooth interpolation without requiring JavaScript softmax at runtime.

For the "Sample" button: implement a seeded pseudo-random draw in TypeScript using the stored probabilities. Same seed + same probabilities = same token every time. A deterministic seed like the scenario name string works.

### Loop demo script (if Option B is built)

A separate array in `sampling.ts`: an array of 12 tokens for the "stuck" path (repeating the same 3–4 tokens cyclically), and an array of 12 tokens for the "escaped" path (diverse continuation after temperature is raised). No softmax needed — just scripted sequences.

---

## 11. Connections to existing chapters

### Ch 5 — Generation (direct prerequisite)

Ch 5's autoregressive step demo ends with "the model produces a probability distribution over next tokens, then picks one" — the exact sentence that opens M-4. The Ch 5 "step" button appends tokens without explaining the picking step. M-4's bar chart demo is the "zoom in" on the moment between the forward pass and the append.

**Specific handoff line in Ch 5** (line 97 of `src/pages/05-generation.mdx`): "those 1,000 prompt tokens get re-processed 200 times — once per decode step." The prose just before this establishes the decode loop but says nothing about how the token is selected. M-4 picks up exactly there.

### Ch 7 — Prompt cache (indirect connection)

The prefix that is cached (system prompt, tool definitions, conversation history) is fixed and deterministic — the same bytes every time. What happens after the last cached token is the sampling step. Sampling parameters do not affect cache eligibility (the cache key is the prefix, not the output) but they do affect whether the same cached prefix produces the same output.

This is a one-paragraph connection worth making explicit: "You can have a perfect cache hit — the prefix was reused exactly — and still get a different response, because the sampler drew a different token from the distribution." This reinforces both why caching is valuable (the expensive computation is reused) and why outputs still vary (the cheap sampling step remains stochastic).

### Ch 3 — Attention (upstream connection, brief)

The logits M-4 operates on are the ultimate output of the attention and FFN stack described in Ch 3 and Ch 4. A one-sentence reminder: "The logit vector the sampler receives is the final output of all those attention layers — every layer's computation, distilled into a score for each token in the vocabulary." This grounds the new chapter in the existing chain without requiring readers to re-read Ch 3.

### Ch 1 — Tokens (vocabulary framing)

Ch 1 establishes that the model's vocabulary is a fixed set of token IDs, typically 32,000–128,000 entries. M-4's probability distribution is over that exact vocabulary. The bar chart demo should use a note like "in a real model, this bar chart has 32,000+ bars — we're showing 10 for clarity."

---

## 12. Closing-takeaway angle

The chapter should land on a reframe that changes how readers think about their daily interactions with Claude.

**Proposed closing:**

When Claude gives you a different answer on the second try, it is not because the model changed its mind, or reconsidered, or forgot. The model ran the same computation and produced essentially the same probability distribution. Then the sampler drew a different token. That single different token started a different branch, and the rest of the response followed.

This is why temperature exists: to give you some control over how likely those different branches are. Low temperature means the sampler stays close to the model's first choice at every step. High temperature means it is willing to explore the second and third choices. Neither is "right" — it depends entirely on what kind of variation you want.

Knowing this separates productive prompting from cargo-cult prompting. The model is not "in a mood." It is not "trying harder" when you rephrase. The distribution shifts slightly when the wording shifts, and a different draw follows. If you want consistent output, lower the temperature and keep the prompt stable. If you want diverse options, raise it. Everything else about how Claude "feels" is a layer of interpretation on top of this mechanical step.

---

## 13. Up-to-date facts (with citations)

### Anthropic Messages API sampling parameters (2026)

**Confirmed as of 2026-05-17 from `platform.claude.com/docs/en/api/messages`:**

- **`temperature`**: supported. Default 1.0. Range 0.0 to 1.0. Anthropic's own documentation notes: "Note that even with temperature of 0.0, the results will not be fully deterministic."
- **`top_p`**: not listed as an exposed public parameter in the Messages API reference at this time.
- **`top_k`**: not listed as an exposed public parameter in the Messages API reference.
- **Repetition / frequency / presence penalty**: not exposed. These are OpenAI-style API parameters.

**Implication for the chapter:** from a Claude-user's standpoint, temperature is the only lever. Top-P, top-K, and repetition penalties are important to explain (because readers encounter them elsewhere and because they illuminate the concept space), but they are not actionable in the Anthropic API as of 2026.

**Important caveat for the author:** API surface areas change. Before finalizing prose, re-confirm the parameter list at `platform.claude.com/docs/en/api/messages`. If top-p has been added since this dossier was written, update §3.4 accordingly.

### Min-P

Min-P is available in:
- llama.cpp (parameter `--min-p`)
- vLLM (as a sampling parameter)
- Hugging Face text-generation pipeline

Not available in the Anthropic Messages API or OpenAI API as of 2026. The original description and rationale for min-P is documented in community discussions across inference framework repositories. The formal academic citation for nucleus (top-P) sampling is: Holtzman et al., "The Curious Case of Neural Text Degeneration," ICLR 2020. Min-P does not yet have a widely-cited academic paper; cite the implementation documentation (llama.cpp README or vLLM docs) if a citation is needed.

### Non-determinism at temperature=0

Anthropic states this explicitly in their API documentation. For broader context:
- GPU floating-point non-determinism is a known phenomenon in deep learning; NVIDIA's documentation on deterministic algorithms (`torch.use_deterministic_algorithms`) covers the root cause.
- Batched inference introducing variance is a documented property of transformer inference; the HuggingFace `how-to-generate` blog post (huggingface.co/blog/how-to-generate) covers basic sampling behavior and implicitly treats greedy as deterministic, which is the common simplification. The Anthropic API documentation's explicit caveat is more accurate.

### Repetition penalties

These are an OpenAI API surface feature. The `frequency_penalty` and `presence_penalty` parameters appear in OpenAI's Chat Completions API. The Hugging Face transformers `generate()` function exposes `repetition_penalty`. Neither appears in Anthropic's Messages API.

---

## 14. Open questions

**1. Should min-P receive a sidebar or be omitted entirely?**
Min-P is not user-accessible in the Anthropic API. Its value in the chapter is purely conceptual — to show that top-P is not the final word in sampling research. Given the audience (daily Claude users, no ML background), it could be demoted to a one-sentence footnote or a small "Going deeper" sidebar. Recommendation: one-paragraph aside, clearly labeled as "not available in Claude's API, but worth knowing the concept exists." Decision needed before drafting.

**2. Should the bar chart demo implement real softmax or illustrative pre-computed values?**
The chapter can authentically implement softmax in TypeScript (it is one function, no library needed) and apply it live to the stored logits when the temperature slider moves. This would make the demo technically accurate rather than illustrative. The tradeoff: the GOAL.md non-goals say "no real model inference" and emphasize hand-authored data, but implementing softmax from scratch is not "real inference" — it is arithmetic. Recommendation: implement actual softmax in the demo (it is three lines of TypeScript). Label the logit values as "illustrative" but let the math be real. Confirm with the orchestrating agent before implementation.

**3. How should the top-P slide interact with the temperature slide simultaneously?**
If both sliders are active in the demo, their interaction (reshape distribution via temperature, then prune via top-P) should be visually clear. One approach: apply them in sequence with a brief visual pause — first watch bars reshape (temperature), then watch grey-out happen (top-P). Another approach: apply simultaneously and label the two effects with callout text. This is a UX decision for the builder agent. Note it here so the builder knows the interaction is intentional and needs explanation, not just implementation.

**4. How does this chapter fit the callout convention?**
Every existing chapter ends with a "How this connects to the cache" callout box. Sampling has an indirect but real connection (same cached prefix, potentially different sampled output). EXTENSIONS.md section 5 notes this open question: "Extension modules that have little direct cache relevance (M-4 Sampling, M-10 Vision) will need either a forced cache angle or a rebranded callout." Recommendation: keep the cache callout, using the connection described in §10 (cache hits guarantee prefix reuse but not output identity). The callout text would be: "A cache hit means the expensive prefix computation was skipped. But sampling still runs fresh on every request — same prefix, same distribution, different draw. The cache does not make your outputs deterministic; it makes your costs lower." This is honest and relevant.

**5. Should the chapter name and number follow the M-4 convention from EXTENSIONS.md?**
EXTENSIONS.md labels this M-4 and places it third in the recommended track (after M-1 and M-3). Navigation in `ChapterLayout.astro` uses slugs and chapter numbers from frontmatter. Before implementation, the orchestrating agent needs to decide: does M-4 get a chapter number like "8" (continuing the sequence after Ch 7), or a letter-based identifier, or a track-prefixed number? See EXTENSIONS.md §5, open question 3. This decision affects `ChapterLayout.astro` before any content is written.

---

*Iterations used: 1 of 2. Stopping reason: done — all required sections complete, no meaningful gap to improve on a second pass.*
