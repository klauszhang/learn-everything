# Research dossier — Long-context behavior

**Status:** research-only.
**Date:** 2026-05-17.

---

## 1. Plain-language premise

Most people who use Claude for document-heavy work have hit a wall that doesn't announce itself. You paste in a 60-page contract, a stack of code files, or a long conversation history. The context fits — the model accepts it without complaint. Then the model confidently ignores a clause you explicitly highlighted on page 43, or contradicts itself about something you said 80K tokens ago, or retrieves the wrong detail when two similar facts appear in different sections.

This chapter explains why *fitting in the window* is not the same as *being used reliably from the window*. The distinction matters because the industry has stretched context windows much faster than it has improved the model's ability to act faithfully on everything inside them.

The pattern is not random. Degradation is position-aware, distractor-sensitive, and task-dependent. Understanding these patterns does not require knowing anything about machine learning internals — it just requires knowing what to expect, and what to do about it.

**What you'll learn:** why 1M tokens of capacity does not mean 1M tokens of reliable recall; what the research says about where failures concentrate; what the mechanism probably is (hedged); how the cost story shapes the economics; and when long context beats RAG and when it doesn't.

**How this chapter fits the site:** this is a research dossier for an extension chapter, not the eight core chapters. The core site teaches the transformer architecture and the prompt cache. This chapter extends the core with the practical question every reader will have after finishing Ch 7: "I understand the prompt cache — but how does the model actually perform when the context is very long?" The chapter answers that question honestly, with hedging where the evidence is thin and with concrete guidance on what to do differently.

**Prerequisite chapters:** Ch 3 (attention) for the budget metaphor, Ch 6 (KV cache) for the memory cost story, Ch 7 (prompt cache) for the economic context. None of these need to be re-explained in detail here — just cross-referenced.

**What this chapter is not:** it is not a survey of all long-context LLM research, nor a tutorial on how to implement long-context applications from scratch. It is a conceptual foundation: after reading it, the user should understand why long context is harder than it looks, what patterns to expect when it fails, and the two or three concrete things they can do about it. Implementation details (API code, specific model configurations, retrieval pipeline design) belong in downstream chapters or the RAG dossier.

---

## 2. Capacity vs. effective use — the distinction

The phrase "context window" blurs two things that are very different:

**Window size (capacity)** is the maximum number of tokens the model will accept as input. If you send more, the API returns an error. Current Anthropic models (as of May 2026): Claude Opus 4.7 and Claude Sonnet 4.6 both have 1M-token context windows. Claude Haiku 4.5 has a 200K-token context window. [Source: Anthropic models overview, fetched 2026-05-17.]

**Effective use** is how reliably the model retrieves and integrates information placed *anywhere* in those tokens — at the beginning, the middle, the end. Passing the "does it fit?" test tells you nothing about whether the model will actually use the content correctly.

These two quantities have been diverging. Context windows have grown 5–10x in the past two years. There is no equivalent 5–10x improvement in recall fidelity documented from any Anthropic or third-party benchmark that this dossier could verify. RULER, LongBench, and "Lost in the Middle" all show meaningful degradation well below the nominal window size — and those benchmarks were published when windows were smaller. Extrapolating them forward to 1M-token claims is speculative; this dossier does not do that.

The key mental model: a context window is like a very large desk. You can spread a million tokens of paper across it. Whether you can reliably find any given fact on that desk — quickly, accurately, without getting confused by nearby papers — is a different question entirely.

**A note on what "effective use" means:**

For this chapter, effective use has three components: (1) the model successfully retrieves the specific information requested; (2) it integrates that information correctly with the rest of its response; and (3) it does not contradict or ignore that information elsewhere in a long generated response. All three can fail independently.

Failure mode 1 (retrieval failure) is what the Liu et al. and RULER benchmarks primarily measure. Failure mode 2 (integration failure) and failure mode 3 (consistency failure over long outputs) are less studied in public benchmarks. A chapter that only covers retrieval failure gives a partial picture; the full picture includes whether the retrieved fact is correctly used.

For the scope of this chapter, the focus is on retrieval — where the research evidence is strongest. Integration and consistency are named here as out-of-scope to avoid underselling the complexity.

---

## 3. The degradation patterns

### 3.1 "Lost in the Middle" — the U-shape effect

The most widely cited empirical finding in long-context research is from Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts," published in Transactions of the Association for Computational Linguistics.

**What it showed:** when a piece of relevant information is placed at the beginning or end of a long input, retrieval accuracy is substantially higher than when the same information is placed in the middle. The effect produces a U-shaped accuracy curve across token positions — high at both ends, lower in the middle. The researchers used multi-document question answering (find the answer document among many distractor documents) and key-value retrieval tasks.

**How sharp is the drop?** The paper documented accuracy drops from the high-80% range at position extremes to the 50–60% range for mid-position placements on some models and tasks. The specific numbers varied by model and task. [Source: arXiv 2307.03172, fetched 2026-05-17.]

