/**
 * vector-search.ts
 *
 * Hand-authored illustrative data for the Vector Search chapter.
 * IMPORTANT: All vectors, coordinates, and similarity scores are ILLUSTRATIVE.
 * They were authored by hand to produce pedagogically clear examples — they are
 * NOT real model output and NOT computed from any embedding model.
 *
 * Convention: 8-dimensional vectors, L2-normalized so dot product = cosine similarity.
 * 2D coords are purely for scatter-plot layout and are NOT projections of the 8-dim vectors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentTopic = "legal" | "code" | "biology" | "finance" | "hr";

export type CorpusDoc = {
  id: string;
  title: string;
  body: string;
  topic: DocumentTopic;
  /** 2D position for the scatter diagram. Purely aesthetic — not a vector projection. */
  coords2d: [number, number];
  /** 8-dim illustrative vector, L2-normalized. Semantic axes: [legal, code, biology, finance, hr, tech, people, numbers]. */
  vec8: number[];
};

export type RetrievalQuery = {
  id: string;
  text: string;
  /** 2D position for the scatter diagram — near the relevant cluster. */
  coords2d: [number, number];
  /** 8-dim illustrative vector, L2-normalized. */
  vec8: number[];
  /** Pre-computed ranked document IDs, closest first. Derived from vec8 dot products. */
  rankedIds: string[];
  /** Illustrative cosine scores for the top-3 results (dot product on normalized vecs). */
  topKScores: number[];
};

// ---------------------------------------------------------------------------
// Corpus documents (~12 chunks, 5 topics)
// ---------------------------------------------------------------------------

export const corpus: CorpusDoc[] = [
  // ── Legal cluster (upper-left in 2D) ─────────────────────────────────────
  {
    id: "doc-01",
    title: "Account termination",
    body: "Terminating your account removes access to all paid features immediately. Outstanding balances remain due according to the billing schedule in effect at termination.",
    topic: "legal",
    coords2d: [95, 80],
    vec8: [0.91, 0.07, 0.03, 0.05, 0.08, 0.02, 0.06, 0.04],
  },
  {
    id: "doc-02",
    title: "Late payment grace period",
    body: "Late payment triggers a 30-day grace period before service suspension. After 30 days, accounts are flagged for collection and access is restricted.",
    topic: "legal",
    coords2d: [120, 100],
    vec8: [0.88, 0.04, 0.02, 0.09, 0.06, 0.02, 0.05, 0.07],
  },
  {
    id: "doc-03",
    title: "Indemnification clause",
    body: "Section 14(d) governs indemnification. Each party agrees to hold the other harmless from claims arising from its own breach of this agreement.",
    topic: "legal",
    coords2d: [80, 110],
    vec8: [0.93, 0.03, 0.02, 0.03, 0.04, 0.01, 0.05, 0.02],
  },

  // ── Code cluster (lower-right in 2D) ─────────────────────────────────────
  {
    id: "doc-04",
    title: "NullPointerException in UserService",
    body: "NullPointerException at line 42 in UserService.java. The user object was not initialized before calling getProfile(). Check that authentication middleware runs before this handler.",
    topic: "code",
    coords2d: [380, 260],
    vec8: [0.04, 0.90, 0.03, 0.02, 0.04, 0.12, 0.03, 0.02],
  },
  {
    id: "doc-05",
    title: "API rate limit",
    body: "The API rate limit is 100 requests per minute per token. Exceeded requests return HTTP 429. Implement exponential back-off with jitter to handle rate-limit responses gracefully.",
    topic: "code",
    coords2d: [400, 240],
    vec8: [0.03, 0.87, 0.02, 0.03, 0.02, 0.14, 0.04, 0.06],
  },
  {
    id: "doc-06",
    title: "Installing project dependencies",
    body: "Run `bun install` to install all project dependencies. Use `bun run dev` to start the local development server on port 4321.",
    topic: "code",
    coords2d: [360, 290],
    vec8: [0.02, 0.92, 0.02, 0.02, 0.03, 0.10, 0.03, 0.02],
  },

  // ── Biology cluster (upper-right in 2D) ──────────────────────────────────
  {
    id: "doc-07",
    title: "Photosynthesis overview",
    body: "Photosynthesis converts light energy into chemical energy stored as glucose. Chlorophyll absorbs sunlight; the Calvin cycle fixes CO2 into sugar molecules.",
    topic: "biology",
    coords2d: [360, 80],
    vec8: [0.03, 0.03, 0.93, 0.02, 0.03, 0.02, 0.04, 0.03],
  },
  {
    id: "doc-08",
    title: "Mitochondria and ATP",
    body: "Mitochondria produce ATP via oxidative phosphorylation. Electrons from NADH drive proton pumps across the inner membrane, powering ATP synthase.",
    topic: "biology",
    coords2d: [395, 100],
    vec8: [0.02, 0.02, 0.94, 0.02, 0.02, 0.02, 0.04, 0.02],
  },

  // ── Finance cluster (lower-left in 2D) ───────────────────────────────────
  {
    id: "doc-09",
    title: "Q3 revenue results",
    body: "Q3 revenue was $4.2 million, down 12% year-over-year. The decline reflects reduced enterprise contract renewals in North America.",
    topic: "finance",
    coords2d: [120, 250],
    vec8: [0.06, 0.03, 0.02, 0.91, 0.04, 0.03, 0.04, 0.08],
  },
  {
    id: "doc-10",
    title: "EBITDA margin improvement",
    body: "The EBITDA margin improved to 18% in fiscal 2025, up from 14% in 2024. Cost reductions in infrastructure and headcount drove the improvement.",
    topic: "finance",
    coords2d: [100, 270],
    vec8: [0.05, 0.02, 0.02, 0.92, 0.03, 0.03, 0.05, 0.09],
  },

  // ── HR cluster (center-bottom in 2D) ─────────────────────────────────────
  {
    id: "doc-11",
    title: "PTO policy",
    body: "Full-time employees receive 15 days of paid time off per calendar year. PTO accrues at 1.25 days per month and can carry over up to 5 days.",
    topic: "hr",
    coords2d: [230, 290],
    vec8: [0.08, 0.03, 0.03, 0.04, 0.92, 0.02, 0.10, 0.04],
  },
  {
    id: "doc-12",
    title: "Remote work policy",
    body: "Remote work is permitted up to 3 days per week for eligible roles. Employees must be reachable during core hours of 10 AM – 3 PM in their local time zone.",
    topic: "hr",
    coords2d: [260, 270],
    vec8: [0.06, 0.04, 0.02, 0.03, 0.90, 0.03, 0.12, 0.03],
  },
];

