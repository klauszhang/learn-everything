// search-engines.ts — hand-authored data for the Search Engines chapter.
// All data is illustrative; verify specific feature status at each project's docs.

export interface SearchSystem {
  id: string;
  name: string;
  license: string;
  selfHost: boolean;
  distributed: boolean;
  fullText: 'excellent' | 'good' | 'minimal' | 'none' | 'via-plugin';
  vector: boolean | 'limited' | 'via-extension';
  fuzzy: 'excellent' | 'good' | 'limited' | 'none' | 'via-extension';
  facets: 'excellent' | 'yes' | 'limited' | 'none';
  sweetSpot: string;
  niche: string;
  /** rough corpus size range where this system shines */
  corpusSizeMin: number; // documents
  corpusSizeMax: number; // documents (Infinity = no upper bound)
  opsComplexity: 'low' | 'medium' | 'high';
  hostingOption: 'self-only' | 'hosted-only' | 'both';
}

export const searchSystems: SearchSystem[] = [
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    license: 'ELv2 / SSPL / AGPLv3',
    selfHost: true,
    distributed: true,
    fullText: 'excellent',
    vector: true,
    fuzzy: 'good',
    facets: 'excellent',
    sweetSpot: '10M–1B+ docs, complex ranking',
    niche: 'The industry anchor — distributed, battle-tested, the Lucene ecosystem at scale.',
    corpusSizeMin: 10_000_000,
    corpusSizeMax: Infinity,
    opsComplexity: 'high',
    hostingOption: 'both',
  },
  {
    id: 'opensearch',
    name: 'OpenSearch',
    license: 'Apache 2.0',
    selfHost: true,
    distributed: true,
    fullText: 'excellent',
    vector: true,
    fuzzy: 'good',
    facets: 'excellent',
    sweetSpot: 'Same as Elasticsearch; AWS-native deployments',
    niche: 'The Apache 2.0 fork — permissive license, no managed-service restrictions.',
    corpusSizeMin: 10_000_000,
    corpusSizeMax: Infinity,
    opsComplexity: 'high',
    hostingOption: 'both',
  },
  {
    id: 'tantivy',
    name: 'Tantivy',
    license: 'MIT',
    selfHost: true,
    distributed: false,
    fullText: 'excellent',
    vector: false,
    fuzzy: 'limited',
    facets: 'yes',
    sweetSpot: 'Embedded search in Rust applications',
    niche: 'A Rust library, not a server. The engine inside Quickwit and ParadeDB.',
    corpusSizeMin: 0,
    corpusSizeMax: 100_000_000,
    opsComplexity: 'low',
    hostingOption: 'self-only',
  },
  {
    id: 'quickwit',
    name: 'Quickwit',
    license: 'AGPL-3.0',
    selfHost: true,
    distributed: true,
    fullText: 'good',
    vector: 'limited',
    fuzzy: 'none',
    facets: 'yes',
    sweetSpot: 'Logs, traces, events at TB/PB scale on object storage',
    niche: 'Object storage (S3/MinIO) as primary tier — 80–90% storage cost reduction vs. Elasticsearch SSDs.',
    corpusSizeMin: 1_000_000_000,
    corpusSizeMax: Infinity,
    opsComplexity: 'medium',
    hostingOption: 'self-only',
  },
  {
    id: 'meilisearch',
    name: 'Meilisearch',
    license: 'MIT / SSPL',
    selfHost: true,
    distributed: false,
    fullText: 'good',
    vector: true,
    fuzzy: 'excellent',
    facets: 'yes',
    sweetSpot: 'Sub-10M docs, instant search UI, great out-of-box defaults',
    niche: 'Developer-experience-first. Single binary, no deps, sub-50ms responses.',
    corpusSizeMin: 0,
    corpusSizeMax: 10_000_000,
    opsComplexity: 'low',
    hostingOption: 'both',
  },
  {
    id: 'typesense',
    name: 'Typesense',
    license: 'GPL-3.0',
    selfHost: true,
    distributed: false,
    fullText: 'good',
    vector: true,
    fuzzy: 'excellent',
    facets: 'yes',
    sweetSpot: 'E-commerce, docs sites, small-to-medium catalogs',
    niche: 'Billed as an easier Elasticsearch alternative — typo tolerance and facets out of the box.',
    corpusSizeMin: 0,
    corpusSizeMax: 10_000_000,
    opsComplexity: 'low',
    hostingOption: 'both',
  },
  {
    id: 'algolia',
    name: 'Algolia',
    license: 'Proprietary',
    selfHost: false,
    distributed: true,
    fullText: 'excellent',
    vector: true,
    fuzzy: 'excellent',
    facets: 'excellent',
    sweetSpot: 'No-ops, premium quality, cost is secondary',
    niche: 'Hosted SaaS with opinionated-but-good relevance. No self-hosting option.',
    corpusSizeMin: 0,
    corpusSizeMax: 50_000_000,
    opsComplexity: 'low',
    hostingOption: 'hosted-only',
  },
  {
    id: 'postgres-fts',
    name: 'Postgres tsvector + pgvector',
    license: 'PostgreSQL',
    selfHost: true,
    distributed: false,
    fullText: 'good',
    vector: 'via-extension',
    fuzzy: 'via-extension',
    facets: 'limited',
    sweetSpot: '< 10M docs on Postgres — add zero new services',
    niche: 'Already deployed. tsvector + GIN for FTS, pgvector for semantic, pg_trgm for fuzzy.',
    corpusSizeMin: 0,
    corpusSizeMax: 10_000_000,
    opsComplexity: 'low',
    hostingOption: 'both',
  },
  {
    id: 'paradedb',
    name: 'ParadeDB',
    license: 'AGPL-3.0',
    selfHost: true,
    distributed: false,
    fullText: 'excellent',
    vector: 'via-extension',
    fuzzy: 'limited',
    facets: 'yes',
    sweetSpot: 'Lucene-quality FTS + vector search without leaving Postgres',
    niche: 'Tantivy as a Postgres index type (pg_search) + pgvector in one database.',
    corpusSizeMin: 0,
    corpusSizeMax: 50_000_000,
    opsComplexity: 'low',
    hostingOption: 'both',
  },
  {
    id: 'qdrant',
    name: 'Qdrant / Weaviate (vector-native)',
    license: 'Apache 2.0 / BSD-3',
    selfHost: true,
    distributed: true,
    fullText: 'via-plugin',
    vector: true,
    fuzzy: 'none',
    facets: 'limited',
    sweetSpot: 'Vector-first hybrid retrieval; semantic search at scale',
    niche: 'Start from a vector/semantic requirement; add BM25 without a second system.',
    corpusSizeMin: 1_000_000,
    corpusSizeMax: Infinity,
    opsComplexity: 'medium',
    hostingOption: 'both',
  },
];

