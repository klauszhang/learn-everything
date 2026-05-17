# Research dossier — Indexing strategies

**Status:** research-only. Third in the triptych (with /pattern-matching and /data-search).
**Date:** 2026-05-17.

---

## 1. Plain-language premise

You've heard "add an index to that column" once. Maybe it fixed a slow query. Maybe nothing changed and the DBA looked puzzled. This chapter is about why — what indexes actually are, the engineering choices baked into them, and the surprising number of ways they can hurt instead of help.

The word "index" is borrowed from books. A book index is a sorted list of terms pointing to page numbers. A database index is exactly that: a sorted data structure, stored separately from the table, that points to rows. The engine consults the index to find rows without reading every row — the same way you flip to the back of a textbook rather than reading every page to find "B-tree."

The analogy breaks down fast. A book index only has one kind of entry (a word) and one kind of answer (page numbers). A database might have six different index types, covering spatial coordinates, full-text documents, JSON fields, and high-dimensional vectors. Each is a different bet about what queries will look like and what trade-offs are acceptable.

This dossier is about the engineering choices that make indexes pay rent: when to build one, what kind, how it's stored, how it's kept current, what it costs, and — critically — when it actively slows things down. It sits between the `/pattern-matching` dossier (the underlying algorithms) and the `/data-search` dossier (the access strategies those structures enable). Think of it as the operator's manual for the structures those two chapters describe.

The single most important thing to know before reading further: **every index speeds some reads, slows all writes, and burns space.** The art is choosing exactly the reads you want to speed up, and paying the write tax only for those.

---

## 2. The fundamental tradeoff — the one slide that matters

Every index, without exception:

- **Speeds reads that match its shape.** A B-tree on `email` makes `WHERE email = 'x@y.com'` fast. It helps nothing for `WHERE age > 30`.
- **Slows writes.** Every `INSERT`, `UPDATE`, and `DELETE` must update every relevant index on that table. A table with ten indexes pays ten times the maintenance cost on each write.
- **Burns space.** A B-tree index is often 10–30% the size of the table data it covers. A covering index (Section 4) with many included columns can exceed the table size.
- **Burns RAM.** Production databases keep hot indexes in buffer cache. Each index competes for the same RAM the table data needs. More indexes = more evictions = more disk reads for everything.

Two practical implications follow immediately:

1. **An index that no query uses is pure tax.** It slows writes, wastes space, and occupies RAM — and you get nothing back.
2. **The optimal number of indexes is rarely "as many as possible."** For write-heavy tables (logs, events, audit trails) it can be zero, with a batch-rebuilt summary table serving reads instead.

The corollary that trips up most teams: adding an index never makes anything worse for the query that prompted it. But it can make everything else measurably worse. A write-heavy table with 15 indexes can spend more time updating indexes than writing data.

### How a B-tree index is physically stored

It helps to know roughly what you're paying for. A B-tree index is a balanced tree of pages (also called blocks). Each page is typically 8 KB (Postgres default). The tree has three kinds of pages:

- **Root:** the top of the tree. One page. Points to internal nodes.
- **Internal nodes:** store separator keys and pointers to child pages. You traverse these to get from root to leaf.
- **Leaf pages:** store the actual index entries — each entry is a `(key_value, row_pointer)` pair. Leaf pages are organized as a **doubly linked list** so the engine can scan a range forward or backward without returning to the root.

A table row pointer in Postgres is called a `ctid` — a `(page_number, tuple_number)` pair that locates the row in the heap. The index stores sorted key values + ctids; the heap stores rows in no particular order.

Source: "Use The Index, Luke" — leaf nodes chapter, use-the-index-luke.com/sql/anatomy/the-leaf-nodes, fetched 2026-05-17.

A concrete size estimate: 1 million rows with a single 8-byte integer key → roughly 20,000–30,000 8 KB leaf pages → 160–240 MB for the leaf level alone, plus a few hundred KB for internal nodes. The internal nodes are tiny relative to the leaves; the leaves are what occupy RAM.

---

## 3. Single-column vs composite — column order matters more than you think

A single-column index on `country` helps queries that filter by country. An index on `city` helps queries that filter by city. But if your most common query is `WHERE country = 'US' AND city = 'Austin'`, neither single-column index is as good as a composite index — and the order of columns in the composite index determines whether it helps at all.

### The leftmost-prefix rule

A composite index on `(country, city)` is stored sorted first by `country`, then by `city` within each country. The engine can use this index for:

- `WHERE country = 'US'` — yes, `country` is the leftmost column.
- `WHERE country = 'US' AND city = 'Austin'` — yes, both columns used.
- `WHERE city = 'Austin'` — **no.** Without knowing the country, the cities are scattered all over the index. A full index scan is needed, often slower than a table scan.

Concrete rule: an index on `(a, b, c)` can serve queries filtering on `a`, `(a, b)`, or `(a, b, c)`. It cannot efficiently serve queries filtering only on `b`, only on `c`, or only on `(b, c)`.

The telephone-directory analogy (from "Use The Index, Luke" by Markus Winand — open access textbook at use-the-index-luke.com, fetched 2026-05-17): a phone book sorted by last name, then first name, lets you look up everyone named "Smith" instantly, but can't help you find everyone named "John" without scanning the whole book.

### Which column goes first?

The column with the **higher cardinality** (more distinct values) usually goes first — but "usually" is doing real work there. The actual rule is: put first the column your most-important queries filter on. If 90% of your queries filter by `country` and occasionally also by `city`, `(country, city)` is right. If 90% filter by `city` alone, reverse it.

A concrete example with the `users` schema from Section 19: suppose your top query is `WHERE status = 'active' AND country = 'US'`. Should the index be `(status, country)` or `(country, status)`?

- If most queries filter on `status` alone (e.g., "get all active users for a dashboard report"), `(status, country)` leads with the column that appears alone.
- If most queries filter on `country` alone AND some filter on both, `(country, status)` is better — the leading `country` column serves the single-column case, and adding `status` narrows it further when both filters appear.
- If `status` has only 3 distinct values (`active`, `inactive`, `banned`) and `country` has 200, `country` has much higher cardinality and usually goes first — but query frequency matters more than cardinality in most real decisions.

The critical failure mode: `INDEX(a), INDEX(b), INDEX(c)` — three separate single-column indexes — is **not** the same as `INDEX(a, b, c)`. Separately, each index covers only one column. The optimizer might combine them with a "bitmap index scan" (Postgres) or "index merge" (MySQL), but this is slower than a well-designed composite. It trips up nearly everyone exactly once.

### Range conditions break the composite rule

One important extension to the leftmost-prefix rule: **range conditions stop the composite index from being usable for subsequent columns.** An index on `(country, created_at, status)` with a query `WHERE country = 'US' AND created_at > '2025-01-01' AND status = 'active'` will use `country` (equality) and `created_at` (range), but cannot use `status` — after a range condition, the subsequent columns are no longer sorted in a useful way for the query. The index is still used, but only partially. This is a common composite index design trap: putting a range column before a high-value filter column wastes the filter column's potential.

Source: "Use The Index, Luke" — Concatenated Keys chapter, use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys, fetched 2026-05-17.

---

## 4. Covering indexes — making the index answer the whole question

A standard index lookup works in two steps: (1) search the index to find matching row IDs, (2) fetch the actual rows from the table. Step 2 is often the expensive part — each row might be on a different disk page, causing random I/O.

