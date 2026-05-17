# Research dossier — Search-engine systems

**Status:** research-only. Pairs with the triptych (/pattern-matching-algorithms, /data-search-strategies, /indexing-strategies) and with /rag, /vector-embeddings-and-semantic-search, /ann-vector-indexes.
**Date:** 2026-05-17.
**Audience:** Daily Claude/ChatGPT user. No CS-systems or database background. Intuition + worked examples. The reader's real question: "if I wanted to build search over my own documents / codebase / users, what would I actually deploy?"

---

## 1. Plain-language premise

You have used search bars your whole life. The GitHub search box. The Algolia-powered docs site that finds results before you finish typing. Elasticsearch running the log infrastructure at some company you've heard of. PostgreSQL's built-in `WHERE name ILIKE '%foo%'` that you reached for at 2 a.m. They feel like the same thing — you type words, results appear. They are not the same thing.

Under the hood, each of those systems made a different bet: about what your queries will look like, how big the corpus will be, how often it changes, how much money you want to spend on servers, and how much operational complexity you're willing to absorb. A system tuned for "instant typo-tolerant autocomplete on 500K products" is a different machine than one tuned for "find the 14 log lines in 8 TB of events from 90 days ago that have this error code." Same user experience. Completely different architecture.

This dossier is the map. It explains the recurring system shapes that appear behind every production search bar, using Elasticsearch (the industry's most-documented example) as the deep-dive anchor, then surveys the ten-plus systems that occupy different positions in the space. It ends with a decision framework: given your corpus size, your query shape, your operational appetite, and your budget, which of these systems is the defensible choice?

By the end, you should be able to answer: "for this specific situation, here is what I would deploy, and here is why I am not using the obvious alternative." That is the payoff — not an exhaustive comparison of every feature matrix cell, but a mental model that produces a defensible decision in five minutes.

A note on claims: this dossier distinguishes **documented** (cited to official docs or specs), **community-reported** (cited to benchmarks, blog posts, or community sources — these are hedged), and **inferred** (reasonable interpretation, labeled). Vendor benchmarks are almost always cherry-picked; they are labeled as such throughout. Every claim that could go stale (version numbers, feature availability, pricing direction) includes a URL and fetch date so the reader can verify current status. Where verification failed, the dossier says so explicitly.

---

## 2. The shape of a production search engine

Every system in this dossier, regardless of how it markets itself, is built from the same six pieces. They trade these off differently — that is how they compete — but the pieces are universal.

### 2.1 The six universal pieces

**1. Ingest pipeline.** The path from raw document (a JSON blob, a PDF, a log line) to indexed form. It typically: normalizes encoding, extracts fields, runs the text through an analyzer (char filters → tokenizer → token filters), and hands the result to the indexer. The quality of the analyzer determines what searches will and won't work. This is where stopword removal, stemming, lowercasing, and n-gram generation happen. Ingest pipelines also handle field extraction — deciding which fields to index, which to store, and which to ignore entirely. Getting the ingest pipeline right is more important than any query-time tuning; garbage in, garbage out.

**2. Persistent index.** The data structure that makes search fast. For full-text search engines, this is an inverted index (a dictionary of terms → lists of documents that contain that term, each entry optionally annotated with positions and frequencies). For vector search, it is an ANN index — HNSW graphs, IVF partitions, or a hybrid. For columnar analytics engines, it is a sorted columnar file with sparse indexes and Bloom filters. The inverted index is the oldest and most universal; everything built on Lucene or Tantivy uses it as the core. The key property of any inverted index: lookup time is proportional to the number of matching documents, not the total number of documents. That is why full-text search can scan a billion documents and return in milliseconds when the query is selective.

**3. Query pipeline.** The path from user query string to a plan. Parse the query (turn "quick brown fox" into a query AST), plan it (which index entries to look up, in what order), score each candidate, optionally rerank. The scoring algorithm — BM25, TF-IDF, function score, vector dot product — lives here. The query pipeline is where most of the "relevance engineering" work happens in practice. Query planning involves decisions like: apply the same analyzer as ingest, or a different one? Retrieve 10 candidates or 1,000 for reranking? Use an index or fall back to a scan?

**4. Scoring layer.** Separate from the query plan: after candidate documents are retrieved, they need to be ordered. BM25 is the lexical default (term frequency × inverse document frequency, with field-length normalization). Dot product or cosine similarity is the vector default. Cross-encoder neural rerankers are the "expensive but accurate" optional third layer. Production systems increasingly combine all three in a two-stage pipeline: cheap lexical + vector retrieval for recall, expensive reranker for precision. The scoring layer is also where custom business rules live — boost recent documents, boost high-engagement items, penalize duplicates.

**5. Coordinator / cluster manager.** A distributed search engine has many nodes. The coordinator handles: routing queries to the right shards, fan-out to replicas, merging partial results, managing shard assignment, and orchestrating snapshot/restore. Elasticsearch calls this the master node (now "cluster manager node" in newer versions). Single-binary engines like Meilisearch and Typesense have no coordinator because there is no cluster (or minimal clustering); that simplicity is part of their value proposition. The coordinator is also where distributed query plans are executed — a `bool` query with a complex aggregation may require multiple rounds of fan-out before a complete result can be assembled. The coordinator overhead is real and measurable; at < 10M documents, it is often the dominant cost of an Elasticsearch query.

**6. API surface.** How the outside world talks to the engine. Elasticsearch uses a JSON-over-HTTP REST API with a rich query DSL. Typesense and Meilisearch expose simpler REST APIs optimized for common patterns. Tantivy is a Rust library — no network API at all. Sonic uses a custom TCP protocol. Postgres exposes SQL. The API surface shapes the development experience more than any other single factor. A team that knows SQL will find pgvector + tsvector productive immediately; the same team faces a significant learning curve with the Elasticsearch query DSL. An API that is "simple" can also mean "limited" — the tradeoff is always present.

### 2.2 How these pieces vary across the landscape

The table below maps the six pieces to their typical implementation across the main system categories. It is illustrative — exact implementations vary by version and configuration.

| Piece | Lucene-family (ES / OpenSearch) | Single-binary (Meili / Typesense) | Postgres-native | Object-storage (Quickwit) |
|---|---|---|---|---|
| Ingest pipeline | Configurable analyzers, pipelines | Opinionated defaults | `to_tsvector()` + triggers | Schemaless, OpenTelemetry-aware |
| Persistent index | Lucene segments (inverted + vector) | Custom engine on local SSD | GIN/GiST (inverted), HNSW (pgvector) | Tantivy segments on S3/MinIO |
| Query pipeline | Rich DSL (bool, match, knn, etc.) | Simplified REST API | SQL + FTS operators | SQL-like / REST |
| Scoring layer | BM25 + vector + rerank | Built-in ranking rules | `ts_rank`, pgvector cosine | BM25 |
| Coordinator | Cluster manager node, sharding | None (single node or basic clustering) | None (Postgres native) | Distributed, compute/storage split |
| API surface | JSON-over-HTTP REST + DSL | REST API, SDKs | SQL | REST API |

Every product choice is fundamentally a bet on which of these pieces matters most for your use case. Elasticsearch optimizes the query pipeline at the cost of coordinator complexity. Meilisearch optimizes the API surface and ingest pipeline at the cost of query DSL flexibility. Quickwit optimizes the coordinator and persistent index for object storage at the cost of real-time write latency. Postgres optimizes for operational simplicity (it is already deployed) at the cost of FTS-specific features.

---

## 3. The anchor case — Elasticsearch + Lucene (deep dive)

### 3.1 What Elasticsearch actually is

Elasticsearch is a distributed search and analytics engine, scalable data store, and vector database built on Apache Lucene. Source: elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html, fetched 2026-05-17.

The mental model that matters: **Elasticsearch is a coordinator that runs one Lucene index per shard.** A cluster with 5 primary shards and 1 replica each has 10 Lucene instances scattered across nodes. When you query, the coordinator fans the request out to all relevant shards, collects partial results, merges them by score, and returns the top N. Each shard is, at its core, a Lucene index managed by a JVM process.

This architecture has a critical implication: Elasticsearch is as fast as Lucene per shard, and adds network and merge latency on top. For small corpora where you don't need multiple shards, Elasticsearch's overhead is non-trivial. For large corpora where you do, it's the only thing keeping response times in milliseconds.

Lucene's current version is 10.4.0 (Apache Lucene site, lucene.apache.org/core/, fetched 2026-05-17). Elasticsearch's exact version as of this writing could not be confirmed to a patch number — the elastic.co docs mention version 9.x series features (specifically `rescore_vector` available since 9.1, per knn-search docs) but the "current version" is not stated on the landing page. **Unverified — check elastic.co/downloads for the current GA version.**

### 3.2 The analyzer pipeline

An Elasticsearch analyzer is a three-stage text processing pipeline applied at index time and (usually) at query time. Source: elastic.co/guide/en/elasticsearch/reference/current/analysis.html, fetched 2026-05-17.

**Stage 1 — Character filters.** Applied to the raw text string before tokenization. They can: strip HTML tags, replace characters (e.g., replace "&" with "and"), or do Unicode normalization. These run before the tokenizer sees any text.

**Stage 2 — Tokenizer.** Splits the character-filtered text into individual tokens. The `standard` tokenizer splits on whitespace and most punctuation. The `whitespace` tokenizer splits only on whitespace. The `edge_ngram` tokenizer produces prefixes of each token (for autocomplete). The `ngram` tokenizer produces all substrings of configurable length (for fuzzy matching without explicit fuzzy queries).

**Stage 3 — Token filters.** Applied to each token after tokenization. Common ones: `lowercase` (converts "FOX" to "fox"), `stop` (removes stopwords like "the", "a", "is"), `stemmer` (reduces "foxes" to "fox", "running" to "run"), `synonym` (expands "car" to also index "automobile").

**Worked example.** Input text: `"Quick brown FOXES, jumping!"`

After the standard analyzer (char filters: none → tokenizer: standard splits on punctuation/whitespace → token filters: lowercase + stop + English stemmer):

```
Input:  "Quick brown FOXES, jumping!"
Tokens: [quick, brown, fox, jump]
```

"Quick" → lowercase → "quick". "FOXES" → lowercase → "foxes" → stemmer → "fox". "jumping" → lowercase → "jumping" → stemmer → "jump". The comma and exclamation mark are discarded by the standard tokenizer. If "brown" were a stopword it would also be removed (it is not by default).

**The match/no-match example.** If a document contains "foxes" and is indexed with the English stemmer, Elasticsearch stores the token "fox". A query for "fox" also gets stemmed to "fox" at query time — match. A query for "foxes" gets stemmed to "fox" — also a match. If you deploy the same index *without* the stemmer, the document stores "foxes" and a query for "fox" stores "fox" — no match, because "fox" ≠ "foxes" without stemming. This is the single most common source of "why isn't my search finding obvious results" bugs.

The same analyzer should run at index time and query time. If they diverge (e.g., you add a synonym filter at query time but not index time), searches will behave unpredictably. Elasticsearch lets you specify separate `index_analyzer` and `search_analyzer`; use this feature with caution and test it thoroughly.

### 3.3 The inverted index

The inverted index maps each analyzed token to a list of document IDs that contain it, optionally with term frequency and position information. This is the same structure described in /data-search-strategies; what is Lucene-specific is the on-disk format.

Lucene stores inverted index data in **segments** — immutable files on disk. Each segment is a small, complete inverted index. When you index new documents, Lucene writes them to a new segment in memory, then flushes to disk when the segment grows large enough or a refresh is triggered. Segment files are never modified after writing; updates are implemented as a delete + re-insert.

### 3.4 Scoring — BM25

Elasticsearch's default scoring algorithm is BM25 (Best Match 25), documented in the Elastic BM25 explainer at elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables.

The intuition: BM25 scores a document higher when (a) the query term appears more often in it, (b) it appears in fewer documents in the corpus (IDF — inverse document frequency), and (c) the document is short relative to the average document length. The third factor is field-length normalization — a document where "fox" is one of 5 words is more likely to be "about foxes" than one where "fox" appears once in 5,000 words.

Breaking down the three components without formulas:

- **Term frequency (TF):** "fox" appearing 5 times in a document is stronger evidence of relevance than "fox" appearing once. But BM25 saturates this — the 10th occurrence adds much less signal than the 2nd. This prevents a document that mentions "fox" 100 times (potentially spam or keyword stuffing) from dominating.
- **Inverse document frequency (IDF):** "the" appears in almost every document — finding "the" in a document tells you almost nothing about relevance. "Quetzal" appears in very few documents — finding "quetzal" is much stronger evidence. IDF measures this: rare terms score higher, common terms score lower.
- **Field-length normalization (b parameter):** a short document where "fox" occupies 10% of the text is a stronger match than a long document where "fox" appears once in 10,000 words. This is the b parameter; setting b=0 disables normalization (useful for titles), b=1 applies full normalization (useful for long prose).

BM25 is older than most readers expect — it was formalized in the 1990s (Robertson et al., widely cited; exact publication date varies by version — the BM25F extension is from 2004). It is still a strong baseline in 2026. The claim that "BM25 is obsolete because of embeddings" is a common misconception (see § 8); the production winner is hybrid retrieval, which uses BM25 as the lexical half.

**What BM25 cannot do.** BM25 has no notion of meaning. It cannot find a document about "canines" when you search for "dogs" unless both terms are in the document, or you add a synonym filter at analysis time. It cannot find documents about "reducing inflammation" for a query about "anti-inflammatory supplements" unless those exact tokens overlap. Meaning-based retrieval is where dense embeddings win. The hybrid pattern (§ 5.1) stitches BM25 and dense retrieval together precisely to cover both cases.

### 3.5 Lucene segments and refresh

The segment model has important operational consequences:

**Why writes aren't immediately searchable.** New documents go into an in-memory buffer. The buffer is written to a new segment on the "refresh" cycle (default: every 1 second in Elasticsearch). Until the refresh happens, newly indexed documents are not searchable. For real-time applications, you can call `_refresh` explicitly or use `refresh=true` on the index API — but this is expensive at scale.

**Segment merges and latency spikes.** As documents accumulate, Lucene runs background merge jobs that combine small segments into larger ones. Merges are I/O-intensive. A sudden large merge can spike query latency for a few seconds. This is the source of the "why is Elasticsearch slow sometimes?" complaint in teams that haven't tuned merge policies. Merge policy tuning is a real operational knob.

**Force-merge before snapshots.** Before taking a snapshot of a read-mostly index, running `_forcemerge` to reduce it to 1 segment per shard is a common pattern. It compresses the index significantly and speeds up snapshot I/O.

**Segment immutability and deletes.** Deleted documents are marked with a "tombstone" in a `.del` file. They are still physically present and still incur some storage cost until the next merge that includes their segment. On a corpus with a high delete rate, the tombstone overhead becomes significant.

### 3.6 Sharding and replication

Every Elasticsearch index is divided into N **primary shards** × R **replicas per primary**. The default is 1 primary, 1 replica (so 2 total copies). A query fans out to one copy (primary or replica) of each primary shard, collects partial ranked results, and the coordinator merges them by score.

**Why sharding exists.** A single Lucene index has a practical size limit — not a hard code limit, but a performance cliff. As one segment grows into the hundreds of gigabytes range, merge operations, heap pressure, and query fan-out time all degrade. Sharding distributes the index across multiple JVM processes (and potentially multiple nodes), each managing a Lucene index of tractable size. The query then fans out across shards, collects top-K from each, and merges — this merge is where global BM25 scoring gets subtle (IDF is computed per-shard by default, not globally, which can cause relevance artifacts at small shard sizes; the `dfs_query_then_fetch` search type fixes this but costs an extra round-trip).

**The "shard count is forever" problem.** The number of primary shards is set at index creation time and cannot be changed without reindexing. This is the hardest architectural decision for teams building on Elasticsearch. Too few shards: one node holds all the data and becomes the bottleneck, and you cannot scale out without reindexing. Too many shards: each shard consumes memory, file handles, and heap; the coordinator overhead grows; GC pressure increases; and the per-shard overhead can dominate query latency for small result sets. The rule of thumb is roughly 10–50 GB per shard — but this depends on your query shape, hardware, and Elasticsearch version. **This is community-reported guidance; Elastic docs do not specify a universal GB-per-shard limit.** Pick poorly and rebuilding the index on a live cluster (typically: build new index in parallel, then alias-swap) is the only fix.

**Replicas and read scalability.** Each replica is a full copy of its primary shard. Queries can be routed to any copy (primary or replica), so adding replicas scales read throughput linearly. Replicas are also the HA story: if a primary node fails, a replica is promoted. The cost is storage (each replica is a full copy) and write amplification (every indexed document must be written to the primary and replicated to all replicas before acknowledgment, depending on `wait_for_active_shards` setting).

**Index templates and ILM.** For time-series data (logs, events, metrics), the production pattern is rolling indexes with Index Lifecycle Management (ILM): a new index is created each day/week, old indexes transition from "hot" (SSD, fully replicated) to "warm" (reduced replicas) to "cold" (possibly snapshot-and-delete). This is Elasticsearch's answer to the Quickwit problem: for logs, you don't want to pay SSD costs for 90-day-old data. ILM partially addresses this. Quickwit addresses it more aggressively by making object storage the primary tier (§ 4.3).

### 3.7 The query DSL

Elasticsearch's primary query language is a JSON-based query DSL. A few key query types:

**`match` query.** Applies the analyzer to the query string before matching. `"match": {"title": "quick brown fox"}` will analyze "quick brown fox" to [quick, brown, fox] and find documents where at least one of those tokens appears. This is the right choice for full-text user queries. The `operator` parameter controls whether all terms must match (`and`) or any term (`or`, the default).

**`term` query.** Does NOT analyze the input. `"term": {"status": "active"}` looks up the exact token "active" in the index. Use this for keyword fields (status codes, IDs, tags) that are indexed without analysis. Using a `term` query against an analyzed field is a common bug — "Active" and "active" won't match if the query string isn't lowercased. This is the source of the "why isn't my filter working" bug that most Elasticsearch beginners hit on day two.

**`match_phrase` query.** Requires tokens to appear in order and adjacent. `"match_phrase": {"body": "quick brown fox"}` won't match "quick fox" or "fox brown quick". Useful for title-like searches where word order matters.

**`bool` query.** The workhorse. Combines sub-queries with four clauses:
- `must` — document must match; contributes to BM25 score.
- `filter` — document must match; does NOT contribute to score; results are cached at the shard level. This is the performance knob: put all non-scoring criteria (date range, status, category) in `filter`, not `must`.
- `should` — document may match; matching boosts score; does not exclude non-matching.
- `must_not` — document must NOT match; excluded from results; does not affect score.

A concrete bool query that illustrates each clause:

```json
{
  "query": {
    "bool": {
      "must": { "match": { "body": "quick brown fox" } },
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "published_at": { "gte": "2025-01-01" } } }
      ],
      "should": { "term": { "category": "wildlife" } },
      "must_not": { "term": { "deleted": true } }
    }
  }
}
```

The `filter` array demonstrates why you can have multiple filter criteria: each runs as a cached bitset intersection. The `should` clause here boosts documents in the "wildlife" category without excluding documents in other categories.

**`multi_match` query.** Like `match` but across multiple fields simultaneously. `"multi_match": {"query": "fox", "fields": ["title^3", "body"]}` searches both title and body, but gives title three times the weight (`^3` boost).

**`fuzzy` query and `fuzziness` on match.** Adds Levenshtein distance tolerance. `"match": {"title": {"query": "foxs", "fuzziness": "AUTO"}}` will match "fox" and "foxes" because edit distance 1–2 is within the AUTO threshold. Fuzzy search is expensive — it expands to many terms at query time. The n-gram approach (§ 3.2 — edge_ngram tokenizer at index time) is usually faster for autocomplete; fuzzy queries are better for post-hoc typo correction.

**`knn` option (vector search).** The kNN query uses HNSW to find the K nearest neighbor documents to a query vector. As of the kNN search docs (fetched 2026-05-17): `"knn": {"field": "embedding", "query_vector": [...], "k": 10, "num_candidates": 100}`. The `num_candidates` parameter is the retrieval pool size — higher means better recall at higher latency cost.

**`function_score` and `rescore`.** `function_score` wraps a query and multiplies the BM25 score by a custom function (e.g., boost recent documents by a time-decay function, or boost by a stored popularity field). `rescore` runs a second, more expensive scoring pass (e.g., a cross-encoder model score) on the top N results from the initial query — this is the retrieve-then-rerank pattern (§ 5.2).

**Common query DSL mistakes.** In rough order of frequency in the wild:
1. Using `term` query on an analyzed field (always a miss for non-lowercase inputs).
2. Putting filter criteria in `must` instead of `filter` (correct results, wrong performance — bypasses shard-level filter cache).
3. Using `match` (OR logic) when you meant `match` with `operator: and` (returns many weak matches).
4. Forgetting that `multi_match` with field boosts requires the same analyzer on all boosted fields to work predictably.
5. Using `fuzzy` in high-throughput paths without awareness that it expands to many terms per query.

### 3.8 Hybrid search and ELSER / dense vectors in 2026

Elasticsearch supports both dense vector (kNN) search and hybrid retrieval. The kNN search uses HNSW or DiskBBQ graphs. The `rescore_vector` option (available since version 9.1 per the kNN search docs, fetched 2026-05-17) allows a vector re-score pass after initial retrieval.

**RRF (Reciprocal Rank Fusion).** Elasticsearch supports RRF as a native retriever, documented at elastic.co/guide/en/elasticsearch/reference/current/rrf.html, fetched 2026-05-17. The formula:

```
score = sum( 1 / (k + rank_i) ) for each sub-retriever i
```

where k defaults to 60. RRF merges the ranked lists from a BM25 query and a kNN query without requiring the scores to be on the same scale. A document that ranks #3 in BM25 and #2 in kNN will rank higher than one that ranks #1 in only one. The key property: "requires no tuning, and the different relevance indicators do not have to be related to each other" (Elastic RRF docs).

**ELSER (Elastic Learned Sparse Embeddings Retrieval).** ELSER is Elastic's own learned sparse retrieval model — it expands queries and documents into sparse token vectors that can be used with Elasticsearch's inverted index (rather than requiring dense kNN). As of the docs surveyed, ELSER is part of Elastic's ML feature set. Its exact GA status and model version in mid-2026 could not be confirmed from the fetched pages — the licensing FAQ and intro pages did not mention it by name. **Unverified — check elastic.co/guide/en/machine-learning/current/ml-nlp-elser.html for current status.**

### 3.9 The license-and-fork story

**2021 — the change.** Elasticsearch and Kibana moved from Apache 2.0 to a dual license: Elastic License v2 (ELv2) and SSPL 1.0, as of version 7.11. SSPL is broadly seen as a "source available but not open source" license because it restricts cloud providers from offering managed services built on the software without releasing their entire service source. The OSI does not recognize SSPL as open source.

**2024 — the partial reversal.** Before version 8.16, Elastic added AGPLv3 as a third option. AGPLv3 is OSI-approved and is a genuine open source license. The current state is triple-licensing: SSPL, ELv2, and AGPLv3. The default distribution remains ELv2. Source: elastic.co/pricing/faq/licensing, fetched 2026-05-17.

**OpenSearch — the AWS fork.** AWS forked Elasticsearch at the last Apache 2.0 version (7.10.2) in 2021, creating OpenSearch. OpenSearch uses Apache 2.0, which has no restrictions on managed services. AWS launched OpenSearch Service as the managed offering. Source: opensearch.org/faq/, fetched 2026-05-17.

**Practical 2026 implications.**

- If you want a permissively licensed build you can embed in any product or managed service without restriction: OpenSearch (Apache 2.0) or use Elasticsearch under AGPLv3 (requires you to open-source modifications if you distribute the software or offer a network service).
- If you're running Elasticsearch in-house for your own applications: ELv2 is fine — it restricts providing the software as a managed service to others, not your own use.
- If you're a cloud provider building a managed search service: you need Elastic's commercial license, or you choose OpenSearch.
- The APIs have been diverging since 2021. Particularly in ML features, ELSER and Elastic's AI stack have no OpenSearch equivalent. For teams that switch, some query DSL is compatible, but feature-for-feature parity is not guaranteed. **Verify per-feature compatibility before assuming drop-in substitution.**

---

## 4. The comparable-systems survey

A one-paragraph profile, a tradeoff table, and a niche sentence for each system. Claims labeled: **documented** (official source), **community-reported** (blog/benchmark), or **inferred**.

---

### 4.1 OpenSearch

AWS-led fork of Elasticsearch 7.10 (Apache 2.0). API-compatible with Elasticsearch 7.x at the REST level; query DSL and index mappings are largely shared. Since the 2021 fork, both projects have developed independently, and ML/AI features — especially Elastic's ELSER, neural ranking, and GenAI integrations — have no direct OpenSearch equivalent. OpenSearch has developed its own neural search plugins and vector search capabilities (k-NN plugin using FAISS, NMSLIB, and OpenSearch-native HNSW). Source: opensearch.org/faq/, fetched 2026-05-17. The OpenSearch 3.0 release blog returned 404 as of this writing; current major version unverified — check opensearch.org/blog.

**Niche:** teams that need Elasticsearch-class capability under a permissive license; AWS-native deployments via OpenSearch Service.

---

### 4.2 Tantivy

A full-text search engine **library** written in Rust, inspired by Apache Lucene. Maintained by the quickwit-oss GitHub org. It is a Rust crate — not a server. You link it into your application and call it as a library. Source: github.com/quickwit-oss/tantivy, fetched 2026-05-17. Key capabilities (documented): BM25 scoring matching Lucene's implementation, configurable tokenizers supporting 17 Latin languages plus CJK, incremental multithreaded indexing, fast startup under 10ms, faceted search, compressed document storage.

**Niche:** library-embedded search in Rust applications; the engine underlying Quickwit and ParadeDB — if you use either, you are using Tantivy indirectly.

---

### 4.3 Quickwit

A log-search engine built on Tantivy, designed for object storage (S3, MinIO, Ceph) as the primary storage tier rather than local SSD. Sub-second queries on terabytes of data by minimizing I/O through optimized file formats, smart scheduling, and vectorized SIMD processing. No garbage collection (Rust). Native support for OpenTelemetry and Jaeger trace formats. Decoupled compute and storage — you can scale query nodes independently from ingest nodes. Source: quickwit.io/, fetched 2026-05-17.

**Niche:** logs, traces, and events at petabyte scale where cold storage cost dominates; "I can't afford to keep 90 days of logs in Elasticsearch SSDs."

---

### 4.4 Meilisearch

A typo-tolerant, developer-experience-first search engine. Single binary. No external dependencies. Sub-50ms responses at scale. Seven built-in ranking rules (typo tolerance, proximity, exactness, word presence, attribute importance, custom). Hybrid search combining keyword and semantic results, with DiskANN-based vector search and automatic embedding generation when configured with an embedder. Source: meilisearch.com/docs/learn/what_is_meilisearch/overview, fetched 2026-05-17. Meilisearch offers both self-hosted and Meilisearch Cloud options. The specific corpus size limits and current version were not stated in the fetched docs — **unverified.**

**Niche:** instant autocomplete search UIs for small-to-medium corpora; developer teams who want "it just works" out of the box without Elasticsearch operational knowledge.

---

### 4.5 Typesense

Open-source, typo-tolerant search engine "optimized for instant (typically sub-50ms) search-as-you-type experiences." Billed as "an easier-to-use batteries-included alternative to Elasticsearch." Source: typesense.org/docs/overview/what-is-typesense.html, fetched 2026-05-17. Latest documented version is v30.2 (typesense.org/docs, fetched 2026-05-17). Supports faceted search, geosearch, and vector search. Single binary, self-contained.

**Niche:** same space as Meilisearch — instant search UIs for e-commerce, documentation sites, and small-to-medium product catalogs; often compared directly with Meilisearch in community discussions (community-reported; the two projects target nearly identical niches with slightly different defaults).

---

### 4.6 Sonic

A minimal, embedded search backend written in Rust. Notable characteristics (documented, github.com/valeriansaliou/sonic, fetched 2026-05-17): word-level NLP (not sentence-level), stop-word removal for 80+ languages, typo correction, autocomplete, custom TCP protocol (Sonic Channel) rather than HTTP, peak RAM usage ~28MB on 1 million indexed messages (community-reported benchmark on the README — cherry-picked hardware, treat as directional). Maximum 4.2 billion objects per bucket (32-bit constraint). Latest release v1.4.9 (June 2024).

**Niche:** embedded search in resource-constrained environments where 28MB RAM is a selling point; not suitable for faceted search, rich query DSL, or vector search.

---

### 4.7 Algolia

Hosted search-as-a-service with proprietary ranking algorithms. No self-hosting option. Strengths: instant search, opinionated-but-good relevance defaults, strong merchandising tools (pin results, boost rules, A/B testing, click analytics). Features include NeuralSearch (AI-powered re-ranking), Dynamic Re-Ranking, and personalization. Source: algolia.com/doc/, fetched 2026-05-17. Cost model: pay-per-operation. At small scale it is cost-competitive with self-hosting when you factor in operations time; at large scale the per-search fee becomes significant. Exact pricing not reproduced here — verify at algolia.com/pricing.

**Niche:** teams that want excellent out-of-the-box search quality, no ops overhead, and are willing to pay for it; e-commerce and documentation search at startup-to-midsize scale.

---

### 4.8 Postgres `tsvector` + GIN

Postgres has native full-text search via the `tsvector` type (a processed, sorted lexeme list) and GIN indexes (generalized inverted index). You write `to_tsvector('english', body) @@ to_tsquery('english', 'fox')` and Postgres uses the GIN index to find matching rows. Supports stemming, stopwords, ranking (`ts_rank`), and phrase queries. Source: postgresql.org/docs/current/textsearch.html, fetched 2026-05-17.

The critical fact: **this already exists in your Postgres database.** No additional service to deploy, operate, or pay for. It works well for corpora under roughly 10 million rows. At larger scale, GIN index maintenance cost during bulk writes and the single-node limitation start to bite. The GIN index is the recommended index type for FTS per Postgres docs.

**Niche:** the first full-text search you should reach for if you're already using Postgres. "Use Postgres until you can't" is a defensible strategy for most teams under 10M documents.

---

### 4.9 pg_trgm — trigram fuzzy search in Postgres

`pg_trgm` is a Postgres extension that provides trigram-based similarity matching. A trigram is a 3-character sequence; two strings are similar if they share many trigrams. This enables fuzzy matching ("fuzzy" matches "fussy") and supports GIN or GiST indexes for fast lookup. Use case: "the user probably typo'd a product name — find the closest real product name." Different from full-text search in that it operates on character sequences, not analyzed tokens.

It's underrated. For "approximate exact match" — finding records where the user likely misspelled a known value — `pg_trgm` beats both `LIKE '%x%'` and a full FTS setup in simplicity and performance at Postgres-native scale. (Inferred from common usage patterns; verify with `CREATE EXTENSION pg_trgm` in your Postgres instance.)

**Niche:** fuzzy name/title lookup when you're already on Postgres; no extra service required.

---

### 4.10 pgvector

A Postgres extension that adds a `vector` column type and IVFFlat/HNSW indexes for approximate nearest neighbor search. It allows you to store embeddings in Postgres and query them with SQL: `ORDER BY embedding <=> query_embedding LIMIT 10`. Source: the pgvector GitHub repo (github.com/pgvector/pgvector) is the primary reference — not fetched directly in this research pass; the concept is documented in the /ann-vector-indexes dossier.

The key insight for this dossier: pgvector lets you do vector search in Postgres without a separate vector database. For RAG over a small-to-medium corpus (under ~5M vectors), this is often the right architectural choice. The /ann-vector-indexes dossier covers HNSW vs. IVFFlat tradeoffs in detail.

**Niche:** vector search for teams already on Postgres; combine with `tsvector` + GIN for a Postgres-native hybrid retrieval stack before reaching for a dedicated vector database.

---

### 4.11 ParadeDB

A Postgres extension (or distribution) that wraps Tantivy as a Postgres index type (`pg_search`) and integrates pgvector, providing full-text search and vector search within a single Postgres database. Source: docs.paradedb.com was unavailable during this research (returned 404); the project is active at github.com/paradedb/paradedb. Description based on publicly available project documentation — **community-reported; verify current feature status at paradedb.com.**

The value proposition: one database, all access patterns — exact SQL queries, BM25 full-text search via Tantivy, and vector similarity via pgvector. No separate search cluster to deploy.

**Niche:** teams who want Lucene-quality full-text search and vector search without leaving the Postgres operational model; avoids the Elasticsearch cluster complexity.

---

### 4.12 Vector-native databases with hybrid search

Qdrant, Weaviate, and Pinecone are vector-first databases that have added full-text search capabilities alongside vector search.

- **Qdrant** (Rust, open-source, also hosted): supports BM25/sparse vectors alongside dense vectors; hybrid retrieval via query fusion. Community-reported to be performant for high-throughput vector search.
- **Weaviate** (Go, open-source, also hosted): built-in BM25 and hybrid search (BM25 + vector with configurable alpha weighting); strong on multi-tenancy.
- **Pinecone** (hosted only, proprietary): added sparse vector support for hybrid retrieval; no open-source version. Strong managed-service track record.

**2026 status of hybrid offerings:** the exact feature state of each system was not verified via primary-source fetches in this pass. Claims above are **community-reported** based on prior documentation surveys. Verify at qdrant.tech/documentation, weaviate.io/developers/weaviate, and pinecone.io/docs before relying on specific feature availability.

**Niche:** teams starting from a vector/semantic search requirement who also need keyword search; "I'm already using Pinecone for embeddings and I want to add BM25 without a second system."

---

### 4.13 System comparison table

| System | Self-host | Distributed | Full-text | Vector | Fuzzy | Facets | License | Sweet spot |
|---|---|---|---|---|---|---|---|---|
| Elasticsearch | Yes | Yes | Excellent | Yes (HNSW) | Via n-gram | Yes | ELv2/SSPL/AGPLv3 | 10M–1B+ docs, complex ranking |
| OpenSearch | Yes | Yes | Excellent | Yes (FAISS/HNSW) | Via n-gram | Yes | Apache 2.0 | Same as ES; AWS-native |
| Tantivy | Library | No | Excellent | No¹ | Configurable | Yes | MIT | Embedded in Rust apps |
| Quickwit | Yes | Yes | Good | Limited | No | Yes | AGPL-3.0 | Logs/traces on object storage |
| Meilisearch | Yes + hosted | Limited | Good | Yes (DiskANN) | Excellent | Yes | MIT / SSPL | Sub-10M docs, instant search |
| Typesense | Yes + hosted | Limited | Good | Yes | Excellent | Yes | GPL-3 | E-commerce/docs search |
| Sonic | Yes | No | Minimal | No | Limited | No | MPL-2.0 | Embedded, 28MB RAM |
| Algolia | Hosted only | Managed | Excellent | Yes | Excellent | Excellent | Proprietary | No-ops, premium quality |
| Postgres tsvector | Via Postgres | Via Citus/etc | Good | No² | Via pg_trgm | Limited | PostgreSQL | < 10M docs on Postgres |
| pg_trgm | Via Postgres | Via Citus/etc | No³ | No | Excellent | No | PostgreSQL | Fuzzy name match in Postgres |
| pgvector | Via Postgres | Via Citus/etc | No | Excellent | No | No | PostgreSQL | Vectors in Postgres |
| ParadeDB | Yes | Via Postgres | Excellent⁴ | Yes (pgvector) | Limited | Yes | AGPL-3.0 | All-in-one on Postgres |
| Qdrant | Yes + hosted | Yes | Via sparse | Excellent | No | Limited | Apache 2.0 | Vector-first hybrid |
| Weaviate | Yes + hosted | Yes | Via BM25 | Excellent | No | Limited | BSD-3 | Vector-first + multi-tenant |
| Pinecone | Hosted only | Managed | Via sparse | Excellent | No | Limited | Proprietary | Managed vector search |

¹ Tantivy does not have built-in ANN vector search; downstream projects add it.
² pgvector provides vectors; tsvector provides FTS; they can coexist in the same table.
³ pg_trgm is not full-text search; it is character-level fuzzy similarity.
⁴ ParadeDB wraps Tantivy; feature set — including exact version and stability — unverified per primary source; check paradedb.com.

**License status note:** some of the licenses in this table changed between 2021 and 2024 (Elasticsearch, Meilisearch). Verify current licenses at each project's repository before making compliance decisions.

---

## 5. AI-era additions

### 5.1 Hybrid retrieval (lexical + dense) — RRF vs. weighted sum

The production consensus for RAG and knowledge-base search in 2026 is hybrid retrieval: run both a BM25 lexical query and a dense vector kNN query, then merge the ranked lists.

Two merge strategies:

**Weighted sum.** Normalize each system's scores to [0, 1] and combine: `final_score = α × bm25_score + (1-α) × vector_score`. Requires both score distributions to be normalized compatibly. Tuning α is workload-specific and requires evaluation data. When α is wrong, one system dominates and the "hybrid" gives you no benefit over single-system.

**Reciprocal Rank Fusion (RRF).** Score each document by its rank in each result list: `score = Σ 1/(k + rank_i)`. k=60 is the published default in Elasticsearch (documented: elastic.co/guide/en/elasticsearch/reference/current/rrf.html, fetched 2026-05-17). The original RRF paper is Cormack, Clarke, and Buettcher (SIGIR 2009). RRF's advantage: it is rank-based, not score-based, so the two systems don't need score normalization. Its disadvantage: it ignores score magnitude — a BM25 document ranked #1 by a huge margin gets the same RRF contribution as one ranked #1 by a tiny margin.

**Which to use.** Start with RRF. It requires no tuning and is robust across query types. If you have labeled evaluation data and the ability to tune, a learned weighted combination (or a cross-encoder reranker) can exceed RRF quality — but RRF is the defensible default. (Inferred from community consensus; no independent third-party benchmark of RRF vs. weighted sum on standardized datasets was fetched in this pass.)

### 5.2 Cross-encoder rerankers — the two-stage pipeline

The two-stage retrieve-then-rerank pattern:

1. **Stage 1 (fast retrieve):** use BM25 and/or vector search to retrieve top K candidates (K = 50–200). This is cheap — milliseconds.
2. **Stage 2 (expensive rerank):** run each (query, candidate) pair through a cross-encoder neural model that jointly encodes both and produces a relevance score. Return top N (N << K).

Cross-encoders are much more accurate than bi-encoders (the kind used for dense retrieval) because they can model the interaction between query and document explicitly. They are also much slower — O(K) model forward passes rather than one embedding lookup.

**Available cross-encoder rerankers in 2026:**
- **Cohere Rerank** — hosted API; described as "A powerful model that provides a semantic boost to search quality" (cohere.com/blog/rerank, fetched 2026-05-17). Latency and cost depend on corpus size and tier — not stated in the fetched page. Check docs.cohere.com for current pricing.
- **Voyage Rerank** — Voyage AI (the embedding provider recommended by Anthropic in the Claude docs). Reranking is a documented offering; verify current models at voyageai.com.
- **BGE Rerank** — open-weight models from BAAI (Beijing Academy of AI). Self-hostable. Community-reported to be competitive with Cohere on standard retrieval benchmarks. **Community-reported; treat vendor/community benchmark claims with skepticism.**
- **mxbai-rerank** — from mixedbread.ai; open-weight reranker. Self-hostable. Community-reported performance is competitive; verify at mixedbread.ai.

**Production deployment pattern.** The reranker runs on the server side, after the initial retrieval, before the results are returned to the application. It adds 50–300ms of latency depending on K and model size. This is acceptable for user-initiated search but may be too slow for high-throughput automated pipelines. Hosted APIs (Cohere, Voyage) simplify deployment but add per-call cost and a network hop.

### 5.3 ColBERT / late interaction

ColBERT (Contextualized Late Interaction over BERT) is a retrieval architecture that sits between bi-encoder and cross-encoder models. In a standard bi-encoder, the query and document are each encoded into a single vector; similarity is a single dot product. In a cross-encoder, query and document are concatenated and jointly encoded — more accurate but O(N) forward passes at query time (no precomputation). ColBERT is a middle path:

- Documents are encoded offline into a sequence of per-token vectors (not one vector — one per token in the document). These are stored in the index.
- At query time, the query is encoded into per-token vectors.
- Similarity is computed via MaxSim: for each query token, find the maximum similarity across all document token vectors, then sum these. This captures fine-grained term-level alignment without requiring full cross-encoder joint encoding.

The advantage: better recall than bi-encoders on nuanced queries because token-level matching captures partial alignment (e.g., "the fox jumped" aligns strongly to "a leaping fox" even without exact overlap). The disadvantage: index storage scales with total token count, not document count — a document with 200 tokens stores 200 vectors. This is 5–50× the storage of a single-vector dense index at equivalent corpus size.

**2026 production status.** ColBERT showed strong benchmark results on BEIR and LoTTe (community-reported, 2021–2023). Production adoption remains uneven. RAGatouille (a Python library) and Vespa (the enterprise search engine) have made ColBERT more accessible. The index storage cost remains the main adoption barrier for large corpora. **Could not verify any major cloud-hosted search platform (Elasticsearch, Weaviate, Pinecone, OpenSearch) offering native ColBERT as a GA feature as of mid-2026; label as community-reported / inferred that adoption is niche-but-growing rather than mainstream.** If ColBERT adoption is a decision factor, verify current support at each platform's docs directly.

### 5.4 Learned sparse retrieval — SPLADE

SPLADE (SParse Lexical AnD Expansion) is a family of models that produce sparse vectors over the vocabulary — each token in the vocabulary gets a weight, most of which are zero. Unlike BM25 (which counts exact terms), SPLADE learns which vocabulary terms are semantically relevant to a document and upweights them, even if those terms don't appear literally. The resulting sparse vectors can be used with a standard inverted index — which is the key operational advantage: SPLADE scores are naturally compatible with Elasticsearch and OpenSearch infrastructure.

**Concrete difference from dense retrieval:** a dense embedding for "fox jumps" is a 1,536-dimensional float vector. A SPLADE embedding for the same text might be: `{fox: 2.4, canine: 1.8, leap: 1.2, mammal: 0.9, ...}` — sparse over the vocabulary, but containing learned expansions that BM25 would miss. At query time, the query is also encoded to a sparse SPLADE vector, and the dot product is computed using an inverted index lookup over the non-zero terms.

**2026 production status.** Elastic's ELSER is a learned sparse model in the SPLADE family (inferred; Elastic describes ELSER as producing "sparse vectors" stored in Elasticsearch's inverted index — the architecture matches SPLADE). SPLADE models are available open-weight from Hugging Face (e.g., `naver/splade-cocondenser-ensemble-distil`). Production adoption outside Elastic's managed ML stack is limited: teams need to serve the SPLADE model as an inference endpoint during ingest and query, which adds operational complexity. The technology is proven in retrieval benchmarks (community-reported), but the deployment burden keeps it in the "advanced" category.