// --- Decision tree -------------------------------------------------------

export type DecisionAnswer =
  | 'small-postgres'   // < 100K docs, already on Postgres
  | 'small-new'        // < 100K docs, no Postgres
  | 'medium-postgres'  // 100K–10M, on Postgres
  | 'medium-new'       // 100K–10M, new stack
  | 'large-logs'       // 10M+, logs/traces/events
  | 'large-no-ops'     // 10M+, want hosted zero-ops
  | 'large-complex';   // 10M+, complex ranking, multi-tenant

export interface DecisionResult {
  primary: string[];   // system IDs
  rationale: string;
  modifiers: DecisionModifier[];
}

export interface DecisionModifier {
  condition: string;
  action: string;
}

export const decisionResults: Record<DecisionAnswer, DecisionResult> = {
  'small-postgres': {
    primary: ['postgres-fts'],
    rationale:
      'Already deployed. tsvector + GIN handles FTS, pgvector adds semantic search, pg_trgm covers fuzzy name matching. Zero new services.',
    modifiers: [
      { condition: 'Need instant autocomplete (< 20ms)', action: 'Consider Meilisearch/Typesense' },
      { condition: 'Need rich faceted filtering', action: 'Postgres limited — consider Meilisearch' },
    ],
  },
  'small-new': {
    primary: ['meilisearch', 'typesense'],
    rationale:
      'Single binary, no dependencies, sub-50ms responses, excellent typo tolerance out of the box.',
    modifiers: [
      { condition: 'Budget allows no ops overhead', action: 'Algolia is a valid alternative' },
    ],
  },
  'medium-postgres': {
    primary: ['paradedb', 'postgres-fts'],
    rationale:
      'ParadeDB brings Lucene-quality BM25 (via Tantivy) + pgvector into Postgres. No new cluster.',
    modifiers: [
      { condition: 'Need Lucene-class FTS + hybrid', action: 'ParadeDB (pg_search + pgvector)' },
      { condition: 'Simpler requirements', action: 'tsvector + pgvector is sufficient' },
    ],
  },
  'medium-new': {
    primary: ['meilisearch', 'typesense', 'qdrant'],
    rationale:
      'Single-binary engines for FTS/fuzzy; Qdrant/Weaviate if vector/semantic is the primary access pattern.',
    modifiers: [
      { condition: 'Semantic search is primary', action: 'Qdrant or Weaviate with built-in BM25 hybrid' },
      { condition: 'Instant typo-tolerant search UI', action: 'Meilisearch or Typesense' },
    ],
  },
  'large-logs': {
    primary: ['quickwit'],
    rationale:
      'Object storage as primary tier. Sub-second queries on TB/PB. 80–90% storage cost reduction vs. Elasticsearch on SSD.',
    modifiers: [
      { condition: 'Need < 10s ingest freshness', action: 'Keep small Elasticsearch hot tier for last 24h' },
    ],
  },
  'large-no-ops': {
    primary: ['algolia'],
    rationale:
      'Excellent out-of-the-box quality, no cluster to manage, strong merchandising tools.',
    modifiers: [
      { condition: 'Data residency requirement', action: 'Cannot use Algolia — switch to self-hosted' },
      { condition: 'Cost becomes prohibitive', action: 'Re-evaluate Elasticsearch or OpenSearch at scale' },
    ],
  },
  'large-complex': {
    primary: ['elasticsearch', 'opensearch'],
    rationale:
      'Distributed, multi-shard, complex ranking, multi-tenant, or full Elastic observability stack.',
    modifiers: [
      { condition: 'Need permissive license (no SSPL/ELv2)', action: 'Use OpenSearch (Apache 2.0)' },
      { condition: 'Want latest ML/AI features (ELSER, GenAI)', action: 'Use Elasticsearch (ELv2/AGPLv3)' },
    ],
  },
};