// ---------------------------------------------------------------------------
// Queries (6 illustrative queries with pre-computed rankings)
// ---------------------------------------------------------------------------

// Cosine scores: dot product of query vec8 with each doc vec8 (all L2-normalized).
// Rankings and scores authored to match intuitive relevance within each cluster.

export const queries: RetrievalQuery[] = [
  {
    id: "q-01",
    text: "What happens when I stop paying?",
    coords2d: [105, 60],
    vec8: [0.90, 0.05, 0.02, 0.06, 0.07, 0.01, 0.04, 0.05],
    rankedIds: ["doc-01", "doc-02", "doc-03", "doc-09", "doc-11", "doc-10", "doc-12", "doc-04", "doc-05", "doc-06", "doc-07", "doc-08"],
    topKScores: [0.92, 0.87, 0.83],
  },
  {
    id: "q-02",
    text: "How to install project dependencies",
    coords2d: [345, 310],
    vec8: [0.02, 0.93, 0.02, 0.02, 0.02, 0.11, 0.03, 0.02],
    rankedIds: ["doc-06", "doc-04", "doc-05", "doc-11", "doc-12", "doc-01", "doc-02", "doc-03", "doc-09", "doc-10", "doc-07", "doc-08"],
    topKScores: [0.95, 0.83, 0.80],
  },
  {
    id: "q-03",
    text: "Where does the cell get its energy?",
    coords2d: [420, 60],
    vec8: [0.02, 0.02, 0.95, 0.02, 0.02, 0.01, 0.03, 0.02],
    rankedIds: ["doc-08", "doc-07", "doc-04", "doc-05", "doc-06", "doc-01", "doc-02", "doc-03", "doc-09", "doc-10", "doc-11", "doc-12"],
    topKScores: [0.94, 0.91, 0.06],
  },
  {
    id: "q-04",
    text: "Quarterly earnings performance",
    coords2d: [85, 300],
    vec8: [0.05, 0.02, 0.02, 0.93, 0.03, 0.02, 0.04, 0.07],
    rankedIds: ["doc-09", "doc-10", "doc-01", "doc-02", "doc-03", "doc-11", "doc-12", "doc-04", "doc-05", "doc-06", "doc-07", "doc-08"],
    topKScores: [0.94, 0.91, 0.10],
  },
  {
    id: "q-05",
    text: "How many days off do I get per year?",
    coords2d: [250, 320],
    vec8: [0.07, 0.03, 0.02, 0.04, 0.93, 0.02, 0.09, 0.03],
    rankedIds: ["doc-11", "doc-12", "doc-01", "doc-02", "doc-09", "doc-10", "doc-03", "doc-04", "doc-05", "doc-06", "doc-07", "doc-08"],
    topKScores: [0.95, 0.83, 0.12],
  },
  {
    id: "q-06",
    text: "Java error during application startup",
    coords2d: [395, 300],
    vec8: [0.03, 0.91, 0.02, 0.02, 0.03, 0.13, 0.03, 0.03],
    rankedIds: ["doc-04", "doc-05", "doc-06", "doc-11", "doc-12", "doc-01", "doc-02", "doc-03", "doc-09", "doc-10", "doc-07", "doc-08"],
    topKScores: [0.93, 0.81, 0.78],
  },
];

// ---------------------------------------------------------------------------
// Topic metadata (colors for scatter plot)
// ---------------------------------------------------------------------------

export const topicColors: Record<DocumentTopic, { fill: string; label: string }> = {
  legal:   { fill: "#6366f1", label: "Legal" },
  code:    { fill: "#10b981", label: "Code" },
  biology: { fill: "#f97316", label: "Biology" },
  finance: { fill: "#8b5cf6", label: "Finance" },
  hr:      { fill: "#ec4899", label: "HR" },
};