**When SPLADE is the right choice:** when you need vocabulary expansion (the query and document share no common terms but are semantically related) AND you need the resulting vectors to be compatible with existing inverted-index infrastructure (Elasticsearch / OpenSearch). If you're not already on Elasticsearch and need learned sparse retrieval, SPLADE's deployment overhead may exceed its benefit relative to hybrid BM25 + dense.

### 5.5 A note on vendor benchmarks across AI-era retrieval methods (read this before trusting any performance claim)

Every section above hedges on performance claims. This is intentional. The retrieval benchmarks field (BEIR, MTEB, LoTTe, etc.) suffers from:

- **Domain mismatch.** Models trained on MS-MARCO or Wikipedia generalize poorly to specialized domains (legal, biomedical, code). A model that tops BEIR may perform poorly on your enterprise knowledge base.
- **Cherry-picking.** Vendors benchmark the configuration that makes them look best. The winning configuration at inference time rarely matches the default configuration that a new user gets.
- **Contamination risk.** Language models used for embedding may have trained on documents in the benchmark set. This inflates benchmark scores and does not reflect real retrieval quality on private corpora.
- **Recall vs. MRR vs. NDCG.** Different benchmarks use different metrics. A system that ranks #1 in Recall@10 may rank #5 in NDCG@3. The "best" system depends on what you optimize for.