A **covering index** (also called an index-only scan in Postgres) skips step 2 entirely. If every column the query needs is stored in the index, the engine never touches the table at all.

Example: a query `SELECT email FROM users WHERE country = 'US'` with an index on `(country, email)` never needs the table — both `country` (the filter) and `email` (the output) are in the index.

### The `INCLUDE` clause (Postgres, SQL Server)

Postgres allows you to add "payload" columns that aren't part of the sort key but ride along in the index leaf pages:

```sql
CREATE INDEX idx_users_country ON users (country) INCLUDE (email);
```

`email` is not sorted by, not useful for filtering, but is available when the index is read — enabling index-only scans for queries that return `email` filtered by `country`.

Source: PostgreSQL 18 docs, postgresql.org/docs/current/indexes-index-only-scans.html, fetched 2026-05-17.

### The visibility map dependency

Postgres has an additional wrinkle: even with a perfect covering index, it still checks the **visibility map** to confirm that rows are visible to the current transaction. If a heap page has been modified recently and the visibility map bit isn't set, Postgres falls back to a heap fetch — the benefit disappears until `VACUUM` catches up. This is documented behavior, not a bug; it's the price of Postgres's MVCC model.

### When to add an included column vs. accept the heap fetch

Add it when: the query is run millions of times per day, the column is small (an ID, a status flag, an email string), and the index is otherwise well-targeted. Skip it when: the column is large (a text blob, a JSONB document), the query runs infrequently, or the index is already large. Covered columns inflate index size, which has its own cache and I/O cost.

---

## 5. Clustered vs non-clustered — the physical layout choice

This distinction is subtle but has large practical consequences.

### Non-clustered (heap + index) — Postgres default

In Postgres, table rows live in a heap: an unordered pile of pages. Rows are written wherever there's space. Indexes are separate B-trees that store `(key, ctid)` pairs, where `ctid` is the physical address of the row in the heap. A query using an index walks the B-tree to find `ctid` values, then fetches those heap pages.

The result: if your index returns 10,000 matching rows and each row is on a different heap page, you pay 10,000 random I/Os. For highly selective queries (returning a handful of rows), this is fast. For moderately selective queries (1% of a large table), it can be slower than a full sequential scan.

### Clustered (index-organized table) — MySQL InnoDB default

In MySQL InnoDB and SQL Server, the table rows are stored inside the primary-key B-tree — not in a heap. The index *is* the table. This is called a clustered index or index-organized table (IOT).

Consequence: rows with adjacent primary-key values are physically adjacent on disk. A range query `WHERE id BETWEEN 1000 AND 2000` reads rows from contiguous pages — efficient. But secondary indexes store the primary key (not a physical address) as the pointer. A secondary-index lookup does two B-tree traversals: once in the secondary index, then again in the primary-key tree for each matched row.

Source: "Use The Index, Luke" — index-organized tables chapter, use-the-index-luke.com/sql/clustering/index-organized-clustered-index, fetched 2026-05-17.

### Secondary indexes on clustered tables pay double

This is the underappreciated cost of clustering. When you have a clustered primary key and a secondary index, a secondary-index lookup does two B-tree traversals:

1. Walk the secondary index to find the primary key value(s) matching the query.
2. Walk the primary-key B-tree to retrieve the actual row data for each matched primary key.

That second traversal is the price you pay for clustering. On a heap table (Postgres), the secondary index stores the physical `ctid` directly — one hop to the heap, done. On an InnoDB table, the secondary index stores the primary key — and then you traverse the whole primary B-tree again. For queries hitting many rows via a secondary index, this double-lookup cost adds up.

Practical implication: in MySQL InnoDB, queries that primarily use secondary indexes (not the primary key) can be slower than equivalent Postgres queries on heap tables, especially for low-selectivity scans. The clustering benefit pays off most for primary-key range scans.

### Postgres's CLUSTER command

Postgres does not have clustered indexes, but it has a one-time `CLUSTER table USING index` command that physically reorders the heap to match an index's order. The reorder is not maintained — writes since the last `CLUSTER` scatter again over time. It's useful before a large batch read, not as a standing architecture.

---

## 6. Primary key as a physical layout choice

This flows directly from Section 5, but it surprises enough people to deserve its own section.

**In Postgres:** the primary key is a constraint enforced by a unique B-tree index. Its value doesn't affect heap layout. A UUID primary key is fine physically.

**In MySQL InnoDB:** the primary key is the clustering key — it dictates the physical order of rows on disk. A `UUID` primary key causes random insertion order, which means every `INSERT` may land on a different disk page, causing page splits, fragmentation, and heavy write amplification. Production MySQL teams almost always use auto-increment integers or ULIDs (sortable, random-suffix UUIDs) for this reason.

Rule of thumb: in InnoDB, pick a monotonically increasing primary key — `AUTO_INCREMENT INT`, `BIGINT`, or a ULID — unless you have a strong reason not to. A UUID-keyed InnoDB table with millions of rows will show measurably worse write throughput and larger indexes than an equivalent auto-increment table.

Note: this applies to MySQL InnoDB specifically. Postgres heap tables don't have this constraint. (Inferred from documented InnoDB architecture — see MySQL 8.4 docs on clustered indexes for authoritative detail.)

---

## 7. Partial / filtered indexes

A partial index includes only the rows matching a `WHERE` predicate. The rest of the table is not indexed at all.

```sql
-- Postgres: index only active users
CREATE INDEX idx_users_active ON users (email)
WHERE status = 'active';

-- SQLite: same idea
CREATE INDEX po_parent ON purchaseorder(parent_po)
WHERE parent_po IS NOT NULL;
```

Why this matters: suppose your `users` table has 500 million rows and 95% have `status = 'inactive'`. An index on all users is enormous and mostly useless, since nearly all queries look for active users. A partial index on `WHERE status = 'active'` covers the 25 million active users — 5% the size, faster to build, faster to search, cheaper to maintain.

The constraint the engine enforces: to use a partial index, the query's `WHERE` clause must **logically imply** the index predicate. `WHERE status = 'active' AND email LIKE 'a%'` implies `status = 'active'`, so the index is eligible. `WHERE email LIKE 'a%'` alone does not imply the predicate — the index won't be used.

Supported in Postgres and SQLite (3.8.0+, released 2013). Not universally supported — MySQL does not have partial indexes as of MySQL 8.4; a common workaround is to use a generated/virtual column with a conditional expression.

Sources: PostgreSQL 18 docs — partial indexes, postgresql.org/docs/current/indexes-partial.html, fetched 2026-05-17. SQLite partial index docs, sqlite.org/partialindex.html, fetched 2026-05-17.

---

## 8. Expression / functional indexes

Indexes are normally built on column values. An expression index is built on the *output of a function* applied to one or more columns.

```sql
-- Case-insensitive email lookup
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Index on extracted year
CREATE INDEX idx_orders_year ON orders (EXTRACT(YEAR FROM created_at));
```

The crucial constraint: **the query must use the exact same expression** for the index to be used. `WHERE LOWER(email) = 'alice@example.com'` hits the first index above. `WHERE email = 'alice@example.com'` does not — those are different expressions, and Postgres treats them differently (case matters in the plain column form).

