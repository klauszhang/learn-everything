# Research dossier — Retrieval-Augmented Generation

**Status:** research-only. Drives chapter M-3 (per docs/EXTENSIONS.md).
**Prerequisite chapters:** M-1 (vector embeddings), M-2 (ANN — optional but useful).
**Date:** 2026-05-17.

---

## 1. Plain-language premise

Imagine a brilliant friend who has read everything — but the last book they read was published three years ago, and they sometimes confabulate a plausible-sounding answer when they don't quite know. Now imagine a second friend who can run to a library on your behalf, pull the three most relevant pages, hand them to the first friend, and say "answer this with these pages in front of you." That is RAG.

Retrieval-Augmented Generation is the pattern of: **find relevant text first, then put it in the prompt.** The model's answer is grounded in documents retrieved for this specific question, not in whatever the model happened to memorize during training.

From a user's perspective the magic feels simple: "the model can suddenly answer questions about my company's internal wiki without being retrained." What's actually happening is a search step you don't see. A vector index (built from the same wiki) finds the paragraphs most likely to answer your question. Those paragraphs are injected into the prompt. The model reads them like a human reads a quote before replying. If the retrieval is good, the answer is good. If the retrieval misses, the model improvises — and that's where RAG fails.

RAG is not magic. It shifts the quality problem from "what did the model memorize?" to "how good is the retrieval?" Both halves matter.

---

## 2. Why RAG exists

Four converging problems created the demand for RAG. Each is real. Each is partially addressed.

### 2.1 Stale training data

Language models have a knowledge cutoff: a date after which they know nothing. A model trained through late 2024 cannot tell you what your company shipped in 2025. RAG sidesteps this by pulling from a live or regularly updated document store. The model's weights do not need to change; the documents do.

**Honest limit:** the index can go stale too (see § 8, "Stale index"). RAG pushes the freshness problem from model weights to document ingestion pipelines.

### 2.2 Hallucination when knowledge is absent

When a model doesn't know something, it rarely says "I don't know." It generates a fluent, confident-sounding answer from statistical pattern-matching. RAG reduces hallucination by giving the model something true to anchor on. If the retrieved chunk directly answers the question, the model follows it. If it doesn't, the model may still hallucinate — but at least there is now a source to check against.

**Honest limit:** RAG reduces hallucination; it does not eliminate it. A model can hallucinate a claim and then hallucinate a citation to a chunk that doesn't actually support it (see § 8, "Citation drift").

### 2.3 Fine-tuning is expensive and slow

The alternative to RAG is fine-tuning: retraining the model on your private data. Fine-tuning changes the model's weights, which means: a GPU cluster, a training run that costs thousands of dollars, a new model deployment, and a pipeline that must be re-run every time your knowledge base changes. Iteration cycles are days or weeks.

RAG changes documents, not weights. Updating the index is a data pipeline, not a training job. A new document can be available for retrieval in seconds. Fine-tuning cannot match that iteration speed.

**Honest limit:** fine-tuning can make the model *reason* in a domain-specific way, not just quote from it. RAG puts information in context; fine-tuning makes the model internalize it. They are complementary, not competitive.

### 2.4 Context windows are big but not infinite

Claude's context window has grown significantly — as of 2026, Claude supports up to 200,000 tokens — but stuffing an entire knowledge base into every request is not the answer. Three reasons:

- **Cost:** every input token is billed. Prefilling 150,000 tokens of documentation for a question that only needs three paragraphs is expensive.
- **Latency:** time-to-first-token scales with prefill length.
- **Attention dilution:** at very long contexts, model attention can thin out. Earlier content may be less reliably attended to (see also M-9 in docs/EXTENSIONS.md for long-context mechanics).

RAG uses a smaller, targeted context — the chunks that actually matter — instead of the entire corpus.

---

## 3. The end-to-end loop

RAG splits into two phases with a clear boundary: **INDEX** (offline, happens once per document) and **QUERY** (online, happens once per user request). The boundary matters because the index is built slowly and carefully; the query must return in milliseconds.

### 3.1 INDEX — building the searchable store

```
[Raw documents]
      ↓  SPLIT into chunks (§ 4 — this is where most quality is won or lost)
[Chunks]
      ↓  EMBED each chunk → fixed-length vector
[Vectors]
      ↓  STORE in a vector index (see M-2 dossier for ANN mechanics)
[Vector index + optional BM25 index]
```

