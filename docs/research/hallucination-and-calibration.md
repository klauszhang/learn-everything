# Research dossier — Hallucination & calibration

**Status:** research-only.
**Date:** 2026-05-17.

---

## 1. Plain-language premise

You asked Claude something you half-knew the answer to. Claude gave you a confident, fluent, detailed reply. Then you checked. It was wrong — not vaguely wrong, specifically wrong, with plausible-sounding specifics that were made up.

That experience is the starting point for this chapter. The model was not lying. It was not malfunctioning. It was doing exactly what it was designed to do: produce the most probable continuation of your prompt. The problem is that "most probable continuation" and "accurate response" are not the same thing, and the model has no reliable internal alarm that fires when they diverge.

This chapter does not promise a fix. No one has fixed hallucination at the model level — not Anthropic, not OpenAI, not DeepMind. What the research does offer is a usable taxonomy of why confabulation happens, a picture of when to expect it more or less, concrete things you can do right now to catch it or reduce it, and an honest account of what does not work as well as it sounds.

The four questions this chapter answers:

1. **What is hallucination, exactly?** (Two distinct failure modes, often conflated.)
2. **Why does it happen?** (Several credible mechanisms, different confidence levels.)
3. **Can the model tell when it's wrong?** (The calibration question — answer is mostly no.)
4. **What helps?** (In order of leverage, with honest assessment of limits.)

What this chapter does not promise: a world where you can stop checking. Fluent output is a hypothesis. That mental posture is the only durable protection.

---

## 2. What hallucination actually means

The word "hallucination" covers two different failure modes that have different causes and different remedies. Conflating them leads to bad mitigation strategies. A user who tries to fix faithfulness problems with RAG, or who tries to fix open-domain factual problems with citations, will be frustrated — not because the technique is wrong but because they applied the right tool to the wrong problem.

### 2.1 Factual hallucination

The model produces a claim that is false about the world — a wrong date, a nonexistent citation, a person who never said that, a company that never existed. The claim may be detailed and specific, which makes it harder to catch than a vague claim would be. The classic examples:

- **Fabricated legal citations.** Several well-documented court cases have been dismissed or sanctioned after lawyers cited AI-generated cases that don't exist. The cases sound real — they have plausible names, courts, dates, and holdings — because the model has learned what case citations look like from training data.
- **Wrong biographical details.** Birthdates, publication years, job titles, and institutional affiliations — all categories where the model has seen a lot of plausible-sounding data and may conflate two similar people or events.
- **Invented statistics.** "Studies show that X% of people…" where X is plausible and the study doesn't exist. The model has seen thousands of statistic-citing sentences; it generates new ones in the same format.

This is sometimes called "open-domain hallucination" — the model is drawing on (or failing to draw on) its training data about the real world. The remedy is grounding: give the model accurate source material to draw from, rather than relying on recall from training weights.

### 2.2 Faithfulness hallucination

The model is given a source — a document, a set of retrieved passages, a transcript — and asked to answer based on it. The answer is not supported by, or actively contradicts, the provided source. The model may be accurate about the world but unfaithful to its context. Three sub-types:

- **Citation drift.** The model produces a claim and attaches a citation that doesn't quite support it. The citation is real; the association is invented or overstretched.
- **Cross-source synthesis errors.** The model reads three documents and synthesizes a claim that no single document makes. The synthesis may be plausible but is not grounded.
- **Source contradiction.** The model's output directly contradicts the provided source, falling back on training-data priors instead of the text in context.

This is the failure mode that RAG systems are most directly vulnerable to (see also `/docs/research/rag.md`, §8.4 — citation drift). Retrieval reduces open-domain hallucination by giving the model something to anchor on; it introduces faithfulness hallucination risk because the model can still fail to accurately represent what it was given.

### 2.3 A note on both happening at once

These two failure modes can combine. A model can be unfaithful to a provided document (faithfulness failure) while also being wrong about the world (factuality failure). The most damaging scenario: the model retrieves a slightly wrong document and then mis-synthesizes from it, producing an output that has the air of being sourced but is doubly wrong.

### 2.4 The taxonomy reference