This is the most common expression-index surprise: you create `INDEX(LOWER(email))`, all your app queries use `WHERE email = ?` with mixed-case inputs, and the index is never used. You must change the query or normalize the data at write time.

Expression indexes are supported in Postgres, SQLite, and MySQL (as generated columns with an index). They're particularly valuable for case-insensitive searches and for indexing derived values you compute repeatedly.

---

## 8b. BRIN indexes — the zone map for correlated data

Before the LSM section, a brief detour into a specialized index type that's often overlooked: **BRIN** (Block Range INdex).

BRIN is the database equivalent of what columnar analytics systems call a "zone map" or "min/max index." Instead of indexing every row like a B-tree, BRIN divides the table into fixed-size **block ranges** (128 pages by default in Postgres) and stores only the **minimum and maximum value** of the indexed column within each block range.

A query like `WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'` can skip entire block ranges whose min/max range doesn't overlap the query window. No per-row index entries to look up — just a tiny lookup table of ranges.

**The critical constraint:** BRIN only works well when the indexed column is **correlated with physical row order**. For a time-series table where rows are inserted in timestamp order, `created_at` is perfectly correlated — early rows are in early blocks, late rows are in late blocks. For a table with random inserts (a UUID-keyed table, for instance), rows with similar `created_at` values might be scattered across every block, so BRIN can't exclude anything.

A BRIN index on a 100 GB table can be under 1 MB — compared to 10–30 GB for an equivalent B-tree. The tradeoff: BRIN can't pinpoint a single row; it narrows to a set of block ranges, which the engine then scans. It's a coarse primary filter, not a precise lookup. For range scans over time-series data, it's excellent. For equality lookups (`WHERE id = 12345`), it's useless.

```sql
-- BRIN index for an insert-ordered events table
CREATE INDEX idx_events_created_brin ON events
USING BRIN (created_at);
-- Typically under 1 MB for a multi-billion-row events table
```

ClickHouse, DuckDB, and Parquet all implement a similar concept natively for columnar storage: each column chunk stores its min/max, and the reader skips chunks that can't contain the queried value. It's the same idea, applied to columnar rather than row-oriented storage.

Source: PostgreSQL 18 index types docs (BRIN section), postgresql.org/docs/current/indexes-types.html, fetched 2026-05-17.

---

## 9. B-tree vs LSM-tree — the write-amplification story

This is the biggest architectural split in storage engines, and it maps directly to "read-heavy vs write-heavy."

### B-tree: update in place

A B-tree (the default structure in Postgres, SQLite, MySQL InnoDB, and most SQL databases) stores data in a balanced tree of pages. Each leaf page holds sorted key-value pairs. When a new key is inserted, the engine finds the right leaf page and writes the entry into it. If the page is full, it splits.

The read path is clean: traverse the tree from root to leaf, O(log N) page reads. The write path is also usually one page write per row (plus any necessary splits). B-trees perform well for read-heavy workloads with moderate writes, especially range queries, which benefit from the sorted order.

The weakness: on write-heavy workloads with random keys, page splits and fragmentation accumulate. Each "logical" write may trigger multiple physical page writes — this is **write amplification**. On spinning disks, random writes are catastrophically slow. On SSDs, random writes accelerate things but still wear flash cells faster than sequential writes.

### LSM-tree: append-only, merge later

An LSM-tree (Log-Structured Merge-tree) takes a different bet. Writes never touch old data. Instead:

1. New data lands in an **in-memory memtable** (a sorted buffer).
2. When the memtable fills, it's **flushed as an immutable SSTable** (Sorted String Table) to disk — a sequential write, fast on any storage.
3. In the background, a **compaction** process merges SSTables from level L into level L+1, maintaining sorted order and discarding old versions of keys.

The write path is always sequential — fast, low write amplification at the write moment. The read path may now require checking multiple SSTables (the memtable plus several levels), which is **read amplification**.

**Bloom filters** per SSTable (described in the `/data-search` dossier) cut read amplification dramatically: before scanning an SSTable, the engine checks the bloom filter — if the key definitely isn't there, skip the whole file.

Who uses LSM-trees: RocksDB (used internally by MySQL MyRocks, TiKV, Pebble in CockroachDB), Apache Cassandra, Google Bigtable, Amazon DynamoDB's underlying storage, LevelDB.

### A concrete walk-through: writing "user 42 updated" to an LSM store

1. Write arrives. The key `user:42` and new value land in the **memtable** (in-memory sorted buffer). The write is also appended to the **Write-Ahead Log (WAL)** for durability. No disk page is read or randomly modified. Done — the write returns to the caller.

2. The memtable fills up (say, 64 MB). It becomes immutable. A new empty memtable starts taking writes. The old memtable is flushed to disk as **L0 SSTable** — a sequential write of 64 MB.

3. The previous value of `user:42` (from 10 minutes ago) is still sitting in an older L1 SSTable. There are now two copies of `user:42` on disk — the old value in L1, the new value in L0. Both are valid; reads check L0 first.

4. Background compaction runs. It merges the L0 SSTable with overlapping L1 SSTables. During the merge, it sees two versions of `user:42` and keeps only the newer one, discarding the old. It writes the merged result back as a new L1 SSTable.

The write amplification comes from step 4: the 64-byte record for `user:42` might have been rewritten multiple times (once per compaction level it participates in). In exchange, the original write (step 1) was essentially free — just a memtable insert and WAL append.

### The practical choice

| Workload | Preferred engine |
|---|---|
| Read-heavy, range queries | B-tree (Postgres, SQLite, MySQL InnoDB) |
| Write-heavy, point lookups | LSM-tree (RocksDB, Cassandra) |
| Time-series (append-only, recent reads) | LSM-tree or columnar |
| Mixed (OLTP) | B-tree, with tuning |

RocksDB's write amplification factor varies by compaction strategy. The Universal compaction style reduces write amplification at the cost of higher read and space amplification; Level compaction (the default) does the reverse. Specific numbers depend heavily on workload and configuration — could not verify a single canonical figure for Level compaction write amplification in a current authoritative source; the RocksDB wiki at github.com/facebook/rocksdb/wiki/RocksDB-Overview (fetched 2026-05-17) describes the trade-off qualitatively without a specific multiplier in the overview. Academic literature (the original LevelDB paper and O'Neil et al. 1996 LSM-tree paper) discuss write amplification analytically but with workload-specific results.

---

## 9b. Postgres index type cheat sheet

Since this site is Postgres-oriented, a quick reference for which index type to reach for and when:

| Type | Reach for it when… | Do not use when… |
|---|---|---|
| **B-tree** | equality, range, sorting, `LIKE 'prefix%'` — the default for a reason | never a wrong choice; the question is whether another type is better |
| **Hash** | high-volume exact equality on large keys (long strings, UUIDs) where range is never needed | any range query or sort; not crash-safe before Postgres 10 (now fine) |
| **GiST** | geometric/spatial data, full-text (lossy), nearest-neighbor queries, custom operator classes | high-write tables where GIN's faster updates matter more |
| **GIN** | full-text search (`tsvector`), arrays, JSONB containment (`@>`) — any "does this doc contain X?" | small, frequently-updated values; GIN updates are slower than B-tree per row |
| **BRIN** | very large tables where the column is correlated with insert order (timestamps, serial IDs) | columns with random distribution; equality lookups; tables under a few million rows |
| **SP-GiST** | space-partitioned structures: quadtrees for 2D points, k-d trees, radix tries | general use; specialized and less commonly needed than GiST |