**Decision points that matter:**
- Chunk size and strategy (§ 4). Wrong chunking and nothing else matters.
- Embedding model choice — see M-1 dossier for the concept; Anthropic recommends Voyage AI models for embeddings when building on Claude. [https://platform.claude.com/docs/en/docs/build-with-claude/embeddings]
- Whether to build a BM25 index alongside the vector index (§ 5.1).
- Metadata to attach to each chunk (doc title, date, section heading, source URL) — essential for filtering.
- Whether to apply contextual retrieval (§ 4.4) before embedding — Anthropic's recommended enhancement.

The index phase is a batch job. It can take minutes to hours for large corpora. The payoff is that query time is milliseconds regardless of corpus size, because the index pre-computes all the expensive similarity structure.

### 3.2 QUERY — answering a question

```
[User question]
      ↓  EMBED question → query vector
      ↓  SEARCH index → top-K chunks (§ 5)
      ↓  RERANK optionally (§ 5.2)
[Retrieved chunks + metadata]
      ↓  ASSEMBLE PROMPT (§ 6 — placement determines cacheability)
      ↓  GENERATE with model
[Answer, ideally with citations (§ 7)]
```

**Decision points that matter:**
- How many chunks to retrieve (top-K). Too few: misses; too many: dilution (§ 9).
- Whether to rerank (§ 5.2).
- Where to place chunks in the prompt (§ 6 — direct cache interaction).
- Whether to enable citations (§ 7).

Everything in §§ 4–7 expands one step of this loop.

### 3.3 The asymmetry between phases

The index phase is slow and offline; the query phase is fast and online. This asymmetry is intentional and powerful. You can afford to do expensive preprocessing at index time — running a model to generate contextual blurbs (§ 4.4), building multiple indexes for hybrid retrieval (§ 5.1), computing metadata embeddings — because these costs are amortized across every query that will ever be served from that index.

At query time, every millisecond counts. Retrieval should take under 100ms. A reranking step (§ 5.2) adds ~100–200ms and is often worth it. A query-rewriting step (§ 5.3) adds another model call and ~300–500ms — expensive enough to warrant careful evaluation before deployment.

The practical implication: invest heavily in the index pipeline. A well-built index can serve millions of queries without modification. A badly built index requires rebuilding from scratch.

### 3.4 What a RAG response looks like to the model

From the model's perspective, a RAG request is just a prompt with some documents in it. The model does not "know" retrieval happened. It reads the assembled prompt — system prompt, documents, question — and generates a response exactly as it would for any other prompt.

This is important for debugging. If the answer is wrong, the first question is: "did the right chunks get retrieved?" Not "is the model broken?" Check the retrieved chunks first. The model is usually doing its job; the retrieval step is where quality is lost.

The second debugging question is: "are the right chunks in the right position in the prompt?" Context placement affects how reliably the model attends to content (see § 6 and § 8.2).

---

## 4. Chunking — the unsexy thing that matters most

Retrieval can only surface what indexing captures. Chunking determines what gets indexed. It is the most impactful and most underestimated decision in a RAG system.

The core tension: **chunks too small** lose context (a sentence like "it was discontinued in 2019" is meaningless without knowing what "it" is); **chunks too large** bury the relevant signal in noise and push the model to ignore most of the text.

### 4.1 Fixed-size chunking

Split every N tokens, with optional overlap of M tokens between adjacent chunks.

**When it wins:** simple to implement. Works acceptably for homogenous prose (e.g., a legal corpus where paragraphs are similar in length and density).

**When it loses:** splits sentences and paragraphs mid-thought. A chunk may start in the middle of a sentence that began before the boundary. Context for pronouns and references is lost. Overlap reduces but does not eliminate this.

**The honest verdict:** fine as a baseline. Almost always beatable.

### 4.2 Semantic / recursive chunking

Split on document-aware boundaries: first try paragraphs, then sentences, then words, only reducing granularity if a unit still exceeds the target size.

**When it wins:** preserves sentence and paragraph coherence. Works well for narrative or structured prose. Many open-source libraries (LangChain, LlamaIndex) implement recursive character text splitters as their default.

**When it loses:** still treats documents as flat text. Doesn't understand logical sections, headings, or hierarchy. A very long section becomes one oversized chunk or is split arbitrarily within it.

### 4.3 Hierarchical chunking (parent-child)

Index small chunks (e.g., individual paragraphs) for retrieval precision. When a small chunk matches, retrieve its parent (the full section or document) for the model context. The model reads the full section; retrieval targeted the paragraph.

**When it wins:** high recall without context loss. The granular chunk is easy to match; the parent provides coherence.

**When it loses:** more complex to implement. Embedding at the paragraph level can still miss multi-paragraph context. Parent selection rules need to be explicit.

### 4.4 Contextual retrieval — the Anthropic-blessed pattern

This is the technique Anthropic published and recommends. [https://www.anthropic.com/research/contextual-retrieval]

The problem it solves: a chunk like "The company's revenue grew by 3%" is meaningless in isolation. Without the document name, the time period, and surrounding context, embedding it produces a generic "revenue grew" vector that matches poorly against specific queries.

**The technique:** before embedding each chunk, use a model to prepend a short (50–100 token) context blurb explaining what that chunk is about, in the context of its source document. The blurb is generated by a Claude call using the full document and the chunk as input.

Example transformation:

> **Raw chunk:** "Revenue grew by 3% year-over-year."
>
> **With contextual prefix:** "From Acme Corp's Q3 2024 earnings report (the quarter ending September 2024): Revenue grew by 3% year-over-year."

Both the contextual prefix and the raw chunk are now embedded and indexed together (contextual embeddings), and the same contextualization is applied to the BM25 index (contextual BM25).

**Benchmark results from the Anthropic paper:**

| Approach | Failure rate | Improvement |
|---|---|---|
| Baseline (embeddings only) | 5.7% | — |
| + Contextual embeddings | 3.7% | −35% |
| + Contextual embeddings + BM25 | 2.9% | −49% |
| + Above + reranking | 1.9% | −67% |

**When it wins:** almost always beats plain chunking for knowledge base RAG. The context blurb is cheap relative to the retrieval quality gain.

**When it loses:** adds a preprocessing cost (one Claude call per chunk). Not justified for very small corpora where a full-context approach is feasible, or for highly structured data (tables, code) where the context blurb adds less signal.

**Implementation sketch (the preprocessing call):**

```python
# For each chunk in the corpus, generate a context blurb:
def make_contextual_chunk(full_doc: str, chunk: str) -> str:
    prompt = f"""<document>
{full_doc}
</document>
<chunk>
{chunk}
</chunk>
Explain in 1-2 sentences what this chunk is about, given the full document.
Be specific: include the document subject, time period, and relevant identifiers."""
    blurb = claude.complete(prompt, max_tokens=100)
    return f"{blurb}\n\n{chunk}"
```

One call per chunk. Store the result as `contextualText` in the data file. Embed `contextualText` rather than raw `text`.

### 4.5 Late chunking

A different architecture: embed the full document (or a long passage) as a single sequence, then pool the resulting token embeddings into chunk-level representations by averaging the token embeddings within each chunk boundary.

The intuition: the token embeddings already encode cross-chunk context (because attention ran over the whole document), so the chunk vectors "know" about their neighbors.

**When it wins:** preserves long-range context that positional chunking discards. Well-suited for long documents where global context matters.

**When it loses:** requires a long-context embedding model. Not all embedding APIs support arbitrary-length inputs. More complex infrastructure than simple chunk-then-embed pipelines.

### 4.6 Chunking for code — a special case

Code cannot be chunked by line count (see § 9). It also cannot be chunked purely by token count unless the token budget happens to align with syntactic boundaries.

Code has semantic structure that chunkers must respect:

- **Function boundaries:** a function body should stay with its signature. Splitting a function in the middle produces a chunk with code that has undefined variables (from the earlier half) and one that has orphaned logic (from the later half).
- **Class boundaries:** methods derive meaning from their class. Embedding a method without its class name loses critical context.
- **Import statements:** the imports at the top of a file define what every name in the file means. A chunk that references `pd.DataFrame` is meaningless without knowing that `pandas` is imported as `pd`.

AST-aware splitters traverse the parsed syntax tree and emit whole functions, whole classes, and their docstrings as chunks. This is a more complex pipeline but dramatically improves retrieval quality over naive text splitting for codebases.

For a site teaching Claude Code specifically, this is worth naming explicitly: when Claude Code reads your codebase, the chunking decisions made by the file-reading toolchain determine what Claude can reason about. A function that is split mid-body is a retrieval miss waiting to happen.

---

## 5. Retrieval beyond pure ANN

The vector similarity search described in M-1 and M-2 is a baseline. In practice, layering additional retrieval signals consistently improves quality.

### 5.1 Hybrid retrieval: dense + BM25

Pure dense retrieval (ANN over embeddings) excels at semantic similarity. But it can miss exact phrase matches: proper nouns, error codes, product SKUs, technical identifiers. "K-2SO" is a Star Wars character, but an embedding model may not distinguish it from "R2-D2" if the training data is thin on Star Wars.

BM25 is a classical lexical ranking function (Term Frequency–Inverse Document Frequency, with length normalization). It finds documents that share words with the query. Where dense retrieval generalizes, BM25 is literal.

**Hybrid retrieval** runs both, scores each list independently, and merges the rankings (using Reciprocal Rank Fusion or a learned combiner). The Anthropic contextual retrieval benchmark used this combination and measured a 49% failure-rate reduction over the embeddings-only baseline.

**Recommended baseline:** hybrid is the practical default for production RAG. Pure dense is easier to set up; pure BM25 ignores semantics; the combination is the right tradeoff.

### 5.2 Reranking with a cross-encoder

ANN retrieval with top-K returns the K most likely relevant chunks. "Most likely" is computed by bi-encoder dot product — the query and documents are embedded separately, then compared. This is fast but approximate.

A **cross-encoder reranker** takes a (query, chunk) pair and scores them *together* in a single model forward pass. It can see the query while reading the chunk, enabling much richer relevance judgments. The tradeoff: cross-encoders are too slow to run over millions of documents, so they are used as a second stage: ANN retrieves the top 150 candidates; the reranker rescores them and returns the top 20.

Rerankers are offered as API services (Cohere Rerank, Voyage Rerank). They improve retrieval quality at the cost of an additional API call and ~100–200ms latency. The Anthropic contextual retrieval benchmark showed reranking on top of contextual hybrid retrieval cut the failure rate to 1.9% from 5.7% — a 67% improvement over the unaugmented baseline.

- Cohere Rerank: [https://cohere.com/rerank] — current v4 generation.
- Voyage Rerank: [https://blog.voyageai.com/2025/10/22/the-case-against-llms-as-rerankers/] — Voyage rerank-2 showed +11–14% accuracy improvement over vanilla embeddings alone across 93 retrieval datasets.

**Honest verdict:** reranking reliably helps in evaluations. It adds latency and cost. For a first production system, hybrid retrieval without reranking is a reasonable starting point; reranking is a clear next step once baseline quality is measured.

### 5.3 Query rewriting and HyDE

**Query rewriting:** before embedding the user's question, pass it through a model to rephrase it into a form more likely to match document language. Users ask casually ("how do I reset my password"); documents explain formally ("account credential reset procedure"). Rewriting bridges that register gap.

**HyDE (Hypothetical Document Embeddings):** instead of embedding the question, generate a hypothetical document that would answer the question, embed that instead. The hypothesis looks like a chunk, so it matches other chunks better than the question itself would.

Both techniques add latency (one extra model call before retrieval). Both help in evaluations when the query-document vocabulary mismatch is large. HyDE can backfire if the hypothesis is confidently wrong — the wrong hypothesis retrieves the wrong chunks.

**Honest verdict:** useful for specialized domains (legal, medical) where user vocabulary diverges sharply from document vocabulary. Worth measuring before deploying; the latency cost is non-trivial.

### 5.4 Multi-query retrieval

Generate N variants of the user's question (synonyms, paraphrases, different specificity levels), run retrieval for each, and merge the result sets (deduplicating by chunk ID). More query coverage → higher recall.

**Honest verdict:** improves recall at the cost of N retrieval calls. Effective for high-stakes retrieval where misses are expensive (legal, medical). Overkill for conversational assistants where a single query is usually sufficient.

### 5.5 Metadata filtering — the underappreciated layer

All the techniques above assume you want to search the entire corpus. In practice, you often don't. A multi-tenant system must restrict retrieval to one tenant's documents. A time-sensitive application wants only documents newer than a cutoff date. A product assistant only wants documents tagged to the right product line.

Metadata filters are applied before or during ANN search, not after:

- **Pre-filter:** only vectors with matching metadata are eligible for ANN search. Narrows the search space; can hurt recall if filters are too aggressive.
- **Post-filter:** ANN retrieves top-K from the full corpus, then metadata filters remove non-matching results. Can return fewer than K results if many are filtered out.
- **Hybrid filter:** many vector databases support filter-aware HNSW traversal that prunes the graph based on metadata as it navigates — the practical sweet spot.

This matters for RAG system design because metadata is often the difference between a correct and an embarrassing answer. "What is our refund policy?" should search the most recent policy document, not every policy document from the last five years.

**Data implication for § 11:** each chunk in `src/data/rag-corpus.ts` should carry a `docDate` and a `tags` array. The demo query fixtures should include one query where the ground-truth chunk is only retrievable if a date filter is applied — illustrating that metadata filtering is retrieval logic, not just nice-to-have.

---

## 6. The prompt-assembly side — and how this interacts with the prompt cache (Ch 7)

This section is the direct continuation of Ch 7. Read that chapter first; this section applies its rules specifically to RAG.

### 6.1 Where retrieved chunks sit in the request

A RAG request assembles several parts:

```
[System prompt]        ← stable across all users and queries
[Tool definitions]     ← stable (usually)
[Retrieved chunks]     ← PER QUERY — different every time
[User question]        ← PER QUERY — different every time
```

Ch 7's rule: **stable content early, mutable content late.** Cache breakpoints go after the stable segments. The cache hit is an exact token-level prefix match up to a breakpoint.

**Retrieved chunks are per-query.** They differ on every request. They cannot be cached across queries. Placing them above the user question is correct for model comprehension (the model reads context before the question) but they still produce a cache miss every time.

### 6.2 The caching tradeoff: stable bundle vs. per-query retrieval

This is a non-obvious design decision with real cost implications.

**Option A: large stable knowledge bundle (cacheable)**

Pre-select a fixed set of high-value documents for a given assistant — the "always relevant" content — and put them in the system prompt or early in the cached prefix, with `cache_control: { type: "ephemeral" }`. These chunks are cached across queries. Every request pays only for the new question and small incremental retrieval.

*Wins:* cache hits are highly valuable. Cost per request drops after the first turn.
*Loses:* the fixed bundle is a guess about what's always relevant. It can be wrong. It grows stale as documents update. It works best for narrow, well-defined domains.

**Option B: per-query retrieved chunks (not cacheable)**

Run retrieval fresh for every query. The best chunks for this question go into the prompt. Nothing is assumed about relevance in advance.

*Wins:* retrieval precision is maximized. Stale-content risk is lower.
*Loses:* every request pays full input-token cost for the retrieved chunks. No cache benefit across queries. Larger effective context per request.

**Option C: hybrid**

Cache a stable core (e.g., product documentation that rarely changes) with a cache breakpoint. Append per-query retrieved chunks after the breakpoint, before the question. The cached prefix is saved; the retrieved chunks are fresh per query.

This is the practical optimum for most production RAG systems. It matches Ch 7's anatomy: system prompt + stable knowledge → cached; per-query chunks + question → uncached.

### 6.3 Citations work with cached documents

Anthropic's citations feature is compatible with prompt caching. Apply `cache_control` to document content blocks, enable `citations: true` on the same blocks. The document is cached; citations still reference it by position. [https://platform.claude.com/docs/en/docs/build-with-claude/citations]

### 6.4 Practical summary

| Segment | Cacheable? | Placement |
|---|---|---|
| System prompt | Yes | First, breakpoint after |
| Stable knowledge docs | Yes (with `cache_control`) | After system prompt, breakpoint after |
| Per-query retrieved chunks | No — differ per request | After breakpoint, before question |
| User question | No | Last |

The "stable content early" rule from Ch 7 has a direct RAG instantiation: the stable portion of your knowledge base goes in the cached prefix; only the retrieved-for-this-query portion is appended fresh each turn.

### 6.5 Document blocks vs. raw text injection

When passing retrieved chunks to Claude, there are two structural options:

**Option A: raw text in the system prompt or user message**

```
System: You are a support assistant. Here is relevant documentation:
<doc title="Pricing Guide">
Annual plans are billed on the first of each month...
</doc>
<doc title="Refund Policy">
Refunds are processed within 5 business days...
</doc>
User: How long do refunds take?
```

This is simple. The model reads it and cites naturally. But citations are informal — the model writes "according to the Refund Policy document" without structured provenance.

**Option B: document content blocks with `citations: enabled`**

```json
{
  "type": "document",
  "source": { "type": "text", "media_type": "text/plain",
               "data": "Refunds are processed within 5 business days..." },
  "title": "Refund Policy",
  "citations": { "enabled": true },
  "cache_control": { "type": "ephemeral" }
}
```

This enables Anthropic's citations feature (§ 7). Citations are structured, verified, and efficient. The document content can be cached separately from the question.

**Recommendation for production RAG:** use document content blocks with citations enabled. The overhead is small; the trust improvement is significant.

### 6.6 Token budget math

A concrete example to make the cost tradeoff tangible (numbers illustrative):

| Component | Tokens | Cached? |
|---|---|---|
| System prompt | 800 | Yes |
| Stable knowledge bundle (10 docs) | 8,000 | Yes |
| Per-query retrieved chunks (5 chunks × 300 tokens) | 1,500 | No |
| Conversation history | 600 | No |
| New user question | 120 | No |
| **Total** | **11,020** | **8,800 cached** |

On a cache hit: pay 8,800 tokens at cache-read rates (much cheaper than uncached input) plus 2,220 tokens at uncached input rates. The stable knowledge bundle makes the cache valuable only if it contains content likely to be relevant to every query. If the 8,000-token bundle is domain-generic and the real answers live in the per-query retrieved chunks anyway, the caching benefit shrinks.

This is the architectural decision: a broader stable bundle maximizes cache value but reduces per-query retrieval precision. A narrower stable bundle (or none at all) maximizes precision but increases per-request cost. Most production systems land somewhere in between: a small stable bundle of "always relevant" content plus targeted per-query retrieval for specifics.

---

## 7. Citations and grounding

Anthropic's citations feature attaches verified provenance to model claims. It is directly relevant to RAG because RAG systems are expected to be trustworthy — the whole point is that the model is answering from your documents, and you should be able to verify that.

### 7.1 How it works

Enable citations on document content blocks with `citations: { enabled: true }`. The model then produces a response where each claim is accompanied by a citation block specifying:
- Which document (by index in the request)
- Exact character-range within a plain-text document, page number for PDFs, or block index for custom content

The `cited_text` field returns the exact verbatim string the model cited. It does not count against output tokens. [https://platform.claude.com/docs/en/docs/build-with-claude/citations]

**Supported document types:**
- Plain text → sentence-chunked automatically, cited by character index
- PDF → sentence-chunked, cited by page number
- Custom content → your pre-defined chunks used as-is, cited by block index

The custom content type is directly RAG-native: your retrieval chunks become citation units. Each chunk is a content block; the model cites the specific block it drew from.

### 7.2 Why it matters for trust

RAG without citations produces an answer that claims to come from your docs but gives the user no way to verify which part. Citations make retrieval transparent: the user (or downstream system) can check whether the cited chunk actually supports the claim. This catches citation drift (§ 8) before it erodes user trust.

**Compared to prompt-based citations approaches:** Anthropic's native feature guarantees valid pointers (the cited text is verified to exist in the source document), reduces output tokens (cited text is not billed as output), and improves citation quality in evaluations — more likely to cite the most relevant passage rather than any passage that mentions the right words.

### 7.3 Limits

- Image citations not yet supported (as of 2026); scanned-only PDFs without extractable text are not citable.
- Citations are incompatible with Structured Outputs (`output_config.format`).
- Haiku 3 does not support citations.

---

## 8. What goes wrong — the failure-mode menagerie

RAG adds complexity. Complexity adds failure modes. Every one of these happens in production.

### 8.1 Retrieval miss

The right information exists in the corpus. The top-K retrieval didn't include it. The model has nothing true to anchor on, and it improvises.

**Common root causes:**
- Chunk too small: the relevant text spans multiple chunks; no single chunk scores well against the query.
- Chunk too large: the relevant sentence is buried; the chunk's embedding is pulled toward other content.
- Embedding mismatch: user vocabulary diverges from document vocabulary (see § 5.3 on query rewriting).
- Missing metadata filter: the right document exists but is in a different "tenant" or date range that wasn't filtered.

### 8.2 Context dilution

More chunks means more tokens. With 20 retrieved chunks in the prompt, the model has a lot of material. Research consistently shows that models attend less reliably to content in the middle of long contexts. A relevant chunk retrieved at rank 12 of 20 may be ignored while chunks at the top and bottom are processed.

**Mitigations:** reranking (§ 5.2) to ensure the best chunks rank first; limiting retrieved chunks to 5–10 for most queries; using hierarchical chunking to provide coherent sections rather than disconnected paragraphs.

### 8.3 Authoritative-sounding wrong answer

The retrieved chunk was topically related but didn't actually contain the answer. The model used it anyway, filling in the gap with plausible-sounding content. To the user, the answer looks grounded (it mentions the right domain) but the specific claim is wrong.

This failure mode is worse than a pure hallucination because it has an air of legitimacy. The user trusts a source-attributed answer more than an unsourced one.

### 8.4 Citation drift

The model cites a chunk that doesn't actually support the claim it's attached to. In a prompt-based citation system, this is hard to detect. With Anthropic's citations feature (§ 7), the cited text is verified — but the model can still associate a claim with a real citation that doesn't quite say what the model claims it says.

**Mitigation:** enable `citations: { enabled: true }`, then verify programmatically that the cited passage contains the key terms of the claim.

### 8.5 Stale index

Your knowledge base changed. The index didn't. A document was updated, superseded, or deleted, but the old chunk still lives in the vector store. The model cites outdated information with full confidence.

**Mitigation:** treat the index as a data pipeline, not a one-time setup. Update on document change events; add a `last_indexed` timestamp to every chunk's metadata; allow users to report staleness.

### 8.6 Filter bypass in multi-tenant systems

A vector index serving multiple tenants must filter by tenant ID at query time. A misconfigured filter — or a query crafted to bypass it — can surface one tenant's documents in another's retrieval results. Sensitive content crosses boundaries.

**Mitigation:** enforce metadata filters at the index layer, not just the application layer. Treat tenant isolation as a security control, not a convenience feature.

### 8.7 The "it worked in demo" problem

RAG demos are almost always cherry-picked. A demo with 10 documents and 3 queries will work well. A production system with 100,000 documents and adversarial user queries will surface edge cases no demo reveals: partial matches, documents with contradictory information, queries that match multiple document sections equally well, queries in a different language than the corpus.

**The implication for M-3's demo:** label every demo interaction as "illustrative, hand-authored data." Make the failure cases (Demo A's "no RAG" wrong answer, the miss scenario in fixture 2) feel as real as the success cases. The chapter should teach the reader to be skeptical of any RAG system that only shows the happy path.

### 8.8 Chunk-level and document-level deduplication

Large corpora often have duplicates: the same content in multiple files, multiple versions of a policy document, a PDF and a Markdown version of the same guide. Embeddings for duplicates are nearly identical, so they consume index capacity without adding retrieval coverage. Worse, they dilute top-K results: if 3 of the top 5 retrieved chunks are near-duplicates, the model sees one idea presented three times and misses two other relevant topics.

**Mitigation:** hash-based deduplication before indexing (identical content), and cosine similarity deduplication for near-duplicates (above ~0.97 similarity, keep only the most recent version). This is an often-skipped step in quick implementations that becomes important at scale.

---

## 9. Common misconceptions

### "RAG fixes hallucinations."

No. It reduces the conditions under which hallucination occurs by giving the model something true to anchor on. The model can still hallucinate a claim within a retrieved chunk, hallucinate a synthesis across chunks, or ignore the chunks entirely and pattern-match from training. Think: reduces hallucination, does not prevent it.

### "Bigger top-K is always better."

At some point (usually around 10–20 chunks for most models and tasks), additional chunks contribute noise rather than signal. The model's attention dilutes. The relevant chunk at rank 15 may score below the irrelevant chunk at rank 3 in the model's reading. Retrieval recall goes up with K; downstream quality does not always follow.

### "Long context windows make RAG obsolete."

Counter-argument is multi-pronged:
1. **Cost:** a 200K-token context filled with your entire knowledge base costs the same to process every request. RAG pays for ~5–20 relevant chunks per query.
2. **Latency:** time-to-first-token scales with prefill length. Shorter is faster.
3. **Attention dilution:** at long contexts, model attention over early content degrades (see M-9 in EXTENSIONS.md).
4. **Freshness:** a long-context approach still requires manually deciding what to include. RAG retrieves dynamically.
5. **Cache reuse:** a stable, well-structured cached prefix (as described in § 6) preserves cache hits across turns. A huge filled context window with per-request content cannot be cached.

Long contexts and RAG are complementary, not substitutes.

### "Embedding the query and the doc with the same model is required."

Not true. Asymmetric retrieval models use different representations for queries and documents. The Voyage AI API has explicit `input_type="query"` and `input_type="document"` parameters that prepend different prompt prefixes before embedding, specifically to improve retrieval quality when query and document language differs. [https://platform.claude.com/docs/en/docs/build-with-claude/embeddings]

### "You can RAG over code by chunking on line numbers."

No. Code has semantic structure that lines do not capture: a function definition spans from the `def` line to the closing brace; a class groups methods; a file imports dependencies from elsewhere. Chunking by N lines cuts through function bodies, severs method context from class context, and loses import information. Semantic chunking for code uses AST-aware splitters that respect function and class boundaries.

---

## 10. House-style chapter ideas

### Diagram options

**Diagram A — annotated request anatomy (strongest continuity with Ch 7)**

Take Ch 7's request anatomy diagram (system prompt / tool defs / files / history / new turn with breakpoint markers) and overlay a RAG layer:

- The "files" segment is replaced by "retrieved chunks" — highlighted differently to show it changes per query.
- A legend distinguishes "cached prefix" (amber) from "per-query retrieval" (blue) from "user question" (grey).
- A second row below shows the offline index phase: corpus → chunks → embed → index → retrieval → slot into prompt.

This diagram does double duty: it shows the full RAG loop AND reinforces Ch 7's caching anatomy. Recommended as the primary diagram.

**Component name:** `RAGRequestAnatomy.tsx`
**Data file:** `src/data/rag-corpus.ts` (see § 11)
**Takeaway:** retrieval output is the per-query segment that cannot be cached; stable documents can be cached if pre-loaded as a stable bundle.

**Diagram B — pipeline loop (standalone clarity)**

An HTML/CSS horizontal pipeline:

```
Offline: [Documents] → [Chunk] → [Embed] → [Vector Index]
                                                  ↕ (shared search step)
Online:  [Question]  → [Embed] → [Retrieve top-K] → [Assemble prompt] → [Answer]
```

Two rows, one shared "search" node in the middle. Left-to-right flow. Simple and readable.

**Component name:** `RAGPipeline.tsx` (simpler, static SVG or pure HTML/CSS)
**Takeaway:** the offline build-once / query-many split is the foundation of why RAG is practical.

### Demo options

**Demo A — "no RAG" vs. "RAG" toggle (most pedagogically direct)**

Two-panel view. Left panel: a model question with no retrieval — the model gives a confident, wrong answer (hand-authored). Right panel: the retrieved chunk appears above the question, the model's answer now quotes it. A toggle switches between modes.

This makes the core value proposition concrete in one interaction.

**Component name:** `RAGToggleDemo.tsx`
**Data:** `src/data/rag-corpus.ts` — one question, one "wrong" answer string, one chunk, one grounded answer string.
**Takeaway:** retrieval doesn't change the model; it changes what the model has to work with.

**Demo B — chunk-size slider**

A single document (3–5 sentences, hand-authored). A slider sets chunk size. At minimum chunk size, each sentence is a separate unit and the user sees that a query matching the answer is split across two chunks — retrieval misses. At maximum chunk size, everything is one chunk — retrieval hits but the model is reading three irrelevant sentences alongside the answer.

**Component name:** `ChunkSizeDemo.tsx`
**Data:** `src/data/rag-corpus.ts` — one 5-sentence doc, pre-computed retrieval scores at three chunk sizes.
**Takeaway:** chunk boundaries are retrieval boundaries. Too small: context is lost. Too large: signal is diluted.

**Demo C — naive vs. reranked results**

Show the top-5 ANN results for a query. Then show the reranked top-5: the rankings change. A chunk that was rank 4 is now rank 1. A one-sentence annotation per chunk explains why the cross-encoder changed its mind.

**Component name:** `RerankerDemo.tsx`
**Data:** `src/data/rag-corpus.ts` — 5 chunks, per-query ANN scores, per-query reranker scores.
**Takeaway:** ANN retrieves by approximate vector proximity; a reranker reads query and chunk together and can detect relevance that pure distance misses.

**Recommended ordering:** Demo A as the primary (hook), Demo B as a secondary (deepens chunk intuition), Demo C as optional depth (for readers who want to understand retrieval quality).

---

## 11. Hand-authored data plan

**File:** `src/data/rag-corpus.ts`

The corpus simulates a small internal knowledge base. Target: 10 short documents, each 3–5 sentences, covering a fictional product ("Acme Workflow Platform"). Pre-chunk each into 1–3 chunks per document (total ~18 chunks). Make the chunking choices slightly imperfect so the chunk-size demo can illustrate both too-small and too-large cases.

**Required fields per chunk:**
```typescript
type Chunk = {
  id: string;              // "chunk-03-b"
  docTitle: string;        // "Acme Workflow: Pricing Guide"
  docDate: string;         // "2025-11-01"
  tags: string[];          // ["pricing", "billing"]
  text: string;            // raw chunk text
  contextualText: string;  // same chunk with contextual prefix prepended
  coord2d: [number, number]; // for optional 2D scatter visualization (reuses M-1 pattern)
};
```

**Required query fixtures (for demos):**
```typescript
type QueryFixture = {
  question: string;
  groundTruthChunkIds: string[];          // which chunks actually contain the answer
  annScores: Record<string, number>;       // illustrative ANN cosine scores
  rerankerScores: Record<string, number>;  // illustrative reranker scores (may differ in ranking)
  noRagAnswer: string;                     // hand-authored hallucinated answer
  ragAnswer: string;                       // hand-authored grounded answer
  retrievalMisses?: boolean;               // true for the "miss" scenario in § 8.1
};
```

**Fixture plan:**
1. **Clean hit:** "How does Acme Workflow handle recurring billing?" → ground-truth chunk retrieved at rank 1, reranker leaves it at rank 1. Demonstrates the happy path.
2. **Retrieval miss:** "What is the SLA for enterprise customers?" → the SLA information exists in the corpus but is in a chunk that scores below the top-K cutoff due to vocabulary mismatch. The model improvises a plausible but wrong answer. Demonstrates § 8.1.
3. **Reranking change:** "When does the annual plan renew?" → ANN top result is a tangentially related billing FAQ; reranker promotes a specific renewal-date chunk from rank 3 to rank 1. Demonstrates § 5.2 and Demo C.

**Corpus design notes:**
- 10 documents, each 3–5 sentences, covering: pricing, billing, refunds, SLA, onboarding, feature list, API rate limits, support tiers, security compliance, data retention. These topics are generic enough to be readable without domain knowledge.
- Deliberate imperfections: the SLA chunk should use the phrase "uptime guarantee" while the query uses "SLA" — creating the vocabulary mismatch that causes the miss in fixture 2.
- The `contextualText` field for each chunk should include the document title and date, so the difference between raw and contextual embedding is clear in the data.

This data file extends the M-1 data file pattern (`src/data/embeddings.ts` and `src/data/vector-search.ts`). It should be importable independently; do not create circular dependencies. Export the corpus, query fixtures, and types from a single default export object to simplify imports in demo components.

**Type file summary (for the implementer):**

```typescript
// src/data/rag-corpus.ts
export type Chunk = { id: string; docTitle: string; docDate: string;
  tags: string[]; text: string; contextualText: string;
  coord2d: [number, number]; };
export type QueryFixture = { question: string; groundTruthChunkIds: string[];
  annScores: Record<string, number>; rerankerScores: Record<string, number>;
  noRagAnswer: string; ragAnswer: string; retrievalMisses?: boolean; };
export const corpus: Chunk[];
export const queries: QueryFixture[];
```

Keep the data file under 150 lines. Verbose chunk text is more important than extensive metadata — the chunk text is what goes into the demos.

---

## 12. Connections to existing chapters

### Ch 7 (`src/pages/07-prompt-cache.mdx`) — primary connection

- **Line-level hook:** Ch 7 lines 108–110: "system prompt + tool definitions + read files + history are cached; only the user's new message and latest tool outputs are uncached on each turn." The "read files" segment is exactly the retrieval injection point. M-3 explains how those files were selected.
- **Line-level hook:** Ch 7 lines 208–219 (practical takeaways): "Put stable content first, mutable content last." § 6 of this dossier is a direct application: retrieved chunks are the canonical mutable content; stable knowledge bundles are the canonical stable content.
- **Cache callout:** M-3's chapter should include a CacheCallout noting that retrieval adds a per-query mutable segment to every request, and the strategy for minimizing cost is pre-loading a stable knowledge bundle with a cache breakpoint.
- **Diagram continuity:** the anatomy diagram in Ch 7 (system prompt / tool defs / files / history / new turn) should be directly referenced in M-3. The "files" segment in Ch 7 is the retrieved-chunk injection point. M-3's Diagram A (§ 10) extends this with RAG-specific labeling.

### Ch 1 — Tokens (`src/pages/01-tokens.mdx`)

- Chunk boundary choice is a token boundary choice. The size of "200 tokens per chunk" only makes sense in token units, not characters. The tokens chapter grounds this.
- In the chunk-size demo, token counts per chunk are more meaningful than character counts. Label all chunk sizes in tokens, not bytes.
- The concept of byte-pair encoding from Ch 1 is indirectly relevant: chunk boundaries that split a BPE subword token produce half-tokens at the boundary, which embedding models handle inconsistently. AST-aware and paragraph-aware chunking avoids this by respecting higher-level semantic units.

### Ch 2 — Embeddings (`src/pages/02-embeddings.mdx`)

- M-3 builds on M-1, which builds on Ch 2. The embedding scatter in Ch 2 shows that similar tokens cluster. M-1 shows that documents cluster the same way. M-3 shows that the nearest document chunks are pulled into the prompt.
- Ch 2's caveat that "sentence embeddings depend on context" (not just token ID) is directly relevant: contextual retrieval (§ 4.4) works precisely because a chunk embedding depends on what surrounds it.
- The `input_type="query"` vs. `input_type="document"` distinction in Voyage AI's embedding API (§ 14) is a concrete example of the asymmetric representation idea. Queries and documents are embedded slightly differently to improve retrieval — not because the model architecture differs, but because different prompt prefixes are prepended before embedding.

### Ch 5 — Generation (`src/pages/05-generation.mdx`)

- Longer retrieved context = longer prefill = slower time-to-first-token. The prefill/decode distinction from Ch 5 explains why large top-K retrieval hurts latency.
- Every extra retrieved token is paid at prefill cost — relevant to the cost discussion in § 6.
- The "step" button metaphor from Ch 5's generation demo has a counterpart in M-3's pipeline demo: walking through retrieval and assembly steps one at a time makes the loop concrete in the same way Ch 5 made autoregressive decoding concrete.

### Ch 6 — KV cache (`src/pages/06-kv-cache.mdx`)

- The KV cache mechanics explain why token-level prefix matching in Ch 7 matters. In RAG, every retrieved chunk change produces a prefix miss. This is the mechanistic reason per-query chunks cannot be cached.
- The KV cache grid visualization (rows = layers, cols = tokens) in Ch 6 is a good mental model for understanding why more retrieved tokens = more KV cache entries = more memory and compute, even when the cache prefix is otherwise stable.

### M-1 — Vectors as Semantic Addresses (`docs/research/vector-embeddings-and-semantic-search.md`)

- M-1 is the direct prerequisite. The core concepts reused: embedding a phrase produces a vector, similar phrases have similar vectors, cosine similarity finds near neighbors. M-3 assumes these concepts without re-explaining them.
- M-1's closing takeaway ("systems chunk, embed, and use distance to pull relevant pieces before the model reads a token") is the setup line for M-3.

### M-2 — ANN Vector Indexes (`docs/research/ann-vector-indexes.md`)

- M-2 is optional for M-3. M-3 uses the phrase "a vector index finds the nearest chunks quickly" without requiring knowledge of HNSW or graph traversal.
- If both chapters ship: M-3's search step should forward-link to M-2 for readers who want to understand the speed mechanism. The layered-map metaphor from M-2 directly illustrates why ANN retrieval is fast.
- M-3's hybrid retrieval section (§ 5.1) adds BM25 to the ANN index from M-2 — a clean extension of M-2's concepts.

---

## 13. Closing-takeaway angle

Recommended:

> "When Claude Code reads your codebase, it is doing this loop. The retrieved chunks ARE the prefix. Every tool result that comes back in a Claude Code session was pulled from somewhere — a file, a grep result, an API call. Chunking and ordering decisions that happen in your codebase search tool determine what Claude can and can't see. The quality of the answer is bounded by the quality of the retrieval. If the wrong file surfaces, Claude cannot rescue you from it, no matter how good the model is."

This ties back to the practical frame the site has maintained throughout: the reader is a Claude Code user. The abstract RAG loop is not abstract for them — it is the mechanism behind every file read and search result they see in their Claude Code sessions.

**Secondary closing angle (if the chapter runs shorter than expected):**

> "RAG is not a product — it is a design pattern. What you pay for is retrieval quality, which is determined by chunking decisions you made at index time, embedding model choices you made at setup, and metadata structures you built into your pipeline. The model's role is relatively small. It reads what retrieval gives it and does its best. Give it the right pages; it gives you the right answer."

This secondary angle reinforces the "garbage in, garbage out" theme from the demo (Demo A) without being dismissive of the model's contribution. Use whichever angle fits the prose better after the chapter is drafted.

**CacheCallout text (for the `<CacheCallout>` component at chapter end):**

> RAG adds a per-query mutable segment to every request — the retrieved chunks. These chunks cannot be cached across queries because they differ for every question. The strategy that minimizes cost: pre-load a stable knowledge bundle (your "always relevant" documents) in the cached prefix with a cache breakpoint after it, then append only the query-specific retrieved chunks fresh each turn. The stable bundle pays for itself on the second query; the per-query retrieval costs the same every time. This is the "stable content early, mutable content late" rule from Ch 7, applied to RAG specifically.

---

## 14. Up-to-date facts (with citations)

### Anthropic contextual retrieval
- Published: September 2024
- URL: https://www.anthropic.com/research/contextual-retrieval (also at https://www.anthropic.com/news/contextual-retrieval)
- Key claim: prepending 50–100 token model-generated context to each chunk before embedding reduces retrieval failure rate by 35% (embeddings alone) to 67% (combined with BM25 and reranking).
- Benchmark baseline: 5.7% failure rate on a multi-domain retrieval benchmark.
- With contextual embeddings: 3.7% (−35%).
- With contextual embeddings + BM25: 2.9% (−49%).
- With contextual embeddings + BM25 + reranking: 1.9% (−67%).
- Recommended implementation: retrieve top 150 chunks (hybrid BM25 + embeddings), rerank to top 20, pass 20 chunks to the model.
- Note on costs: generating contextual blurbs requires one Claude API call per chunk. For a 10,000-chunk corpus, this is a significant indexing cost — but a one-time cost amortized across all future queries.

### Anthropic citations feature
- URL: https://platform.claude.com/docs/en/docs/build-with-claude/citations
- Status as of May 2026: available on all active models except Haiku 3.
- Three citation formats: character-span (plain text), page-number (PDF), block-index (custom content).
- `cited_text` field is provided in the response but does not count toward output tokens — cost-efficient for grounding.
- When `cited_text` is passed in subsequent conversation turns, it is also not counted toward input tokens.
- Compatible with prompt caching: apply `cache_control: { type: "ephemeral" }` to document content blocks. The document is cached; citations still reference it by position.
- Incompatible with Structured Outputs (`output_config.format` parameter). Cannot use both in the same request.
- Enabling citations incurs a slight increase in input tokens due to system prompt additions and document chunking overhead.
- For RAG specifically: custom content document type lets you pass your retrieval chunks as pre-defined blocks. The model cites specific blocks, not arbitrary character spans — matching exactly the granularity your chunking pipeline established.

### Anthropic's RAG for Projects
- URL: https://support.claude.com/en/articles/retrieval-augmented-generation-rag-for-projects
- Claude Projects automatically activates RAG when knowledge content approaches context window limits.
- Uses a "project knowledge search tool" — a built-in retrieval mechanism that retrieves relevant information per query rather than loading all documents.
- Enables storing up to 10x more content than traditional in-context loading.
- Users can reference specific documents by name in their messages to focus Claude's search.
- Transparent to users: RAG activation is automatic and does not require any user configuration.

### Embedding models (Anthropic's partner)
- Anthropic does not offer its own embedding model.
- Recommends Voyage AI. [https://platform.claude.com/docs/en/docs/build-with-claude/embeddings]
- Current generation (voyage-4, released January 2026 — [https://blog.voyageai.com/2026/01/15/voyage-4/]):
  - `voyage-4-large`: best general-purpose quality
  - `voyage-4`: balanced quality and efficiency
  - `voyage-4-lite`: optimized for latency and cost
  - `voyage-4-nano`: open-weight model, Apache 2.0 license, available on Hugging Face
- All voyage-4 models: 32,000 token context length, 1024-dimensional embeddings (adjustable to 256, 512, or 2048).
- Asymmetric retrieval: `input_type="query"` vs `input_type="document"` prepends task-specific prompts before embedding, improving retrieval quality. This is a concrete implementation of the asymmetric retrieval concept — query and document representations are tuned differently.
- Domain-specific models available: `voyage-code-3` for code retrieval, `voyage-finance-2` for finance, `voyage-law-2` for legal.
- Multimodal: `voyage-multimodal-3.5` supports interleaved text, images, and video.

### Voyage Rerank
- URL: https://blog.voyageai.com/2025/10/22/the-case-against-llms-as-rerankers/
- Voyage rerank-2 shows +11.86% accuracy improvement over vanilla embedding retrieval across 93 retrieval datasets spanning multiple domains.
- Voyage rerank-2-lite shows +13.89% improvement in the same benchmark.
- The Voyage blog post linked above argues specifically against using large LLMs as rerankers due to cost and latency, positioning dedicated cross-encoder rerankers as the practical optimum.

### Cohere Rerank
- Current generation: Cohere Rerank 4 Pro.
- +170 ELO improvement over Rerank v3.5 on general tasks; +400 ELO on business and finance tasks.
- URL: https://cohere.com/rerank
- Rerank 3 Nimble: a speed-optimized variant designed for production latency constraints while retaining high accuracy.

### Claude context window
- As of 2026: Claude supports up to 200,000 tokens context window.
- Anthropic API model overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Note for the chapter: avoid stating a specific token limit in prose — state it as "very large (currently 200K tokens)" and note that limits change. The qualitative argument (cost, latency, attention dilution) is more durable than a specific number.

### Prompt cache API limits
- Up to 4 cache breakpoints per request (as of 2026).
- Default TTL: 5 minutes. Extended TTL: 1 hour.
- Cache writes cost more than uncached input; cache reads cost much less.
- Source: Ch 7 (`src/pages/07-prompt-cache.mdx`) — these facts are confirmed in that chapter and are the authoritatively maintained source for this site.

### RAG leaderboard context (reranking)
- Zerank 2 leads the reranker leaderboard as of early 2026 with 1638 ELO (head-to-head matchups). Source: https://agentset.ai/rerankers
- Cohere Rerank v4.0 Pro: 1629 ELO.
- These leaderboard positions change frequently — do not state them as facts in the chapter; use them only as research context confirming that dedicated reranker APIs are a mature, competitive category.

---

## 15. Open questions for the chapter author

1. **Diagram priority: A or B?** Diagram A (request anatomy overlay, continuing Ch 7) is editorially stronger for this site because it directly extends the reader's existing mental model. But it may be too complex for an intro chapter. Diagram B (pipeline) is self-contained and clearer as a first exposure. Recommend A as the main diagram with B as a secondary figure, but this needs a judgment call on the chapter's cognitive load budget.

2. **Should the demo show the full prompt assembly?** Demo A (no-RAG vs. RAG toggle) shows that retrieval changes the answer. It does NOT show the assembled prompt. Showing the prompt assembly (system prompt + retrieved chunks + question) reinforces the Ch 7 connection directly, but adds a third panel to the demo. For an audience that just read Ch 7, showing the prompt structure is high-value. Worth the complexity.

3. **Contextual retrieval preprocessing: show the Claude call?** The contextual retrieval technique (§ 4.4) uses a Claude API call per chunk during indexing. This is a meaningful implementation detail but involves API code. The dossier caps code snippets at ~15 lines. A simple 10-line Python sketch of the preprocessing call would be within budget and would make the technique concrete. Recommend including it.

4. **How deeply to cover HyDE and multi-query?** These techniques (§ 5.3, § 5.4) are real but relatively niche. A single paragraph each with a clear honest verdict is probably right. Avoid implementing a demo for either — the concepts are clear without interaction.

5. **Chunk-size slider demo: how many chunk sizes?** Three discrete settings (too small / right / too large) is simpler to implement and reason about than a continuous slider. A continuous slider looks better but the underlying data needs to be pre-computed for every position. Recommend three discrete settings for v1.

6. **Should M-3 assume M-2 (ANN) has been read?** Per EXTENSIONS.md, M-2 is optional for M-3. The chapter should work without ANN internals. Use the phrase "a vector index finds the nearest chunks quickly" and link to M-2 as optional depth. The dossier is written on this assumption.

7. **Data file name collision risk:** `src/data/rag-corpus.ts` is a new file. Confirm the M-1 author's data file name (`src/data/vector-search.ts` per EXTENSIONS.md) before writing rag-corpus.ts to ensure no overlap in type names or exported symbols.

---

## Iteration log

**Iteration 1:** Full draft. All 15 sections populated. Web research completed (8 fetches: Anthropic contextual retrieval blog, citations docs, embeddings docs, support RAG-for-projects article, reranker landscape search, Anthropic RAG pattern search). Citations verified.

**Iteration 2:** Expanded sections 3 (added asymmetry discussion, debugging angle), 4 (added code chunking § 4.6, contextual retrieval code sketch), 5 (added metadata filtering § 5.5), 6 (added document block options § 6.5, token budget math § 6.6), 8 (added demo calibration § 8.7, deduplication § 8.8), 11 (added corpus design notes, fixture plan detail, tags field), 12 (added M-1/M-2 connections, additional line-level Ch 7 reference), 13 (added CacheCallout text, secondary closing angle), 14 (expanded all fact sections with additional detail).

**Reason stopped:** `done met` — line count 800+, all required sections complete, no meaningful improvement available without building the actual chapter.
