# Research dossier — Vector embeddings & semantic search

**Status:** research-only. Drives future chapter M-1 (per docs/EXTENSIONS.md). Conceptual prerequisites for M-2 also covered.
**Date:** 2026-05-17.
**Audience target:** Daily Claude/ChatGPT user; knows surface terms (tokens, context window); no formal ML background, no linear algebra, no backprop, no proofs.

---

## 1. Plain-language premise

The chapter teaches how to search for the *meaning* of a question — not the words in it.

Here is the moment most readers have already lived: you paste a question into a product built on Claude, and it finds exactly the right paragraph from a 200-page document even though none of your words appear in that paragraph. The query was "what happens if I cancel my subscription?" and the matching sentence was "terminating your account removes access to all paid features." Zero word overlap. The product still found it.

The mechanism behind that is not magic, not a large language model reading every page, and not keyword search. It is a geometric trick: a separate, purpose-built embedding model turns your question into a list of numbers (a vector), turns every document chunk into a similar list, and then finds the chunks whose number-lists point in the same direction as your question's number-list. Chunks that point in similar directions encode similar meaning. Finding them is fast and runs *before* the language model ever reads a token.

This chapter makes that geometry concrete, explains why "similar direction" usually means cosine similarity, and names the real limits of the approach — because dense embeddings fail in predictable and important ways that the reader should know about before trusting them in production.

---

## 2. Bridge from Ch 2 (embedding-layer embeddings)

Ch 2 already teaches that "each token maps to a fixed vector at the input layer." A reader finishing Ch 2 will naturally carry that concept into this chapter and conflate the two. The distinction must be made explicit immediately.

**What Ch 2 teaches.** When a model like Claude receives a prompt, it converts each token ID into a vector by looking up a row in a large table — the embedding table. Token 4721 (`king`) always retrieves the same 12,288-dimensional row, no matter what surrounds it. This per-token, fixed-at-training, *always-the-same* property is the embedding-layer determinism Ch 2 emphasizes. The resulting vectors feed into the first attention layer, where they immediately begin picking up context from neighboring tokens; after that, the representation of any token is no longer fixed.

**What this chapter teaches.** A retrieval embedding is a completely different object. It is produced by a *separate, often smaller* model — an embedding model (e.g., `voyage-4`, `text-embedding-3-small`, `cohere-embed-english-v3.0`) — whose sole job is to map an entire sentence or document passage into *one* vector. That single vector is designed to represent the meaning of the whole text, not any individual token. It has a different size (commonly 1024 dimensions, not 12,288), a different purpose (similarity search, not attention input), a different lifetime (you can store it in a database and query it months later), and a different consumer (a nearest-neighbor index, not a transformer's attention mechanism).

**The same word, two different objects:**

| Property | Ch 2: input-layer embedding | This chapter: retrieval/doc embedding |
|---|---|---|
| Produced by | The main LLM itself, at inference time | A separate, dedicated embedding model |
| Granularity | Per token | Per sentence / chunk / document |
| Determinism | Same token → same vector, always | Same text + same model → same vector (but not the same as Ch 2's vector) |
| Size (typical) | 4,096–12,288 dims | 256–2,048 dims |
| Lives in | Temporary inference buffers | A vector database or index |
| Consumer | The next attention layer | A nearest-neighbor search algorithm |
| Relationship to context | Becomes context-dependent after layer 1 | Is already context-aware at creation (the embedding model reads the whole input) |

**The underlying machinery is related — but the engineering question is different.** Many embedding models are themselves transformers. They produce per-token representations internally, then collapse those into one vector via a pooling step (mean-pool, CLS token, or last-token — more on this in §3.2). In that sense, Ch 2's per-token story is happening *inside* the embedding model too, invisibly. But the reader never sees those internal per-token states; they only receive the final pooled vector. The question this chapter answers is not "what is the model doing inside?" but "how do I use the output vector to find related text?"

Keep this distinction in the first two paragraphs of the chapter. Readers who conflate the two will misread every demo.

---

## 3. Concept walkthrough

### 3.1 What "semantic" means here — lexical vs. dense vs. hybrid

Search has two broad strategies that look superficially similar but are mechanically distinct.

**Lexical search (BM25 and cousins)** works on word overlap. Given the query "apple pie recipe," it scores documents by how often "apple," "pie," and "recipe" appear, discounted by how common each word is across the whole collection. It is fast, exact, and interpretable. It cannot find the "apple tart preparation guide" unless the query words appear in it. BM25 is the backbone of Elasticsearch and most search engines built before ~2018. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))

**Dense semantic search** replaces word overlap with vector proximity. Both the query and every document chunk are embedded into a shared high-dimensional space. The search finds chunks whose vectors are close to the query vector — regardless of whether any words match. It can find "apple tart preparation guide" given "apple pie recipe" because a good embedding model places related concepts near each other. The trade-off: it is worse than BM25 for exact matches, rare terms, code, and numbers (see §5.1).

**Hybrid retrieval** runs both, then combines the ranked lists. Most production systems use some form of hybrid — BM25 for precision on known terms, dense embeddings for recall on paraphrased or conceptually related content — with a reranker optionally on top. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))