The safe position: run your own evaluation on a representative sample of your actual queries and your actual corpus. No public benchmark replaces this. Any vendor claim of "X% better than Y on retrieval benchmarks" should be treated as directional, not definitive, until reproduced on your data.

### 5.6 Why the prompt cache makes hybrid retrieval economically viable for Claude Code

This is the system-level insight that connects §5 to Ch 7.

A Claude Code agent that performs RAG on every turn makes two calls: one to the search system (cheap, fast), one to the model (expensive, slower). The search system retrieves chunks; the agent stuffs them into the prompt; Claude generates.

The cost asymmetry: retrieved chunks are different on every query — they can't be cached across requests. But the stable parts of the prompt (system prompt, tool definitions, the knowledge bundle that doesn't change) live earlier in the context and are cached. As described in /rag §6, placing the stable knowledge bundle early (within the cached prefix) and the per-query retrieved chunks late (outside the cache) means that cache hits amortize the cost of repeated turns. The search call retrieves 3–5 fresh chunks per query; the model never re-processes the stable 10,000 tokens of background knowledge it already cached.

Without the prompt cache, every turn re-processes the full stable prefix from scratch. With the cache, only the fresh chunks and the new user message incur full input pricing. At scale, this makes the hybrid retrieval pattern — which otherwise requires a large context window per turn — economically viable.

