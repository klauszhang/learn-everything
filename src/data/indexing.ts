/**
 * indexing.ts
 *
 * Hand-authored illustrative data for the Indexing Strategies chapter.
 * Schema: users(id, country, city, status, email, created_at)
 *
 * All match results are illustrative, derived from the leftmost-prefix
 * rule and expression-match semantics — not from a real query planner.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchResult = "used" | "partial" | "not-used";

export type IndexDefinition = {
  id: string;
  /** Display label shown in the UI */
  label: string;
  /** Type tag for grouping in the UI */
  type: "single" | "composite" | "covering" | "partial" | "expression";
  /** Short SQL DDL (≤15 lines) */
  ddl: string;
};

export type ExampleQuery = {
  id: string;
  /** Display text for the dropdown */
  label: string;
  /** Short SQL snippet */
  sql: string;
};

export type MatchRule = {
  indexId: string;
  queryId: string;
  result: MatchResult;
  /** One sentence explaining the match decision */
  reason: string;
};

// ---------------------------------------------------------------------------
// Mini schema (reference only — not runtime data)
// ---------------------------------------------------------------------------

export const SCHEMA_DDL = `CREATE TABLE users (
  id         BIGINT PRIMARY KEY,
  country    TEXT,
  city       TEXT,
  status     TEXT,   -- 'active' | 'inactive' | 'banned'
  email      TEXT,
  created_at TIMESTAMPTZ
);`;

// ---------------------------------------------------------------------------
// Index definitions (6 indexes covering the key concepts)
// ---------------------------------------------------------------------------

export const indexes: IndexDefinition[] = [
  {
    id: "idx-country",
    label: "INDEX(country)",
    type: "single",
    ddl: `CREATE INDEX idx_users_country
  ON users (country);`,
  },
  {
    id: "idx-country-city",
    label: "INDEX(country, city)",
    type: "composite",
    ddl: `CREATE INDEX idx_users_country_city
  ON users (country, city);`,
  },
  {
    id: "idx-city-country",
    label: "INDEX(city, country)",
    type: "composite",
    ddl: `CREATE INDEX idx_users_city_country
  ON users (city, country);`,
  },
  {
    id: "idx-country-incl-email",
    label: "INDEX(country) INCLUDE (email)",
    type: "covering",
    ddl: `CREATE INDEX idx_users_country_cov
  ON users (country)
  INCLUDE (email);`,
  },
  {
    id: "idx-partial-active",
    label: "INDEX(email) WHERE status='active'",
    type: "partial",
    ddl: `CREATE INDEX idx_users_active_email
  ON users (email)
  WHERE status = 'active';`,
  },
  {
    id: "idx-lower-email",
    label: "INDEX(LOWER(email))",
    type: "expression",
    ddl: `CREATE INDEX idx_users_lower_email
  ON users (LOWER(email));`,
  },
];

// ---------------------------------------------------------------------------
// Example queries (6 queries against the users table)
// ---------------------------------------------------------------------------

export const queries: ExampleQuery[] = [
  {
    id: "q-country",
    label: "Filter by country only",
    sql: `SELECT * FROM users
WHERE country = 'US';`,
  },
  {
    id: "q-city",
    label: "Filter by city only",
    sql: `SELECT * FROM users
WHERE city = 'Austin';`,
  },
  {
    id: "q-country-city",
    label: "Filter by country AND city",
    sql: `SELECT * FROM users
WHERE country = 'US'
  AND city = 'Austin';`,
  },
  {
    id: "q-select-email",
    label: "SELECT email WHERE country (covering scan)",
    sql: `SELECT email FROM users
WHERE country = 'US';`,
  },
  {
    id: "q-active-email",
    label: "Filter active users by email",
    sql: `SELECT * FROM users
WHERE status = 'active'
  AND email = 'alice@example.com';`,
  },
  {
    id: "q-lower-email",
    label: "Case-insensitive email lookup",
    sql: `SELECT * FROM users
WHERE LOWER(email) = 'alice@example.com';`,
  },
];

// ---------------------------------------------------------------------------
// Match rules: (indexId, queryId) → result + reason
// ---------------------------------------------------------------------------