Note: "Hash" in this table refers to Postgres's built-in hash index type — different from hash-based lookup tables in general. Postgres's hash index is crash-safe since Postgres 10 and is a legitimate choice for pure equality workloads. Source: PostgreSQL 18 index types docs, postgresql.org/docs/current/indexes-types.html, fetched 2026-05-17.

---

## 10. Vector indexes — the AI-era index

Vector indexes (flat scan, IVF partition-based, HNSW graph-based) exist to answer "which stored vectors are closest to this query vector?" They are covered in full in the `/ann-vector-indexes` dossier. A brief pointer here:

- **Why they're different:** Traditional indexes answer exact equality or range predicates. Vector indexes answer approximate nearest-neighbor queries — "give me the 10 closest embeddings to this one, accepting a small chance of missing the true closest."
- **pgvector:** Postgres extension that adds vector storage and HNSW/IVF indexes alongside standard SQL tables. A `users` table can have a standard B-tree index on `email` and an HNSW index on `embedding` simultaneously — the two indexes coexist.
- **Why they sit beside, not inside, traditional indexes:** The query shape is fundamentally different. B-trees need sortable keys. Vectors have no total ordering in high dimensions — you can't put them in a B-tree leaf and retrieve them in "order." A vector index is a specialized structure that lives next to the table, not in place of a B-tree.

For depth: see `/ann-vector-indexes`.

---

## 11. Full-text indexes

Searching text for meaning — "find all documents about transformer architecture" — is not a B-tree problem. The data is unstructured, the queries are keyword-based or phrase-based, and relevance ranking matters.

### Inverted index: the core structure

A full-text index is an **inverted index**: a mapping from each unique word (or word stem) to the list of documents containing it. (See `/data-search` for the data-structure deep-dive.) Building this index requires an **analyzer pipeline**:

1. **Tokenization:** split the document into words on whitespace and punctuation.
2. **Normalization:** lowercase everything.
3. **Stemming:** reduce words to their root (`"running"` → `"run"`, `"indexes"` → `"index"`). Language-specific — English stemming rules don't apply to German.
4. **Stopword removal:** drop extremely common words (`"the"`, `"a"`, `"is"`) that add noise.

The result is a list of lexemes per document. The index maps each lexeme to a posting list of (document_id, position) pairs.

### BM25 scoring

A search for `"transformer architecture"` might match thousands of documents. BM25 (Best Match 25) is the standard relevance ranking formula. Intuitively: a document scores higher if it contains the query terms many times relative to document length, and if the query terms are rare across the whole corpus (so matching "transformer" is more significant than matching "the"). BM25 is the default scoring formula in Elasticsearch, Lucene, Tantivy, and many other search engines. Postgres's `ts_rank` function implements a similar tf-idf-based ranking on `tsvector` data.

### Postgres: tsvector + GIN

```sql
-- Store pre-computed lexemes
ALTER TABLE documents ADD COLUMN tsv tsvector;
UPDATE documents SET tsv = to_tsvector('english', body);

-- Index the tsvector column
CREATE INDEX idx_documents_fts ON documents USING GIN (tsv);

-- Query
SELECT title FROM documents
WHERE tsv @@ to_tsquery('english', 'transformer & architecture');
```

GIN is the preferred index type for full-text in Postgres (non-lossy, efficient for multi-term queries). GiST can also index `tsvector` but is lossy — it produces false positives that require a second heap check. GIN is preferred for most use cases.

Source: PostgreSQL 18 docs — text search indexes, postgresql.org/docs/current/textsearch-indexes.html, fetched 2026-05-17.

### The analyzer pipeline — a worked mini example

Given the text `"Running Indexes on PostgreSQL 18"`, an English analyzer produces:

```
tokenize  →  ["Running", "Indexes", "on", "PostgreSQL", "18"]
lowercase →  ["running", "indexes", "on", "postgresql", "18"]
stopwords →  ["running", "indexes", "postgresql", "18"]  (dropped "on")
stem      →  ["run", "index", "postgresql", "18"]
```

The inverted index stores: `run → [doc42]`, `index → [doc42]`, `postgresql → [doc42]`, `18 → [doc42]`. A search for `"indexes"` (stemmed to `"index"`) finds doc42. A search for `"ran"` (stemmed to `"run"`) also finds doc42 — same stem. A search for `"postgres"` would not find it unless the analyzer treats "postgres" and "postgresql" as synonyms (a configurable option in most FTS systems).

This is why language selection matters: the wrong stemmer can fail to match words you expect to match, or incorrectly match words you don't want.

### N-gram indexes

For "contains substring" or autocomplete ("starts with `trans`"), standard stemming-based indexes don't help — you're not searching by word, you're searching by prefix or fragment. N-gram indexes split text into overlapping character sequences:

- Bigram: `"hello"` → `["he", "el", "ll", "lo"]`
- Trigram: `"hello"` → `["hel", "ell", "llo"]`

Postgres's `pg_trgm` extension builds a GIN or GiST index on character trigrams, enabling fast `LIKE '%substring%'` queries that would otherwise require a full table scan.

### Lucene / Tantivy

For heavier workloads — millions of documents, complex faceting, multi-field queries — the Lucene architecture (and Tantivy, its Rust reimplementation) stores indexes as **segments**: immutable chunks of inverted index data. New documents land in a fresh segment; background merging combines small segments into larger ones (an LSM-tree-like pattern). Claude Code's codebase-search features rely on this architecture for fast grep-like and semantic searches over code.

---

## 12. Geospatial indexes

A geographic coordinate is two numbers (latitude and longitude). A B-tree can sort one number at a time — it can't efficiently answer "find all points within 10km of this coordinate" because proximity in 2D doesn't map cleanly to a 1D sort order.

### R-tree

An **R-tree** organizes geometries into a hierarchy of nested bounding rectangles. Each internal node stores the minimum bounding rectangle (MBR) of all geometries in its subtree. A spatial query prunes entire subtrees by checking whether the query rectangle intersects the node's MBR — if not, skip everything below.

PostGIS implements spatial indexes as R-trees built on Postgres's GiST infrastructure. An important implementation detail (documented in PostGIS): spatial indexes store only the **bounding box** of each geometry. The index filters candidates; the query then re-checks actual geometries to confirm true intersection. The R-tree is a primary filter, not an exact answer.

```sql
-- PostGIS: spatial index for fast proximity queries
CREATE INDEX idx_locations_geom ON locations USING GIST (geom);

-- Nearest-neighbor query (uses the index)
SELECT name FROM locations
ORDER BY geom <-> ST_MakePoint(-97.74, 30.27)  -- Austin, TX
LIMIT 10;
```

Source: PostGIS docs, postgis.net/docs/using_postgis_dbmanagement.html, fetched 2026-05-17.

### Why R-trees need a two-stage filter

The bounding-box primary-filter detail is worth pausing on. Suppose you index a set of irregular polygons — countries, city boundaries, river paths. The R-tree stores the bounding rectangle of each polygon, not the polygon itself. A query "find all geometries intersecting this point" first checks: which bounding boxes contain the point? That gives a candidate set. Then the engine re-checks each candidate against the actual polygon geometry (the slow, exact computation). The R-tree eliminates 99% of the table from exact computation — that's the win. It does not eliminate all false positives in the candidate set (a bounding box might contain the point even if the actual polygon doesn't).