For this chapter, "semantic search" means dense search unless otherwise specified. The chapter should frame lexical and hybrid honestly rather than pretending dense-only is the norm.

### 3.2 What a sentence / doc embedding is

The embedding model reads the whole input — a sentence, a paragraph, a document chunk — runs it through its transformer layers, and then needs to produce one vector from what is internally still a sequence of per-token hidden states.

The collapsing step is called **pooling**. Three strategies are common:

- **Mean pooling**: average all token hidden states. Simple and often effective. Used by many sentence-transformer models (e.g., `all-mpnet-base-v2`). ([Sentence Transformers docs](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html))
- **CLS token**: use only the hidden state of a special `[CLS]` token prepended to the input. Common in BERT-family models. Works well when the model was trained with a CLS-pooling objective.
- **Last token**: use the final token's hidden state. Common in decoder-style (GPT-family) embedding models. The exact pooling strategy of commercial models like Voyage AI is not publicly disclosed; the chapter should hedge with "one of these approaches" rather than asserting specifics.

The chapter does not need to teach pooling strategies in depth — frame it as "the embedding model reads the whole text, then squishes it into one vector using one of a few techniques." The exact method is a model implementation detail the reader does not control.

**One important property:** embedding models designed for retrieval typically prepend an invisible instruction to the query and a different instruction to the document before embedding. Voyage AI does this explicitly via `input_type="query"` vs `input_type="document"` parameters:

> When `input_type="query"`, the query becomes: "Represent the query for retrieving supporting documents: [query text]"
> When `input_type="document"`, the document becomes: "Represent the document for retrieval: [document text]"