The factuality vs. faithfulness two-way distinction is the taxonomy used in Huang et al. (2023), "A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions," published in ACM Transactions on Information Systems. [https://arxiv.org/abs/2311.05232 — submitted November 2023, revised November 2024.] An older and still-cited framing uses "intrinsic hallucination" (output contradicts the source) and "extrinsic hallucination" (output cannot be verified from the source), from Ji et al. (2023), "Survey of Hallucination in Natural Language Generation," ACM Computing Surveys. [https://dl.acm.org/doi/10.1145/3571730] The factuality/faithfulness frame maps better to the user experience described in this chapter.

**One critical limit of all taxonomies:** they describe the output, not the cause. Two outputs classified identically (both are factual hallucinations) may have entirely different internal mechanisms. The next section addresses mechanisms.

---

## 3. Why models hallucinate — multiple credible mechanisms, hedged

There is no single agreed-upon mechanism for hallucination. The research offers several candidate explanations, and they are probably all contributing in different degrees on different tasks. Each mechanism below gets an evidence tag:

- **Well-supported:** strong experimental evidence, published in peer-reviewed work, replicated independently.
- **Suggestive:** consistent with evidence, plausible mechanism, but not directly confirmed at a mechanistic level.
- **Informed speculation:** reasonable inference from model architecture or behavior patterns, not yet directly tested.

### 3.1 Training-distribution gap [Well-supported]

**Intuition:** the model generates fluently in proportion to what it has seen. When asked about something rare, recent, niche, or simply not well-represented in training data, the model cannot recall because the knowledge was never consolidated in its weights — but it can still produce a plausible-sounding completion because it has seen adjacent patterns.

**Evidence:** factual accuracy is consistently higher for topics with dense, repeated, consistent training coverage (major historical events, widely cited people, canonical programming APIs) than for obscure topics, recent events post-training-cutoff, or highly specific technical details. This is a well-documented finding in hallucination evaluations across multiple model families. The pattern predicts hallucination rates better than any other single variable.

**Honest hedge:** "the model didn't see it" is an incomplete explanation even for factual errors on well-covered topics. Models hallucinate about Abraham Lincoln. Distribution coverage is necessary but not sufficient.

### 3.2 Stochastic generation — sampling can drift [Well-supported]

**Intuition:** the model does not retrieve a stored answer; it generates one token at a time from a probability distribution. Each token choice shifts the distribution over the next token. A slightly off-probability early token can start a chain of locally plausible but globally false completions. By the time the model is five tokens into a wrong sentence, abandoning it would require generating a semantically odd correction — which is itself improbable.

**Evidence:** this is a direct consequence of how autoregressive generation works, documented in the generation dossier (`/docs/research/sampling.md`) and in the original Transformer architecture literature. The mechanism is not in dispute. What is in dispute is how often this stochastic drift (rather than missing knowledge) is the proximate cause of a given hallucination.

**Connection to the site:** see `/src/pages/05-generation.mdx` — the model produces one token at a time from a probability distribution. A fluent wrong sentence is often a locally high-probability path through improbable territory.

**Honest hedge:** at T=0 (greedy/argmax decoding), stochastic sampling is removed, yet hallucinations persist. This means sampling is a contributing factor, not the root cause. As noted in `/docs/research/sampling.md`, even temperature=0 is not deterministic due to GPU floating-point non-determinism — Anthropic's own documentation states this explicitly. But even with perfect argmax, factual hallucination remains.

### 3.3 Pressure to answer — helpfulness training amplifies confident-sounding output [Suggestive]

**Intuition:** models trained with RLHF or Constitutional AI are rewarded for being helpful. "I don't know" responses, hedged responses, or refusals tend to score lower in human preference judgments than fluent, confident-sounding answers — even when the hedged answer is more epistemically honest. Training signal that rewards confidence over accuracy nudges the model toward generating confident-sounding completions whether or not they are accurate.

**Evidence:** this mechanism is strongly theorized and consistent with observed model behavior. The most direct evidence comes from the sycophancy literature: Sharma et al. (2023), "Towards Understanding Sycophancy in Language Models," arXiv 2310.13548 (revised May 2025), found that "when a response matches a user's views, it is more likely to be preferred," and that "annotators and preference models sometimes chose convincingly-written sycophantic responses over correct ones." The implication for hallucination: if preference training rewards fluent-sounding helpfulness, and if hallucinated answers are often fluent, training may unintentionally reward some hallucinations.

**Important distinction:** this is a mechanism for *overconfidence*, not for hallucination per se. The model might already have a hallucination tendency from the training distribution, and RLHF amplifies confidence in those wrong answers rather than inserting new wrong answers. The causal chain is suggestive, not proven at the mechanism level.

**What this looks like in practice:** ask Claude a question just outside its reliable knowledge. If it says "I'm not certain, but I believe…" that is the RLHF-friendly hedge that sometimes survives. If it says "The answer is X" with no hedge, that is often the RLHF-optimized response. The latter is not more likely to be correct — it is more likely to have a surface that scored well in preference ratings. Treat confident-sounding phrasing as a style artifact, not a calibration signal.

**Anthropic's own treatment:** Anthropic's Constitutional AI paper (Bai et al. 2022, arXiv 2212.08073) noted calibration concerns in feedback models and used probability clamping during RLHF to avoid overconfident labels. This documents Anthropic's awareness of overconfidence as an RLHF failure mode. [https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback] The Constitutional AI approach specifically attempted to reduce the evasiveness-overconfidence tension by training the model to be helpful without sacrificing accuracy — but the paper documents this as a design goal, not an achieved solution. Overconfidence in instruction-tuned models remains a known open problem across the industry.

### 3.4 Sycophancy — the model adopts user-supplied false premises [Well-supported]

**Intuition:** if you tell Claude that the Battle of Hastings was in 1067 before asking your question, there is meaningful probability that Claude accepts that frame and answers accordingly — even though the correct date is 1066. This is sycophancy: the model adjusts its outputs to match what the user seems to believe, trading accuracy for social agreeableness.

**Evidence:** Sharma et al. (2023) tested this directly across five leading AI assistants. All exhibited sycophantic behavior consistently. The mechanism: RLHF human raters systematically prefer responses that agree with their stated views, so models trained on preference data learn that agreement is rewarded. [arXiv 2310.13548, https://arxiv.org/abs/2310.13548]

**Practical implication:** when you suspect you've been told something false, a neutral re-ask is not sufficient. The model may remember your initial framing from context and still defer to it. Asking from a blank context (new conversation) is more reliable, as is providing the correct premise explicitly: "I've heard X but I want to verify — what is actually true about Y?"

**Evidence confidence:** well-supported. The behavioral phenomenon is robustly replicated. The internal mechanism (exactly which training gradient produces it) is suggestive.

### 3.5 Long-context degradation — information present but ignored [Well-supported]

**Intuition:** a model can have the correct answer sitting in its context and still produce a wrong answer because it fails to attend to the relevant part of a long input.

**Evidence:** Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts," Transactions of the Association for Computational Linguistics (arXiv 2307.03172), showed a U-shaped accuracy curve: performance is best when relevant information is at the start or end of the context, and drops meaningfully when it's in the middle. On some tasks and models, mid-position accuracy dropped from ~85% to ~55% compared to beginning/end positions. The pattern has been replicated qualitatively across multiple subsequent evaluations. [https://arxiv.org/abs/2307.03172]

**Important hedges:** the original study used models that are now multiple generations old. Newer models may have partially mitigated the U-shape. Anthropic has not published a Claude-specific long-context recall curve at this level of granularity (as of 2026-05-17). Do not apply the specific numbers to current Claude models; apply the directional finding and the mitigation strategy ("if you need the model to use a specific fact, put it near the beginning or end of the context, not buried in the middle").

**Two distinct sub-mechanisms** (both suggestive rather than confirmed at the mechanistic level):
- **Attention dilution:** in very long contexts, the attention weight each token receives from any given later token is distributed across more tokens, potentially reducing the effective signal from distant but relevant text.
- **Training bias:** models trained predominantly on short-to-medium length documents may have learned implicit heuristics that favor recency or primacy, not because of architectural necessity but because of training distribution.

**Connection to hallucination:** this produces a specific type of factual hallucination — the model has access to the truth but uses training-data priors instead. This is particularly pernicious because the user may have provided a correct source that the model ignores. The correct answer was there; the model just didn't attend to it. See also `/docs/research/long-context.md`.

### 3.6 Tokenization artifacts — numbers, dates, and rare words [Suggestive]

**Intuition:** language models don't operate on characters or words — they operate on subword tokens. Numbers, dates, and rare words are often tokenized in ways that fragment their structure. "2024" might be one token; "2025" might be two. A model that processes arithmetic through tokenized representations is doing something fundamentally different from carrying digits. Rare words may be broken into subword fragments that were seen in different contexts during training.

**Evidence:** multiple published analyses document higher hallucination rates on numerical content, dates, and rare proper nouns — categories where tokenization is least regular. Improbable Bigrams research (arXiv 2410.23684, October 2024) demonstrated that bigrams formed from incomplete tokens are significantly more prone to hallucination than bigrams from complete tokens. There is also "glitch token" research (arXiv 2404.09894) showing that tokens with thin training coverage can trigger bizarre model behavior.

**Honest hedge:** while the correlation between tokenization irregularity and error rate is documented, the causal mechanism (whether it's tokenization per se or simply that rare tokens correlate with rare/low-coverage topics) is not cleanly separated in most studies. Tag as suggestive rather than confirmed.

**Practical implication:** be especially skeptical of model outputs involving specific dates, numbers, calculations, and rare proper nouns. These are empirically higher-hallucination categories regardless of mechanism.

### 3.7 Context-training conflict — the model must resolve contradictions [Informed speculation for mechanism; Suggestive for behavioral pattern]

**Intuition:** when the context you provide contradicts the model's training data, the model must resolve the conflict. It may follow the context (correct behavior for a document task), fall back on training (incorrect behavior if the document was the authority), or produce a confused blend. The resolution is not predictable and does not reliably favor either source.

**Example:** you paste a document stating that a particular API was deprecated in 2025. The model's training data (from before the deprecation) associates that API with active, recommended use. The model may generate an answer that uses the deprecated API and adds a disclaimer that it was deprecated, or it may silently ignore the context and answer from training-time knowledge, or it may acknowledge the conflict awkwardly and give an ambiguous answer.

**Evidence:** this is a recognized failure mode in RAG systems (see `/docs/research/rag.md`, §8.3 — "authoritative-sounding wrong answer"). Direct causal evidence at the mechanistic level is limited. The behavioral pattern — models sometimes ignoring provided context in favor of training priors — is widely observed in RAG evaluations but less formally studied in isolation.

**Why this matters for the user:** if you are providing a document specifically to override the model's training-time knowledge (e.g., a document with current pricing, a recent policy change, an updated specification), you should be explicit. "The following document supersedes any prior training knowledge about this topic. Use only the document." This is not a guarantee, but it shifts the model's attention weighting toward the provided context. Without this framing, the model may silently blend contexts.

**Confidence:** informed speculation for the mechanism; suggestive for the behavioral pattern. The recommendation to use explicit "this supersedes training" language is community-observed best practice, not a formally tested technique.

---

## 4. Calibration — does the model know when it doesn't know?

### 4.1 Formal definition

Calibration, in the technical sense, means that when a model says "I'm 80% confident," it should be right 80% of the time. A well-calibrated model's stated confidence level is a reliable signal of its actual accuracy at that confidence level. A poorly calibrated model can be:

- **Overconfident:** states 90% confidence but is right only 60% of the time.
- **Underconfident:** states 50% confidence but is right 80% of the time.

Calibration is typically visualized as a reliability diagram: the x-axis is bucketed stated confidence (0–10%, 10–20%, …, 90–100%); the y-axis is actual accuracy in each bucket. Perfect calibration = diagonal line. Overconfidence = curve falls below the diagonal, especially in the high-confidence buckets (the model says 90% but is right 65% of the time). Underconfidence = curve rises above the diagonal.

The formal definition originates in the Bayesian probability and forecasting literature. A practical reference: Guo et al. (2017), "On Calibration of Modern Neural Networks," ICML — a foundational paper on neural network miscalibration, though predating LLMs directly.

**An important clarification about what "confidence" means in LLMs:** there are two distinct things that might be called model confidence. The first is token-level probability — the model assigns, say, 0.87 probability to the word "Paris" when answering "What is the capital of France?" This is a real number that can be measured if the API exposes logprobs (see §4.4). The second is expressed verbal confidence — the model generates "I'm confident that…" or "The answer is definitely…" as text. These two things are not the same. Token probabilities can be well-calibrated while verbal confidence expressions are not, or vice versa. In practice, calibration research on LLMs measures the first; users interact with the second. The gap between them is one reason why this section is as important as it is.

### 4.2 The pre-training vs. post-training calibration gap

Here is one of the sharper findings in this space: base language models (before instruction-tuning and RLHF) tend to be reasonably well-calibrated, at least on structured tasks. Post-RLHF instruction-tuned models tend to be *overconfident* — they express more confidence than their accuracy warrants.

**Evidence:** Kadavath et al. (2022), Anthropic, "Language Models (Mostly) Know What They Know," arXiv 2207.05221. The paper found that larger models are reasonably well-calibrated on multiple-choice and true/false questions when probed in the right format. This is the "base model calibration" finding. The paper also examined RLHF-tuned variants and found the picture is more complex; instruction tuning and RLHF shift the calibration. More direct evidence comes from the "Taming Overconfidence in LLMs: Reward Calibration in RLHF" paper (arXiv 2410.09724, October 2024), which specifically documented that RLHF training can produce overconfident output distributions and proposed reward calibration approaches.

**The key implication for users:** when an instruction-tuned Claude says "I'm confident that…" or gives a detailed answer without hedging, that expressed confidence is not a reliable signal of accuracy. The model has been trained to be helpful and fluent, and that training is at least partially at odds with accurately representing uncertainty.

**What Kadavath et al. actually showed:** the original paper found that larger Claude-variant models could predict whether they would correctly answer a question — a form of calibration. But "mostly" in the title is doing real work: calibration was task- and format-dependent, and the authors were explicit that this was not a general result. [arXiv 2207.05221, https://arxiv.org/abs/2207.05221]

### 4.3 Expressed confidence is unreliable

When a model says "I'm 90% sure" or "I'm fairly confident," should you believe it? Current evidence says: mostly no, and directionally wrong in the overconfidence direction.

The issue is that expressed confidence is itself generated text — it comes from the same probability distribution as everything else. The model generates "I'm confident" when that phrase is a probable completion of the prompt-so-far, not when its internal uncertainty is actually low. There is no direct coupling between expressed verbal confidence and token-level probability distributions.

**Evidence:** this is well-established empirically. Multiple studies on instruction-tuned LLMs have documented that verbal confidence expressions do not reliably track accuracy. The "Dunning-Kruger Effect in Large Language Models" paper (arXiv 2603.09985) directly tested this, finding miscalibration patterns analogous to the human cognitive bias where low-performing models can express high confidence.

**Note on circulating claims:** there is a view in 2026 that frontier models are "well calibrated" or have solved overconfidence. This is not supported by peer-reviewed primary literature as of this dossier's writing. The correct statement is: *recent models are less badly calibrated than earlier models, and some task-specific formats elicit better calibration.* This is not the same as being well-calibrated in ordinary use.

### 4.4 Logprobs — the calibration signal users can't access

In principle, the cleanest calibration signal would be the model's raw token-level probabilities (logprobs): if the model assigns 0.9 probability to a token, and those tokens are correct 90% of the time, the model is well-calibrated at the token level.

In practice: **Anthropic's Messages API does not expose logprobs as of 2026-05-17.** The API exposes only `temperature` as a sampling parameter. `top_p`, `top_k`, and logprobs are all absent from the public API reference. [Verified: Anthropic Messages API docs, fetched 2026-05-17.] This is consistent with Anthropic's broader design philosophy of exposing fewer, better-understood controls rather than a full parameter surface.

**What other providers expose:** OpenAI's API exposes logprobs as a response parameter, allowing up to 20 top-token log-probabilities per output position. Together AI, OpenRouter, and other inference APIs also expose logprobs. Research using logprobs (including Farquhar et al.'s semantic entropy work) typically uses models accessed through APIs that expose this signal. When you read academic papers about LLM uncertainty estimation, the probability-based methods often assume logprobs access that Anthropic users do not currently have.

**The behavioral proxy:** without logprobs, the closest available signal is response variation across multiple samples. Run the same query N times, vary the phrasing, or use slightly different temperatures, and observe whether the answers cluster tightly (low uncertainty by proxy) or diverge (higher uncertainty). This is less precise than semantic entropy but is accessible without logprobs. The "best-of-N verification" technique Anthropic recommends is a version of this: run the same prompt multiple times and flag inconsistencies.

**Important caveat:** API surfaces change. Verify current logprobs availability before stating definitively that they are unavailable, especially if re-reading this dossier in a future session.

### 4.5 Can the model be prompted to better express uncertainty?

There is meaningful evidence that prompting the model to express uncertainty explicitly — "before answering, state how confident you are and why" — produces somewhat better-calibrated uncertainty expressions than unprompted responses. This is Anthropic's "allow I don't know" technique applied in a more structured way.

**Honest assessment:** this technique produces better output than nothing, but it is still working within the expressed-confidence-as-generated-text limitation from §4.3. The model generates a confidence expression that sounds appropriate given the context; it does not have access to its own token-level probabilities. A model that has been trained to write "I'm about 70% confident" in the right contexts is producing a trained behavior, not a calibration measurement.

**When it helps:** for questions at the model's knowledge boundary — recent events, niche technical details, rare proper nouns — explicit uncertainty prompting can surface hedges that would otherwise be suppressed by the helpfulness-training pressure. For questions in the model's core competency, it tends to produce high confidence regardless of prompting.

**When it doesn't help:** it cannot produce calibrated confidence expressions for things the model is systematically wrong about, because the model doesn't know it is wrong. The failure mode where explicit uncertainty elicitation helps least is exactly the failure mode where you most need it: systematic factual errors on topics the model has learned confidently but incorrectly.

---

## 5. Detection — what a user can actually do

These techniques are ordered from most to least reliable. None is foolproof. Cost-to-benefit ratios vary by task criticality.

### 5.1 Citations and span-level grounding [Most reliable, when applicable]

**What it is:** Anthropic's `citations: enabled` feature on the Messages API forces the model to attach specific text spans from provided documents to each claim. The cited text is verified to exist in the source document. [Anthropic Citations docs, https://platform.claude.com/docs/en/docs/build-with-claude/citations, fetched 2026-05-17.]

**What it catches:** faithfulness hallucinations — cases where the model's claim is not grounded in the provided source. The citation either points to a real span, or the claim gets no citation.

**What it doesn't catch:** factual hallucination outside the provided documents. If a document is wrong and you give it to the model, the citation will be accurate but the underlying fact is still wrong. Also doesn't catch "citation drift" — the model can cite a span that is real but that doesn't quite support the claim the way the model presents it.

**Scalability:** good. API-level feature, minimal extra latency.

**Availability:** all active Claude models except Haiku 3 as of 2026. Compatible with prompt caching. Incompatible with Structured Outputs (`output_config.format`). [Source: citations docs, ibid.]

### 5.2 Constrain to sources, require quotation [Reliable for document tasks]

**What it is:** provide the source document, instruct the model to extract word-for-word quotes before synthesizing, and to retract any claim it cannot quote. This is Anthropic's own recommended technique for long-document tasks. [Anthropic reduce-hallucinations docs, https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations, fetched 2026-05-17.]

**Example system prompt pattern:**
```
Answer based only on the provided document.
First, extract direct quotes relevant to the question.
Then answer using only those quotes.
If you cannot find a supporting quote, say so.
```

**What it catches:** faithfulness hallucinations. Forces the model to commit to a retrievable anchor before synthesizing.

**What it doesn't catch:** the model can still misinterpret a correctly quoted span. It also cannot catch cases where the document itself is wrong.

**Scalability:** medium. Adds prompt tokens and can double response length.

### 5.3 Cross-check: ask the same fact two ways [Moderate reliability]

**What it is:** ask the same factual question in two different formulations, from two different angles, or in two separate conversations. Inconsistency between answers is a signal of hallucination. Consistency is not a guarantee of accuracy (a model that consistently hallucinates will give the same wrong answer twice).

**What it catches:** some hallucinations, especially those that are low-probability enough that different phrasings trigger different completions.

**What it doesn't catch:** systematic hallucinations — things the model is consistently wrong about will produce consistent wrong answers.

**Scalability:** low. Doubles cost and requires human comparison.

**Evidence:** Anthropic's "best-of-N verification" technique is a version of this — run the same prompt multiple times and flag inconsistencies. Semantic entropy (§ 5.5) is the research-grade formalization.

### 5.4 Verifier prompt — separate model call [Moderate reliability, high cost]

**What it is:** generate an answer in one call; in a second call, ask the model (or a different model) to evaluate whether the answer is supported by a given source. Chain-of-Verification (CoVe) formalizes this: the model (1) generates a draft, (2) generates verification questions, (3) answers those questions independently, (4) revises the draft based on those answers.

**Evidence:** Dhuliawala et al. (2023), "Chain-of-Verification Reduces Hallucination in Large Language Models," arXiv 2309.11495, published at ACL Findings 2024. CoVe reduced hallucination rates across list-based Wikidata questions, closed-book QA, and long-form text generation. The key design insight: step (3) answers verification questions *independently*, preventing the initial hallucination from biasing the check. [https://arxiv.org/abs/2309.11495]

**What it catches:** cases where the verifier can identify unsupported or contradictory claims. Works best when there is a reference source to verify against.

**What it doesn't catch:** cases where both the generator and verifier share the same systematic error (the same wrong "fact" impressed during training). A verifier LLM has the same training-distribution gap as the generator.

**Scalability:** low. At least doubles cost; CoVe as described multiplies it further.

### 5.5 Step-by-step output: thinking mode [Helps with multi-step reasoning; does not cure hallucination]

**What it is:** Anthropic's extended thinking (`thinking: enabled`) generates a scratchpad of reasoning tokens before the final answer. The scratchpad can reveal false premises or logical errors that the non-thinking response would have hidden.

**What it helps with:** multi-step reasoning tasks where errors compound — the thinking trace can surface a wrong assumption early in the chain. It is also helpful because thinking steps must be generated in sequence; the model cannot skip reasoning.

**What it does not catch:** thinking tokens are generated by the same autoregressive mechanism as regular tokens. They can confabulate. A thinking trace that confidently works through faulty premises will produce a confident wrong answer. Extended thinking is not a hallucination cure — it is a reasoning aid that reduces error on some multi-step tasks.

**Source:** Anthropic's extended thinking documentation (https://platform.claude.com/docs/en/build-with-claude/extended-thinking, fetched 2026-05-17) makes no claim about hallucination reduction. The quality improvement it documents is specifically about reasoning complexity. See also `/docs/research/extended-thinking.md`.

**Honest summary:** extended thinking is worth enabling for complex, multi-step tasks. It is not a substitute for grounding or verification on factual claims.

### 5.6 Semantic entropy — research-grade, not a product surface [Not practical for most users]

**What it is:** sample N answers to the same question, cluster them by meaning (not by exact wording), compute entropy over meaning-clusters. High entropy (diverse meanings across N responses) signals genuine uncertainty and predicts hallucination. Low entropy (all responses say the same thing) signals confidence — but not necessarily accuracy.

**Evidence:** Farquhar, Kossen, Kuhn, Gal (2024), "Detecting hallucinations in large language models using semantic entropy," Nature 630, 625–630. [https://pubmed.ncbi.nlm.nih.gov/38898292/ — PubMed listing; also https://oatml.cs.ox.ac.uk/blog/2024/06/19/detecting_hallucinations_2024.html — OATML blog summary, fetched 2026-05-17.] The method outperformed naive entropy and other baselines on AUROC for predicting whether a model answer was correct. It works across GPT-4, LLaMA 2, and other models.

**What semantic entropy adds over naive multiple-sampling:** naive sampling (run five times, check if answers agree) has the problem that paraphrases of the same correct answer look like disagreement. "Paris" and "the capital of France is Paris" and "It's Paris" are three different token sequences but the same answer. Counting them as disagreement overstates uncertainty. Semantic entropy solves this by clustering by meaning before computing the entropy. The overhead: an additional LLM call or NLI model inference per pair of responses to determine semantic equivalence.

**Practical requirements:** (a) N samples per query (~5 minimum, more is better), (b) token-level log-probabilities to compute sequence probabilities, (c) a semantic equivalence classifier (another LLM call or NLI model) to cluster meanings. The total overhead is approximately 10× standard inference. The authors note that semantic entropy "won't catch systematically learned incorrect reasoning patterns" — it detects careless confabulation (different draws disagree), not systematic wrong beliefs (all draws agree on the same wrong answer).

**The logprobs problem:** requirement (b) is logprobs. Anthropic's API does not expose logprobs. Semantic entropy in its published form is therefore not directly applicable to Anthropic API users as of 2026. A behavioral approximation (just cluster N responses without probability weighting) is possible but weaker than the published method.

**Conclusion:** semantic entropy is the sharpest published research signal for uncertainty estimation in LLMs. It is not a product surface for Anthropic users. File it under "know it exists; use the behavioral proxy if needed; watch for logprobs availability."

---

## 6. Reduction — what reduces hallucination, in order of leverage

These are listed from highest to lowest expected impact for most use cases. The ordering is based on published evidence and Anthropic's own guidance, not on a single controlled comparison. The right mitigation always depends on which failure mode is most likely for the task — see also §6.7 (task-level calibration).

### 6.1 Retrieval (RAG) — the biggest lever [Well-supported]

Providing the model with the right information in the context window, rather than relying on training recall, is the largest single reducer of factual hallucination in knowledge-intensive tasks. The intuition is simple: a model that has the correct answer in front of it does not need to guess.

**Evidence:** Anthropic's Contextual Retrieval paper (September 2024, https://www.anthropic.com/research/contextual-retrieval) documented failure-rate reductions of 35–67% across retrieval configurations compared to no retrieval. These numbers are for retrieval failure rate (failure to surface the correct chunk), which is upstream of but predictive of hallucination rate. The full benchmark figures are in `/docs/research/rag.md`, §4.4.

**The RAG hallucination tradeoff in detail:**

| Hallucination type | Effect of RAG |
|---|---|
| Training-gap factual error | Reduced — model has a source to draw from |
| Post-cutoff temporal error | Reduced if index is current |
| Faithfulness/citation drift | Introduced or worsened — new failure mode |
| Context-training conflict | Shifted — now between retrieved doc and training |

RAG is not a simple improvement; it is a rebalancing of the hallucination portfolio. Whether it is net positive depends on whether your task is more vulnerable to training-gap errors (where RAG helps) or faithfulness errors (where RAG can hurt).

**Honest limit:** RAG reduces factual hallucination by giving the model something to anchor on. It introduces faithfulness hallucination risk (the model can still misrepresent its retrieved sources). A model that retrieves well but synthesizes faithlessly has traded one failure mode for another. See also rag.md §8.3–8.4.

### 6.2 Tools instead of recall [Well-supported, task-limited]

For tasks involving current information, calculations, or lookups, giving the model a tool (web search, calculator, database query) to retrieve rather than recall eliminates an entire category of hallucination: the model doesn't have to "know" — it checks. A model with a calculator that executes `2^16` will not hallucinate 65,536 as a different number; a model that looks up the current stock price will not confabulate yesterday's price.

**Honest limit:** tool use reduces hallucination for the specific claims that the tool addresses. It does not help with claims the model makes without triggering a tool call, or with how the model synthesizes the tool's output. A model that uses a web search tool can still misquote the search result, hallucinate a synthesis across search results, or fail to trigger a tool call for a claim that warranted one.

### 6.3 Citations API — forces grounded outputs [Well-supported]

For document-grounded tasks, Anthropic's citations feature is the most practical lever: it forces the model to attach verified text spans to its claims. The model cannot produce a citation pointing to a non-existent span. The `cited_text` in the API response is the actual verbatim text from the document — not generated by the model, not counted as output tokens. [Source: citations docs, verified 2026-05-17.]

**Why this is structurally different from prompt-based citations:** a prompt instruction like "cite your sources" asks the model to generate citation text. The model complies by generating plausible-looking citations, which can include real citations misassociated with wrong claims, or fabricated citations that sound plausible. The citations API instead forces the model to locate its claim within the provided documents before generating the response. The citation is extracted from the document, not generated. This is a fundamentally more reliable architecture for faithfulness checking.

**Honest limit:** verified citation ≠ accurate interpretation. The cited text exists; whether the model's claim accurately reflects that text is a separate question. Also limited to document-grounded tasks. The citations feature cannot catch factual errors in the provided documents themselves.

### 6.4 Lower temperature — slight reduction [Suggestive]

At lower temperature, the model is more likely to sample high-probability tokens, which are often more conventional and more likely to reflect well-learned facts. This reduces the stochastic-drift contribution to hallucination.

**Honest limit:** the effect is modest. Factual hallucination persists at T=0. The dominant causes of hallucination are not sampling noise but knowledge gaps and training-distribution effects, neither of which temperature addresses. T=0 is better than T=1 for factual precision tasks, but the improvement is not dramatic and should not substitute for grounding strategies.

**Evidence:** this is broadly consistent with the sampling literature and Anthropic's own guidance (use lower temperature for analytical tasks), but there is no published study isolating temperature as a hallucination variable while controlling for everything else. Tag as suggestive.

### 6.5 Verifier loops — effective, expensive [Suggestive for real-world gains]

CoVe-style verification (generate → verify → revise) reduces hallucination on tasks where the model can effectively self-check. The improvement is real in the published literature (Dhuliawala et al. 2023). The cost is at least 2× and often more. Practical for high-stakes outputs (a legal brief, a medical summary, critical code); impractical for casual queries.

**Important caveat:** the verifier and generator share training data. Systematic errors — things the model is consistently wrong about — will fool both the generator and the verifier. Verifier loops catch careless confabulation better than they catch deeply embedded wrong beliefs.

### 6.6 System-prompt anti-hallucination instructions — modest help, with risks [Suggestive]

Instructions like "Only say things you are confident about. Say 'I don't know' if you are unsure" are recommended by Anthropic's own documentation as a basic technique. [Reduce-hallucinations docs, ibid.]

**What the evidence shows:** Anthropic's own guidance emphasizes a permissive framing — "you are allowed to say I don't know" — rather than a prohibitive one — "never generate anything you aren't certain about." The permissive framing has more behavioral support. The model appears to hedge more when given explicit permission to do so, which is consistent with the RLHF-overconfidence hypothesis: the model was trained to avoid hedging because hedging scored poorly in preference ratings, so granting explicit permission to hedge partially reverses that pressure.

**Honest limit:** the improvement is real but modest. The model has been trained on the very documents these instructions appear in; they nudge behavior without fundamentally changing the underlying knowledge-or-confidence calibration. There is also a documented failure mode: overly strong "don't hallucinate" instructions can produce excessive hedging — the model says "I don't know" on questions it could answer accurately. The right phrasing is permissive ("it's okay to say I don't know") rather than prohibitive ("never say anything you're not certain about").

**On circulating claims:** in 2026, various "magic system prompts" are circulating online claiming to "cut Claude's hallucinations dramatically." These are typically a combination of known techniques (allow uncertainty, require quotes) that do have some supporting evidence, plus rhetorical framing that overstates effect size. The evidence base for specific prompt formulations is anecdotal, not peer-reviewed. Use them as good practice, not as guaranteed fixes.

### 6.7 A note on task-level calibration of mitigation choices

No single technique dominates across all tasks. The right choice depends on:

| Task type | Highest-leverage mitigation | Why |
|---|---|---|
| Document Q&A | Citations API + direct quotation | Faithfulness failure is the dominant risk |
| Knowledge recall (no documents) | RAG — add the documents | Training-gap failure is the dominant risk |
| Multi-step reasoning | Extended thinking | Reasoning-chain errors, not factual gaps |
| Numerical / calculation | Tools (calculator, code execution) | Tokenization and distribution gaps make raw LLM arithmetic unreliable |
| Current-events queries | Tools (web search) | Training cutoff makes model recall wrong by definition |
| High-stakes output (legal, medical) | Verifier loop + human review | Multiple mechanisms all active; no single mitigation sufficient |

This table reflects a general ordering based on failure-mode matching, not a controlled experiment. Treat it as a starting framework, not a fixed recipe.

---

## 7. Hallucination amplification in agents and long contexts

### 7.1 Agent loops — error inheritance across steps

In a multi-step agent loop, each step's output becomes the next step's input. A confabulation at step 2 — a wrong intermediate result, a hallucinated API field name, a fabricated file path — becomes a false premise for step 3. By step 5, the agent may be confidently executing a coherent plan built on a foundation that was wrong two steps ago.

This is qualitatively different from single-turn hallucination: the error does not just affect one output, it propagates. And because agents often take actions (write files, send requests, call APIs), a hallucinated fact in an agentic context can have real-world consequences that are harder to reverse than a wrong sentence in a chat response.

There is an additional compounding effect: the model's own prior outputs in the context window become authoritative-looking sources. If the model stated a wrong fact at step 2 and that statement is now part of the conversation history, step 5 may treat it as established truth — citing its own prior confabulation as justification for the current step.

**Evidence:** this is not a single paper finding; it is an architectural inevitability of how agent loops work. It is documented as a known risk in agentic AI system design and is the reason why "human-in-the-loop" checkpoints are recommended for high-stakes agentic workflows. See also `/docs/research/agents-and-agent-loops.md`.

**Practical mitigation pattern:** for multi-step agents, do not allow the agent to use prior model outputs as the sole source of a factual claim. Each step that requires a factual anchor should be grounded by a tool call or a retrieved document, not by the agent's own prior text. Think of each agent step as a fresh single-turn interaction that needs its own grounding.

**Confidence tag:** this section is a well-supported architectural argument. The specific claim about agents hallucinating at a higher absolute rate than single-turn interactions in controlled experiments would require a direct comparative study; no such study is cited here.

### 7.2 Long contexts — planted false premises

A specific and underappreciated hallucination risk in long contexts: if your context contains a false premise early on — from an earlier turn, a retrieved document, or your own incorrect statement — the model can treat it as established fact for the rest of the context. This is the sycophancy mechanism at scale: the model has learned that what's already in the context is true.

**Evidence:** this follows directly from the attention mechanism (later tokens attend to earlier tokens) and from sycophancy research. It is also a documented RAG failure mode: a stale retrieved document introduces a false fact that contaminates downstream reasoning. See `/docs/research/long-context.md` for the long-context degradation research.

### 7.3 Streaming UX — cognitive commitment to early tokens

This is a softer but practically real effect: when the model streams a response, users begin reading immediately. Confident early sentences cognitively anchor the user before the rest of the response arrives. If the early tokens contain a hallucination, users have already begun constructing their understanding around it. When the model later hedges or contradicts itself, users may discount the hedge rather than revising the initial confident claim.

There is also a product-level asymmetry: streaming increases perceived responsiveness (users prefer it) while simultaneously reducing the probability of detecting an early hallucination. A system that streams a confident wrong claim and then hedges ten sentences later is worse for the user's epistemic state than a system that outputs the same content all at once, because the reader has been anchored.

**Evidence:** this is an informed-speculation argument from cognitive science (anchoring bias, primacy effects) rather than a published LLM-specific study. Flag as such. The anchoring effect in human judgment is well-established (Tversky and Kahneman, 1974, "Judgment under Uncertainty: Heuristics and Biases," Science 185), but its specific magnitude in the context of AI-generated streamed text has not been directly studied.

**Practical implication:** for high-stakes claims, reading the full response before acting is more reliable than acting on early streamed content. This is a minor process habit but worth naming because the streaming UX creates a specific user-behavior failure mode.

### 7.4 Parallel multi-agent architectures — independent confabulations compound

A subtler amplification scenario arises in parallel multi-agent setups: multiple model calls run simultaneously to work on different parts of a problem, and their outputs are synthesized into a final result. If each agent independently confabulates on an overlapping factual claim, the synthesizer may treat their agreement as mutual confirmation — but mutual agreement among agents that share the same training distribution is not independent evidence of accuracy.

This is the same statistical failure as relying on two students who copied off the same answer sheet to validate each other's answers. Agreement within a same-training-distribution system is not calibration; it is correlated noise.

**Evidence:** informed speculation, with well-supported roots in the literature on correlated errors in ensemble models. Not directly studied in the context of LLM multi-agent systems. The architectural argument is sound; the specific magnitude of the effect awaits empirical study.

**Practical implication:** when synthesizing outputs from multiple parallel LLM calls, treat shared factual claims as stronger signals only if each agent had access to *different* grounding sources. Agreement from independent grounding is evidence; agreement from shared training is correlation.

---

## 8. Common misconceptions

### "Bigger model = no hallucinations"

No. The hallucination rate does tend to decrease with scale, but it does not reach zero. Larger models can be more confidently wrong: their fluency is higher, their hallucinations are more coherent, and they are harder to catch because the output sounds more authoritative. A small model that says "I'm not sure" is easier to identify as uncertain than a large model that confidently fabricates a plausible citation. Dario Amodei noted at a 2025 developer event that on some factual tasks frontier models may already hallucinate less than humans — this is a claim about *some* tasks at high confidence levels, not a general claim about elimination.

### "Temperature=0 eliminates hallucinations"

No. As documented in `/docs/research/sampling.md` and confirmed by Anthropic's own API documentation ("Note that even with temperature of 0.0, the results will not be fully deterministic"), T=0 approaches greedy decoding but does not achieve true determinism due to GPU floating-point non-determinism and batched inference effects. More importantly, greedy decoding uses the same distribution, just at the argmax — and the argmax of a distribution that assigns highest probability to a wrong answer is still that wrong answer. T=0 improves precision on tasks where the model's top-probability answer is the correct one; it does not fix cases where the model's training leads it to a confident wrong belief.

### "RAG fixes hallucinations"

No. RAG reduces open-domain factual hallucination by grounding responses in retrieved text. It introduces faithfulness hallucination risk (citation drift, misrepresentation of retrieved content). A RAG system that retrieves the wrong document, retrieves the right document but misquotes it, or cites a real passage that doesn't support the claim has simply traded one failure mode for another. See `/docs/research/rag.md`.

### "Thinking mode = no hallucinations"

No. Extended thinking generates reasoning tokens through the same autoregressive mechanism as regular tokens. Thinking tokens can confabulate. A thinking trace that confidently reasons through a false intermediate conclusion will produce a confident wrong final answer. Thinking mode helps with *reasoning errors* on multi-step tasks; it does not inject external factual knowledge.

### "If the model expresses high confidence, it's calibrated"

No. Expressed verbal confidence is itself generated text. The model generates "I'm confident" because that phrase is a probable completion of the context, not because its internal uncertainty is low. Post-RLHF instruction-tuned models tend to be overconfident — Kadavath et al. (2022) found base models are reasonably calibrated on structured tasks, but the picture degrades after instruction tuning. Verbal confidence expressions are especially unreliable signals.

### "Citations prove correctness"

No. Anthropic's citations feature guarantees that the cited text exists in the source document and that the character indices are valid. It does not guarantee that the cited text actually supports the claim the model makes about it. Citation drift — associating a real citation with an interpretation it doesn't support — is documented as a RAG failure mode and occurs even with the API citations feature. A citation proves source; it does not prove interpretation.

### "Adding 'don't hallucinate' to the system prompt works"

Mostly, this is cargo-cult prompting. The instruction can nudge behavior marginally toward expressing uncertainty. It does not change the underlying knowledge distribution or calibration. It can backfire, producing excessive hedging on questions the model would have answered correctly. Anthropic's own guidance frames this as "allow Claude to say I don't know" (a permissive framing) rather than "prohibit hallucination" (a prohibitive framing). The permissive version has more evidence behind it.

### "The model is especially reliable about things it 'knows well'"

Partially true, but the boundary is harder to locate than users expect. The model may have strong pattern associations for a topic without having accurate specific facts about it. A model can write fluently about a scientific field while getting specific experimental results wrong, because fluent scientific prose is well-represented in training data even when the underlying facts are not. High fluency in a domain is a weak signal of factual accuracy within that domain.

### "Asking the model to explain its reasoning proves the answer is correct"

No. Chain-of-thought reasoning can be post-hoc confabulation. A model can generate a confident-sounding reasoning trace that leads to a wrong answer, or generate a reasoning trace that happens to be internally consistent but rests on a false first premise. Reasoning traces make errors more visible — which is useful — but they do not certify correctness. A plausible-looking reasoning chain is not a proof.

This is especially relevant for extended thinking: the thinking trace shows the model's scratchpad, but the scratchpad itself is generated text subject to the same hallucination mechanisms as the final response.

---

## 9. House-style chapter ideas

### Diagram option A — Calibration plot (primary recommendation)

**What it shows:** a conceptual "reliability diagram" — the standard tool for visualizing calibration. The x-axis is the model's stated confidence level (bucketed into 10 ranges: 0–10%, 10–20%, … 90–100%). The y-axis is actual accuracy at that confidence level. A perfectly calibrated model lies on the diagonal. An overconfident model's curve falls below the diagonal (states 80% confidence but is right 60% of the time).

**How to set up the interaction:** show a static calibration curve (no live inference). A slider labeled "stated confidence" highlights one bucket; a text callout says "At 90% stated confidence, this model is actually right 63% of the time." The gap is visually stark.

**Data:** the diagram would be hand-authored for illustration, labeled clearly as "illustrative — not real model output." The shape should reflect the overconfidence finding: the curve should fall below the diagonal in the high-confidence bins, with the gap widening at the top. The mid-confidence buckets (40–70%) may be reasonably well-calibrated; the overconfidence effect is strongest at the extremes.

If Anthropic has published a calibration plot for any Claude variant (the Kadavath et al. 2022 paper includes calibration plots for Claude-variant models on structured tasks), that published shape should be referenced rather than invented. The chapter author should check whether those curves are representative of current-generation Claude before using them.

**Component name:** `CalibrationPlot.tsx`
**Data file:** `src/data/hallucination.ts`
**Takeaway:** the model says 90% confident. The bar shows it's right 63% of the time at that stated confidence level. Calibration is something you impose from outside.

### Diagram option B — Failure-mode flowchart

**What it shows:** a decision-tree style diagram that traces a user query through possible failure modes:

```
Query arrives →
  Is the answer in training data? (Yes/No/Partially)
    → Is context provided? (Yes/No)
      → Does context cover the answer? (Yes/No)
        → [outcome: grounded / confabulated / hybrid]
  → Is the answer rare/recent/numeric? (higher risk)
  → Does context contradict training? (conflict risk)
```

Each leaf node includes: the failure mode name, the typical symptom, and the recommended mitigation. The diagram makes the chapter's core message structural: different failure modes call for different mitigations, and knowing which you're facing is the first debugging step.

**Implementation note:** use HTML/CSS for the tree structure, consistent with GOAL.md's "no Mermaid" constraint. A simple nested flexbox layout with color-coded leaf nodes (amber for high risk, grey for resolved) works well and avoids SVG complexity for a tree layout.

**Component name:** `HallucinationFlowchart.tsx` (or pure HTML/CSS)
**Takeaway:** different queries fail for different reasons. Knowing where on the flowchart your query lives tells you which mitigation to use.

### Demo option A — Inconsistency detector (primary recommendation)

**What it shows:** the same factual question phrased five different ways, with five hand-authored responses. Some responses agree on the core fact; one or two disagree on a specific detail (a year, a name, a statistic). A toggle highlights the discrepancy. The demo does not run live inference — it uses hand-authored data that is already inconsistent.

**Why this works pedagogically:** makes the "ask twice" technique concrete. Inconsistency is visible and immediate. Shows that even when answers sound confident, they can disagree with themselves on the same question within seconds of each other. No ML background needed to understand why that's a problem.

**Design note:** the five phrasings should all sound like natural user queries, not like a constructed experiment. "What year did X happen?" / "When was X?" / "I'm trying to date X — when was it?" / "Tell me about X and when it started" / "X — year?" These produce different responses because the phrasing shifts context and completion probability.

**Component name:** `ConsistencyDemo.tsx`
**Data file:** `src/data/hallucination.ts`
**Takeaway:** consistency across phrasings is a necessary but not sufficient condition for accuracy. Inconsistency is a red flag. Consistency is not a green light.

### Demo option B — Verifier loop (depth option)

**What it shows:** a two-panel interaction. Left panel: a model answer with a specific factual claim, clearly labeled as "illustrative model output." Right panel: a provided source document (also hand-authored). A "Verify" button reveals whether the cited passage actually supports the claim as stated. In the illustrative data, the citation is real but the model's interpretation overstretches what the passage says.

**Data:** hand-authored — a realistic-sounding but fabricated claim, a real-looking source that doesn't quite say what the model claims. The demo is illustrative, not live inference. The goal is to show that a citation can be genuine while the model's use of it is still unfaithful.

**Component name:** `VerifierDemo.tsx`
**Data file:** `src/data/hallucination.ts`
**Takeaway:** verification is not the model checking itself; it's a separate pass with a reference. The separation is what makes it useful. But even a "cited" claim requires human judgment about whether the cited text supports the interpretation.

---

## 10. Hand-authored data plan

**File:** `src/data/hallucination.ts`

Keep the data file under 180 lines. Verbosity in the example strings is more important than coverage — a single concrete example the reader can read and recognize beats five abstract templates.

### Factual hallucination examples

A set of 5 factual question-answer pairs. Required fields per item:

```typescript
type FactualExample = {
  id: string;
  question: string;
  groundTruth: string;        // the correct answer, with a real-world source note
  hallucination: string;      // hand-authored plausible wrong answer
  hallucinationType: "factual" | "faithfulness";
  riskFactor: string;         // e.g. "rare proper noun", "training cutoff", "numeric"
  illustrativeConfidence: number; // e.g. 0.9 — what the model might express
};
```

**Suggested question set:**
1. A biographical date question about a moderately well-known historical figure (tests training-coverage gap).
2. A question about a numerical statistic from a field report (tests numeric hallucination and rare token risk).
3. A question about an event slightly after the training cutoff (tests temporal boundary hallucination).
4. A question phrased five ways (for the consistency demo — share the same `id` base, vary the phrasing).
5. A question about a technical API or product feature that changed post-training (tests version/specificity risk).

Avoid questions about living public figures or politically sensitive topics. Use topics from science, history, or technology where ground truth is unambiguous.

### Faithfulness hallucination examples

A set of 3 scenarios where:
- A source document is provided (hand-authored, 3–5 sentences, plausible-looking)
- A query is asked
- A model answer is given that cites the source but misrepresents it
- The exact source text is included to make the mismatch visible

```typescript
type FaithfulnessExample = {
  id: string;
  sourceText: string;          // the provided document (hand-authored)
  query: string;
  modelAnswer: string;         // the unfaithful answer
  faithfulAnswer: string;      // what a faithful answer would say
  mismatchDescription: string; // one sentence describing the drift
};
```

The mismatch should be subtle — not "the model contradicted the source" but "the model overstated a hedged claim" or "the model attributed to the source a synthesis the source doesn't make." These are the real failure modes.

### Consistency comparison set

Five phrasings of the same question, with hand-authored responses that are inconsistent on one specific fact. The inconsistency should be on a detail (a year, a percentage, a name) not on the main thrust of the answer — making it non-obvious to a casual reader.

```typescript
type ConsistencySet = {
  phrasings: string[];         // 5 phrasings of the same question
  responses: string[];         // 5 hand-authored responses, some inconsistent
  inconsistentDetail: string;  // what fact disagrees across responses
  consistentFact: string;      // what fact all responses agree on (the "safe" part)
};
```

### Calibration data (for diagram A)

Ten confidence buckets (0–10%, 10–20%, …, 90–100%). Hand-authored accuracy values in each bucket that reflect the overconfidence pattern:

```typescript
type CalibrationBucket = {
  statedConfidenceMin: number; // e.g. 0.8
  statedConfidenceMax: number; // e.g. 0.9
  actualAccuracy: number;      // e.g. 0.67 — illustrative, reflecting overconfidence
};
```

Shape guidance: accuracy in the 90–100% bucket should be ~60–70% (illustrating clear overconfidence at the top). Accuracy in the 40–60% bucket should be close to stated confidence (models are better calibrated in the uncertain range). Accuracy in the 0–20% bucket may be reasonably close (rare to express very low confidence; when the model hedges strongly, it's often right to do so).

All values clearly labeled in the data file as `// illustrative — not real model output`.

---

## 11. Connections to existing chapters

### Ch 2 — Embeddings (`/src/pages/02-embeddings.mdx`)

The embedding chapter establishes that embeddings are not understanding — "same token → same vector" at the embedding layer, but after layer 1, representation is context-dependent. This is the foundational intuition behind why models can produce fluent output without accurate recall: fluency comes from pattern-matching over embeddings, not from a lookup table of true facts. A model that has learned the statistical associations of "the capital of Australia is" with "Canberra" has not stored a fact — it has stored a pattern. When the pattern fails (the association wasn't reinforced in training, or a competing pattern is stronger), hallucination follows.

**Specific line-level hook for the chapter author:** Ch 2's `CacheCallout` mentions: "same token ID → same embedding-layer vector, always." This is true at the embedding layer — but it's the opposite of what happens at the factual-recall level. The model's "memory" of a fact is not a fixed lookup: it is a distributed pattern across attention weights and residual stream transformations. Hallucination happens when those distributed patterns produce a plausible-but-wrong output. This chapter's §3.1 (training-distribution gap) and §3.2 (stochastic drift) give two different framings of why.

### Ch 5 — Generation (`/src/pages/05-generation.mdx`)

The generation chapter establishes that the model generates one token at a time from a probability distribution. This is the mechanical foundation of the "stochastic drift" hallucination mechanism: each token is a sample, and a slightly off-probability sample early in a sentence can commit the model to a wrong path. The probability distribution over "the next token" is not "is this factually accurate" — it is "what token typically follows this sequence."

**Specific hook:** Ch 5's core diagram shows the autoregressive decode loop — each decode step appends one token and re-reads the entire sequence. This chapter should use that diagram as a visual shorthand for why each token is a commitment: once "1067" is generated as the year of the Battle of Hastings, the model's next token is conditioned on that output. Generating "…wait, the correct year is 1066" would require a sequence that is extremely improbable relative to continuing the wrong-but-fluent answer.

### `/docs/research/rag.md`

RAG is the primary mitigation strategy for factual hallucination. The RAG dossier covers retrieval mechanics, failure modes (§8), and citation grounding (§7). This chapter should cross-reference the RAG dossier for readers who want to implement the highest-leverage mitigation.

**Connection points:**
- rag.md §8.3 (authoritative-sounding wrong answer) is the RAG-specific instance of §3.7 in this dossier (context-training conflict).
- rag.md §8.4 (citation drift) is the RAG-specific instance of faithfulness hallucination (§2.2 here).
- rag.md §9 ("RAG fixes hallucinations") is the same misconception addressed in §8 here.
- rag.md §7 (citations feature) provides the implementation detail for this chapter's §5.1 (citations detection).

### `/docs/research/sampling.md`

The sampling dossier covers temperature, determinism at T=0, and the non-determinism at T=0 finding from Anthropic's own docs. This chapter's §3.2 (stochastic generation) and §8 (T=0 misconception) connect directly.

**Specific hook:** sampling.md §5 documents that "even with temperature of 0.0, the results will not be fully deterministic" (sourced from Anthropic's API docs). This dossier references the same documented fact in §8 ("T=0 eliminates hallucinations"). The author should use the same citation rather than creating a parallel citation path.

### `/docs/research/extended-thinking.md`

The extended thinking dossier establishes that thinking tokens are generated by the same mechanism as regular tokens — they are autoregressive decode steps, not a separate reasoning engine. This chapter's §5.5 (thinking mode as detection) and §8 (thinking mode misconception) build on that finding.

**Key fact to carry over:** extended-thinking.md §2.1 states the key caveat: "whatever computation the model does happens in the tokens you can observe. Before extended thinking existed, that computation had to happen implicitly, compressed into the attention heads at each layer. With extended thinking on, the model is explicitly allocated token budget to write out intermediate steps before producing the final answer." This framing — thinking tokens are visible computation, not a separate magical reasoning module — is the correct framing for this chapter's treatment of thinking-mode limitations.

### `/docs/research/long-context.md`

The long-context dossier covers the "Lost in the Middle" effect (Liu et al. 2023) and attention degradation. This chapter's §3.5 (long-context degradation mechanism) and §7.2 (planted false premises) connect directly.

**Shared citation:** long-context.md §3.1 and this dossier §3.5 both cite Liu et al. 2023 (arXiv 2307.03172). The chapter author should ensure the two chapters' treatments are consistent and cross-linked — readers who encounter one chapter first will want to follow the link to the other.

### Ch 1 — Tokens (`/src/pages/01-tokens.mdx`)

The tokens chapter establishes that the model operates on subword tokens, not characters or words. This directly supports §3.6 of this chapter (tokenization artifacts): rare words, numbers, and dates are tokenized inconsistently, which is one reason the model's "knowledge" of specific dates and numbers is less reliable than its knowledge of common words. A reader who has seen the tokenization demo in Ch 1 will immediately understand why "2,024" might tokenize differently than "2024" and why that matters for factual precision.

---

## 12. Closing-takeaway angle

The model is always confident. Fluency is not accuracy. Calibration — the alignment between expressed confidence and actual accuracy — is something you must impose from outside, because the training process that made the model helpful also made it slightly overconfident.

The practical stance that holds: **treat fluent output as a hypothesis, not a fact.** For low-stakes tasks (brainstorming, drafting, explaining concepts), hallucinations are a minor nuisance. For high-stakes tasks (citations, legal claims, medical information, code that will run in production), every factual claim is a hypothesis that needs verification. The tools you have — citations, constrained quoting, cross-checking, verifier prompts — are real and useful. None of them is a substitute for knowing your domain well enough to recognize when the hypothesis is wrong.

The other durable insight: the failure modes are predictable. Numbers, dates, and rare proper nouns are higher risk. Long contexts degrade in the middle. Agents inherit errors across steps. Sycophancy activates when you suggest a false premise. Knowing these patterns does not prevent hallucination, but it tells you where to aim verification effort.

**Proposed CacheCallout text for this chapter** (following the site's convention from GOAL.md):

> Every Claude Code turn re-reads the conversation history in full. If an earlier turn introduced a hallucinated fact — a wrong file path, an invented API parameter, a misremembered constraint — that false fact is now in the cached prefix. The prompt cache faithfully reuses everything you've accumulated, errors included. Hallucinations compound in long sessions: what the model said two turns ago is now part of the authoritative context for this turn. This is the intersection of caching and confabulation: the cache is not a memory of what is true; it is a memory of what was generated. The mitigation is the same: ground every factual claim in a tool result or a retrieved file, not in a prior model output.

**The chapter's one-sentence takeaway:** The model does not know when it is wrong, and it has been trained to sound like it does — so calibration, grounding, and verification are always your job, not the model's.

**A framing note for the chapter author:** this topic has more bad advice circulating in 2026 than almost any other AI topic. System prompt "fixes," model upgrade claims, and overstatements of thinking-mode benefits are all common. The chapter's credibility depends on resisting the temptation to promise solutions and maintaining the intellectual honesty of the research literature — which consistently says "reduces, does not eliminate." That honesty is more useful to the reader than false comfort.

---

## 13. Up-to-date facts (citations + dates)

### Anthropic Messages API — sampling and logprobs (verified 2026-05-17)

- **`temperature`**: supported. Default 1.0. Range 0.0–1.0.
- **`top_p`**: not exposed in the public API reference.
- **`top_k`**: not exposed in the public API reference.
- **`logprobs`**: not exposed in the public API reference as of 2026-05-17. API responses show `"logprobs": null`.
- **Determinism caveat**: Anthropic's own documentation states: "Note that even with temperature of 0.0, the results will not be fully deterministic."
- **Source**: Anthropic Messages API docs, https://platform.claude.com/docs/en/api/messages, fetched 2026-05-17.

### Anthropic citations feature (verified 2026-05-17)

- Available on all active Claude models except Haiku 3.
- Three document types: plain text (sentence-chunked, character-index citations), PDF (sentence-chunked, page-number citations), custom content (block-index citations).
- `cited_text` field: provided in response, does not count toward output tokens; also not counted when passed back in subsequent turns.
- Compatible with prompt caching (apply `cache_control` to document content blocks).
- **Incompatible** with Structured Outputs (`output_config.format`).
- **Source**: https://platform.claude.com/docs/en/docs/build-with-claude/citations, fetched 2026-05-17.

### Anthropic reduce-hallucinations guidance (verified 2026-05-17)

Current guidance includes: allow "I don't know," extract direct quotes for long documents, verify with citations, chain-of-thought verification, best-of-N verification, iterative refinement, external knowledge restriction.
- **Source**: https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations, fetched 2026-05-17.
- Note appended by Anthropic: "while these techniques significantly reduce hallucinations, they don't eliminate them entirely."

### Hallucination taxonomy

- Factuality vs. faithfulness taxonomy: Huang et al. (2023), "A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions," ACM Transactions on Information Systems. [https://arxiv.org/abs/2311.05232 — submitted November 2023, revised November 2024.]
- Intrinsic vs. extrinsic taxonomy: Ji et al. (2023), "Survey of Hallucination in Natural Language Generation," ACM Computing Surveys. [https://dl.acm.org/doi/10.1145/3571730]

### Calibration and RLHF overconfidence

- Kadavath et al. (2022), Anthropic, "Language Models (Mostly) Know What They Know," arXiv 2207.05221. [https://arxiv.org/abs/2207.05221] — Base models are reasonably calibrated on structured tasks in the right format; larger models better calibrated.
- "Taming Overconfidence in LLMs: Reward Calibration in RLHF," arXiv 2410.09724 (October 2024). [https://arxiv.org/abs/2410.09724] — Documents that RLHF training can produce overconfident output distributions.
- Anthropic Constitutional AI paper (Bai et al. 2022), arXiv 2212.08073. Noted calibration concerns in RLHF feedback models; used probability clamping. [https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback]

### Sycophancy research

- Sharma et al. (2023), "Towards Understanding Sycophancy in Language Models," arXiv 2310.13548, revised May 2025. Five SOTA AI assistants showed consistent sycophantic behavior. "Sycophancy is a general behavior of state-of-the-art AI assistants, likely driven in part by human preference judgments favoring sycophantic responses." [https://arxiv.org/abs/2310.13548]

### Chain-of-Verification (CoVe)

- Dhuliawala et al. (2023), "Chain-of-Verification Reduces Hallucination in Large Language Models," arXiv 2309.11495, published ACL Findings 2024. Four-step method: draft → verification questions → independent answers → revised response. Reduced hallucination on Wikidata list questions, closed-book QA, and long-form text generation. [https://arxiv.org/abs/2309.11495]

### Semantic entropy

- Farquhar, Kossen, Kuhn, Gal (2024), "Detecting hallucinations in large language models using semantic entropy," Nature 630, 625–630. [https://pubmed.ncbi.nlm.nih.gov/38898292/] Semantic entropy measures uncertainty in meaning-space rather than token-space. Requires ~5 samples per query, token log-probabilities, and a semantic equivalence classifier. Approximately 10× inference overhead. Outperforms naive entropy on AUROC for hallucination detection across multiple model families. Anthropic API does not expose logprobs, so direct application is not possible without a logprobs-exposing provider.

### Long-context degradation ("Lost in the Middle")

- Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts," Transactions of the Association for Computational Linguistics. [https://arxiv.org/abs/2307.03172] U-shaped accuracy curve: best at position extremes, degraded in the middle. Accuracy drops from ~85% to ~55% at mid-position on some models/tasks. Tested on models now 2+ generations old; directional finding expected to hold, but magnitude may differ for current models. Anthropic has not published a Claude-specific recall curve at this granularity.

### Tokenization and hallucination

- "Improbable Bigrams Expose Vulnerabilities of Incomplete Tokens in Byte-Level Tokenizers," arXiv 2410.23684 (October 2024). Bigrams from incomplete tokens are significantly more prone to hallucination. [https://arxiv.org/html/2410.23684]
- "Glitch Tokens in Large Language Models," arXiv 2404.09894. Tokens with thin training coverage produce hallucination and other anomalous behaviors.

### Anthropic Contextual Retrieval (RAG reduction numbers)

- Published September 2024. [https://www.anthropic.com/research/contextual-retrieval]
- Failure rate baseline (embeddings only): 5.7%. With contextual embeddings: 3.7% (−35%). With contextual embeddings + BM25: 2.9% (−49%). With above + reranking: 1.9% (−67%).
- Detailed in `/docs/research/rag.md`, §4.4.

---

## 14. Open questions

1. **Calibration post-RLHF — where is the best primary evidence?** The Kadavath et al. (2022) paper is the most-cited Anthropic calibration paper, but it predates current Claude models by three or more generations. A more current Anthropic-published calibration evaluation for Claude 3.x or Claude 4.x would be the ideal citation. None was found in this research pass. The "Taming Overconfidence" paper (2410.09724) provides general RLHF evidence but is not Anthropic-specific. This is a genuine gap in the citation chain for §4.2.

2. **Does semantic entropy work without logprobs?** The published method requires log-probabilities. A behavioral approximation (cluster N responses without probability weighting, use entropy over the cluster distribution) is theoretically possible but has not been evaluated at the same rigor as the Farquhar et al. method. This is an open research question as of 2026. If a future Anthropic API update exposes logprobs, semantic entropy would immediately become a practical option and §5.6 should be updated.

3. **Extended thinking and hallucination — where is the controlled comparison?** Anthropic's extended thinking documentation does not include a hallucination-rate comparison between thinking-enabled and thinking-disabled modes. The claim in §5.5 that thinking helps with multi-step reasoning but does not cure hallucination is based on architectural reasoning, not a published controlled study. A published evaluation would strengthen or weaken this claim. The chapter author should check Anthropic's model evaluation pages for any such comparison before finalizing §5.5.

4. **How much of the overconfidence is RLHF vs. pretraining?** The Sharma et al. sycophancy paper and the RLHF overconfidence literature implicate training from human preference data. Whether the overconfidence is primarily a training artifact or whether it was present in the base model and amplified is not cleanly separated in the published literature. Kadavath et al. (2022) found base models reasonably calibrated on structured tasks; post-RLHF models are documented to shift; but whether Constitutional AI's probability clamping partially corrected this for Claude specifically is unknown.

5. **Diagram A (calibration plot) — is there a published Anthropic-specific shape?** The Kadavath et al. paper includes calibration plots for Claude variants on structured tasks in the right format. The chapter author should check whether those plots are still representative of current model behavior, or whether a more recent Anthropic calibration evaluation is available before designing the diagram. Using a 2022 calibration curve to represent 2026 model behavior would be inaccurate; if no current curve is available, the diagram must be labeled as reflecting a historical pattern, not current Claude behavior.

6. **Does extended thinking meaningfully reduce sycophancy?** The thinking scratchpad is not visible to the user during generation and cannot be overridden. In principle, a model that reasons through "the user has stated X, but X is inconsistent with the evidence — I should correct this" in its thinking trace might be more likely to override sycophantic pressure in the final answer. No published study on this interaction was found. It is an interesting open question, and one where the answer would have practical implications for the value of extended thinking on contested factual questions.

7. **How does long-context hallucination interact with the prompt cache?** The prompt cache stores prefix KV states across API calls, allowing expensive prefix computation to be reused. If an early part of a cached prefix contains a hallucinated model output from a prior turn, that hallucination is baked into the cached state. Whether the cached representation differs in any meaningful way from a freshly computed representation (for the purposes of how the model attends to the hallucinated content in later turns) is unclear. The practical expectation is that cached and fresh prefixes produce the same model behavior — but this is an assumption, not a documented fact.

---

## Iteration log

**Iteration 1:** Full draft. All 14 sections populated. Web research completed (12 fetches: Anthropic citations docs, Messages API sampling/logprobs, reduce-hallucinations guidance, Nature/OATML semantic entropy, CoVe arXiv abstract, hallucination taxonomy survey, Kadavath calibration paper search, RLHF overconfidence search, sycophancy paper abstract, long-context "Lost in the Middle" search, extended thinking docs, Constitutional AI search).

**Iteration 2:** Citation verification, confidence tier review, and line count expansion pass.
- Demoted "context-training conflict" to "informed speculation for mechanism; suggestive for behavioral pattern" — the split is now explicit in the section header.
- Added explicit flag in §4.2 on the gap between Kadavath et al. (2022) and current models.
- Added §4.5 on prompted uncertainty expression — a technique with moderate evidence that was missing from the first pass.
- Added §7.4 on parallel multi-agent architectures — an architectural amplification scenario not in the first pass.
- Expanded §6.1 with a RAG hallucination tradeoff table showing which failure modes RAG helps and hurts.
- Expanded §6.3 with structural comparison between API citations and prompt-based citations.
- Expanded §9 (diagram/demo options) with implementation notes and design guidance.
- Expanded §10 (data plan) with TypeScript type definitions and corpus design guidance.
- Expanded §11 (connections) with specific line-level hooks and shared-citation notes.
- Expanded §12 (closing) with CacheCallout text and chapter author framing note.
- Expanded §14 (open questions) with 2 additional questions (extended thinking/sycophancy interaction; prompt cache and long-context hallucination).
- Added two new misconceptions to §8.
- Verified logprobs unavailability: API docs show `"logprobs": null`; confirmed as of 2026-05-17. Warning maintained that this can change.
- Noted in §8 that circulating "magic system prompt" claims are not peer-reviewed.
- Total line count: 765+ lines. Short of 800-line target but at approximately the same character density as rag.md (59K chars vs rag.md's 60K chars). Additional line count would require padding rather than adding substantive content.

**Reason stopped:** `done met` — all 14 required sections complete, citations verified and confidence tiers set, connections and data plan fully specified, no further substantive improvement available without drafting the actual chapter. Iteration limit: 2 of 2.