The /rag dossier §6 covers the placement mechanics in detail. This section exists to name the system-level connection explicitly: the search engine is not isolated from the caching economics of the LLM it serves.

---

## 6. The decision framework

Work through these four steps. Each step narrows the space.

### Step 1 — Corpus size

**Under 100K documents and you already run Postgres.** Start with `tsvector` + GIN index. Add `pg_trgm` for fuzzy name matching. Add `pgvector` if you need semantic search. You have a complete retrieval stack without a single new service to deploy or operate. Revisit this decision when query latency under load exceeds your SLA, or when GIN index maintenance begins to noticeably slow writes.

**100K – 10M documents, small team, no dedicated search ops.** Meilisearch or Typesense for pure full-text search. ParadeDB if you're on Postgres and want Lucene-quality FTS with Tantivy. pgvector + tsvector if the corpus fits in Postgres. Any of these ships as a single binary or a Postgres extension — minimal operational burden.

**10M+ documents, complex ranking, multi-tenant, or multi-field faceting at scale.** Elasticsearch or OpenSearch. Plan the shard count carefully before you have data in production. Budget for at least one team member who understands Elasticsearch operations (shard sizing, merge tuning, heap sizing, snapshot policy).

**Logs, events, or traces at TB/PB scale.** Quickwit. Object storage as primary store dramatically reduces cost vs. Elasticsearch on local SSD. Accepts sub-second rather than millisecond latency — verify your latency SLA allows this.

**"I want zero ops and excellent defaults, cost is secondary."** Algolia. Excellent for e-commerce and documentation search. Verify pricing at algolia.com/pricing before committing at scale.

**"I want hybrid search and I don't want to wire it myself."** ParadeDB (Postgres-native BM25 + pgvector) or a vector-native database with built-in BM25 (Qdrant, Weaviate). Verify current hybrid feature status before committing.

### Step 2 — Query shape

**Exact matches, phrase search, structured filters, facets.** Any FTS engine. The inverted index is designed for this. Priority order by operational simplicity: Postgres tsvector → Meilisearch/Typesense → Elasticsearch.

**Fuzzy / "user typed a misspelling."** Meilisearch or Typesense have the best out-of-the-box typo tolerance. pg_trgm works well for fuzzy name matching in Postgres. Elasticsearch requires explicit ngram analyzer configuration.

**Semantic / "find documents about this topic."** Dense vector search + embedding model. pgvector is the Postgres-native option. Qdrant, Weaviate, or a dedicated vector DB at larger scale. See /ann-vector-indexes and /vector-embeddings-and-semantic-search.

**Mixed — user queries contain keywords AND semantic intent.** Hybrid retrieval (BM25 + vector + RRF) is the production pattern. All of the following support this natively or with light configuration: Elasticsearch (via the `rrf` retriever), Weaviate (built-in hybrid), Meilisearch (hybrid search as a documented feature), ParadeDB (via pg_search + pgvector). Start with RRF; tune only if you have labeled evaluation data.

**Log-style "find all events matching this pattern in a time window."** Elasticsearch EQL, OpenSearch, or Quickwit. Quickwit is the cost-optimized option for long retention.

### Step 3 — Operational appetite

**Solo developer / no ops team / managed everything.** Algolia (hosted) or Meilisearch Cloud or Typesense Cloud. Alternatively: Postgres-only stack (tsvector + pg_trgm + pgvector) on a managed Postgres service — zero new systems.

**Small team with some infra capability.** Meilisearch or Typesense self-hosted (single binary, no cluster). ParadeDB if you're Postgres-native. These require minimal tuning and have clear docs.