This two-stage pattern — cheap index filter → exact secondary filter — is extremely common. The PostGIS `&&` operator (bounding box overlap) is the index-supported first stage; `ST_Intersects()` is the exact second stage. Well-written PostGIS queries use both explicitly.

### S2 cells, H3, and geohash — space-filling curves

The R-tree requires a specialized 2D index. An alternative approach converts 2D coordinates into a 1D key using a **space-filling curve** — a mathematical trick that maps a 2D plane onto a 1D line while (approximately) preserving proximity. Points close in 2D land close on the 1D line most of the time. Once you have a 1D key, a standard B-tree can index it.

Three common schemes:
- **Geohash:** divides the world into a grid, encodes each cell as a base-32 string. Points sharing a prefix are geographically close — usually. The "usually" matters: geohash cells near grid boundaries can be far apart in geohash space despite being physically adjacent.
- **S2 cells** (Google): uses a sphere-to-cube projection and Hilbert curve indexing. Better boundary behavior than geohash; used internally at Google Maps and Foursquare.
- **H3** (Uber): hexagonal hierarchical grid. Uniform cell areas (hexagons tile more uniformly than squares), useful for aggregation and analytics.

MongoDB, Google BigQuery, and many mapping services use one of these for scalable geo queries without a specialized spatial index engine.

---

## 13. Index maintenance — the part nobody enjoys

Indexes don't maintain themselves perfectly. Three problems accumulate over time.

### B-tree bloat

When a row is deleted in Postgres, the heap row is marked dead but stays on the page until `VACUUM` cleans it. The corresponding index entries similarly remain — marked dead but occupying space. Over time, an actively-updated table accumulates dead index entries: **bloat**. A 10 GB index might be 40% bloat after months of churn.

Symptoms: index scans slow down (more pages to traverse), index size keeps growing despite no net data growth. Fix: `VACUUM` (automatic in Postgres, reclaims dead rows) and occasionally `REINDEX` or `REINDEX CONCURRENTLY` (rebuilds the index from scratch, compacting it).

### Online vs offline rebuild

`REINDEX` in Postgres (before `CONCURRENTLY`) holds an `ACCESS EXCLUSIVE` lock — the table is unreadable and unwritable during the rebuild. For large tables, this means minutes to hours of downtime.

`CREATE INDEX CONCURRENTLY` (and `REINDEX CONCURRENTLY` in Postgres 12+) builds the index without blocking reads or writes. It takes longer and uses more resources, but production stays live. The tradeoff: if the process is interrupted, it leaves an "invalid" index that must be cleaned up manually.

### LSM compaction and IO storms

LSM-based engines (RocksDB, Cassandra) do not have bloat in the B-tree sense — data is never updated in place. Instead, old versions accumulate across SSTables until compaction merges and discards them. Compaction is I/O-intensive: it reads and rewrites large files. An under-configured system can fall behind on compaction, leading to **compaction storms** — bursts of disk I/O that spike latency for normal reads and writes. Production tuning of RocksDB and Cassandra clusters is substantially about managing compaction rate and parallelism.

An important nuance: LSM-trees have three amplification metrics that trade against each other. **Write amplification** is the ratio of physical bytes written to logical bytes written — compaction rewrites data multiple times. **Read amplification** is the number of disk reads per logical read — without compaction, a key might exist in multiple SSTables. **Space amplification** is the ratio of disk space used to logical data size — stale versions occupy space until compaction. Every tuning choice moves the balance among the three. Universal compaction reduces write amplification but increases space amplification. Level compaction (RocksDB default) prioritizes low space amplification at the cost of higher write amplification. There is no configuration that minimizes all three simultaneously.

Source: RocksDB Overview, github.com/facebook/rocksdb/wiki/RocksDB-Overview, fetched 2026-05-17 (qualitative; specific WAF numbers not in overview — see Open Questions).

### Index rebuilds — when, why, how long