export const matchRules: MatchRule[] = [
  // --- idx-country vs all queries ---
  {
    indexId: "idx-country",
    queryId: "q-country",
    result: "used",
    reason: "Exact match on the indexed column — index scan used.",
  },
  {
    indexId: "idx-country",
    queryId: "q-city",
    result: "not-used",
    reason: "Index is on country; query filters city — no overlap.",
  },
  {
    indexId: "idx-country",
    queryId: "q-country-city",
    result: "partial",
    reason: "Index covers country (used), but city must be filtered from heap rows.",
  },
  {
    indexId: "idx-country",
    queryId: "q-select-email",
    result: "partial",
    reason: "Index narrows rows by country, but email must be fetched from the heap.",
  },
  {
    indexId: "idx-country",
    queryId: "q-active-email",
    result: "not-used",
    reason: "Query filters on status and email — country index is irrelevant.",
  },
  {
    indexId: "idx-country",
    queryId: "q-lower-email",
    result: "not-used",
    reason: "Query uses LOWER(email) — country index is irrelevant.",
  },

  // --- idx-country-city vs all queries ---
  {
    indexId: "idx-country-city",
    queryId: "q-country",
    result: "used",
    reason: "country is the leftmost prefix — full index scan on that prefix.",
  },
  {
    indexId: "idx-country-city",
    queryId: "q-city",
    result: "not-used",
    reason: "Leftmost-prefix rule: city is the second column. Without country, cities are scattered throughout the index — seq scan wins.",
  },
  {
    indexId: "idx-country-city",
    queryId: "q-country-city",
    result: "used",
    reason: "Both columns match in order — full composite index used.",
  },
  {
    indexId: "idx-country-city",
    queryId: "q-select-email",
    result: "partial",
    reason: "country prefix used to find rows, but email must be fetched from the heap.",
  },
  {
    indexId: "idx-country-city",
    queryId: "q-active-email",
    result: "not-used",
    reason: "Query filters on status and email — neither is in this index.",
  },
  {
    indexId: "idx-country-city",
    queryId: "q-lower-email",
    result: "not-used",
    reason: "Query uses LOWER(email) — no overlap with (country, city).",
  },

  // --- idx-city-country vs all queries ---
  {
    indexId: "idx-city-country",
    queryId: "q-country",
    result: "not-used",
    reason: "city is the leftmost column — filtering only by country skips all leading index entries.",
  },
  {
    indexId: "idx-city-country",
    queryId: "q-city",
    result: "used",
    reason: "city is now the leftmost prefix — index scan used.",
  },
  {
    indexId: "idx-city-country",
    queryId: "q-country-city",
    result: "partial",
    reason: "city is the leftmost prefix (used), country narrows further. But if the planner sees country = 'US' matching many cities, it may prefer seq scan.",
  },
  {
    indexId: "idx-city-country",
    queryId: "q-select-email",
    result: "not-used",
    reason: "Query filters by country — city must lead in this index. No useful prefix match.",
  },
  {
    indexId: "idx-city-country",
    queryId: "q-active-email",
    result: "not-used",
    reason: "Query filters on status and email — no overlap with (city, country).",
  },
  {
    indexId: "idx-city-country",
    queryId: "q-lower-email",
    result: "not-used",
    reason: "Query uses LOWER(email) — no overlap with (city, country).",
  },

  // --- idx-country-incl-email vs all queries ---
  {
    indexId: "idx-country-incl-email",
    queryId: "q-country",
    result: "used",
    reason: "country is indexed; index scan used.",
  },
  {
    indexId: "idx-country-incl-email",
    queryId: "q-city",
    result: "not-used",
    reason: "Covering index is on country — city has no prefix match.",
  },
  {
    indexId: "idx-country-incl-email",
    queryId: "q-country-city",
    result: "partial",
    reason: "country prefix used; city is not in the index, so heap fetch required for city filter.",
  },
  {
    indexId: "idx-country-incl-email",
    queryId: "q-select-email",
    result: "used",
    reason: "country filters the index; email is an INCLUDE column — index-only scan, zero heap fetches.",
  },
  {
    indexId: "idx-country-incl-email",
    queryId: "q-active-email",
    result: "not-used",
    reason: "Query filters on status and email; country covering index is irrelevant.",
  },
  {
    indexId: "idx-country-incl-email",
    queryId: "q-lower-email",
    result: "not-used",
    reason: "LOWER(email) expression has no match in this index.",
  },

  // --- idx-partial-active vs all queries ---
  {
    indexId: "idx-partial-active",
    queryId: "q-country",
    result: "not-used",
    reason: "Partial index is on email WHERE status='active' — query doesn't imply status='active'.",
  },
  {
    indexId: "idx-partial-active",
    queryId: "q-city",
    result: "not-used",
    reason: "Partial index covers email for active users — no city column.",
  },
  {
    indexId: "idx-partial-active",
    queryId: "q-country-city",
    result: "not-used",
    reason: "Partial index covers email — no country or city column.",
  },
  {
    indexId: "idx-partial-active",
    queryId: "q-select-email",
    result: "not-used",
    reason: "Query doesn't filter on status; partial index predicate (status='active') is not implied.",
  },
  {
    indexId: "idx-partial-active",
    queryId: "q-active-email",
    result: "used",
    reason: "Query implies status='active' (satisfies predicate) AND filters on email — perfect partial index match.",
  },
  {
    indexId: "idx-partial-active",
    queryId: "q-lower-email",
    result: "not-used",
    reason: "Query uses LOWER(email) — the partial index stores raw email values.",
  },

  // --- idx-lower-email vs all queries ---
  {
    indexId: "idx-lower-email",
    queryId: "q-country",
    result: "not-used",
    reason: "Expression index is on LOWER(email) — country query has no match.",
  },
  {
    indexId: "idx-lower-email",
    queryId: "q-city",
    result: "not-used",
    reason: "Expression index is on LOWER(email) — city query has no match.",
  },
  {
    indexId: "idx-lower-email",
    queryId: "q-country-city",
    result: "not-used",
    reason: "Expression index is on LOWER(email) — country/city query has no match.",
  },
  {
    indexId: "idx-lower-email",
    queryId: "q-select-email",
    result: "not-used",
    reason: "Query selects email but filters by country — expression index on LOWER(email) is irrelevant.",
  },
  {
    indexId: "idx-lower-email",
    queryId: "q-active-email",
    result: "not-used",
    reason: "Query uses email = '...' (not LOWER(email)) — expression mismatch; index not used.",
  },
  {
    indexId: "idx-lower-email",
    queryId: "q-lower-email",
    result: "used",
    reason: "Exact expression match: query uses LOWER(email) = '...' — expression index used.",
  },
];

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

export function getMatch(indexId: string, queryId: string): MatchRule | undefined {
  return matchRules.find((r) => r.indexId === indexId && r.queryId === queryId);
}