// Analyzer pipeline trace — the "Quick brown FOXES" worked example.
export interface AnalyzerStep {
  stage: string;
  description: string;
  tokens: string[];
  note?: string;
}

export const analyzerExample: { input: string; steps: AnalyzerStep[] } = {
  input: 'Quick brown FOXES, jumping!',
  steps: [
    {
      stage: 'Raw input',
      description: 'What the document actually contains',
      tokens: ['Quick', 'brown', 'FOXES,', 'jumping!'],
      note: 'Punctuation still attached; casing preserved',
    },
    {
      stage: 'After character filters',
      description: 'Strip HTML, normalize Unicode (none needed here)',
      tokens: ['Quick', 'brown', 'FOXES,', 'jumping!'],
      note: 'No change — no HTML or special chars to strip',
    },
    {
      stage: 'After tokenizer',
      description: 'Standard tokenizer splits on whitespace and punctuation',
      tokens: ['Quick', 'brown', 'FOXES', 'jumping'],
      note: 'Comma and exclamation mark discarded',
    },
    {
      stage: 'After lowercase filter',
      description: 'Every token lowercased',
      tokens: ['quick', 'brown', 'foxes', 'jumping'],
    },
    {
      stage: 'After stop-word filter',
      description: 'Common words removed (none here — "brown" is not a default stopword)',
      tokens: ['quick', 'brown', 'foxes', 'jumping'],
      note: '"quick" and "brown" both survive the English stopword list',
    },
    {
      stage: 'After English stemmer',
      description: 'Reduce to stem form',
      tokens: ['quick', 'brown', 'fox', 'jump'],
      note: '"foxes" → "fox", "jumping" → "jump". These are illustrative approximations of the Snowball stemmer',
    },
  ],
};