**Important hedges:**
- This is a 2023 paper, tested on models that are now two or more generations old. Newer models — including current Claude variants — may have partially closed this gap.
- The paper tested specific task formats. Other task formats may show different patterns.
- The U-shape finding has been widely replicated qualitatively but the magnitude varies.
- Anthropic has not (as of this dossier's research date) published a primary-source paper showing Claude-specific recall curves at position. The absence of such publication is not evidence of absence of improvement.

**Practical implication:** if there is one specific fact you absolutely need the model to use — a constraint, a name, a number — placing it at the very beginning or very end of the context is more robust than burying it in the middle. This is community-observed best practice consistent with the Liu et al. direction, not a guarantee.

**What changed since 2023?** The models Liu et al. tested — GPT-3.5, early GPT-4, and a handful of instruction-tuned models — are now two generations behind current frontier systems. Anthropic and OpenAI have invested specifically in long-context fine-tuning since that paper. The U-curve effect is broadly expected to have moderated in magnitude, but whether it has been eliminated is unknown; no equivalent peer-reviewed study using current Claude models at their full window sizes had been published in a form this dossier could verify as of May 2026. Community practitioners still report position-sensitivity effects consistent with Liu et al.'s direction. The chapter should present the research direction as durable without asserting the exact 2023 numbers apply to Claude 4.x.

### 3.2 Distractors — irrelevant content degrades recall

A related finding from Liu et al. and subsequent work: when irrelevant but topically similar content surrounds the target information, recall of the target drops sharply compared to when the context is clean. A needle in a haystack of genuinely random text is easier to find than a needle surrounded by similar-looking needles.

This matters practically: a prompt stuffed with many "relevant-seeming" documents — all related to the topic, but only one containing the actual answer — performs worse than a leaner context that cherry-picks just the right document. This is one of the core arguments for RAG over naive long-context stuffing: retrieval selects for relevance rather than including everything tangentially related.

The attention dilution mechanism (Section 4) offers one explanation for this. Another explanation, less mechanism-level and more empirical: models trained on mostly short-context data learn to weight nearby content more heavily, and distractor signals accumulate in proportion to the number of distractors.

A concrete example: imagine you are asking Claude to identify a specific contract clause from a set of 20 contracts. If 15 of those contracts contain similar-but-not-identical language, the model has 15 distractor signals competing with the one true answer. Contrast this with sending only the one relevant contract — a much smaller context, but one where the signal-to-noise ratio is near-perfect. The latter approach often outperforms the former despite using a much shorter prompt.

This is exactly the argument that motivates the retrieve-then-read pattern in RAG: instead of loading all 20 contracts, retrieval finds the one likely to contain the answer and presents only that. The model's job becomes easier, not because the model got smarter, but because the task got cleaner.

*Caveat: "distractor sensitivity" is community-observed and directionally consistent across multiple evaluations, but the magnitude depends heavily on the specific task and model. Treat this as a tendency, not a law.*

### 3.3 Multi-needle — tracking multiple facts is harder than one

Needle-in-a-haystack tests (NIAH) typically ask the model to find a single fact hidden in a large document. RULER (described in Section 3.5) extended this to multi-needle variants: hide two, three, or more distinct facts and ask the model to retrieve all of them.

The finding: recall degrades faster per fact as you add more facts to track. A model that retrieves a single needle at 95% accuracy might retrieve all three needles in a three-needle task at 60–70% accuracy. Exact numbers depend heavily on model, task, and context length.

This has direct implications for real use: if you need a model to keep track of five separate constraints scattered across a 100K-token document, it will be less reliable than if you need it to remember one. Consolidate constraints into a summary; don't assume the model will track everything you scattered across the text.

### 3.4 Format sensitivity — how you ask changes what you get

Multiple evaluations have shown that asking the model to retrieve the same information in different ways can produce meaningfully different accuracy. A question phrased as "What was the revenue in Q3?" may produce a correct answer while "List all financial figures mentioned in the document" misses it, or vice versa.

This is partly a task-format issue (retrieval vs. synthesis) and partly a symptom of attention being non-uniform — the model's internal representation of where answers live is sensitive to how the query activates its attention patterns.

*This is documented behavior in evaluation studies but not well-explained at a mechanistic level. It is noted here as a practical caution, not a derived result.*

**Why this matters for prompt engineering:** if you are not getting useful answers from a long-context session, one diagnostic step is to rephrase the question explicitly and concretely — name the section, give the token position, say "in the third paragraph of the section titled X." This changes which attention patterns activate. Whether this consistently helps is task-dependent, but it is a zero-cost diagnostic before concluding that the model has "forgotten" the content.

### 3.5 Benchmark landscape — what each test actually measures

Understanding the research requires understanding that these benchmarks are measuring different things, and their results do not simply agree.

**Needle-in-a-Haystack (NIAH):** the original long-context benchmark. A synthetic fact is inserted at a specific position in a large filler document. The model is asked to retrieve it. Tests: pure retrieval of a single item at varying positions. Does not test: reasoning, synthesis, multi-step tasks, or real-document structure. Near-perfect scores on standard NIAH have become essentially a minimum bar for frontier models, which means NIAH has been saturated as a discriminating test for current models. RULER's authors explicitly note this.

**RULER** (arXiv 2404.06654): extends NIAH to include multi-needle retrieval, variable-type needles (words, numbers, UUIDs), and additional task types including multi-hop tracing and aggregation. Key finding: "almost all models exhibit large performance drops as context length increases," and "only half of them can maintain satisfactory performance at the length of 32K" despite claiming to support longer contexts. This was from a 2024 paper on then-current models; current flagship models likely perform better than those tested but have not been re-tested on RULER in a publication this dossier could verify. [Source: arXiv 2404.06654, fetched 2026-05-17.]

**LongBench** (earlier, from 2023): a Chinese/English bilingual benchmark testing multiple long-document tasks including summarization, QA, few-shot in-context learning, code completion, and synthetic tasks. Not purely a retrieval test — it includes generation and reasoning tasks over long documents. Findings generally align directionally with degradation at longer contexts but differ task-by-task.

**"Lost in the Middle" evaluation:** described above. Specific to multi-document QA and key-value retrieval. A 2023 benchmark on 2023-era models. Most directly demonstrates the position-based U-curve, but this is exactly the thing most likely to have improved since publication given it is a clear, measurable target.

**Where they agree:** all four sources agree that models degrade at longer contexts, that the degradation is real and measurable, and that claimed context window length systematically overstates reliable effective context. The precise shape and magnitude of degradation disagrees across tasks, models, and evaluation dates.

**Where they disagree:** NIAH (saturated at frontier level) and RULER (still discriminating) give very different impressions of how well models handle long context. A model scoring near-perfect on NIAH might score 65% on RULER's multi-needle tasks at 128K. Citing only NIAH scores creates a misleadingly optimistic picture.

**LongBench in more detail:** LongBench (Bai et al., 2023) covers six categories — single-document QA, multi-document QA, summarization, few-shot in-context learning, code completion, and synthetic tasks. It evaluates both English and Chinese. Because it includes generative tasks (summarization, few-shot learning) alongside retrieval tasks, its results are not directly comparable to NIAH or RULER. A model might do well on LongBench summarization but poorly on RULER multi-needle — these measure genuinely different capabilities. The lesson: "passes LongBench" is not a substitute for "reliably retrieves specific facts at long range."

**The missing evaluation:** there is no equivalent of these public benchmarks specifically for Claude at 1M-token contexts using real (non-synthetic) documents and complex reasoning tasks, in a form this dossier could verify as of May 2026. The chapter author should not state or imply that Anthropic's 1M-token window performs equivalently to the NIAH near-perfection numbers.

**What Anthropic has and has not published:** Anthropic's model release blog posts typically include benchmark scores on SWE-bench (coding), MMLU (knowledge), and math benchmarks. Long-context specific performance — recall at position, multi-needle accuracy, degradation by context length — is not published in a primary-source form this dossier found. This is worth flagging in the chapter as a transparency gap, not as evidence of poor performance.

---

## 4. Why this happens — mechanism, hedged

The following are mechanistic intuitions. They are the leading explanations in the research community but are not proven first-principles derivations. The field actively debates the precise weighting of each factor.

### 4.1 Attention has a finite budget

In each attention layer (introduced in Ch 3), every token computes attention weights over all prior tokens in the sequence. Those weights are passed through a softmax — a normalization operation that forces all weights to sum to exactly 1.0. That means attention is a *budget*: the total amount of "attention" available for one token to distribute across its history is fixed.

At a sequence length of 1,000 tokens, each earlier token can receive up to 0.1% of the budget. At 1,000,000 tokens, that denominator grows 1,000-fold. If the model spreads attention evenly (it doesn't, but this is the limiting case), each earlier token receives 0.0001% of the budget. In practice, attention is not even — it concentrates on certain positions — but the budget intuition captures why sheer sequence length creates pressure on which tokens get attended to and which effectively disappear.

This is a *budget metaphor*, not a derivation. Real attention heads are sparse and selective. But the metaphor captures the direction of the effect correctly.

### 4.2 The training-length distribution (a softer mechanism)

Before getting to position encoding, consider a simpler explanation: if almost all training examples were under 10,000 tokens, the model's learned patterns about "how to use distant context" are shaped by relatively few long examples. The model is not trained to fail at long context — it is undertrained on long context.

When a model sees a 200K-token prompt at inference time, it is applying patterns learned predominantly from much shorter prompts. The patterns mostly generalize, but behavior at the extreme of the distribution is less reliable than behavior near the center. This is a domain generalization argument: the model is generalizing to a different regime from its training distribution.

**What this predicts:** models that are fine-tuned specifically on long-context data should improve at long context, even without architectural changes. This prediction is empirically supported — Anthropic and others have used targeted long-context fine-tuning as part of extending context capabilities, and improvement has been documented (though the degree of remaining degradation is not publicly benchmarked in a form this dossier verified).

**What this does not predict:** that increasing training-time long-context exposure will fully close the effective-use gap. Even if the model sees many 500K-token training examples, the softmax budget constraint (Section 4.1) and position encoding limits (Section 4.2) are architectural, not data-driven. Data helps; it does not fully substitute for architectural capability.

### 4.3 Position encoding scaling — RoPE and YaRN (architectural limit)

Modern language models use rotary position embeddings (RoPE) to tell the model where each token sits in the sequence. The intuition: each token's representation is "rotated" by an angle proportional to its position, so tokens at different positions look geometrically distinct in the attention space. Nearby tokens have similar angles; distant tokens have dissimilar angles — encoding relative distance as part of the representation. [Source: arXiv 2104.09864, fetched 2026-05-17.]

The problem: RoPE was calibrated during training for a specific maximum sequence length. Beyond that length, tokens appear at positions the model never saw during training — the angles fall outside the trained range. The model doesn't fail catastrophically, but its ability to distinguish "this token is 50,000 positions before me" from "this token is 500,000 positions before me" degrades because those angles are extrapolating beyond training.

**YaRN** (Yet another RoPE extensioN, arXiv 2309.00071) is a method for scaling RoPE to longer sequences with significantly less retraining than naive approaches — reportedly 10x fewer tokens and 2.5x fewer training steps. It scales the angular frequencies so the rotation angles map usefully to the new, longer range. [Source: arXiv 2309.00071, fetched 2026-05-17.] YaRN and similar scaling techniques are how many current models extended their context windows without full retraining on the extended length.

**The key insight for the reader:** context extension via RoPE scaling extends the *reach* of the position system, but it does not guarantee that the model's understanding of very distant context is as reliable as its understanding of nearer context. The model learned most of its long-range behavior from shorter training examples; the extended positions are partially extrapolated. This is one probable contributor to the general degradation-at-distance pattern.

*This is the community's leading mechanistic explanation. It is not a proven account of exactly how much degradation is caused by position encoding vs. other factors.*

### 4.4 Attention sinks — anchor tokens that absorb attention budget

Xiao et al. (2023), "Efficient Streaming Language Models with Attention Sinks" (arXiv 2309.17453, StreamingLLM), documented a striking phenomenon: initial tokens in a sequence receive disproportionately high attention scores regardless of their semantic content — even when those tokens are structurally unremarkable (e.g., a period, a whitespace token). These "attention sinks" absorb a share of the attention budget without contributing semantically useful information.

The discovery came from work on streaming inference: models that otherwise struggled with long sequences could maintain stable behavior if they were allowed to keep the KV vectors of these initial anchor tokens in memory, even when everything else was evicted. This suggests the model has learned to use early tokens as stabilizers — a learned behavior that revealed itself through its absence when the sinks were removed. [Source: arXiv 2309.17453, fetched 2026-05-17.]

**Why this helps explain the "beginning" advantage in Liu et al.:** the fact that the very beginning of a sequence receives disproportionately high attention — even as a stabilizing sink — may partly explain why information at the very start of a long context is retrieved more reliably. The initial positions are structurally privileged by the attention pattern, not just by recency. This is speculative as a causal link between the two papers; neither paper claims it explicitly. But the direction is consistent and worth noting as a mechanistic candidate.

**StreamingLLM's practical contribution:** by keeping just the sink tokens plus a window of recent tokens in the KV cache, StreamingLLM allowed models to process sequences up to 4 million tokens long without fine-tuning, with stable perplexity. This is an inference trick, not a training advance — it does not improve the model's ability to reason over long contexts; it just prevents runtime failure from unbounded KV cache growth. The quality of reasoning over distant content remains limited by the same attention-budget dynamics described above.

For a reader of this site: attention sinks are real, documented, and supported by the StreamingLLM experiments. Their precise role in long-context recall degradation is less clear — they tell us attention budget is not purely allocated to semantically relevant content, which is consistent with the budget story but doesn't precisely quantify its contribution to degradation.

### 4.5 A note on what is not known

The mechanisms above — attention budget, training distribution, position encoding limits, and attention sinks — are the leading explanations for long-context degradation. They are consistent with the empirical patterns in Section 3. They are not a complete, proven account. In particular:

- The relative weight of each factor is not established. Is position encoding the dominant issue, or training data length distribution? Researchers disagree.
- It is possible (and likely) that Anthropic's fine-tuning and training choices for Claude 4.x have shifted the contribution of each factor. Anthropic has not published mechanistic analysis of this.
- The attention budget metaphor is directionally correct but masks important structure: attention heads are specialized and can concentrate sharply on relevant content. The metaphor should not be taken to mean that every token competes equally for attention weight — they don't.

The chapter should present these mechanisms as "likely contributing factors, in the direction the evidence suggests" rather than as established facts.

---

## 5. The cost story

Long context is expensive in two dimensions: compute during the first pass (prefill) and memory throughout the response (KV cache). Understanding this shapes the economics of when long-context use is and isn't sensible.

### 5.1 Prefill is roughly quadratic in context length

During **prefill** (processing the user's prompt), every token must attend to every prior token at every layer. If the prompt doubles in length, the attention computation grows by roughly 4x (each of twice as many tokens attends to twice as many others). For very large contexts, this is the dominant cost before any response generation begins. A 1M-token prefill is not 10x more expensive than a 100K-token prefill in compute terms — it is closer to 100x. (This is the "roughly O(N²)" claim from Ch 3; hardware optimizations like FlashAttention reduce constants but not the asymptotic scaling.)

### 5.2 Decode is roughly linear via the KV cache

Once prefill is done, each new generated token only needs to compute its own Query and compare against the cached Keys and Values of all prior tokens. The KV cache (Ch 6) stores those values. So each decode step costs O(N) in memory reads (scanning the entire cache) rather than O(N²) in compute. The cache grows linearly with sequence length, not quadratically.

Memory implication: a 1M-token context requires a correspondingly enormous KV cache — growing linearly with the number of layers, the number of tokens, and the hidden size. A production-scale model at 1M tokens holds substantially more KV data than the same model at 10K tokens. This is a real constraint in deployment.

### 5.3 Prompt cache changes the economics

The **prompt cache** (Ch 7) is the product-level mechanism that persists a computed prefix across separate API requests. If your 1M-token system prompt or document set is stable across many user turns, you pay the enormous prefill cost once, then amortize it across every subsequent request that hits the cache.

This is the economic mechanism that makes very long contexts tractable. Without caching, every new request re-pays the full quadratic prefill cost. With caching, subsequent requests pay only the cache-read rate on the stable prefix plus the full cost of the new content.

The qualitative direction: cache-read rates are substantially cheaper than uncached input rates. Cache-write rates are more expensive than uncached input. The math works when the same prefix is read many times. A unique-per-user 1M-token context — one that changes with every request — pays the full prefill cost and does not benefit from caching.

**Bottom line on economics:** a cached stable 1M-token prefix is a very different beast from an uncached one. When someone says "we're using 1M-context Opus 4.7," the relevant follow-up question is whether that prefix is being cached. Qualitatively, cached long-context can become competitive with RAG for many use cases; uncached it is extremely expensive per request.

*Exact pricing rates are not quoted here because they change. See Anthropic's current pricing page for current rates.*

**A concrete (qualitative) scenario:**

Imagine a legal team using Claude Opus 4.7 to analyze a 50-page master services agreement against a database of 200 past contracts. The database is ~400K tokens and is the same for every analysis session. If they send the full database as a prefix on every request without caching, every request pays full prefill cost for 400K tokens. If they use prompt caching with the 1M-token context, they write that 400K-token prefix once (paying the higher write rate), then read it on every subsequent request at the much lower read rate. After approximately two to three requests, the cumulative cache-read savings exceed the write premium. From that point forward, every request is substantially cheaper than the uncached version, while seeing the full database rather than a RAG-selected subset. This is a realistic long-context-with-cache use case that beats RAG for a corpus that fits in the window and is stable across sessions.

The same scenario breaks down if: the contract database is 5GB (too large to cache); it updates daily with new contracts (cache invalidated constantly); or different users need different subsets (no shared stable prefix). In those cases, RAG wins on cost and flexibility.

### 5.4 Files API — a surface for reusable long documents

Anthropic's Files API (currently in beta as of May 2026) allows uploading documents once and referencing them by file ID in subsequent API calls, avoiding re-uploading large files with each request. Supported types: PDF, plain text, images. Maximum file size: 500 MB per file; 500 GB total per organization. The Files API is available on the Claude API and Claude Platform on AWS; not currently on Amazon Bedrock or Vertex AI. File-operation calls (upload, list, delete) are free; file content referenced in Messages requests is billed as input tokens. [Source: Anthropic Files API docs, fetched 2026-05-17.]

The Files API addresses a practical friction point (re-uploading the same document repeatedly) but does not change the token economics of what gets processed in the context window. It is infrastructure for document management, not a caching mechanism in the Ch 7 sense — the content still flows through the context window and is processed as tokens. The benefit is bandwidth and latency reduction at upload time, not compute reduction at inference time.

**Files API + prompt cache together:** the combination is complementary. Upload a large document once via the Files API (no re-upload bandwidth cost on subsequent requests). Reference the file by ID in each request. If the document appears early in a stable prefix, the prompt cache can store the computed K/V for those tokens and reuse them across requests. The Files API removes upload overhead; the prompt cache removes compute overhead. Neither alone achieves both goals.

---

## 6. Long context vs. RAG — when each wins

*See also: the RAG dossier at `docs/research/rag.md`, particularly §9 (common misconceptions).*

The framing "long context vs. RAG" is partly false — they are not substitutes in most real systems. But the tradeoffs are real.

### When long context wins

- **Small-N, high-value documents:** you have 5 contracts and need to reason across all of them simultaneously. Putting all 5 in the context lets the model see every clause in relation to every other. RAG would have to guess which chunks to retrieve.
- **Complex cross-document reasoning:** the answer requires synthesizing content from multiple parts of a long document that cannot be predicted at retrieval time. Any chunking strategy risks missing the relevant combination.
- **Citation-heavy summarization:** every paragraph of a 100-page report might be relevant; RAG's top-K would miss the tail. Long context sees everything.
- **Small corpora that fit and are stable:** if your knowledge base is 50K tokens and rarely changes, caching it as a prompt prefix beats running retrieval on every query.

### When RAG wins

- **Massive corpora:** hundreds of gigabytes of documentation do not fit in any context window. RAG is not optional.
- **Freshness:** retrieved documents can be updated continuously; a long context prefix must be re-prefilled (or cache-invalidated) when content changes.
- **Cost-sensitive, latency-sensitive systems:** short, targeted contexts are cheaper and faster than long ones, even with caching, when only a small fraction of the corpus is relevant per query.
- **Multi-tenant systems:** separate users need separate data. Caching a shared long prefix does not help if every user's documents differ.
- **When the answerable subset is small:** if only 3 out of 1,000 pages are ever relevant to any given question, loading 1,000 pages is wasteful and may hurt recall via distractor effects.

### The cache flips the RAG-vs.-long-context comparison

Without caching, long-context is almost always more expensive than targeted RAG for high-volume use. With a stable cached prefix, the per-request cost of long-context drops toward the cost of the new turn only — making it competitive with RAG pipelines for moderate corpus sizes. The RAG dossier's §6 (prompt-assembly) covers the hybrid design: cache a stable knowledge bundle, append per-query retrieved chunks. This is the practical optimum for many production systems — not "RAG vs. long context" but "cached stable prefix plus targeted retrieval."

### Recall quality — an honest comparison

One dimension that is often overlooked in the long-context-vs-RAG debate is recall quality per relevant token. In long context, the model sees everything — relevant and irrelevant — and must selectively attend to the right parts. In RAG with good retrieval, the model sees only the top-K most relevant chunks, with fewer distractors. On tasks where the relevant chunk is highly retrievable and the context is otherwise noisy, RAG often yields higher answer quality despite having a much smaller effective context.

This is not always the case. When the relevant information is the synthesis of many distributed details — not locatable by any single retrieval query — long context wins because no chunked retrieval strategy would surface all of it. The decision point: is the relevant information a needle (findable by retrieval) or a distributed pattern (requiring the whole document to synthesize)? Needles → RAG. Patterns → long context.

### A practical decision tree

```
Do I have a specific, locatable fact to find?
  → Yes: RAG (precise, cheaper)
  → No: Does the answer require synthesizing many parts of the document?
        → Yes: Long context (with cache if stable)
        → No: Can I predict which chunks matter in advance?
              → Yes: Pre-load stable bundle (long context + cache)
              → No: Dynamic RAG with per-query retrieval
```

This is a rough heuristic, not a formula. Real systems often land somewhere between these branches.

**A caution about context-length arms races:** as model providers compete to advertise larger context windows, it can feel like "bigger window = better product." From a user perspective, the window ceiling matters less than the effective recall floor. A model with a 200K context window and 85% recall at the midpoint is more useful for most document tasks than a model with a 1M window and 55% recall at the midpoint. Context window size is a marketing-legible metric; effective recall is harder to measure but more operationally relevant. When evaluating models for long-document work, test recall fidelity at your actual operating context length, not the model's advertised maximum.

---

## 7. Common misconceptions / pedagogical traps

**"1M context = perfect 1M recall."**
False. Capacity is not effective use. See all of Section 3. Models have 1M-token windows; no published benchmark has shown near-perfect recall across the full 1M range for any model.

**"More context = better answers."**
Not necessarily. More context increases the chance of including the right information, but also increases distractor noise and attention dilution. For simple questions, a lean prompt often outperforms a stuffed one. More is better only when the additional content is genuinely relevant and not competing with the signal you need.

**"If the answer is in there, the model will use it."**
This is the core misconception this chapter should break. The answer being present is necessary but not sufficient. Its position, the surrounding content, and how the question is framed all affect whether the model successfully retrieves it.

**"Long context replaces RAG."**
See Section 6. They address different problems. Long context does not scale to massive corpora, does not handle freshness automatically, and is expensive without caching. RAG is not superseded by large windows; it is complementary.

**"Bigger context window = smarter model."**
Window size is a capacity parameter, not an intelligence parameter. Claude Haiku 4.5 has a 200K window; Claude Opus 4.7 has 1M. The window size reflects architectural and training choices about context length, not general reasoning capability. The smarter model in the Opus/Sonnet/Haiku family is distinguished by reasoning quality, not window size alone.

**"Needle-in-a-haystack tests prove long-context works."**
Near-perfect NIAH scores — which most frontier models achieve — prove that a model can find a single synthetic fact in a large filler document. RULER showed that extending NIAH to multi-needle and more complex task types reveals substantial degradation. A model that aces NIAH may still fail meaningfully on real multi-document reasoning tasks at the same length.

**"Prompt cache makes long context free."**
Cache reads are much cheaper than uncached input, but not free. Cache writes are more expensive than uncached input. The economic win requires many reads per write. And the cache requires an exact prefix match — any change to the early content breaks the match and forces re-prefill.

**"The model reads your prompt the way a human reads a document."**
A human reading a 100-page report develops a structured mental model — sections, subsections, main arguments, supporting details. The model does not. It processes all tokens in parallel during prefill via attention, then generates a response token by token. It has no internal "table of contents" it consults; it has attention weights over all prior tokens. When it fails to recall something, it is not "forgetting" in the human sense — it is distributing attention in a way that does not strongly activate the relevant content at response generation time. This distinction matters because it changes what remedies work: "emphasize" it (place at boundaries, ask more specifically), rather than "repeat" it (repetition in the middle helps less than you might expect).

**"Longer output = longer context handled correctly."**
A model can generate a very long response about a document while having attended poorly to parts of it. Output length is not evidence of input recall fidelity. The model can fill a 10,000-token response with fluent, plausible-sounding synthesis that misses a detail buried at position 400K. This is one reason why applications that require strict accuracy (legal review, financial compliance) should not rely solely on long-context recall — they should use structured verification steps, citations, or RAG with explicit chunk references.

---

## 8. House-style chapter ideas

### Diagram option A — position-based accuracy plot (primary recommendation)

A U-curve showing illustrative recall accuracy vs. needle position (expressed as a fraction of total context length, 0 to 1). The curve is high at 0 and 1, dips in the middle. Mark the midpoint explicitly ("middle = lowest recall"). Label the axes plainly. Add a small legend: "consistent with Liu et al. (2023); direction has been replicated; magnitude varies by model and task."

**Format:** inline SVG, hand-authored, clearly labeled as illustrative.
**Component name:** `LongContextRecallCurve.tsx` (or static SVG in the MDX)
**Data file:** `src/data/long-context.ts` — export a `needleRecall` array of `{position: number, recall: number}` (20 points, 0.0–1.0, illustrative U-shape)
**Takeaway:** the model does not attend equally to all positions; the middle is the danger zone.

### Diagram option B — KV cache memory vs. context length (secondary)

A simple bar chart: four bars for 32K, 128K, 500K, 1M tokens. Bar height represents relative KV cache memory (normalized to the 32K bar = 1). Since KV cache scales linearly, the bars are at heights 1, 4, 15.6, 31.25 approximately. This gives a visceral sense that 1M tokens is not just "bigger" — it is 31x more KV memory than 32K.

Optionally overlay a qualitative "cost without cache" overlay in a different color.

**Format:** HTML/CSS bar chart (no library, matching site style)
**Component name:** `KVScaleChart.tsx`
**Data file:** `src/data/long-context.ts` — export `kvScaleData` array
**Takeaway:** memory cost scales linearly with context; this is why caching matters economically.

### Demo option A — place the needle (primary recommendation)

A slider: the user chooses where in a simulated 50-position document to place "the answer." A simple readout shows illustrative recall probability at that position (drawn from the U-curve data). The slider lets the reader physically move the needle from beginning (high recall) to middle (lower recall) to end (high recall again) and see the number change.

**Component name:** `NeedlePositionSlider.tsx`
**Data file:** `src/data/long-context.ts` — the `needleRecall` array from Diagram A doubles as the slider data
**Takeaway:** position matters. Place load-bearing content at the start or end.
**Label clearly:** "Illustrative recall probability based on research direction, not a live model measurement."

**Implementation notes for the component:**
- The slider should have 20 discrete steps (one per data point in `needleRecall`), not continuous, so the values snap to the actual data points.
- Display both the position (e.g., "Position: 45% into the document") and the recall value (e.g., "Illustrative recall: 56%").
- Color-code: positions above 75% recall shown in blue (safe), below 65% in amber (caution), below 60% in a warm red (risk zone). These thresholds are illustrative and should be labeled as such.
- Add a static note: "In a real deployment, recall varies by model, task type, and context content. These numbers show the research direction, not a guarantee about any specific model."

### Demo option B — distractor count slider

A counter (or discrete steps: 0, 2, 5, 10, 20, 40 distractor documents). A simple bar or number showing illustrative recall as distractors increase. The value decreases monotonically with distractor count.

**Component name:** `DistractorSlider.tsx`
**Data file:** `src/data/long-context.ts` — export `distractorRecall` array
**Takeaway:** irrelevant-but-similar content degrades recall. Lean prompts often outperform stuffed ones.
**Label clearly:** "Illustrative — direction consistent with Liu et al. (2023) and subsequent work."

**Implementation notes for the component:**
- Six discrete steps: {0, 2, 5, 10, 20, 40}. Use a step-count display rather than a continuous slider (discrete choices are clearer for illustrative data).
- Alongside the recall number, show a brief text description of what the distractor count means: "2 distractors: 2 similar-but-wrong documents surround the target. 40 distractors: 40 similar documents, 1 correct."
- This reinforces the intuition that "filling the context" is not neutral — the model is competing for attention budget across all of them.

### Diagram option A — implementation sketch

The U-curve SVG should be hand-authored, not generated at runtime from the data array. Key decisions:

- Smooth cubic bezier curve (not a scatter plot) — more legible and honest about the illustrative nature.
- x-axis: "Position in context (start → end)" labeled at 0%, 25%, 50%, 75%, 100%.
- y-axis: "Illustrative recall %" labeled at 50%, 70%, 90%.
- Annotate three regions: "Start: higher recall," "Middle: lower recall," "End: higher recall." Keep annotations small.
- Source note below the diagram: "Shape consistent with Liu et al. (2023). Numbers are illustrative, not measured on Claude."
- Amber fill under the curve in the middle zone (40%–60% position) where recall dips — consistent with the site's amber-for-caution visual convention.

This diagram is the single most important visual in the chapter. It should be self-explanatory without reading the surrounding text.

---

## 9. Hand-authored data plan

**File:** `src/data/long-context.ts`

### 9.1 Needle-position × recall table

Twenty positions, 0.0 (beginning) through 1.0 (end), with illustrative recall percentages consistent with the U-curve literature direction. The curve should be visibly U-shaped: high at both extremes, lowest around 0.4–0.6, with a gentle bowl rather than a sharp V.

```
Illustrative data (not from a real model):
position | recall%
0.00     | 91
0.05     | 89
0.10     | 86
0.15     | 82
0.20     | 76
0.25     | 70
0.30     | 65
0.35     | 61
0.40     | 58
0.45     | 56
0.50     | 55     ← midpoint nadir
0.55     | 57
0.60     | 60
0.65     | 65
0.70     | 71
0.75     | 78
0.80     | 83
0.85     | 87
0.90     | 90
1.00     | 92
```

Clearly labeled in the data file with a comment: `// Illustrative — U-curve direction from Liu et al. (2023); numbers are not from a real model evaluation.`

### 9.2 Distractor count × recall table

Six discrete distractor counts: 0, 2, 5, 10, 20, 40. Recall starts near ceiling with 0 distractors and declines monotonically. The decline is steeper at first (going from 0 to a few distractors hurts most) and flattens out at higher counts.

```
Illustrative data:
distractors | recall%
0           | 94
2           | 86
5           | 76
10          | 66
20          | 57
40          | 50
```

Clearly labeled: `// Illustrative — direction consistent with multi-document QA literature; numbers are not from a real model evaluation.`

### 9.3 KV scale data

Four context lengths with relative memory cost (normalized to 32K = 1.0):

```
32K tokens   → 1.0×
128K tokens  → 4.0×
500K tokens  → 15.6×
1M tokens    → 31.25×
```

Clearly labeled: `// KV cache memory scales linearly with context length; relative sizes are exact given the linear relationship, not illustrative.`

### 9.4 TypeScript type definitions

```typescript
// src/data/long-context.ts

/**
 * Needle-position × recall data.
 * Illustrative U-curve consistent with Liu et al. (2023) direction.
 * Numbers are NOT from a real model evaluation.
 */
export type NeedleRecallPoint = {
  /** Position in context: 0.0 = start, 1.0 = end */
  position: number;
  /** Illustrative recall percentage (0–100) */
  recall: number;
};

/**
 * Distractor count × recall data.
 * Illustrative monotonic decline consistent with multi-document QA literature.
 * Numbers are NOT from a real model evaluation.
 */
export type DistractorRecallPoint = {
  /** Number of irrelevant but topically similar documents */
  distractors: number;
  /** Illustrative recall percentage (0–100) */
  recall: number;
};

/**
 * KV cache memory scaling by context length.
 * Relative sizes are mathematically exact (linear scaling).
 * Absolute memory values are model-dependent and not stated.
 */
export type KVScalePoint = {
  /** Context length in tokens */
  tokens: number;
  /** Memory relative to the 32K baseline (32K = 1.0) */
  relative: number;
  /** Human-readable label for the bar chart */
  label: string;
};

export const needleRecall: NeedleRecallPoint[];
export const distractorRecall: DistractorRecallPoint[];
export const kvScaleData: KVScalePoint[];
```

The data file should be importable independently. Export all three datasets and their types from a single module. Keep the file under 100 lines — the data is compact and should not be over-engineered.

---

## 10. Connections to existing chapters

**Ch 3 — Attention (`src/pages/03-attention.mdx`):** the attention budget metaphor in Section 4 of this dossier extends directly from Ch 3's Q/K/V explanation. The softmax-over-long-sequence intuition is a direct application. The diagram of attention weights in Ch 3 becomes the substrate for the "attention dilutes with length" argument.

**Ch 4 — Layers (`src/pages/04-layers.mdx`):** Ch 4's note that KV cache size scales with layer count × tokens × hidden size is the starting point for Section 5's cost story. The long-context KV memory problem is layers-dependent, not just token-count-dependent.

**Ch 6 — KV cache (`src/pages/06-kv-cache.mdx`):** the KV cache's linear-in-N memory growth (noted in Ch 6: "memory pressure from the KV cache is a real constraint in serving systems") is what makes Section 5's scaling story concrete. Diagram B of Section 8 directly visualizes the O(N) KV memory growth described in Ch 6.

**Ch 7 — Prompt cache (`src/pages/07-prompt-cache.mdx`):** the economics of long context are fundamentally changed by the prompt cache. Section 5.3 is the bridge: cached long-context vs. uncached long-context is a different economic comparison than just "long vs. short." Ch 7's practical takeaway ("stable content early, mutable late") applies directly: the stable document corpus goes first in the prefix, before the breakpoint, so it gets cached. The user's question goes last, after the breakpoint, uncached. This is the correct architecture for document-heavy long-context use. A chapter on long-context that omits the cache economics is incomplete.

**Ch 5 — Generation (`src/pages/05-generation.mdx`):** the prefill vs. decode distinction from Ch 5 is the direct foundation for Section 5 of this dossier. The "prefill is O(N²)" cost is not new information — it follows from what Ch 5 explains about how the model processes the prompt. The long-context cost story is Ch 5's prefill story applied to very large N. Cross-link explicitly.

**RAG dossier (`docs/research/rag.md`):** Section 6 of this dossier cross-references the RAG tradeoff explicitly. The RAG dossier's §9 misconception "Long context windows make RAG obsolete" is a direct counterpart to this chapter's Section 7 misconception "Long context replaces RAG." The two chapters are designed to be read together or linked bidirectionally. The specific link: RAG dossier §6.2 describes the "stable bundle vs. per-query retrieval" tradeoff, which is the same tradeoff Section 6 of this dossier describes from the long-context angle. Both chapters should point at this shared design decision explicitly.

**Sampling / generation dossier (`docs/research/sampling.md`):** if this dossier exists and covers temperature and generation behavior, there may be a connection to long-context generation consistency — very long generated outputs may show increased variance. This connection is speculative and should only be added if the sampling dossier explicitly covers output-length effects.

---

## 11. Closing-takeaway angle

The chapter should close with a version of this:

> Fitting in the window is necessary, not sufficient. The model's effective use of long context degrades in known patterns: position-dependently (the middle is the danger zone), distractor-sensitively (irrelevant-but-similar content degrades recall of the target), and task-dependently (multi-step reasoning over many facts is harder than finding one fact). When you have a choice, place the load-bearing content at the boundaries — the beginning or the end — not buried in the middle. When you are building a system rather than crafting one prompt, understand that long-context cost is dominated by prefill, that the prompt cache changes the economics fundamentally, and that RAG is not the enemy of long context but its complement.

**Optional secondary takeaway for developers:**

> The benchmark landscape is more complex than it looks. A model that aces needle-in-a-haystack is not proved to work reliably at long context for your use case. RULER, multi-needle tasks, and real-document evaluations are more demanding. When evaluating whether a model handles your specific long-context workload, test it on your workload at your context length — don't generalize from synthetic benchmarks.

**CacheCallout text (for the `<CacheCallout>` component):**

> Long context and the prompt cache (Ch 7) are a pair. The context window gives you space; the cache makes using that space economically viable across many turns. Without caching, every new request re-pays the full prefill cost for every token in your long document set — a cost that scales quadratically with context length and becomes impractical at 500K+ tokens per request. With a stable cached prefix, subsequent requests read those tokens at cache-read rates, which are dramatically cheaper than uncached input. The constraint: the cache requires an exact prefix match. Add a single token to your stable document set, and the whole cache entry is invalid. Design your long-context application with the same "stable early, mutable late" discipline that Ch 7 recommends for Claude Code's own request structure.

---

## 11b. Practical guidance — what to do right now (for the chapter's closing section)

This section is a distillation of the above into actionable steps. The chapter author can adapt this as a checklist-style callout or as the chapter's final section before the CacheCallout.

**If you are writing a long prompt:**
1. Place the most critical facts or instructions at the very beginning of the context (after the system prompt), not buried in the middle.
2. If you must place load-bearing content in the middle, summarize it explicitly at the end: "As stated earlier, the key constraint is: [X]." This doubles the signal from endpoints.
3. Minimize distractor documents. If you have 20 candidate documents and only 1 is likely relevant, consider retrieval to surface the 1 rather than sending all 20.
4. Ask specifically. "What does clause 4.2 of the attached contract say about termination?" will fare better than "Summarize the contract with a focus on termination clauses" when the relevant clause is mid-document.

**If you are building a system:**
1. Design for caching. Identify which parts of your long-context application are stable (document set, system instructions) and which are per-request (user questions, fresh data). Put stable content early with a cache breakpoint.
2. Test your specific use case at your specific context length, not at a benchmark context length. A model that performs well at 32K may behave differently at 200K for your task type.
3. Monitor for the "confident-but-wrong" failure mode. Long-context failures are often not visible as errors — the model produces fluent, plausible-sounding answers that happen to miss a specific detail. Build verification steps (citations, structured extraction, grounding checks) rather than trusting fluency.
4. Consider a hybrid: cache a stable core document set for broad context; add targeted RAG retrieval for specifics. This is the architecture the RAG dossier's §6 recommends and the most cost-effective approach for most production systems.

---

## 12. Up-to-date facts (with citations and dates)

| Claim | URL | Fetched date | Verified? |
|---|---|---|---|
| Claude Opus 4.7 context window: 1M tokens | https://platform.claude.com/docs/en/about-claude/models/overview | 2026-05-17 | Yes — table entry confirmed |
| Claude Sonnet 4.6 context window: 1M tokens | https://platform.claude.com/docs/en/about-claude/models/overview | 2026-05-17 | Yes — table entry confirmed |
| Claude Haiku 4.5 context window: 200K tokens | https://platform.claude.com/docs/en/about-claude/models/overview | 2026-05-17 | Yes — table entry confirmed |
| "Lost in the Middle" published in TACL (2023) | https://arxiv.org/abs/2307.03172 | 2026-05-17 | Yes — abstract confirmed |
| Liu et al. found U-shaped accuracy curve across positions | https://arxiv.org/abs/2307.03172 | 2026-05-17 | Yes — stated in abstract |
| RULER extends NIAH to multi-needle and reasoning tasks | https://arxiv.org/abs/2404.06654 | 2026-05-17 | Yes — abstract confirmed |
| RULER: "almost all models exhibit large performance drops as context length increases" | https://arxiv.org/abs/2404.06654 | 2026-05-17 | Yes — abstract confirmed |
| RULER: only half of models maintain satisfactory performance at 32K | https://arxiv.org/abs/2404.06654 | 2026-05-17 | Yes — stated in abstract |
| RoPE (Rotary Position Embedding): rotates token representations by position angle | https://arxiv.org/abs/2104.09864 | 2026-05-17 | Yes — abstract describes rotation-based encoding |
| YaRN requires 10x fewer tokens and 2.5x fewer training steps vs. prior methods | https://arxiv.org/abs/2309.00071 | 2026-05-17 | Yes — stated in abstract |
| Attention sinks: initial tokens receive disproportionate attention regardless of content | https://arxiv.org/abs/2309.17453 | 2026-05-17 | Yes — core finding of StreamingLLM paper |
| StreamingLLM demonstrated attention sinks on Llama-2, MPT, Falcon, Pythia | https://arxiv.org/abs/2309.17453 | 2026-05-17 | Yes — listed in abstract |
| Files API: max file size 500 MB; 500 GB total per org; supports PDF, text, images | https://platform.claude.com/docs/en/build-with-claude/files | 2026-05-17 | Yes — docs confirmed |
| Files API in beta as of May 2026; not on Bedrock/Vertex | https://platform.claude.com/docs/en/build-with-claude/files | 2026-05-17 | Yes — note in docs confirmed |
| Files API operations (upload/list/delete) are free; content billed as input tokens | https://platform.claude.com/docs/en/build-with-claude/files | 2026-05-17 | Yes — billing section confirmed |
| Liu et al. tested multi-document QA and key-value retrieval tasks | https://arxiv.org/abs/2307.03172 | 2026-05-17 | Yes — stated in abstract |
| Specific accuracy numbers from "Lost in the Middle" (e.g., 50–60% mid-position) | Could not verify from abstract alone — full paper required | — | Not verified from primary source — see https://arxiv.org/abs/2307.03172 |
| Whether current Claude models have specifically improved the U-curve position effect | No Anthropic publication found | — | Not verified — Anthropic has not published a Claude-specific long-context recall curve as of May 2026 |

---

## 13. Open questions for the chapter author

**1. Illustrative vs. measured data.** The dossier recommends clearly labeling all demo data as illustrative. Should the chapter also include a callout box that explains *why* the data is illustrative — i.e., that no public benchmark has tested Claude at 1M tokens with the same methodology as Liu et al.? This would be pedagogically honest but may slow the chapter's pacing. Recommend a footnote-style callout rather than a full paragraph.

**2. Depth of position encoding section.** RoPE and YaRN are named in Section 4 but not derived. Should the chapter include a short animation or diagram showing the "rotation" metaphor without math? A simple clock-face or angle illustration might make RoPE intuitive. The tradeoff: it adds a diagram without a strong connection to the "what should I do differently?" takeaway. Judgment call for the chapter author based on how much the chapter's pacing can absorb.

**3. Single-benchmark vs. multi-benchmark coverage.** The chapter could go deep on one benchmark (RULER, because it's the most critical of current models) or give a quick tour of the landscape (NIAH, RULER, LongBench, Lost in the Middle). The dossier leans toward the tour approach, but a focused treatment of RULER alone might be more memorable for a non-ML reader. Consider whether the reader needs to know all the benchmarks exist or just the key finding that "standard NIAH scores are not sufficient."

**4. Files API placement.** The Files API note (Section 5.4) is included because it's a current Anthropic product surface relevant to long-document workflows. But it does not fit cleanly into the cost-or-performance narrative — it's an infrastructure tool. Consider whether it belongs in the main chapter body, a sidebar, or a footnote. It may be more relevant to a developer-oriented supplementary chapter than to the conceptual long-context chapter.

**5. How much to emphasize that newer models may have improved.** The chapter should not leave the reader thinking that Claude is stuck at 2023-era performance on a 2023 benchmark. The hedge is important, but so is not underselling the improvement. Suggested framing: "newer models have likely improved on the specific tasks Liu et al. tested; the direction of the effect (middle is harder than endpoints) is more durable than the exact magnitude."

**6. Diagram A resolution.** The U-curve SVG needs to be hand-authored, not generated from real data. The author should decide whether to show it as a smooth curve (more legible) or a scatter of 20 points (more honest about the illustrative nature). The dossier recommends smooth curve with a clear "illustrative" label; a scatter of points would be unusual for a pedagogical chapter but is defensible.

**7. Connection to prompt cache chapter.** The chapter should cross-link to Ch 7 at the point where it discusses the economics of caching (Section 5.3). A `<CacheCallout>` component would be appropriate here. Suggested text: "The prompt cache (Ch 7) is the mechanism that makes large stable contexts economically viable. A 1M-token prefix that never changes is cached once and read cheaply on every subsequent turn. A 1M-token prefix that changes per user gets no cache benefit and pays the full prefill cost every time."

**8. NoLiMA benchmark.** This dossier searched for "NoLiMA" as a potential long-context benchmark (the research brief listed it). The arXiv URL checked (2309.12307) returned a page about LongLoRA, not NoLiMA. It is possible NoLiMA is a more recent benchmark not yet indexed, or that the name was misremembered in the brief. The chapter author should independently search for "NoLiMA LLM benchmark" before finalizing the benchmark landscape section. This dossier could not verify its existence from the sources checked and has not included it in §3.5.

**9. Quadratic prefill — hardware caveats.** Section 5.1 states prefill is "roughly O(N²)." This is the theoretical complexity of dense attention. In practice, all current frontier inference implementations use FlashAttention or similar I/O-aware algorithms that compute attention in blocks and dramatically reduce memory movement costs, partially offsetting the quadratic scaling. The asymptotic complexity is still quadratic in FLOPs, but the practical constant is much lower. The chapter should state "roughly quadratic" with a note that hardware optimizations reduce the practical cost without changing the asymptotic scaling — this is more precise and prevents readers from over-extrapolating from the raw quadratic claim.

**10. Specific accuracy numbers from Liu et al.** Section 12 flags that the specific accuracy numbers (50–60% mid-position) could not be verified from the abstract alone. The chapter author should access the full paper before quoting any specific percentages. The direction (U-shape; middle is worse than endpoints) is verified from the abstract. The magnitude is not. If specific numbers are included in the chapter, they must be sourced from the full paper and clearly attributed.

---

## Iteration log

**Iteration 1:** Full draft. All 13 sections populated. Web research completed (9 fetches: Anthropic models overview, Lost in the Middle arXiv, Claude 3.7 Sonnet release page, RULER arXiv, NoLiMA/LongLoRA arXiv, StreamingLLM attention sinks arXiv, Anthropic character page, Files API docs, RoPE arXiv, YaRN arXiv). All citations entered in Section 12 with verified/not-verified status. Hand-authored data tables in Section 9 provided with illustrative labels. Diagrams and demo specs in Section 8 are concrete and implementable.

**Iteration 2:** Expanded throughout. Added: post-2023 hedging on Liu et al. (§3.1) and "what changed since 2023" paragraph; concrete distractor example with RAG motivating note (§3.2); format-sensitivity prompt-engineering diagnostic (§3.4); LongBench detail and Anthropic publication gap note (§3.5); new §4.2 training-distribution mechanism; attention sinks → beginning-advantage speculation and StreamingLLM practical note (§4.4 → renumbered); mechanism limitations note (§4.5); concrete legal-team cache economics scenario (§5.3); Files API + cache combination note (§5.4); two additional misconceptions — "model reads like a human" and "longer output = better recall" (§7); TypeScript type definitions (§9.4); expanded chapter connections including Ch 5 and sampling (§10); §11b practical guidance checklist; §3.5 LongBench expansion; decision tree for long-context vs RAG (§6); effective-use decomposition (§2); additional open questions 9 and 10 (§13).

**Reason stopped:** `done met` — all required sections complete, 590+ lines (target 600–1200), open questions specific and actionable, no meaningful improvement available without access to full-text papers or a live model evaluation. Iteration limit was 2; this is iteration 2. Line count: ~600.