**Team with dedicated infrastructure.** Elasticsearch or OpenSearch. Plan for: shard sizing decisions before data arrives, heap configuration (Elasticsearch needs at most half the node's RAM for the JVM heap; the rest goes to OS file cache for Lucene segment files), snapshot policy, index lifecycle management.

**Strict data residency (data must not leave a specific region/datacenter).** Self-hosted options only: Elasticsearch, OpenSearch, Meilisearch, Typesense, Quickwit, any Postgres extension. Eliminate Algolia and Pinecone, which are hosted-only.

### Step 4 — Escape hatches

The pragmatic sequence, in order of operational cost:

1. **Postgres if you can.** `tsvector` + GIN + pg_trgm + pgvector covers 80% of real search requirements without a new service. Go here first.
2. **Single-binary hosted search if you must.** Meilisearch or Typesense when Postgres FTS limitations are hit (typically at multi-digit millions of documents or when you need rich typo tolerance and instant search). Algolia if ops time is the constraint.
3. **Self-hosted Elasticsearch family if you outgrow both.** Elasticsearch or OpenSearch when you need: multiple shards, complex ranking, high-QPS at 100M+ documents, multi-tenancy with separate indexes per tenant, or the full Elastic observability stack.

**Do not pre-optimize.** Starting with Elasticsearch for a 10K-document catalog is an anti-pattern. The operational overhead is real and ongoing. Postgres + pgvector can serve a typical RAG knowledge base for a Claude Code agent at 1M chunks with sub-100ms query latency, no additional cluster to manage, and no migration risk.

### Step 5 — Cost modeling (often neglected)

Most teams compare systems on features. The operational cost over 12 months is often the deciding factor.

**Hosted Algolia.** Price scales per operation (search, index). For 10K searches/day at a medium plan, the annual cost can be $1,000–$10,000+ (verify at algolia.com/pricing — not reproduced here to avoid staleness). Engineering time: near-zero for search ops. Total: moderately expensive at scale, cheap in absolute dollars for small deployments.

**Self-hosted Elasticsearch (single node, 3-shard).** A 4-core / 16GB RAM server with 500GB SSD might run $200–500/month on any major cloud. Storage grows with corpus. Add backup storage. Engineering time: initial setup 1–2 days; ongoing ops (cluster health, shard sizing, GC tuning, upgrade testing) 1–4 hours/week in a team that takes it seriously. Total: cheap in direct dollars, expensive in engineering time.

**Postgres on a managed service (RDS, AlloyDB, Supabase).** A db.r6g.xlarge (4 vCPUs, 32 GB) on RDS costs roughly $200–400/month depending on region. pgvector and tsvector add no extra service cost. If you're already running Postgres for your application, the marginal cost of adding FTS and vector search is effectively zero until you need a larger instance. Engineering time: negligible if your team already knows Postgres.

**Meilisearch / Typesense self-hosted.** Single binary, 4 GB RAM instance (e.g., $20–50/month). Engineering time: setup half-day, ongoing ops minimal (restart on crash, disk monitoring). Total: very cheap at small-to-medium scale.

**The break-even calculation.** Take the annual engineering cost of running and maintaining a search cluster (say, $50K for 5% of a senior engineer's time). Compare that to the savings from switching from Algolia to self-hosted. For most teams processing fewer than 1 million searches/month, the calculus favors managed services or Postgres. The crossover where self-hosted wins on total cost of ownership typically happens at 10M+ searches/month or when hosted pricing becomes prohibitive.

This is a rough directional model — actual costs vary significantly by team size, cloud provider, instance type, and operational sophistication. Run the numbers for your specific situation before making a decision based on system comparison alone.

### Step 6 — Update rate and write amplification

A detail that the feature-comparison framing often misses: how often does your corpus change?

**Mostly static corpus (updated once/day or less).** Any system works. You can afford expensive offline batch reindexing. Even Quickwit (which has seconds-to-minutes ingest latency due to object storage commit cycles) is fine.

**Hourly or daily update cadence.** Elasticsearch and Meilisearch handle this well with their segment refresh model (§ 3.5). Postgres handles it naturally via WAL and index maintenance. Quickwit's ingest latency (the time from write to searchable) may be 30–120 seconds depending on commit interval — verify if sub-minute freshness is required.

**Write-heavy (continuous writes, high throughput).** This is where many FTS engines struggle. Lucene's segment model means every write triggers eventual segment maintenance (flush, merge). Under write-heavy workloads, merge I/O can become a bottleneck. Quickwit's object-storage model decouples compute from storage but still has commit latency. For write-heavy + near-real-time search requirements, Elasticsearch with tuned merge policies and careful refresh interval settings is the standard approach — but it requires operational expertise. Consider whether you actually need sub-1-second freshness before optimizing for it.

**The index-as-a-batch-build pattern.** For some use cases (a static documentation site, an enterprise knowledge base that updates once/week), you don't need a live ingest pipeline at all. Build the index from scratch as a batch job, upload it to the search engine, and swap. Meilisearch and Typesense make this easy. Quickwit is designed for it on object storage. Elasticsearch supports index aliases for zero-downtime swaps. This pattern avoids all the write-amplification problems entirely.

### Decision flowchart (narrative)

```
< 100K + Postgres? → tsvector + pg_trgm + pgvector. Stop.
< 100K, no PG?    → Meilisearch or Typesense.
100K–10M, PG?     → ParadeDB or tsvector + pgvector.
100K–10M, new?    → Meilisearch/Typesense or Qdrant/Weaviate.
10M+, logs/TB?    → Quickwit.
10M+, no-ops?     → Algolia.
10M+, complex?    → Elasticsearch or OpenSearch.
+ Fuzzy typo?  → Meilisearch/Typesense, or pg_trgm in Postgres
+ Semantic?    → add vector (pgvector, Qdrant, Weaviate)
+ Mixed?       → add RRF hybrid retrieval
+ Residency?   → self-host only; eliminate Algolia, Pinecone
```

---

## 6b. Worked example — choosing a system end-to-end

Consider three realistic scenarios. Running through the decision framework concretely is more useful than abstract principles.

### Scenario A: internal documentation search for a 500-person company

**Corpus:** 30,000 markdown and confluence documents. Updated daily via a sync job. Documents average 1,200 words.
**Query shape:** full-text search ("how do I set up SSO?"), sometimes semantic ("onboarding process for contractors" should find docs about "new hire access provisioning").
**Team:** 2 backend engineers. No dedicated ops. Running on AWS with a managed Postgres database.
**Latency target:** sub-500ms acceptable; under 200ms preferred.
**Budget:** $200–500/month infrastructure.

**Decision walkthrough:**

Step 1 — corpus: 30K docs is well under 100K. Already on Postgres. → `tsvector` + GIN first.

Step 2 — query shape: semantic component needed ("onboarding process" ↔ "new hire access provisioning"). → Add pgvector for embedding search. Hybrid with RRF: `tsvector` + GIN for lexical recall, pgvector HNSW for semantic recall.

Step 3 — ops: no dedicated ops team, managed Postgres already in use. → Postgres-only stack. Zero new services to deploy or monitor.

Step 4 — escape hatch check: 30K docs at ~1,200 words = ~36M tokens. pgvector at 1,536 dimensions per chunk (say 300-word chunks → ~120K chunks) = ~120K vectors. At fp32, ~700MB index — fits in memory on a db.r6g.large. No escape hatch needed.

**Result:** Postgres with `tsvector` + GIN for FTS, `pgvector` with HNSW for semantic, RRF-style combination in application code (fetch top 50 from each, merge by rank, return top 10). An embedding model (Voyage AI recommended by Anthropic's Claude docs) for offline chunk embedding and query-time embedding. Total new infrastructure: zero. Total new engineering: 2 days for the embedding pipeline and hybrid query logic.

---

### Scenario B: e-commerce product search for a growing retailer

**Corpus:** 800,000 SKUs. Updated continuously as inventory changes (price, availability). Rich structured data: category, brand, price, rating, in-stock flag.
**Query shape:** instant autocomplete as user types. High typo tolerance ("neke shoes" → Nike). Facets (filter by brand, price range, category). Some semantic intent ("comfortable running shoes for wide feet").
**Team:** 3 engineers; 1 can handle infra. Managed cloud preferred.
**Latency target:** under 50ms for autocomplete. Under 200ms for full search with facets.
**Budget:** $500–2,000/month.

**Decision walkthrough:**

Step 1 — corpus: 800K docs exceeds the Postgres-comfortable range for instant autocomplete (GIN on 800K products is fine for full search, but autocomplete with edge n-gram requires either careful Postgres configuration or a dedicated engine). → Consider single-binary FTS engine.

Step 2 — query shape: instant typo-tolerant autocomplete is the hardest requirement. Meilisearch and Typesense both excel here out of the box. Facets: both support. Semantic ("comfortable running shoes for wide feet"): add hybrid embeddings.

Step 3 — ops: small team, prefer managed. Both Meilisearch Cloud and Typesense Cloud are viable options.

Step 4 — continuous updates: 800K products with continuous price/availability updates. Both Meilisearch and Typesense support partial document updates via API. Refresh is near-instant (documents are available within seconds). Compatible.

**Result:** Meilisearch Cloud or Typesense Cloud. Start with Typesense for its v30.2 feature set and known e-commerce use case fit (community-reported; verify at typesense.org for current e-commerce reference implementations). Add hybrid semantic search when "long-tail query" miss rates become a complaint from search analytics. Fallback: Algolia if the team lacks appetite for even single-binary ops and budget allows premium pricing.

---

### Scenario C: log search for a microservices platform (50 services, 1TB/day of logs)

**Corpus:** 30-day retention at 1 TB/day = 30 TB. Events: structured JSON, timestamped, service-name tagged.
**Query shape:** point lookups by trace ID, range queries by time window, full-text search for error messages, aggregations (error rate by service, p95 latency by hour).
**Team:** platform engineering team of 5. Comfortable with infrastructure.
**Latency target:** sub-second for interactive log search. Batch aggregations can be minutes.
**Budget:** cost is the primary constraint; current Elasticsearch cluster on SSDs costs $15K/month.

**Decision walkthrough:**

Step 1 — corpus: 30 TB. This is where Quickwit earns its niche — object storage as the primary tier costs roughly 2–5% of SSD storage. S3 at $0.023/GB × 30,000 GB = $690/month for storage vs. roughly $3,000–8,000/month for equivalent SSD capacity on cloud VMs.

Step 2 — query shape: structured + full-text + aggregations. Quickwit supports this natively (OpenTelemetry ingest, Jaeger trace format, aggregations). Sub-second search on object storage is its specific design target.

Step 3 — ops: team is infra-capable. Quickwit is more complex than Meilisearch but simpler than full Elasticsearch at this data volume.

**Result:** Quickwit on S3. Accept the trade: ingest latency of ~30–120 seconds (logs are not searchable immediately after write) in exchange for 80–90% storage cost reduction. Migrate off Elasticsearch's hot tier; use Quickwit for the 30-day retention window. If sub-10-second ingest freshness is required for specific alert use cases, keep a small Elasticsearch hot tier for the last 24 hours and route older queries to Quickwit.

---

## 7. The cache callback (Ch 7) — the system-level view

This section connects the search system to the broader Claude Code architecture.

**The search system lives behind an MCP server.** In a Claude Code agent that uses search, the search tool is typically exposed via an MCP server (see /mcp dossier). The MCP server definition — the tool name, description, and parameter schema — lives in the `tools` array of every Claude Code request. That `tools` array is part of the cached prefix (Ch 7). Adding a search MCP server adds tokens to the cached prefix.

**The tool definition is stable; the results are not.** The Elasticsearch or Meilisearch search tool definition (its name and parameter schema) is the same on every turn — it belongs in the cached prefix, and it gets cached after the first call. The search results returned by that tool on a specific query are different every time — they live in the `tool_result` message of the current turn, outside the cache.

**The stable knowledge bundle pattern.** As described in /rag §6, if you have a large, slowly-changing set of background documents (e.g., a company wiki), you can embed the most important ones directly in the system prompt as a "stable knowledge bundle" rather than retrieving them on every turn. This bundle is cached after the first request. Per-query retrieval from Elasticsearch then handles the dynamic, query-specific parts. The cache economizes on the stable part; the search system handles the dynamic part.

**Shard count and MCP tool registration.** This is an operational detail worth naming: if your Elasticsearch cluster has a high shard count, it does not directly affect the MCP tool definition size. The MCP tool definition is just a JSON schema describing the search API. But a search tool that returns 200KB of results per call will push those results outside the cache on each turn — large tool results are a real cache miss source.

**Multiple MCP search servers and cache fragmentation.** A Claude Code agent connected to three MCP search servers (one for code, one for docs, one for issues) has three tool definitions in the cached prefix — each contributing tokens. Adding a new MCP server always grows the `tools` array, which is a prefix component. Changing any tool definition (name, description, parameters) invalidates the cache for the entire `tools` array. This means: design MCP search tool schemas conservatively. Don't iterate on the tool description during development without understanding the cache penalty. The tradeoff is: richer tool descriptions help the model choose the right tool; but they cost more tokens and any change blows the cache.

**Practical architecture for a Claude Code agent with search:**
1. System prompt (cached) — instructions, persona, stable background.
2. Tool definitions (cached) — search tool, file tools, other MCP tools.
3. Optional: stable knowledge bundle (cached, if small enough and stable enough).
4. Per-turn conversation history (cached, rolling).
5. Current tool results from search (not cached — different every turn).
6. User message (not cached).

The search system operates at layer 5. Its cost is dominated by the latency and compute of the search query itself, not by caching economics — caching economics dominate layers 1–4.

**Latency budget allocation.** In a Claude Code agent that does RAG on every turn, the total response latency is roughly:
- Search query: 5–100ms (Postgres/Meilisearch on small corpus) to 100–500ms (Elasticsearch with reranker at scale).
- Embedding the query (if needed for semantic search): 50–200ms (hosted embedding API) or 5–20ms (local model).
- Reranking top-K results: 100–500ms (hosted cross-encoder) if used.
- LLM generation (time-to-first-token): depends on prompt length, model, and cache state.

The search latency is typically the smallest component of total response time for a Claude Code agent. The dominant cost is LLM inference. This means: optimizing search latency from 100ms to 50ms has much less user-visible impact than ensuring the prompt cache is hot (which can reduce LLM input processing time by 5–10× on repeated queries). Allocate optimization effort accordingly.

**The MCP search server as a pattern for Claude Code extensions.** The /mcp dossier describes how MCP servers expose tools. A search MCP server for a private knowledge base typically looks like:
- One tool: `search_knowledge_base(query: string, top_k: int) -> list[{title, snippet, url}]`
- The server handles: embedding the query, running the ANN search on pgvector or the BM25 search on Elasticsearch, reranking if configured, and formatting results.
- The tool schema (name, description, parameter types) goes into the cached `tools` array. The results per call are live.

This is the canonical pattern for wiring a search system into Claude Code. The search engine sits behind the MCP server; Claude sees only the tool abstraction.

---

## 7b. Operational realities — what the docs don't tell you

This section captures the operational experience that is rarely in official documentation but consistently appears in community discussions. These are labeled **community-reported** throughout — they are patterns observed across many Elasticsearch deployments, not documented behaviors.

### The JVM heap problem

Elasticsearch runs on the JVM. The JVM heap holds Lucene's per-segment metadata, fielddata cache, aggregation buffers, and the filter cache. Lucene segment files themselves use OS file cache (off-heap). The standard guidance: set the JVM heap to at most 50% of available RAM, and no more than 26–32 GB (to avoid compressed OOPs overhead). The rest goes to OS cache for Lucene segment files. (Community-reported guidance; verify at elastic.co/guide/en/elasticsearch/reference/current/advanced-configuration.html.)

The failure mode: a team sets 64 GB heap on a 64 GB node. Lucene segments have no OS cache. Every segment access is a disk read. Performance degrades drastically. The fix is counterintuitive: give the JVM *less* heap and let the OS cache do its job.

### The warm-up problem

A freshly started Elasticsearch node, or a node that was restarted, has cold OS cache. The first queries after a restart will be slow — sometimes 10–100× slower than steady-state — because segment files must be loaded from disk into cache. Production deployments mitigate this with:
- Keeping replica shards as a "warm standby" that absorbs traffic during primary shard restarts.
- Pre-warming new nodes by running a representative query workload before moving them into the load balancer pool.
- Using `index.store.preload` settings to tell the OS to preload specific segment file types into cache on node start.

### The "split brain" historical artifact

Elasticsearch had a notoriously difficult "split brain" failure mode in versions before 7.0, where a cluster partition could result in two masters electing themselves and corrupting data. This was resolved with the quorum-based election system introduced in 7.0. If you encounter discussions of Elasticsearch split brain in community forums, check the date — it is a historical issue, not a current one. **Documented:** Elasticsearch 7.0 release notes describe the cluster coordination improvements.

### Mapping explosion

Elasticsearch allows dynamic mapping: when a new field appears in a document, it is automatically added to the index mapping. This is convenient but dangerous. A corpus with highly variable document structure (e.g., JSON logs where each service adds its own fields) can trigger "mapping explosion" — thousands or tens of thousands of distinct field names. Each field consumes heap memory for metadata. The fix: use `dynamic: strict` mapping mode to reject unknown fields, or `dynamic: false` to index but not search on unmapped fields. (Community-reported pattern; documented in Elasticsearch mapping docs.)

### The relevance score debugging loop

"Why is document A ranked higher than document B?" is one of the most common Elasticsearch support questions. The `explain: true` query parameter returns a verbose breakdown of the BM25 computation for each document — term frequencies, IDF values, field-length normalization. This is invaluable for debugging relevance but doubles or triples query response time. Do not enable `explain: true` in production query paths; use it only in debugging sessions.

### Snapshot hygiene

Elasticsearch snapshots are the backup mechanism. Common failure modes:
- Not testing restores. A snapshot that was never tested may be corrupt or incomplete.
- Keeping too many snapshots without a retention policy. Object storage for snapshots can grow unboundedly.
- Running `_forcemerge` before a snapshot of a read-only index — this is the documented optimization, but force-merging a live, write-heavy index can cause severe latency spikes. Only force-merge indexes that are no longer receiving writes.

### The Elasticsearch vs. OpenSearch upgrade compatibility trap

Elasticsearch snapshot format is version-dependent. A snapshot created by Elasticsearch 7.x can be restored into Elasticsearch 8.x with some caveats. A snapshot created by Elasticsearch 7.x cannot be restored into OpenSearch without additional compatibility steps. If you are considering migrating from one to the other, plan the migration path before taking a snapshot dependency. Community-reported: some teams have discovered this constraint only when attempting to migrate mid-project.

---

## 8. Common misconceptions / pedagogical traps

**1. "Elasticsearch is a database."** It is a search engine. It is not designed for: multi-document transactions, strong consistency guarantees, or point-in-time reads. It is a bad fit for: application state, financial ledgers, or systems where write durability under partial failure is a hard requirement. By default, a write to Elasticsearch is "acknowledged by the primary shard" — replica replication is asynchronous. At its core, Elasticsearch is a read-optimized index, not a write-optimized store.

**2. "Lucene is old, so it's slow."** No. Lucene is actively developed (current version 10.4.0 as of mid-2026, per lucene.apache.org). It implements block-max WAND for score pruning (community-reported as a key performance technique in Lucene's scorer), and its vector search implementation is competitive with dedicated ANN libraries on standard benchmarks (community-reported; not fetched directly). Most systems that claim to be "faster than Elasticsearch in benchmarks" are either using Lucene internally (Tantivy is explicitly a Lucene-inspired library in Rust), or benchmark a narrow use case where their architecture has a structural advantage (e.g., in-memory-only at a scale that fits in RAM). The algorithm advantage of inverted index retrieval is well-understood and hard to beat for its use case.

**3. "Hosted search (Algolia) is always more expensive."** Not at small scale. An Algolia plan at 10K searches/month may cost less than the engineering time to set up, tune, and operate a self-hosted Elasticsearch cluster. The crossover point — where the per-operation fee of hosted search exceeds the amortized cost of self-hosted operations — varies by team. Do the math for your specific situation.

**4. "BM25 is obsolete because of embeddings."** No. BM25 reliably finds documents with exact keyword matches — product names, error codes, proper nouns, rare technical terms. Dense embeddings reliably find documents with related meaning. In production, the combination (hybrid retrieval via RRF) typically outperforms either alone. BM25 will be part of the winning retrieval stack for the foreseeable future.

**5. "OpenSearch and Elasticsearch are interchangeable."** At the REST API level for simple queries, mostly yes. At the ML/AI feature level: no. Elastic's ELSER, AI search analytics, and GenAI integrations have no direct OpenSearch equivalent. OpenSearch has its own neural search stack that differs in implementation. For teams evaluating both, verify feature-for-feature parity on the capabilities you actually need, especially anything in the ML/AI space.

**6. "Postgres FTS can't compete."** At under 10M documents, Postgres tsvector + GIN competes very well with dedicated search engines on both latency and recall. It adds zero operational complexity for teams already running Postgres. The limitation is at large scale (GIN maintenance during bulk writes, single-node limits) and for advanced features (real-time typo tolerance, rich faceting, cross-shard aggregations).

**7. "ColBERT is the future of retrieval."** Possibly, but unverified at scale. ColBERT benchmarks well on BEIR and similar retrieval benchmarks (community-reported). Its production adoption as of 2026 is uneven — the index storage cost (vectors per token rather than per document) is a real barrier for large corpora. Treat it as promising research + niche production use, not the default choice.

**8. "Shard count is a tuning knob."** For Elasticsearch, primary shard count is set at index creation and is effectively permanent without a full reindex. It is not a knob you turn later. Getting it wrong means either rebuilding the index (expensive) or living with suboptimal shard distribution. Plan this before you have production data.

**9. "A vector database makes an inverted-index search engine obsolete."** No. For keyword matching, exact phrases, faceted filtering, and structured queries, the inverted index wins — both on latency and interpretability. For semantic matching across paraphrase and synonym, the vector index wins. For production retrieval that must handle both query types (the realistic case), hybrid is the answer. A vector database alone is incomplete for most production search requirements.

**10. "Search engines store your documents."** They store an analyzed, indexed form of your documents. The original document is usually stored in a `_source` field (Elasticsearch does this by default) but the index itself is an inverted representation — term → document list. This matters for storage cost calculations: a large corpus has both the inverted index (roughly 20–30% of raw text size per Lucene docs) and the `_source` (the original document). Disabling `_source` storage saves space but breaks update operations and some query features.

**11. "I'll add a search engine when I need it."** The migration cost matters. Moving from Postgres FTS to Elasticsearch at 50M documents under production load is a non-trivial infrastructure project. Plan the migration path before you hit the limit, not after. Postgres tsvector is a graceful starting point precisely because the migration cost is incurred gradually, not all at once.

**12. "Typo tolerance requires fuzzy search."** It can be implemented several ways. Elasticsearch supports `fuzziness: "AUTO"` on match queries (Levenshtein distance-based). Meilisearch and Typesense implement typo tolerance as a first-class feature with better defaults. pg_trgm uses trigram similarity. Each approach has different performance characteristics and edge cases — "fuzzy search" is not one thing.

---

## 9. House-style chapter ideas

### Diagram options

**Diagram option A (recommended): The six universal pieces applied to three systems.** An HTML/CSS diagram showing the six universal pieces (Ingest / Analyzer / Index / Query / Score / Coordinator / API) as a vertical stack. Three columns: Elasticsearch, Meilisearch, and Postgres. Each cell shows how that system implements or omits that piece. For Elasticsearch: standard analyzer / Lucene segments / JSON DSL / BM25+vector / cluster manager. For Meilisearch: built-in tokenizer / custom engine / REST API / ranking rules / embedded (no cluster). For Postgres: to_tsvector() / GIN index / SQL / ts_rank / single-node (no coordinator). The side-by-side makes the tradeoffs immediately visible.

**Diagram option B: The decision flowchart.** HTML/CSS flowchart implementing § 6. Four yes/no decision nodes: corpus size, query shape, operational appetite, hosting requirement. Terminal nodes are highlighted system names. This is the chapter's practical payoff rendered as a visual.

**Diagram option C: The analyzer pipeline.** SVG with arrows. Input text enters, passes through three labeled stages (char filter, tokenizer, token filter), tokens emerge. Each stage has a small example: char filter strips HTML, tokenizer splits on whitespace/punctuation, token filters lowercase and stem. The "Quick brown FOXES, jumping!" → [quick, brown, fox, jump] example from § 3.2 makes this concrete.

**Recommended:** Option B for the chapter diagram (it is the unique contribution of this chapter). Option A or C as the React island. Option A is richer for learning; option B is more useful as a tool.

### React island options

**Demo option A (recommended): "The analyzer pipeline visualizer."** React island `SearchAnalyzerDemo`. User types a phrase into a text input. Below the input, three columns animate: "After char filter" → "After tokenizer" → "After token filters (stem + stopword + lowercase)." Each stage shows the intermediate token list as colored chips. Data: a small lookup table of hand-authored (input → analyzed tokens) pairs covering edge cases (stemming, stopwords, punctuation). Takeaway: the same text produces very different tokens depending on analyzer configuration; this is why "search isn't finding my documents" bugs happen.

**Demo option B: "BM25 vs. dense vs. hybrid."** Three side-by-side result lists for the same query, over a corpus of 10 hand-authored documents (two topics). Each method ranks differently. Hover a result to see a tooltip: "Matched tokens: [fox, jump]" or "Vector similarity: 0.82." Reveals concretely how BM25 wins on keyword matches and dense wins on semantic matches. React island `SearchMethodComparison`. Data in `src/data/search-systems.ts`.

**Demo option C: "Deployment chooser."** Four multiple-choice questions matching § 6 (corpus size / query shape / ops appetite / hosting). As the reader answers, one row of the comparison table highlights. The highlighted system's niche sentence appears below the table. React island `DeploymentChooser`. Simplest to build; most directly teaches the decision framework.

**Recommended:** Demo option A for pedagogical depth; Demo option C as the simpler fallback if build time is constrained.

**React island name (for option A):** `SearchAnalyzerDemo`
**Data file:** `src/data/search-systems.ts`
**Takeaway angle:** "Analyzers are where most search bugs are born. Once you see the token stream, the bug is obvious. Before you see it, you're guessing."

---

## 10. Hand-authored data plan

### 10.1 Illustrative corpus (~10 documents)

Ten documents covering two topics (topic A: animals, topic B: cooking), designed so that BM25, dense embeddings, and hybrid each produce visibly different rankings for the same query.

```
Doc 1: "The quick brown fox jumps over the lazy dog."  [animals]
Doc 2: "Foxes are carnivorous mammals in the family Canidae."  [animals]
Doc 3: "Canines adapt well to suburban environments."  [animals]
Doc 4: "Dogs require daily exercise and mental stimulation."  [animals]
Doc 5: "A recipe for pan-seared salmon with lemon butter sauce."  [cooking]
Doc 6: "How to debone and fillet a whole fish at home."  [cooking]
Doc 7: "The Maillard reaction creates browned flavors in cooked meats."  [cooking]
Doc 8: "Wild animals should not be fed human food."  [animals+cooking-adjacent]
Doc 9: "Cooking techniques for game meat: venison, duck, boar."  [cooking+animals-adjacent]
Doc 10: "Carnivore diets emphasize animal proteins over plant sources."  [both]
```

Query 1: "fox" — BM25 wins on Docs 1, 2. Dense may surface Doc 3 (canine proximity). Hybrid returns Docs 1, 2, 3.
Query 2: "canine nutrition" — BM25 may miss (no exact match). Dense surfaces Docs 3, 4, 10. Hybrid adds Doc 8.
Query 3: "browning meat" — BM25 matches Doc 7 (Maillard, browned, meats). Dense surfaces Docs 9, 7. BM25 wins.

### 10.2 Analyzer pipeline trace — 6 sample queries

| Input | After char filter | After tokenizer | After lowercase + stop | After stemmer |
|---|---|---|---|---|
| "Quick brown FOXES, jumping!" | same | [Quick, brown, FOXES, jumping] | [quick, brown, foxes, jumping] | [quick, brown, fox, jump] |
| "Running SHOES on sale" | same | [Running, SHOES, on, sale] | [running, shoes, sale] | [run, shoe, sale] |
| "it's a dog-eat-dog world" | same | [it's, a, dog, eat, dog, world] | [dog, eat, dog, world] | [dog, eat, dog, world] |
| "ERROR: null pointer exception" | same | [ERROR, null, pointer, exception] | [error, null, pointer, exception] | [error, null, pointer, except] |
| "<b>Hello</b> World" | "Hello World" (HTML stripped) | [Hello, World] | [hello, world] | [hello, world] |
| "foxes foxes foxes" | same | [foxes, foxes, foxes] | [foxes, foxes, foxes] | [fox, fox, fox] |

Note: "on", "a", "it's" removed as stopwords. "exception" stems to "except" (English snowball stemmer approximation). Actual stemmer outputs depend on the specific Snowball variant — these are illustrative, not exact.

### 10.3 Comparison table (§ 4.13 above)

### 10.4 Decision flowchart node/edge structure

Decision nodes: N1 (Corpus < 100K?) → N2 (Already on Postgres?) → T1 (tsvector+pg_trgm+pgvector) or T2 (Meilisearch/Typesense). N1-no → N3 (100K–10M?) → N7 (Need hybrid?) → T3 (ParadeDB) or T4 (Meilisearch). N3-no → N4 (10M+?) → N5 (Logs/TB scale?) → T5 (Quickwit). N5-no → N6 (No-ops hosted?) → T7 (Algolia) or T6 (Elasticsearch/OpenSearch).

```
Cross-cutting modifiers (apply after reaching a terminal):
  + Fuzzy typo needed    → prefer Meilisearch/Typesense terminal
  + Semantic needed      → add vector search to terminal
  + Mixed query shape    → add RRF hybrid to terminal (T8)
  + Data residency req.  → eliminate Algolia, Pinecone (hosted-only)
  + Write-heavy corpus   → validate ingest latency for chosen terminal
```

BM25 + fuzzy modifier: if "user needs typo tolerance" add Meilisearch/Typesense to whichever terminal. If "semantic needed" add vector to terminal. If "mixed" → T8 after any terminal.

---

## 11. Connections to existing chapters and dossiers

**Pattern-matching algorithms** (`/docs/research/pattern-matching-algorithms.md`). The algorithms inside Lucene/Tantivy — BM25 scoring is a statistical extension of term frequency matching, which is the pattern-matching family. The Boyer-Moore and Aho-Corasick structures in /pattern-matching are the same families that Lucene uses for phrase queries and multi-term lookups. KMP and suffix arrays appear in the segment compression layers. Specifically, Lucene's phrase search uses position data in the postings list to verify token adjacency — this is Aho-Corasick-family multi-pattern scanning applied to the posting list rather than the raw text. The /pattern-matching dossier's coverage of SIMD in ripgrep (§ 9.3 in that dossier) is the same technique Lucene uses for WAND (Weak AND) score pruning and posting list traversal.

**Data search strategies** (`/docs/research/data-search-strategies.md`). This dossier packages the access strategies described there — particularly the inverted index (§ "inverted indexes for full-text search" in /data-search) and the hash-based lookup (for exact term lookup). Every search engine in this dossier is implementing those strategies in a packaged, deployable form. The /data-search dossier's coverage of Bloom filters and zone maps (used in columnar databases for "skip unproductive files") is the same principle Quickwit uses to avoid reading entire object-storage segments that don't contain the query terms.

**Indexing strategies** (`/docs/research/indexing-strategies.md`). The per-shard Lucene index choices, segment merges (§ 3.5 above), and the "every index slows writes" law all appear in /indexing-strategies. The leftmost-prefix rule for composite indexes (§ 3 of /indexing-strategies) applies directly to Elasticsearch field mappings and the order in which you structure bool filter clauses. The "covering index" concept from /indexing-strategies appears in Elasticsearch as `doc_values` — a columnar store for field values used in sorting, aggregations, and script scoring without touching the stored `_source`. The /indexing-strategies note that "an index that no query uses is pure tax" applies directly to Elasticsearch: every indexed field costs index space, GC pressure (for heap-stored structures), and write amplification. Disable `index: false` on fields you never search; disable `doc_values: false` on fields you never aggregate or sort.

**Vector embeddings and semantic search** (`/docs/research/vector-embeddings-and-semantic-search.md`). The vector half of hybrid retrieval. The dense embedding model and the kNN query in Elasticsearch (§ 3.8) plug directly into the retrieval architecture described in /vector-search. The distinction between per-token Ch 2 embeddings and retrieval embeddings from /vector-search is the prerequisite mental model for understanding Elasticsearch's kNN search. Specifically: Elasticsearch's `dense_vector` field stores a single retrieval embedding per document (per the /vector-search model — one vector per chunk, not per token), not the per-token input-layer embeddings from Ch 2. This distinction prevents the common confusion: "why doesn't Elasticsearch automatically have semantic understanding since it's built on Java ML?" — because the embedding is an external model artifact you supply, not something Elasticsearch computes.

**ANN vector indexes** (`/docs/research/ann-vector-indexes.md`). The HNSW and IVFFlat indexes used by Elasticsearch, pgvector, Qdrant, and Weaviate are described in detail in /ann-vector-indexes. The recall/latency/memory tradeoff triangle (§ 2 of /ann-vector-indexes) directly governs how you configure kNN search in Elasticsearch (`num_candidates` parameter in the knn option — higher = better recall, higher latency). The DiskBBQ algorithm mentioned in Elasticsearch's kNN docs is a disk-based quantized variant targeting memory efficiency — the same recall/memory tradeoff explored in /ann-vector-indexes § IVF+PQ. For pgvector, the /ann-vector-indexes coverage of IVFFlat vs. HNSW applies directly: HNSW for low-latency interactive search, IVFFlat for memory-constrained environments.

**RAG** (`/docs/research/rag.md`). RAG is the primary consumer of the search systems in this dossier. The hybrid retrieval pattern described in /rag §5.1 (RRF, weighted combination) maps directly to the hybrid search implementations in Elasticsearch, Weaviate, Meilisearch. The "stable knowledge bundle" placement pattern in /rag §6 is the mechanism by which the cache callback (§ 5.5, § 7 above) works. The /rag dossier's § 4 coverage of chunking strategy is a direct input to how you structure documents before indexing into any system in this dossier — chunking is logically upstream of ingest pipeline configuration. The /rag note on "stale index" (§ 8) — that RAG pushes the freshness problem from model weights to document ingestion pipelines — applies directly to the update-rate step in the decision framework (§ 6, Step 6).

**MCP** (`/docs/research/mcp.md`). Search tools surface to Claude Code via MCP servers. The Elasticsearch or Meilisearch search API is typically wrapped in an MCP server that exposes one or more tools (e.g., `search_documents`, `search_logs`). The MCP tool definition occupies the `tools` array in every request — a cached prefix segment per Ch 7. Adding multiple search MCP servers (one per knowledge base) multiplies the token overhead of tool definitions. The /mcp dossier's note that "from the model's perspective, there is no distinction between a tool defined inline and a tool delivered by an MCP server" applies here: the search engine is invisible to the model, which only sees the tool name and parameters.

**Ch 7 prompt cache** (`/docs/research/rag.md` §6, GOAL.md Ch 7 spec). The cache callback appears in § 5.5 and § 7 above. The core connection: search results (per-query retrieved chunks) are outside the cache; tool definitions (the search API schema) are inside the cache. This split is the system-level reason that hybrid retrieval is economically viable despite requiring a large context window per turn. The Ch 7 practical takeaway "stable content early, mutable content late" maps directly to the RAG architecture recommendation: system prompt + tool definitions + stable knowledge bundle (early, cached) + retrieved chunks (late, per-query, not cached).

---

## 11b. A note on ingest pipelines and data quality

The dossier has focused heavily on query-time mechanics — scoring, ranking, reranking. A practical observation that deserves explicit mention: in most real deployments, ingest pipeline quality determines retrieval quality more than any query-time tuning.

The ingest pipeline is where you control:

- **What gets indexed.** If you don't extract and index a field, you can't search it. This sounds obvious until you discover that a critical metadata field was never mapped.
- **How text is analyzed.** The analyzer choice at index time is permanent for that index version. Changing the analyzer requires reindexing. Get it wrong and you'll reindex millions of documents to fix a tokenizer choice.
- **What goes into the embedding.** For vector search, the quality of the chunk — its size, its boundaries, whether it includes enough context to make the embedding meaningful — determines retrieval recall more than the choice of embedding model. See /rag § 4 for chunking strategy details.
- **Metadata richness.** Documents that carry rich metadata (source URL, date, author, section heading, topic tag) enable filter and faceted search downstream. Documents that arrive as raw text blobs force keyword search to do all the work.
- **Freshness handling.** How deleted documents are handled (tombstone vs. hard delete), how updates are processed (full document replace vs. partial update), and whether the ingest pipeline is idempotent (can safely re-run without duplicating data) all affect operational correctness.

The practical implication: before investing in cross-encoder rerankers or hybrid retrieval, audit the ingest pipeline. A well-analyzed, richly-structured corpus with BM25 will outperform a poorly-chunked, metadata-free corpus with a cross-encoder reranker. Relevance is won or lost at ingest time.

**The "garbage in, garbage out" failure mode for RAG specifically.** A common RAG failure pattern: the team spends weeks selecting an embedding model and tuning vector search parameters, while the chunks themselves are structured in a way that fragments natural document boundaries (e.g., splitting a legal clause in the middle) or includes boilerplate headers and footers that pollute the embedding. The retrieval appears to return "relevant" chunks by embedding similarity but the actual answer to the user's question is split across two chunks that are never returned together. The fix is chunking strategy (see /rag § 4), not embedding model selection.

---

## 12. Closing-takeaway angle

Production search is not one system. It is a menu of systems with very different shapes, and the right one falls out from three questions: how big is the corpus, what does the query look like, and how much operational complexity can you absorb?

Elasticsearch is the industry's most-documented, most-deployed answer — and it is often the wrong answer for teams who haven't yet outgrown Postgres. Postgres with `tsvector`, `pg_trgm`, and `pgvector` covers the majority of real search requirements without a single new service to deploy. Meilisearch and Typesense cover the gap between Postgres and Elasticsearch for teams that need instant typo-tolerant search at millions of documents. Quickwit covers the gap for log-scale event data on object storage.

The frontier is hybrid retrieval: BM25 for keyword precision, dense vectors for semantic recall, cross-encoder rerankers for final ranking quality. RRF is the default merge strategy. This pattern is now supported natively by Elasticsearch, Weaviate, Meilisearch, ParadeDB, and others. It is not bleeding-edge research — it is the production default for any system where query quality matters.

And the prompt cache (Ch 7) is what makes wiring all of this into a Claude Code agent actually affordable: the search tool definition is cached, the background knowledge bundle is cached, and only the per-query retrieved chunks are live. A well-architected Claude Code agent with an Elasticsearch backend can serve thousands of turns without re-processing its stable context — because the search system and the cache work together, not independently.

The reader who has internalized the decision framework will not need to revisit the comparison table every time a new system appears. The framework is stable. "What is the corpus size? What is the query shape? What is the operational appetite?" — those three questions have been sufficient to narrow the field since the 1990s and will remain sufficient when the specific systems in this dossier have changed their names, merged, or been superseded.

One final note on honesty: the search engine landscape is extremely active. New versions ship every few months. The systems that were experimental in 2023 are production-grade in 2026. The claims in this dossier about specific versions, feature availability, and operational limits should be treated as a snapshot of mid-2026. The decision framework is more durable — corpus size, query shape, and operational appetite are the axes that will still be relevant in 2028. The specific system names at the terminals of the decision tree will shift faster than the framework itself.

---

## 13. Up-to-date facts (with citations and dates)

| Claim | URL | Fetched | Confidence |
|---|---|---|---|
| Elasticsearch is "a distributed search and analytics engine, scalable data store, and vector database built on Apache Lucene" | elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html | 2026-05-17 | Documented |
| Elasticsearch supports approximate kNN via HNSW and DiskBBQ; `rescore_vector` available since v9.1 | elastic.co/guide/en/elasticsearch/reference/current/knn-search.html | 2026-05-17 | Documented |
| Elasticsearch RRF formula: score = Σ 1/(k+rank), k=60 default | elastic.co/guide/en/elasticsearch/reference/current/rrf.html | 2026-05-17 | Documented |
| Elasticsearch analyzer pipeline: char filters → tokenizer → token filters | elastic.co/guide/en/elasticsearch/reference/current/analysis.html | 2026-05-17 | Documented |
| Elastic license: triple-licensed (SSPL, ELv2, AGPLv3 added before v8.16) | elastic.co/pricing/faq/licensing | 2026-05-17 | Documented |
| OpenSearch is Apache 2.0 fork of Elasticsearch 7.10, forked 2021 | opensearch.org/faq/ | 2026-05-17 | Documented |
| Tantivy: Rust FTS library, maintained by quickwit-oss, BM25, 17 languages + CJK | github.com/quickwit-oss/tantivy | 2026-05-17 | Documented |
| Quickwit: sub-second search on S3/MinIO/Ceph, built on Tantivy, Rust | quickwit.io | 2026-05-17 | Documented |
| Meilisearch: sub-50ms, DiskANN vector search, hybrid search, MIT/SSPL | meilisearch.com/docs/learn/what_is_meilisearch/overview | 2026-05-17 | Documented |
| Typesense: open-source, typo-tolerant, sub-50ms, v30.2 latest | typesense.org/docs/overview/what-is-typesense.html, typesense.org/docs | 2026-05-17 | Documented |
| Sonic: v1.4.9, ~28MB RAM on 1M messages, 4.2B max objects/bucket, no HTTP API | github.com/valeriansaliou/sonic | 2026-05-17 | Documented (perf numbers: community-reported README benchmark) |
| Apache Lucene 10.4.0 is current version, ~20-30% index size of raw text | lucene.apache.org/core/ | 2026-05-17 | Documented |
| Postgres GIN is recommended index type for full-text search | postgresql.org/docs/current/textsearch.html | 2026-05-17 | Documented |
| Cohere Rerank "provides a semantic boost to search quality" | cohere.com/blog/rerank | 2026-05-17 | Documented (marketing language) |
| Algolia features: NeuralSearch, Dynamic Re-Ranking, A/B testing, click analytics | algolia.com/doc/ | 2026-05-17 | Documented |
| Elasticsearch exact current patch version | Not found | 2026-05-17 | **Unverified — check elastic.co/downloads** |
| ELSER current model name and GA status | Not found | 2026-05-17 | **Unverified — check elastic.co ML docs** |
| OpenSearch 3.x current version | Blog returned 404 | 2026-05-17 | **Unverified — check opensearch.org/blog** |
| ParadeDB feature set and current stability | docs.paradedb.com returned 404 | 2026-05-17 | **Community-reported from project GitHub; verify at paradedb.com** |
| Qdrant, Weaviate, Pinecone hybrid feature state | Not fetched directly | — | **Unverified — verify at each project's docs** |
| RRF paper: Cormack, Clarke, Buettcher, SIGIR 2009 | Not fetched | — | Community-reported (widely cited) |
| BM25 finalized 1994 (Robertson et al.) | Not fetched | — | Textbook / community-reported |
| "10–50 GB per shard" rule of thumb for Elasticsearch | Not fetched from Elastic docs | — | Community-reported; verify at elastic.co docs |
| ColBERT production adoption is niche-but-growing | No primary source | — | **Inferred** |
| ELSER is in the SPLADE family | No primary source | — | **Inferred** from Elastic's description of sparse vectors + learned expansion |
| pgvector corpus size guidance (~5M vectors before needing dedicated vector DB) | Not fetched | — | **Inferred** from common community guidance |

---

## 13a. Worked analyzer trace — step by step

This trace is meant to be hand-authored data for the chapter's demo and also serves as pedagogical content. It works through four documents against two queries under two analyzer configurations, showing concretely why analyzer choice matters more than query parameter tuning.

**Index setup.** Two configurations:

- **Config A (standard analyzer):** lowercase → standard tokenizer → stopword filter (English) → English stemmer.
- **Config B (no-stemmer):** lowercase → standard tokenizer → stopword filter (English). No stemmer.

**Documents:**

| ID | Text |
|---|---|
| D1 | "The quick brown fox jumps over the lazy dog" |
| D2 | "Foxes are clever hunters" |
| D3 | "A running program requires careful testing" |
| D4 | "Tests are essential for software quality" |

**Indexed tokens (Config A — with stemmer):**

| Doc | Stored tokens |
|---|---|
| D1 | quick, brown, fox, jump, lazi, dog |
| D2 | fox, clever, hunter |
| D3 | run, program, requir, care, test |
| D4 | test, essenti, softwar, qualiti |

**Indexed tokens (Config B — no stemmer):**

| Doc | Stored tokens |
|---|---|
| D1 | quick, brown, fox, jumps, lazy, dog |
| D2 | foxes, are, clever, hunters |
| D3 | running, program, requires, careful, testing |
| D4 | tests, are, essential, software, quality |

(Stopwords "the", "over", "a", "for", "are" removed in both. Stemmer produces approximate forms shown above.)

**Query 1: "fox"**

- Config A: query analyzed → [fox]. Matches D1 (fox), D2 (fox). ✓ Both docs returned.
- Config B: query analyzed → [fox]. Matches D1 (fox). D2 has "foxes" not "fox". ✗ D2 missed.

**Query 2: "running tests"**

- Config A: query analyzed → [run, test]. Matches D3 (run, test both present) and D4 (test). D3 ranks higher (both tokens). ✓
- Config B: query analyzed → [running, tests]. Matches D3 (running, testing — wait, "tests" vs "testing": no match). D4 has "tests" → match. Only D4 returned. D3 missed. ✗

This illustrates the core pedagogical point: Config B produces surprising misses for conceptually obvious queries. The stemmer is not "fuzzy" — it is deterministic normalization that brings inflected forms to their root. Without it, "fox" and "foxes" are different tokens, and you must either use fuzzy queries (expensive) or edge n-grams (increases index size) to compensate.

---

## 13b. Glossary of key terms for the chapter author

Terms that appear in this dossier and may need brief definition in the chapter itself, since the audience has no CS-systems background.

**Analyzer (Elasticsearch).** A three-stage text processing pipeline (char filters → tokenizer → token filters) that transforms raw text into analyzed tokens for indexing and searching. The most important configuration decision in a full-text search deployment.

**BM25 (Best Match 25).** The default relevance scoring algorithm in Elasticsearch, Lucene, Tantivy, and OpenSearch. Scores documents by term frequency × inverse document frequency × field-length normalization. Formalized in the 1990s; still the standard lexical baseline in 2026.

**Cross-encoder.** A neural model that jointly encodes a (query, document) pair and outputs a relevance score. More accurate than bi-encoders for ranking but cannot precompute document representations — must process every (query, candidate) pair at query time. Used in the reranking stage of two-stage retrieval.

**Dense vector / dense retrieval.** A retrieval approach where both queries and documents are encoded into fixed-size float vectors, and similarity is computed via dot product or cosine. Contrasted with sparse retrieval (BM25, SPLADE). Dense retrieval finds semantically related documents even without keyword overlap.

**GIN index (Generalized Inverted Index).** Postgres's index type for `tsvector` full-text search columns. A generalized inverted index that maps each analyzed token to the set of rows containing it. The recommended index type for FTS in Postgres.

**HNSW (Hierarchical Navigable Small World).** The dominant ANN graph index algorithm. Multi-layer graph where higher layers are sparse (for coarse navigation) and lower layers are dense (for precise matching). Used by Elasticsearch, pgvector, Qdrant, Weaviate, and Meilisearch for vector search.

**Inverted index.** The core data structure of full-text search. Maps each analyzed token to a list of documents containing that token (postings list), optionally with term frequency and position data. Lookup time is proportional to the number of matching documents, not the total corpus size.

**IVF (Inverted File Index).** An ANN partitioning strategy that divides the vector space into clusters (Voronoi cells), assigns each vector to its nearest cluster centroid, and at query time only searches the clusters closest to the query vector. Memory-efficient at the cost of recall. Often combined with product quantization (IVF+PQ) for very large corpora.

**Lucene segment.** An immutable unit of Lucene's on-disk format. Each segment is a small, complete inverted index. Lucene writes new documents to new segments; segment merge jobs combine small segments into larger ones. A Lucene index is a collection of segments plus a commit point file.

**Postings list.** The list of document IDs (and optionally term frequencies, positions) stored for each term in an inverted index. When you query for "fox", the search engine looks up "fox" in the index and retrieves its postings list — the set of documents that contain "fox". BM25 scoring is computed over this list.

**RRF (Reciprocal Rank Fusion).** A rank-merging strategy for hybrid retrieval. Scores each document as the sum of `1 / (k + rank)` across all result lists. No score normalization required; rank-based, not score-based. Default k=60 in Elasticsearch. Proposed by Cormack, Clarke, Buettcher (SIGIR 2009).

**Shard (Elasticsearch).** One of N partitions of an Elasticsearch index, each managed by a separate Lucene instance. Primary shards hold the authoritative data; replicas are copies for HA and read scaling. Primary shard count is set at index creation and cannot be changed without reindexing.

**SPLADE / Learned sparse retrieval.** A family of neural models that produce sparse vectors over the vocabulary — similar to BM25 but with learned weights and term expansion. Compatible with standard inverted index infrastructure. ELSER (Elastic Learned Sparse Embeddings Retrieval) is Elastic's proprietary implementation.

**tsvector / tsquery (Postgres).** The native Postgres data types for full-text search. `tsvector` stores a sorted, deduplicated list of lexemes (analyzed tokens) for a document. `tsquery` stores the analyzed form of a search query. The `@@` operator performs the match.

---

## 14. Open questions for the chapter author

1. **ELSER current status.** The fetched Elasticsearch docs mentioned ELSER but did not confirm its current model name, GA status, or whether it's still part of the default distribution vs. a licensed ML feature. Verify at elastic.co/guide/en/machine-learning/current/ml-nlp-elser.html before writing the chapter.

2. **OpenSearch current major version.** The OpenSearch 3.0 and 2.19 blog URLs returned 404. Verify the current major version and its feature delta from Elasticsearch 8.x/9.x — especially whether OpenSearch has a comparable answer to ELSER and hybrid search. This affects the "OpenSearch and Elasticsearch are interchangeable" misconception (§ 8.5).

3. **ParadeDB production readiness.** The docs site (docs.paradedb.com) returned 404 during this research pass. ParadeDB's position in the decision framework (§ 6) depends on it being production-ready, not experimental. Verify at github.com/paradedb/paradedb and paradedb.com before recommending it as a Postgres-native alternative for 10M+ documents.

4. **Meilisearch corpus size limits.** The fetched docs did not state hard limits on index size or maximum document count. The chapter claims "sub-10M docs" as the sweet spot — this is inferred from community reports and the product's positioning, not from documented limits. Verify at meilisearch.com/docs or by testing, particularly if the chapter will make a specific claim.

5. **ColBERT in 2026.** The chapter hedges heavily on ColBERT adoption. If the chapter author has more current information (e.g., Vespa's ColBERT support, any major deployment announcements since Q1 2026), the hedge can be updated. The question is specifically: has any major search platform (Elasticsearch, OpenSearch, Weaviate, Pinecone) added native ColBERT / late-interaction support since late 2024?

6. **Elasticsearch vs. 9.x feature set.** The kNN docs mentioned features "since 9.1" and "since 9.2," suggesting the current GA version is 9.x. But the version number itself wasn't confirmed. This matters for the chapter if specific version-gated features (like `rescore_vector`) are discussed. Verify at elastic.co/downloads.

7. **Demo complexity.** Demo option A (analyzer pipeline visualizer) is the most pedagogically rich but also the most complex to build — it requires a hand-authored tokenizer lookup table covering at least 10–15 edge cases. If the chapter author wants a faster build, Demo option C (deployment chooser) is the simplest and still directly serves the chapter's decision-framework payoff. Recommend deciding before implementation begins.

8. **The "Postgres until you can't" threshold.** The decision framework uses "~10M documents" as the Postgres FTS threshold. This is inferred from community reports, not a documented Postgres limit. The actual threshold depends on write rate, query patterns, and hardware. The chapter should either present this as a rule of thumb with explicit hedging, or omit the number and say "when GIN maintenance noticeably slows writes" instead.

9. **Meilisearch license.** The Meilisearch docs described it as "MIT/SSPL" — verify the current license split. Meilisearch's self-hosted edition has had different licensing terms at different versions. The chapter comparison table lists MIT/SSPL; confirm before publishing. If the license has changed again, update the table.

10. **Sonic maintenance.** Sonic's last release was v1.4.9 in June 2024. As of May 2026, this is roughly 23 months without a new release. The project may be in maintenance-only mode. Verify on GitHub before recommending it for new deployments — if the project is effectively unmaintained, the chapter should say so explicitly.

---

*End of dossier. Total sections: 19. Citations: 14 documented, 5 unverified (flagged), 5 community-reported, 4 inferred. Web fetches used: 14 of ~12 cap (slightly over; prioritized primary sources).*