Rebuild when: bloat crosses a threshold (Postgres's `pgstatindex` view shows bloat percentage); index statistics are wildly stale; changing a column type requires an index rewrite; upgrading Postgres between major versions sometimes requires it.

How long: proportional to table size and I/O speed. A 100 GB table's index might take 20–60 minutes to rebuild concurrently. Plan accordingly.

```sql
-- Check index bloat (requires pgstattuple extension)
SELECT indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
       pg_stat_get_numscans(indexrelid) AS scans_since_reset
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild an index without locking the table
REINDEX INDEX CONCURRENTLY idx_users_email;
```

### Partial indexes and maintenance cost

One often-missed maintenance advantage of partial indexes: a partial index on `WHERE status = 'active'` only needs updating when a row's `status` changes to or from `'active'` — not on every write to the table. If 99% of your writes touch inactive users, the active-user index is barely touched. This is the dual benefit of partial indexes: smaller at read time, cheaper at write time.

### Postgres autovacuum and index health

Postgres's autovacuum daemon runs `VACUUM` and `ANALYZE` automatically when a configurable fraction of rows are modified. VACUUM reclaims dead heap rows and dead index entries; ANALYZE refreshes query planner statistics. On actively-written tables, autovacuum keeps pace. On tables that receive sporadic large bulk loads (e.g., an overnight batch of 10 million inserts), autovacuum may lag — consider running `ANALYZE` manually after bulk loads to avoid bad query plans in the hours immediately following.

---

## 14. When indexes hurt

Five situations where adding an index makes things worse or does nothing.

### Small tables

If a table has 500 rows and fits in a few disk pages, the engine reads the whole thing in one or two I/Os. An index lookup requires traversing the B-tree (2–3 pages) plus fetching the result row (1 page) — possibly more I/O than the scan. Postgres's query planner knows this and will choose a sequential scan on small tables regardless of what indexes exist.

Rule of thumb: below a few thousand rows, indexes rarely help. Exact cutoff depends on row width and selectivity. Let the planner decide.

### Write-heavy workloads

A table receiving 50,000 inserts per second with 8 indexes pays 8× the index-maintenance cost per insert. Each index write may require reading a B-tree page into cache, modifying it, and writing it back. For log ingestion, clickstream recording, or IoT sensor data, this can saturate I/O and CPU with index maintenance rather than actual data storage. Pattern: use LSM-based storage (or a buffer table with a batch-rebuilt index on the read side).

### Queries that don't match the index

An index on `(country, city)` does not help `WHERE city = 'Austin'` (leftmost prefix rule). An expression index on `LOWER(email)` does not help `WHERE email = 'Alice@example.com'`. A partial index on `WHERE status = 'active'` does not help `WHERE status = 'inactive'`. In all these cases, you're paying write-time maintenance with zero read-time benefit.

### Low-selectivity indexes on write paths

An index on a boolean column (`is_deleted`) with 99% of rows having `is_deleted = false` has very low selectivity. A query for deleted rows (1% of the table) might use it; a query for non-deleted rows (99%) won't — seq scan is faster. You've paid maintenance cost on every write for an index that almost never fires.

### Too many indexes confuse the planner

With fifteen indexes on a table, the query planner must evaluate more candidate plans. Planner time increases. Occasionally, the planner chooses a bad index (due to stale statistics) when it would have defaulted to a reliable sequential scan. This is rare but documented behavior. Keep indexes purposeful.

### The "just in case" trap

Engineers sometimes add indexes "just in case a query needs them someday." This is understandable — indexes feel cheap, and the downside of a missing index (a slow query in production) is visible, while the downside of an unused index (slightly slower writes, wasted space, confused planner) is invisible. The invisible costs accumulate silently for months or years before anyone notices. The discipline: add indexes in response to measured slow queries, not in anticipation of hypothetical ones. Audit and drop unused indexes on a regular cadence.

---

## 14b. The four scan types — a quick taxonomy

When you run `EXPLAIN ANALYZE`, Postgres reports one of four main scan strategies. Knowing what each means lets you read the plan without guessing.

**Sequential scan (Seq Scan):** reads every page of the table, top to bottom, in physical order. Fast when you need most of the rows or the table is tiny. The baseline to beat.

**Index scan:** walks the B-tree to find matching row pointers, then fetches each heap page via its ctid. Efficient when the query is highly selective (few rows returned). Can be slower than seq scan if many rows match — each row might be on a different heap page, causing many random I/Os.

**Index-only scan:** like an index scan, but every needed column is in the index, so no heap fetch. Fastest for selective queries with covering indexes. Requires visibility-map confirmation (Section 4).

**Bitmap index scan + bitmap heap scan:** a middle path. The index scan phase produces a bitmap of heap pages that contain matching rows. The heap scan phase reads those pages in physical order (sorted to minimize random I/O), then applies any remaining filters. Efficient for moderately selective queries — more rows than index scan handles well, fewer than seq scan is optimal for. Common when selectivity is in the 1–20% range.

```
-- Example EXPLAIN output
Bitmap Heap Scan on users  (cost=142.00..3200.00 rows=5000)
  ->  Bitmap Index Scan on idx_users_country
        Index Cond: (country = 'US')
```

Reading this: the planner estimated 5,000 rows match `country = 'US'`. Too many for a straight index scan (many random heap fetches), so it builds a bitmap and reads heap pages in order. If there were 5 matching rows, it would use a plain index scan. If there were 500,000 matching rows (50% of the table), it would use seq scan.

---

## 15. Why your index isn't being used — the query planner

You added an index. The query is still slow. `EXPLAIN ANALYZE` shows `Seq Scan`. What happened?

The query planner is a **cost-based optimizer**. It estimates the cost of several execution plans (sequential scan, index scan, index-only scan, bitmap index scan, nested loop join, hash join…) and picks the cheapest estimate. It does not use your intent; it uses statistics.

### Stale statistics

The planner estimates row counts using `pg_statistic` — a catalog table populated by `ANALYZE`. If your table has grown 10× since the last `ANALYZE`, the planner thinks it's still small. It underestimates how selective an index would be, decides seq scan is cheaper, and you pay the penalty.

Fix: `ANALYZE table_name`. In production Postgres, `autovacuum` runs `ANALYZE` automatically when ~10% of rows change. If your table changes faster than that, run `ANALYZE` manually after bulk loads.

### High selectivity on non-selective queries

If `WHERE country = 'US'` returns 40% of the table, the planner is right to choose a sequential scan. Fetching 40% of rows via an index means 40% of the table's page count in random I/Os — almost always worse than a sequential scan. The planner's cost formula for index scans includes the random-I/O penalty; if it's higher than sequential, it picks sequential. This is correct behavior, not a bug.

### The expression mismatch

`WHERE email = 'alice@example.com'` does not use `INDEX(LOWER(email))`. The expressions are different. Always confirm the query uses the exact expression form.

### When statistics go wrong — a realistic scenario

Consider a `users` table with 1 million rows, 50,000 of which have `status = 'active'`. Postgres collects statistics and knows: `status = 'active'` matches 5% of rows — selective enough to use an index. You have an index on `status`.

Now your product runs a user-acquisition campaign and signs up 4 million new users in a week — all with `status = 'active'`. The table is now 5 million rows, 4,050,000 of which are active (81%). But autovacuum hasn't run `ANALYZE` yet because it's busy keeping up with the write volume. The planner still thinks `status = 'active'` matches 5% of rows. It confidently chooses the index scan. In reality, it's fetching 81% of the table via random I/Os — far slower than a seq scan would be.

This is when `EXPLAIN ANALYZE` shows a large gap between `rows=50000` (estimate) and `actual rows=4050000` (reality). Fix: `ANALYZE users;`. Consider adding a monitoring alert for cases where estimated rows differ from actual rows by more than 10×.

### The correlation problem

One subtlety the planner handles: even with a valid index, if the indexed column's values are poorly correlated with physical row order, the random-I/O cost of an index scan increases. For example, if `email` values are randomly distributed across the table's pages (they are), fetching 5,000 rows via an index on `email` might touch 5,000 different heap pages — catastrophically slow. The planner uses a `pg_stats.correlation` statistic per column (ranging from -1 to +1, where ±1 means perfect correlation with physical order) to adjust its I/O cost estimate. Low correlation = higher estimated I/O cost for index scan = more likely to prefer seq scan. This is correct behavior. (Inferred from Postgres cost model documentation; correlation is a documented pg_stats field.)

### Forcing the issue (use sparingly)

Postgres allows `SET enable_seqscan = off` at the session level to disable sequential scans, forcing index use. This is a debugging tool, not a production setting. If the planner still avoids your index with seq scan disabled, the plan is probably right and your index is wrong.

Source: PostgreSQL 18 docs — using EXPLAIN, postgresql.org/docs/current/using-explain.html, fetched 2026-05-17.

---

### Reading an EXPLAIN ANALYZE output — a worked mini example

Here's what a real (abbreviated) output looks like for a query using an index:

```
EXPLAIN ANALYZE SELECT email FROM users WHERE country = 'US';

Index Only Scan using idx_users_country on users
  (cost=0.43..180.12 rows=4200 width=32)
  (actual time=0.081..14.2 rows=4231 loops=1)
  Index Cond: (country = 'US')
  Heap Fetches: 0
  Planning Time: 0.5 ms
  Execution Time: 15.8 ms
```

Reading it: the planner estimated 4,200 rows and got 4,231 — close enough to trust the statistics. `Heap Fetches: 0` means the covering index served every column without touching the heap. `cost=0.43..180.12` is in planner cost units (proportional to page I/Os), not milliseconds.

Now the same query without a covering index — just `INDEX(country)`, not `INDEX(country) INCLUDE (email)`:

```
EXPLAIN ANALYZE SELECT email FROM users WHERE country = 'US';

Index Scan using idx_users_country on users
  (cost=0.43..890.00 rows=4200 width=32)
  (actual time=0.081..41.7 rows=4231 loops=1)
  Index Cond: (country = 'US')
  Planning Time: 0.4 ms
  Execution Time: 42.5 ms
```

Same rows, but `Heap Fetches` would be 4,231 — each row fetched individually from the heap. Time jumped from 15 ms to 42 ms. For 50,000 rows, the difference would be far larger.

---

## 16. Common misconceptions

**"More indexes = faster."**
Faster reads for queries that match, slower everything else. An index that no query uses is pure maintenance cost.

**"Indexes are free at write time."**
Every insert, update, and delete must update every relevant index on the table. A table with ten indexes pays ten times the index-maintenance cost per write.

**"Adding an index never hurts."**
Wrong on small tables (seq scan is faster). Wrong on write-heavy paths (maintenance overwhelms benefit). Wrong when the query doesn't match the index (zero read benefit, positive write cost).

**"The query planner always picks the best plan."**
It picks the plan with the lowest estimated cost. If statistics are stale, estimates are wrong, and the plan can be wrong too. `EXPLAIN ANALYZE` shows actual vs estimated rows — large discrepancies indicate stale stats.

**"B-tree is obsolete on SSDs."**
No. B-trees are the default index type in every major SQL database for good reasons: they support equality, range, and sort efficiently; they're well-understood and well-optimized. SSDs reduce the penalty for random reads (B-trees' main weakness vs seq scan), which actually makes indexes *more* useful on SSDs, not less.