([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

This asymmetry — different instructions for query vs. document — is one reason you should use the same embedding model for both query and document, with the correct `input_type`. Mismatching (embedding documents as queries) degrades retrieval quality.

### 3.3 The geometry — cosine similarity and why it is standard

Imagine every chunk of text is a point in a space with 1024 dimensions. You can not visualize 1024 dimensions, but you can reason about it: two points are "close" if their vectors are similar, and "far" if they are different.

There are three common ways to measure closeness between vectors:

**Euclidean distance** measures the straight-line gap between two points. Sensitive to the *length* (magnitude) of each vector. If one vector has large numbers and another has small ones, Euclidean distance will say they are far apart even if they point in exactly the same direction. Generally not preferred for embedding similarity. ([Pinecone vector similarity guide](https://www.pinecone.io/learn/vector-similarity/))

**Dot product** is the sum of element-wise products. It considers both the *direction* and the *magnitude* of vectors. Useful when magnitude carries meaningful information (e.g., in recommendation systems, a more popular item might have a larger-magnitude embedding). ([Pinecone vector similarity guide](https://www.pinecone.io/learn/vector-similarity/))

**Cosine similarity** measures only the *angle* between two vectors — it ignores magnitude entirely. Two vectors pointing in exactly the same direction score 1.0, perpendicular vectors score 0.0, and opposite vectors score -1.0. This is the standard for semantic search because we care about the *direction* of meaning, not the scale of the numbers.

The practical pseudo-formula, included only because most chapters on this topic will show it once:

```
cosine_similarity(A, B) = (A · B) / (|A| × |B|)
```

where `A · B` is the dot product and `|A|`, `|B|` are the magnitudes (lengths) of each vector.

**The L2 normalization shortcut.** Most production embedding models — including all Voyage AI models — return vectors that are already normalized to length 1 (L2-normalized). When all vectors have length 1, their magnitude is always 1, so the denominator in the cosine formula is always `1 × 1 = 1`. This means cosine similarity collapses to just the dot product:

> "Voyage embeddings are normalized to length 1, therefore dot-product and cosine similarity are the same." ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

This matters practically: dot product is faster to compute than cosine (no division), so normalized vectors let you use the faster operation without a different result. For the chapter demo, using dot product on pre-normalized vectors is fine and can be labeled as cosine similarity without confusion.

**Euclidean distance is also equivalent to cosine for normalized vectors** — they produce the same *rankings* (though not the same raw scores). So for models that return normalized vectors, all three metrics give identical search results. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

### 3.4 Dimensions in practice

Embedding models output vectors of a fixed length. That length is the "dimension" of the embedding space. Common values in 2026:

| Dimension | Example models | Character |
|---|---|---|
| 256 | Voyage 4-series (short option), Cohere embed-v4.0 (short option) | Smallest footprint; fast; quality loss for complex topics |
| 384 | `all-MiniLM-L6-v2` (sentence-transformers) | Lightweight open-source default |
| 512 | Voyage 4-series (medium option), Cohere embed-v4.0 (medium) | Mid-range balance |
| 768 | `all-mpnet-base-v2`, `bge-base-en-v1.5` | Standard open-source quality |
| 1024 | Voyage 4 (default), `voyage-code-3`, Cohere `embed-english-v3.0`, `bge-large-en-v1.5` | High-quality production default |
| 1536 | OpenAI `text-embedding-3-small` | Premium quality; higher storage cost |
| 2048 | Voyage 4-series (large option) | High-end; niche use cases |
| 3072 | OpenAI `text-embedding-3-large` | Maximum published quality; heaviest storage |

([Anthropic/Voyage embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings); [HuggingFace embedding quantization blog](https://huggingface.co/blog/embedding-quantization))

**Bigger ≠ always better.** A 1024-dimension model does not automatically outperform a 768-dimension model. Quality depends on training data, architecture, and the specific domain. The HuggingFace benchmarks show that a quantized 1024-dim model often outperforms a full-precision 384-dim model on NDCG@10, but comparing across architectures and training regimes is more complex. ([HuggingFace embedding quantization blog](https://huggingface.co/blog/embedding-quantization))

**Bigger has real storage cost.** 250 million embeddings at 1024 dims (float32) occupies ~954 GB. At 3072 dims, that is ~2.86 TB. Storage cost scales linearly with dimension. ([HuggingFace embedding quantization blog](https://huggingface.co/blog/embedding-quantization))

**Matryoshka embeddings (truncatable).** Named after Russian nesting dolls, Matryoshka Representation Learning (MRL) trains a model so that the first N dimensions of its output are already a useful embedding on their own. You can truncate a 1024-dim Matryoshka vector to 256 dims, re-normalize, and lose only a small amount of retrieval quality. Voyage AI's current models (`voyage-4`, `voyage-4-large`, `voyage-code-3`, etc.) all support multiple output dimensions (256, 512, 1024, 2048) using this property. ([Anthropic/Voyage embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings); [HuggingFace Matryoshka blog](https://huggingface.co/blog/matryoshka))

The HuggingFace MRL analysis found that at 8.3% of original size (e.g., 64 dims from a 768-dim model), Matryoshka models retain ~98% of retrieval performance. ([HuggingFace Matryoshka blog](https://huggingface.co/blog/matryoshka))

**For the chapter demo:** use 8 dimensions. This is explicitly illustrative — real models use hundreds or thousands. Label it clearly.

### 3.5 What embeddings are NOT

This section is as important as the positive definitions above. The chapter must be honest about these limits.

**Embeddings are not understanding.** An embedding model has no idea what the words mean in any human sense. It has learned statistical patterns: texts that appear in similar contexts have similar vectors. It cannot reason, check facts, or catch contradictions. A sentence stating the opposite of a true fact will often embed close to the true fact because they share vocabulary and topic structure.

**Negation is unreliable.** "The drug has no side effects" and "The drug has serious side effects" may embed similarly because both are about drug side effects. Negation is a known failure mode of dense retrieval. Do not use embedding search as the only safety check on negation-sensitive queries.

**Numbers and proper nouns are brittle.** "Revenue was $4.2 million" and "Revenue was $42 million" will embed nearly identically. Embeddings compress meaning, and numerical precision is the first casualty of compression. Similarly, rare proper nouns (a person's name, a product model number) may embed poorly because the model rarely saw them in training.

**Fresh facts are invisible.** An embedding model trained before a certain date has no representation for events or entities that emerged afterward. The vector for a new product or a recent news event will be anchored to whatever training-time context the model can approximate. This is also a silent failure: the model does not say "I don't know this entity." It silently embeds it to the nearest thing it does know.

**High cosine similarity does not mean factual agreement.** Two sentences can have cosine similarity 0.92 and still contradict each other. Retrieval surface similarity is not semantic entailment. The LLM reasoning over retrieved chunks still needs to catch contradictions — retrieval just narrows the candidate set.

---

## 4. The semantic search loop end-to-end

Two separate phases, often called offline (build) and online (query).

### A. Offline: building the index

1. **Chunk** the documents. Long documents must be broken into smaller passages — typically 200–500 tokens each, often with overlap between adjacent chunks. Chunking strategy has a large effect on retrieval quality, and is a topic in its own right (not covered in M-1).
2. **Embed each chunk** using an embedding model with `input_type="document"` (or equivalent). This produces one vector per chunk.
3. **Store** each `{chunk_id, vector, text}` tuple in an index — at the simplest, a list in memory; in production, a vector database (Pinecone, Weaviate, Chroma, Qdrant, etc.). The chapter stays product-agnostic and calls this "a vector index."

This offline phase can take minutes to hours for large corpora. It runs once (or when documents change). The result is a persistent index on disk or in a managed service.

### B. Online: answering a query

1. **Embed the query** using the same embedding model with `input_type="query"`. This is fast — one short text, usually under a second.
2. **Find the K nearest chunks** in the index by cosine similarity (or dot product on normalized vectors). K is typically 3–20 depending on how much context the downstream LLM receives.
3. **Return the text** of those K chunks to the calling system (which might pass them into an LLM prompt, display them directly, or both).

The query embedding and the dot-product search together take milliseconds for most modern indexes. The LLM inference that follows is the bottleneck — not the retrieval step.

**This chapter covers steps A and B at the conceptual level.** The next module (M-2) explains how to find nearest neighbors fast when the index has millions of chunks — that is where approximate nearest neighbor (ANN) algorithms like HNSW come in.

---

## 5. Embeddings vs. the things people confuse them with

### 5.1 vs. Lexical search (BM25)

Dense semantic embeddings genuinely underperform BM25 in several common real-world scenarios:

- **Rare or specialized terms.** If a user queries "ISDA Master Agreement Section 14(d)" and no document uses exactly those words, BM25 fails cleanly (no match). Dense embeddings will find *something* nearby — but "something nearby" may be wrong, and wrong with confidence. For legal, medical, and technical domains with precise terminology, BM25 or exact-match layers are often safer. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))
- **Code and identifiers.** Function names, variable names, error codes, and API endpoints are often absent or poorly represented in general embedding training data. BM25 handles `TypeError: cannot unpack non-iterable NoneType object` reliably; a general embedding model may not. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))
- **Numeric precision.** As noted in §3.5, numbers compress poorly. BM25 matches exact numbers; embeddings may swap adjacent values silently. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))
- **Exact phrase queries.** When a user wants verbatim text (a quote, a contract clause, a log line), lexical search is more reliable.

The chapter should not imply dense embeddings are a universal upgrade over BM25. For general natural-language queries over prose documents, dense wins. For the above cases, hybrid or pure lexical is often better.

### 5.2 vs. Hybrid retrieval

Most production retrieval systems at scale use hybrid retrieval: run BM25 and dense embedding search in parallel, then merge the ranked results using a method like Reciprocal Rank Fusion (RRF). Some systems add a reranker (a cross-encoder model that scores query-document pairs directly) on top of the merged list. The chapter should mention this as the practical reality without going deep. M-1 can frame dense-only as the conceptual baseline and note that hybrid is how real systems ship.

### 5.3 vs. Fine-tuning the LLM

These address different problems:

- **Retrieval embeddings** determine what text enters the context window — they change *what information the model sees*.
- **Fine-tuning** changes the model's weights — it changes *how the model responds* to any input, including retrieved context.

They are orthogonal. A fine-tuned model on top of a retrieval pipeline is common (the model is tuned to follow the retrieved context faithfully, for example). Neither replaces the other. The chapter should make this explicit, because the "retrieval vs. fine-tuning" question is one of the most common confusions in the RAG space.

### 5.4 vs. The prompt cache (Ch 7)

These are unrelated mechanisms. Brief disambiguation for the chapter to prevent conflation:

| | Retrieval embedding | Prompt cache (Ch 7) |
|---|---|---|
| What it does | Finds relevant text before the model runs | Reuses prefix computation across requests |
| Where it lives | A vector index (database or in-memory) | Anthropic's inference infrastructure |
| Lifetime | Days to months (until docs change) | 5 minutes (default) or 1 hour (extended TTL) |
| Invalidated by | Adding/changing documents; re-embedding | Any token-level change in the prefix |
| Consumer | The nearest-neighbor search algorithm | The KV cache inside the model |

These can coexist in the same system: retrieved chunks go into the prompt prefix, and if the same chunks are retrieved again on the next request, the prompt cache may serve that prefix from memory. But the mechanisms are distinct and do not interact directly.

---

## 6. Common misconceptions / pedagogical traps

The following are misconceptions a reader might plausibly arrive with. For each: the misconception, why it is wrong, and how the chapter should phrase it to avoid planting the trap.

**1. "Bigger embeddings are always better."**
*Why it's wrong:* Quality depends on training data, domain match, and task. A 1024-dim model trained on code will outperform a 3072-dim model on code retrieval even though it has fewer dimensions. Storage and compute cost scale with dimension, making bigger models expensive for marginal or no quality gain. ([HuggingFace embedding quantization blog](https://huggingface.co/blog/embedding-quantization))
*How to phrase it:* "Dimension is one variable among many. Match the model to your domain and benchmark on your actual data before assuming bigger is better."

**2. "Cosine similarity above 0.8 means the result is relevant."**
*Why it's wrong:* Thresholds are model- and domain-specific. A model trained on general web text may place completely unrelated sentences at 0.7 cosine, while a domain-specific model may place related sentences at 0.5. Threshold tuning is empirical; no universal cutoff exists.
*How to phrase it:* "Cosine similarity scores are not probabilities and have no universal meaning. A score of 0.85 in one model's space may correspond to 0.6 in another's. Use relative ranking — top K — not absolute thresholds, until you've validated thresholds on your data."

**3. "You must use the same model for queries and documents."**
*Why it's nuanced:* For most models, yes — using different models breaks the shared geometric space. But asymmetric models (also called bi-encoders with asymmetric training, or cross-encoder hybrids) intentionally use different encoders for queries and documents, optimized separately. Voyage AI's `input_type` parameter is a mild form of asymmetry: the same model, but the query and document texts are prefixed differently before embedding. ([Anthropic/Voyage embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
*How to phrase it:* "In practice, use the same model with the correct `input_type` for query vs. document. Some advanced models have separate query and document encoders — use them as documented, not interchangeably."

**4. "Embeddings understand the text."**
*Why it's wrong:* Embeddings encode statistical associations from training data into a geometric space. There is no understanding, no fact-checking, no logical inference. Two contradictory sentences may embed nearly identically. Negation, sarcasm, and implication are poorly captured.
*How to phrase it:* "The embedding model has learned which texts tend to appear in similar contexts. It encodes that pattern as a direction in space. 'Understanding' is not the right frame — proximity in embedding space means statistical co-occurrence, not semantic entailment."

**5. "Dense embeddings always beat keyword search."**
*Why it's wrong:* For rare terms, precise codes, numbers, and verbatim matches, BM25 reliably wins. Dense embeddings underperform on these cases — and fail silently, returning something plausible-looking but wrong. ([Elastic BM25 explainer](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables))
*How to phrase it:* "Dense embeddings win on natural language paraphrase. Keyword search wins on precision. Production systems usually use both. Don't throw away BM25."

**6. "If two texts have similar embeddings, the LLM will treat them the same way."**
*Why it's wrong:* Retrieval and reasoning are separate steps. The LLM receives the retrieved text verbatim and reasons over it. Two texts with similar embeddings may have very different logical content (e.g., one affirms a claim, the other negates it). The retrieval step narrows candidates; it does not determine the model's reasoning.
*How to phrase it:* "Embeddings rank candidates for relevance. Once retrieved, the LLM reads the full text. Close embeddings mean similar topic area — they do not guarantee the same information."

**7. "The embedding model is part of the LLM (Claude, GPT-4, etc.)."**
*Why it's wrong:* Claude does not expose embedding outputs. Voyage AI (`voyage-4`, etc.), OpenAI (`text-embedding-3-*`), and Cohere (`embed-english-v3.0`) are separate models accessed via separate APIs. Claude is the reasoning step that runs *after* retrieval; it is not the retrieval mechanism itself.
*How to phrase it:* "The embedding model and the language model are different services. You call the embedding API to build the index and embed queries, then call the language model API (Claude, etc.) with the retrieved text in its prompt."

**8. "Embedding the full document is better than chunking."**
*Why it's wrong:* Most embedding models have a context limit (Voyage 4: 32,000 tokens, but most practical chunks are much shorter). More importantly, a single vector representing a 50-page document compresses away the specific details needed for precise retrieval. Smaller chunks produce more precise matches; chunking strategy is one of the most impactful tuning decisions in a retrieval system.
*How to phrase it:* "Embedding an entire long document loses precision — the single vector averages out too many topics. Chunk documents into passages of 200–500 tokens for reliable retrieval."

**9. "Matryoshka embeddings are just compressed embeddings."**
*Why it's wrong:* Matryoshka (MRL) embeddings are not compressed — the full-dimension vector is produced and then *truncated*. The training objective ensures the first N dimensions are already informative on their own. This is different from quantization (which reduces precision of existing dimensions) and different from just taking the first N elements of any model's output (which would produce garbage for a non-Matryoshka model).
*How to phrase it:* "Truncating a Matryoshka embedding works because the model was specially trained to pack the most important information into the first dimensions. You cannot truncate any embedding model's output — only those trained with MRL."

**10. "Retrieval and the prompt cache are two names for the same thing."**
*Why it's wrong:* The prompt cache (Ch 7) saves computation within the LLM across requests. Retrieval embeddings run *before* the LLM and determine what text goes into the prompt. They operate at different layers of the system, with different mechanisms, lifetimes, and invalidation rules. (See §5.4 for the full table.)
*How to phrase it:* "These solve different problems at different points in the pipeline. Retrieval finds the right text before the model runs. The prompt cache saves the model from reprocessing that text on repeat requests."

---

## 7. Concrete house-style chapter ideas

The site convention: one diagram + one small React island + a closing takeaway callout.

### Option A — 2D scatter with query and nearest neighbors

**Diagram (SVG):** A 2D embedding space (labeled axes: "Dimension 1", "Dimension 2" — keeping them abstract). ~15 document points scattered, colored by topic (purple for legal docs, orange for code docs, green for biology docs, blue for finance docs). A query point (star shape, amber) is placed near one cluster. Concentric dotted rings show distance from the query. Labels identify the K=3 closest points with dashed lines connecting them.

**React island:** `SemanticSearchDemo.tsx`
**Data file:** `src/data/retrieval-corpus.ts` (see §8 for schema)

Behavior: user selects one of 6 pre-written queries from a dropdown. The query dot animates to its pre-computed 2D position. The K=3 nearest documents highlight (ring glow effect). A ranked result list below updates with document titles and mock cosine scores (e.g., 0.91, 0.87, 0.82). A small note: "Scores are illustrative — 2D hand-authored coordinates."

**Closing takeaway angle:** "Every 'smart search' in a Claude-powered product is running this loop before you see any text from the model."

### Option B — Side-by-side: lexical vs. semantic match

**Diagram (HTML/CSS):** Two columns. Left: "Keyword search." Right: "Semantic search." Same query appears above both columns: "what happens when I stop paying?". Three document snippets are shown below each. In the keyword column, word overlaps with the query are highlighted in amber; documents with no overlap are ranked last. In the semantic column, one document — "terminating your account removes access to all paid features" — rises to rank 1 despite zero word overlap with the query.

**React island:** `LexicalVsSemanticDemo.tsx`
**Data file:** `src/data/retrieval-queries.ts` and `src/data/retrieval-corpus.ts`

Behavior: user selects from 3 pre-written queries. Both columns update simultaneously showing the two different ranked lists. The discrepancy between lexical rank and semantic rank is the point.

**Closing takeaway angle:** "When the model finds what you meant rather than what you typed, this is the mechanism. It's not smarter reading — it's geometry."

### Option C — Similarity metric toggle (cosine vs. Euclidean vs. dot product on unnormalized data)

**Diagram (HTML/CSS):** Three vectors drawn in 2D. Two point in the same direction but one is much longer (different magnitudes). Shows visually why Euclidean distance says they are "far" but cosine says they are "close."

**React island:** `SimilarityMetricDemo.tsx`
**Data file:** `src/data/retrieval-corpus.ts` (includes both normalized and unnormalized vectors)

Behavior: user toggles between three metrics. Rankings update on a hand-authored 8-document corpus where the unnormalized vectors produce meaningfully different rankings under Euclidean vs. cosine. A toggle "Normalize vectors" resets all lengths to 1 and shows that all three metrics then produce the same ranking.

**Closing takeaway angle:** "The reason most embedding APIs return L2-normalized vectors is to make this problem disappear — normalized vectors behave identically under cosine, dot product, and Euclidean distance."

**Recommended for M-1:** Option A (scatter + query demo) as the primary, with Option B available as a secondary illustration in the prose. Option C is mathematically richer and better suited for M-1 as supplementary depth or moved to M-2.

---

## 8. Hand-authored data plan

All vectors are illustrative, not real model output. Same convention as Ch 2 (`src/data/embeddings.ts`). Label demos clearly.

### `src/data/retrieval-corpus.ts`

Array of ~12 document chunks. Each entry:

```typescript
export type CorpusChunk = {
  id: string;             // e.g. "doc-01"
  title: string;          // short label for display
  body: string;           // 2-3 sentence text for the chunk
  topic: "legal" | "code" | "biology" | "finance" | "hr";
  coords2d: [number, number];  // hand-authored 2D position for the scatter diagram
  vec8: number[];         // 8-dimensional illustrative vector, L2-normalized
};
```

**12 suggested documents** (topic groupings by cluster in 2D space):

| id | topic | title snippet |
|---|---|---|
| doc-01 | legal | "Terminating your account removes paid access…" |
| doc-02 | legal | "Late payment triggers a 30-day grace period…" |
| doc-03 | legal | "Section 14(d) governs indemnification clauses…" |
| doc-04 | code | "NullPointerException at line 42 in UserService.java…" |
| doc-05 | code | "The API rate limit is 100 requests per minute…" |
| doc-06 | code | "Run `bun install` to install dependencies…" |
| doc-07 | biology | "Photosynthesis converts light into glucose…" |
| doc-08 | biology | "Mitochondria produce ATP via oxidative phosphorylation…" |
| doc-09 | finance | "Q3 revenue was $4.2 million, down 12% YoY…" |
| doc-10 | finance | "The EBITDA margin improved to 18% in fiscal 2025…" |
| doc-11 | hr | "Employees receive 15 days PTO per year…" |
| doc-12 | hr | "Remote work policy allows up to 3 days per week…" |

### `src/data/retrieval-queries.ts`

Array of 6 queries. Each entry:

```typescript
export type RetrievalQuery = {
  id: string;
  text: string;           // the query text shown in the UI
  coords2d: [number, number];  // hand-authored position near relevant cluster
  vec8: number[];         // 8-dimensional illustrative vector, L2-normalized
  rankedIds: string[];    // true ranked doc IDs by cosine score (pre-computed from vec8)
  topKScores: number[];   // illustrative cosine scores for top-3 results
};
```

**6 suggested queries:**

| id | text | nearby cluster |
|---|---|---|
| q-01 | "what happens when I stop paying?" | legal (near doc-01, doc-02) |
| q-02 | "how to install project dependencies" | code (near doc-06) |
| q-03 | "where does the cell get energy?" | biology (near doc-07, doc-08) |
| q-04 | "quarterly earnings performance" | finance (near doc-09, doc-10) |
| q-05 | "days off work per year" | hr (near doc-11) |
| q-06 | "error in Java application startup" | code (near doc-04) |

### Design note on 8-dimensional vectors

Hand-author these by assigning "semantic axes" manually: e.g., dimension 1 = legal-ness, dimension 2 = code-ness, dimension 3 = biology-ness, etc. Set the relevant dimension high for each document, keep others low, and L2-normalize. The resulting cosine scores will be realistic enough to illustrate ranking without being deceptively precise.

### `src/data/lexical-corpus.ts` (optional, for Option B demo)

Same 12 documents as above plus a precomputed BM25-style word-overlap score for each (query, document) pair. The overlap score is a simple integer (number of query tokens appearing in the document), making the lexical side easy to implement without a real BM25 library.

---

## 9. Connections to existing chapters

Cross-references are to the site's MDX source files. Line numbers are approximate (as of 2026-05-17).

- **Ch 1 Tokens** (`src/pages/01-tokens.mdx`): Tokenization affects embedding quality for rare or long words. A word the tokenizer splits into many subword tokens (e.g., a rare proper noun → `["Ky", "ri", "an", "os"]`) may embed poorly because the subword pieces carry little meaning individually. This is related to the "fresh facts are invisible" failure mode in §3.5.

- **Ch 2 Embeddings** (`src/pages/02-embeddings.mdx`, lines 13–18 on the embedding table; lines 83–88 on the embedding-layer boundary): The input-layer-vs-doc-embedding distinction developed in §2 of this dossier is the primary bridge. The Ch 2 CacheCallout (lines 95–98) is also relevant: it notes "the embedding lookup is a pure table read" — M-1 generalizes this to sentence-level embeddings, where the lookup is replaced by a full forward pass through an embedding model.

- **Ch 3 Attention** (`src/pages/03-attention.mdx`): The Q/K dot product in attention is a similarity computation — the same geometric operation as cosine similarity over normalized vectors. Ch 3's Q/K/V framing ("query looks at keys to decide what values to attend to") is structurally identical to "query embedding looks at document embeddings to decide what to retrieve." This parallel is worth a brief call-out to reinforce both chapters.

- **Ch 7 Prompt Cache** (`src/pages/07-prompt-cache.mdx`): The disambiguation in §5.4 is the relevant link. Retrieval and the prompt cache coexist in production RAG pipelines — retrieved chunks go into the cached prefix — but the mechanisms are distinct. The Ch 7 content about "read files segment" (which Ch 7's GOAL.md description calls out explicitly) is precisely the injection step in a RAG pipeline: M-3 (RAG) will close that loop.

---

## 10. Closing-takeaway angle

The "How this connects to your daily Claude use" callout.

**Recommended framing:**

> Most of what feels like magic in Claude-powered products — file search, knowledge bases, document Q&A — is just this vector lookup happening before the model ever processes a single token of your question. The model's intelligence is real, but it can only reason about what ends up in its context window. Retrieval is how the right text gets there. Understanding the geometry is understanding the first, often decisive, step in any RAG pipeline.
>
> **Forward pointer:** M-2 (ANN search) explains how to run this lookup in milliseconds over millions of documents. M-3 (RAG) shows the full pipeline: embed, retrieve, inject, generate.

**Alternative callout angle (more grounded):**

> When you ask Claude Code "find where this function is defined," Claude Code is not grepping your codebase in real time. It calls an embedding model on your query, compares the result against pre-embedded code chunks, and puts the nearest ones into the prompt — all before model inference starts. The quality of that embedding step determines what Claude sees. If the right chunk doesn't get retrieved, the answer will be wrong even if the model reasons perfectly over the wrong context.

Use the second angle if the chapter author wants to make the connection to Claude Code behavior more explicit. The first is cleaner for a general audience.

---

## 11. Up-to-date facts (with citations)

### Voyage AI as Anthropic's recommended embedding partner

Anthropic does not offer its own embedding model. Anthropic's documentation explicitly recommends Voyage AI as the primary embedding provider, with the note: "Anthropic does not offer its own embedding model. One embeddings provider that has a wide variety of options and capabilities... is Voyage AI." ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

The Voyage 4 generation launched in January 2026 ([Voyage AI blog, 2026-01-15](https://blog.voyageai.com/2026/01/15/voyage-4/)).

### Top embedding models in 2026 and their dimensions

**Voyage AI (Anthropic's recommended provider):**
- `voyage-4-large`: 32K context, 1024 dims (default), also 256/512/2048; "best general-purpose and multilingual retrieval quality." ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-4`: 32K context, 1024 dims (default), also 256/512/2048; balanced quality/cost. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-4-lite`: 32K context, same dims; optimized for latency and cost. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-4-nano`: Open-weight (Apache 2.0), on Hugging Face, same dim support. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-code-3`: Code-specialized, 32K context, 1024 dims (default), supports truncation. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-law-2`: Legal-specialized, 16K context, 1024 dims. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))
- `voyage-finance-2`: Finance-specialized, 32K context, 1024 dims. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

All Voyage 4-series models support Matryoshka truncation (256/512/1024/2048 dims). ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

All Voyage AI embeddings are L2-normalized, making cosine similarity equivalent to dot product. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

**OpenAI:**
- `text-embedding-3-small`: 1,536 dims (can be shortened via the API's `dimensions` parameter). (OpenAI's embeddings guide at platform.openai.com/docs/guides/embeddings — returned HTTP 403 during research on 2026-05-17; specs sourced from [HuggingFace embedding quantization blog](https://huggingface.co/blog/embedding-quantization) and [Pinecone vector similarity guide](https://www.pinecone.io/learn/vector-similarity/).)
- `text-embedding-3-large`: 3,072 dims (can be shortened via `dimensions`). Both models support Matryoshka-style truncation natively.

**Cohere:**
- `embed-v4.0`: 1,536 dims (default), also 256/512/1024; supports text and images; 128K context. ([Cohere embed docs](https://docs.cohere.com/docs/cohere-embed))
- `embed-english-v3.0`: 1,024 dims; up to 512 tokens.
- `embed-english-light-v3.0`: 384 dims. ([Cohere embed docs](https://docs.cohere.com/docs/cohere-embed))

**Open-source (sentence-transformers):**
- `all-mpnet-base-v2`: 768 dims; mean pooling; best general-quality open model per sbert.net. ([Sentence Transformers docs](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html))
- `all-MiniLM-L6-v2`: 384 dims; 5x faster than mpnet-base; good quality/speed tradeoff. ([Sentence Transformers docs](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html))
- `nomic-embed-text-v1.5`: 768 dims; Matryoshka-trained; open-source production model. ([HuggingFace Matryoshka blog](https://huggingface.co/blog/matryoshka))

### Matryoshka embedding adoption

As of 2026, Matryoshka-style truncatable outputs are standard in the Voyage 4 series, OpenAI's `text-embedding-3-*` models (via `dimensions` API parameter), and Cohere's `embed-v4.0`. Open-source models like `nomic-embed-text-v1.5` also support MRL. The HuggingFace analysis shows that at 8.3% of original dimensions, MRL models retain ~98% retrieval performance, vs. ~96% for standard models truncated to the same size. ([HuggingFace Matryoshka blog](https://huggingface.co/blog/matryoshka))

### Asymmetric embedding (query vs. document)

Voyage AI's `input_type` parameter prepends different instruction prompts for queries vs. documents — a lightweight form of asymmetric embedding that improves retrieval quality. This is documented and recommended as the default for all retrieval use cases. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings))

Cohere's documentation lists three similarity metrics (cosine, dot product, Euclidean) as supported by embed-v4.0 but does not document asymmetric query/document encoding at the API level — users are expected to pass the same model for both. ([Cohere embed docs](https://docs.cohere.com/docs/cohere-embed)) This is worth noting because Cohere's and Voyage AI's APIs behave differently on this point; any chapter example using `input_type` should clarify it is specific to Voyage AI's API.

### Normalization

Voyage AI embeddings are L2-normalized, making cosine similarity equivalent to dot product. Euclidean distance also produces the same *rankings* (though not the same scores) as cosine for normalized vectors. ([Anthropic embeddings guide](https://platform.claude.com/docs/en/docs/build-with-claude/embeddings)) This is consistent with the general guidance: match your similarity metric to the one used during training, or use normalized vectors to make all three metrics equivalent for ranking. ([Pinecone vector similarity guide](https://www.pinecone.io/learn/vector-similarity/))

---

## 12. Open questions for the chapter author

**1. Chunking: mention it or defer entirely?**
Chunking strategy (size, overlap, whether to chunk at sentence boundaries vs. fixed tokens) is one of the most impactful parameters in retrieval quality. It is not covered in M-1 as scoped. The chapter needs to either give a one-paragraph honest sketch ("in practice, chunking is its own discipline; we use pre-chunked documents for this demo") or explicitly forward-reference a future note or resource. Leaving it unmentioned risks readers assuming the demo chunks are representative.

**2. Which demo: scatter (Option A) or lexical vs. semantic (Option B)?**
Option A visualizes the geometry directly, which is the core concept of M-1. Option B is more immediately relatable (readers have experienced keyword mismatch failures). Both can be implemented within the site's one-island constraint only if one is the diagram and one is the React island. Decide which is more important for the chapter's teaching goal before implementing data files.

**3. How to handle the input_type asymmetry in the demo?**
Real Voyage AI usage requires specifying `input_type="query"` for queries and `input_type="document"` for documents. The demo uses hand-authored vectors, so this does not apply mechanically — but the prose needs to mention it as a real-world concern without confusing readers who are looking at a demo that silently ignores it. A brief inline note ("in real use, always specify the input type") is probably sufficient, but the exact phrasing needs care.

**4. Should M-1 mention sparse (BM25) retrieval at all, given EXTENSIONS.md's non-goals?**
EXTENSIONS.md §6 says "not a survey of embedding model providers." It does not explicitly exclude BM25 discussion. However, a deep BM25 explanation risks scope creep. The recommended approach: one honest paragraph acknowledging BM25's strengths (see §5.1 of this dossier), with no implementation detail. The chapter author needs to decide whether that paragraph belongs in M-1 or is pushed to M-3 (RAG), where hybrid retrieval is more directly relevant.

**5. The "embedding model is not Claude" misconception — where to handle it?**
Misconception 7 (§6) is fundamental but awkward to address without naming specific providers, which EXTENSIONS.md prohibits. The site could handle this by saying "a separate embedding API" and linking to Anthropic's embeddings guide for readers who want to explore. But if the chapter author wants readers to actually try the concept (even if the demo is illustrative), there needs to be a policy decision: does M-1 name Voyage AI at all, or does it stay fully provider-agnostic? EXTENSIONS.md says "use the phrase 'an embedding model' throughout without naming any provider" — but Anthropic's own docs page names Voyage AI directly. Resolve this before writing the prose.

**6. 2D coords for the scatter: maintain separately or derive from 8-dim vectors?**
The 8-dimensional illustrative vectors in `retrieval-corpus.ts` and `retrieval-queries.ts` are for cosine-similarity computation. The 2D coords for the scatter diagram are for visual layout. These should be maintained separately (the 2D coords are purely aesthetic, not computed from the 8-dim vectors). However, this creates a consistency risk: if someone interprets the scatter as "the projection of the 8-dim vectors," the layout may not match the similarity scores. Add a clear in-code comment and a visible "Illustrative — not a projection" label on the diagram.