**"LSM is just B-tree on flash."**
No. LSM-trees are a fundamentally different storage architecture: append-only writes, immutable SSTables, background compaction, different read/write trade-offs. They favor high write throughput; B-trees favor read throughput and range queries.

**"Covering index is the same as a composite index."**
Related but different. A composite index includes multiple columns as sort keys — useful for filtering. A covering index includes columns the query reads but doesn't filter on (via `INCLUDE` in Postgres) — useful to avoid the heap fetch. They can overlap (an index on `(country, city)` that also includes `email`) but are distinct concepts.

**"`INDEX(a), INDEX(b), INDEX(c)` is the same as `INDEX(a, b, c)`."**
Very much not. Three separate indexes can filter on one column each. The composite can filter on the combination far more efficiently for multi-column WHERE clauses.

---

## 16b. A practical index-design workflow

Given a new or existing table, here is a repeatable process for deciding which indexes to build — no DBA experience required.

**Step 1: Identify the top queries.** Log your slow queries (Postgres's `pg_stat_statements` extension tracks query frequency and total time). Pick the 5–10 queries responsible for the most cumulative time.

**Step 2: For each slow query, run `EXPLAIN ANALYZE`.** Look for:
- `Seq Scan` on a large table — candidate for an index.
- High `actual time` with low `rows` returned — probably a selectivity problem.
- `Heap Fetches` much higher than row count — candidate for a covering index.

**Step 3: Design the index to fit the query shape.**
- Single equality filter → single-column index.
- Multiple equality filters → composite index (higher-cardinality column first).
- Filter + select — composite index with INCLUDEd non-filter columns.
- Filter on a derived expression — expression index with the exact same expression.
- Hot subset of a large table — partial index with the subset predicate.

**Step 4: Check that the index is used.** After creating it, re-run `EXPLAIN ANALYZE` and confirm `Index Scan` or `Index Only Scan` appears. If it still shows `Seq Scan`, check: expression mismatch, stale stats (run `ANALYZE`), or the query returns too many rows for the index to be worth using.

**Step 5: Audit unused indexes periodically.** `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;` lists indexes that have never been used since the last stats reset. Each one is a tax with no corresponding discount. Drop them unless you know they're for a rare but critical query.

---

## 17. Connections to AI-era code search

**Codebase indexing in Claude Code.** A code repository is a small read-heavy corpus — perhaps tens of thousands of files, rarely changing during a session. Full-text indexes (Tantivy, Lucene) built over it support Claude Code's grep-like search. The inverted index maps token names, identifiers, and strings to file locations. This is a direct application of Section 11 above, at a scale where even a flat scan would work, but the index pays rent as the corpus grows.

**The prompt cache as an index on prefixes.** Chapter 7 of the learn-claude-code site describes Claude Code's prompt cache: a product feature that persists prefix computation across API requests, avoiding reprocessing the stable part of each conversation. Conceptually, the prompt cache is an exact-prefix index on conversation state — given the first N tokens of the current request, return the cached KV activations rather than recomputing them. The "search key" is the token prefix; the "stored value" is the intermediate computation. The cache hit condition (exact token-level match up to a breakpoint) is analogous to a hash-index equality check — fast and exact, but zero tolerance for mismatch.

**MCP servers as index frontends.** An MCP (Model Context Protocol) server that exposes a search tool is fronting some kind of index — a full-text index, a vector index, a knowledge graph. The tool call is the query; the index is what makes the answer cheap. (See `/mcp` dossier for the protocol details.)

---

## 18. House-style chapter ideas

### Recommended diagram

**Option C: B-tree vs LSM-tree write flow** — side-by-side HTML+CSS panels. Left panel shows a B-tree with a page-modification animation when a new key arrives. Right panel shows data landing in a memtable, flushing to L0, and compaction arrows to L1. A "disk writes" counter below each panel increments as the animation plays. Takeaway: same logical write, different physical cost patterns. Component: `BTreeVsLSM.tsx`, data in `src/data/indexing.ts`.

**Runner-up — Option A: the cost triangle** — an equilateral triangle with corners labeled Read Speed, Write Speed, Space. Three or four index types are plotted inside the triangle at different positions. B-tree sits close to the Read corner; a fat composite covering index sits closer to the Space corner; an LSM-based store sits closer to the Write corner. Static SVG, no interaction needed. Takeaway: every index is a trade-off, not a free lunch.

### Recommended demo

**Option A: "Would the index help?"** — two drop-downs: (1) pick an index definition from a list of 6; (2) pick a query from a list of 8. The demo evaluates the leftmost-prefix rule and expression-match rule, then renders one of three outputs: **Index used** (green), **Partial — index used for some columns** (amber), **Not used — seq scan** (red), with a one-sentence explanation. No backend; the logic is a pure function over hand-authored rule tables. Component: `IndexMatchDemo.tsx`, data in `src/data/indexing.ts`.

---

## 19. Hand-authored data plan

Mini schema used throughout:

```sql
CREATE TABLE users (
  id          BIGINT PRIMARY KEY,
  country     TEXT,
  city        TEXT,
  status      TEXT,          -- 'active' | 'inactive' | 'banned'
  email       TEXT,
  created_at  TIMESTAMPTZ
);
```

Six example queries with best index, second-best, and no-index plan:

| Query | Best index | Second-best | No-index plan |
|---|---|---|---|
| `WHERE email = 'a@b.com'` | `(LOWER(email))` expression index | `(email)` if case-guaranteed | seq scan + filter |
| `WHERE country = 'US'` | `(country)` B-tree | none useful | seq scan |
| `WHERE country = 'US' AND city = 'Austin'` | `(country, city)` composite | `(country)` + filter | seq scan |
| `WHERE city = 'Austin'` | `(city)` B-tree | none (composite (country,city) won't help) | seq scan |
| `WHERE status = 'active' AND country = 'US'` | partial `(country) WHERE status='active'` | `(status, country)` composite | seq scan |
| `SELECT email FROM users WHERE country = 'US'` | `(country) INCLUDE (email)` covering | `(country, email)` composite | seq scan + heap fetch |

Composite-index match-rule table (for the IndexMatchDemo component):

| Index | Query filter | Leftmost match? | Usable? |
|---|---|---|---|
| `(country, city)` | `country = ?` | yes | yes |
| `(country, city)` | `city = ?` | no | no |
| `(country, city)` | `country = ? AND city = ?` | yes (both cols) | yes |
| `(LOWER(email))` | `WHERE LOWER(email) = ?` | yes (exact expr) | yes |
| `(LOWER(email))` | `WHERE email = ?` | no (different expr) | no |
| `(status) WHERE status='active'` | `WHERE status = 'active'` | yes (predicate implied) | yes |
| `(status) WHERE status='active'` | `WHERE status = 'inactive'` | no (predicate not implied) | no |

B-tree vs LSM simulated write counts (for BTreeVsLSM demo, illustrative — not measured):

| Operation | B-tree disk writes (pages) | LSM disk writes (sequential bytes) |
|---|---|---|
| Insert 1 row (no split) | 1 index page | 0 (stays in memtable) |
| Insert 1000 rows (memtable flush) | ~1000 index pages (random) | 1 SSTable file (sequential) |
| Delete + reuse row | 1 index page (mark dead) | 0 + future tombstone |
| Compaction | N/A (no equivalent) | Reads + rewrites 2–10× SSTables |

---

## 20. Connections to existing chapters and dossiers

- **/pattern-matching** — the underlying algorithms (B-tree traversal, inverted index construction). This dossier picks among structures; that one describes the mechanics.
- **/data-search** — the access strategies those structures enable: bloom filters, binary search, skip lists, inverted index internals.
- **/ann-vector-indexes** — vector indexes specifically. This dossier defers to that one; Section 10 is a callback only.
- **/rag** — full-text indexes (Section 11) and vector indexes (Section 10) both feed RAG pipelines. This dossier covers the index side; the RAG dossier covers how retrieval results flow into prompts.
- **Ch 7 prompt cache** — the prompt cache is conceptually an exact-prefix hash index on conversation state, as described in Section 17.

---

## 21. Closing-takeaway angle

Indexes are a tax you pay on writes for a discount on reads. The art is paying the tax only on the discounts you'll actually use.

Most database performance disasters are not "we needed a smarter algorithm." They're "we had the wrong index," "we had no index," "we had the right index but stale statistics made the planner ignore it," or "we had too many indexes and the write path collapsed under their maintenance cost."

The corollary: **the most dangerous index is one that was never used.** It silently slows every write, occupies RAM, and inflates backups — and the team never notices because no slow query was fixed by removing it.

The practical habit: after every schema change, run `EXPLAIN ANALYZE` on your top-10 most frequent queries. Verify they're using the indexes you expect. Check `pg_stat_user_indexes` (Postgres) for indexes with zero scans — those are candidates for removal. Index hygiene is not a one-time activity; it's a maintenance discipline.

---

## 22. Up-to-date facts — citations and confidence

| Claim | URL | Fetched | Confidence |
|---|---|---|---|
| Postgres 18 supports B-tree, Hash, GiST, SP-GiST, GIN, BRIN | postgresql.org/docs/current/indexes-types.html | 2026-05-17 | High (primary source) |
| GIN is preferred over GiST for full-text; GiST is lossy | postgresql.org/docs/current/textsearch-indexes.html | 2026-05-17 | High (primary source) |
| Postgres INCLUDE clause for covering indexes; heap fetch / visibility map dependency | postgresql.org/docs/current/indexes-index-only-scans.html | 2026-05-17 | High (primary source) |
| Partial indexes: Postgres syntax and semantics | postgresql.org/docs/current/indexes-partial.html | 2026-05-17 | High (primary source) |
| SQLite partial indexes supported from 3.8.0 (2013) | sqlite.org/partialindex.html | 2026-05-17 | High (primary source) |
| Leftmost-prefix rule and composite index column order | use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys | 2026-05-17 | High (well-maintained open textbook) |
| IOT / clustered index vs heap, MySQL InnoDB vs Postgres | use-the-index-luke.com/sql/clustering/index-organized-clustered-index | 2026-05-17 | High (textbook) |
| PostGIS spatial indexes use R-tree via GiST; bounding-box primary filter | postgis.net/docs/using_postgis_dbmanagement.html | 2026-05-17 | High (primary source) |
| RocksDB: memtable → SSTable → compaction; Level vs Universal compaction trade-offs | github.com/facebook/rocksdb/wiki/RocksDB-Overview | 2026-05-17 | High (primary source); no specific WAF number given in overview |
| EXPLAIN ANALYZE scan types: seq scan, index scan, index-only scan, bitmap scan | postgresql.org/docs/current/using-explain.html | 2026-05-17 | High (primary source) |
| RocksDB write amplification factor (Level compaction): specific number | Not verified — see rocksdb.org blog and academic LSM-tree literature | N/A | Could not verify — see note below |
| MySQL InnoDB UUID primary key causes write fragmentation | Inferred from documented InnoDB clustered-index architecture | N/A | Inferred (documented behavior, not measured here) |
| pg_trgm trigram GIN for LIKE substring queries | Mentioned in Postgres docs; not separately fetched this session | N/A | High (well-documented feature) |

---

## 23. Open questions

1. **RocksDB write amplification numbers:** The wiki overview describes the trade-off qualitatively. A specific WAF range for Level compaction (commonly cited as 10–30× in academic contexts) should be verified against the RocksDB benchmarks page or the original Dong et al. 2021 "Optimizing Space Amplification in RocksDB" paper before publishing.

2. **MySQL partial index workaround:** MySQL 8.4 is documented to lack native partial indexes. The generated-column workaround should be verified against MySQL 8.4 release notes — partial index support has been discussed as a feature request for years and may have landed in a subsequent release.

3. **pgvector HNSW vs IVF performance in Postgres:** The `/ann-vector-indexes` dossier covers this in depth, but for any claim in Section 10 that pgvector supports both HNSW and IVF-Flat, verify against the pgvector GitHub README for the current default and any behavioral changes since 0.7.0 (the version that added HNSW).

4. **BRIN index write behavior:** Section 2 states all indexes slow writes. BRIN indexes are extremely small (they store only min/max per block range) and their write overhead is negligible compared to B-tree. The "every index slows writes" framing holds directionally but BRIN is the weakest counterexample and could be called out explicitly.

5. **Expression index support in MySQL:** MySQL handles expression indexes via generated virtual columns (`ALTER TABLE t ADD COLUMN email_lower TEXT AS (LOWER(email)) VIRTUAL, ADD INDEX (email_lower)`). The mechanics and planner behavior differ from Postgres — verify current MySQL 8.4 docs before recommending this pattern.

---

### A note on `pg_stat_user_indexes`

Postgres's `pg_stat_user_indexes` view tracks `idx_scan` (number of times each index has been used since stats reset) and `idx_tup_read` / `idx_tup_fetch` (tuples read from index vs fetched from heap). An index with `idx_scan = 0` after several weeks of production traffic is a strong candidate for removal. An index with high `idx_scan` but very high `idx_tup_read / idx_tup_fetch` ratio may be a poor covering index candidate (many tuples read from the index, few fetched from heap — or many heap fetches indicating non-covering).

These views reset on `pg_stat_reset()` and on server restart in older Postgres versions — keep that in mind when interpreting zeros.

The combination of `pg_stat_user_indexes` (usage tracking), `pgstatindex` (bloat measurement), and `EXPLAIN ANALYZE` (plan verification) gives you the full picture for any index health question without guessing.

---

*Iterations used: 2 of 2. Stopping reason: target range (800–1500 lines) met; additional iterations would add depth on open questions 1–5 but not change core content, which is flagged for fact-checking before publication.*
