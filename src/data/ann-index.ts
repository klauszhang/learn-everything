/**
 * ann-index.ts
 *
 * Hand-authored illustrative data for the ANN vector indexes chapter.
 * All coordinates, visit sets, and recall values are constructed to tell
 * a plausible story about HNSW's exploration budget — not real model output.
 *
 * Coordinate space: [0, 1] × [0, 1]
 * Clusters: Finance (top-left), Legal (top-right), Engineering (bottom-left),
 *           Marketing (bottom-right), HR (center), Noise (scattered).
 */

export type Point = {
  id: string;
  x: number; // [0,1]
  y: number; // [0,1]
  label: string;
  topic: "finance" | "legal" | "engineering" | "marketing" | "hr" | "noise";
  owner: string;
  year: number;
};

export type Query = {
  id: string;
  label: string;
  x: number;
  y: number;
  trueTop5: string[];         // ids of the 5 true nearest neighbors (exact search)
  visitedAt16: string[];      // hnsw visited nodes at efSearch=16
  visitedAt64: string[];      // hnsw visited nodes at efSearch=64
  visitedAt128: string[];     // hnsw visited nodes at efSearch=128
  visitedAt256: string[];     // hnsw visited nodes at efSearch=256
  recallAt16: number;         // fraction of trueTop5 found at efSearch=16
  recallAt64: number;
  recallAt128: number;
  recallAt256: number;
};

// ─── 60-point corpus ──────────────────────────────────────────────────────────

export const points: Point[] = [
  // Finance cluster — top-left (x: 0.08–0.28, y: 0.68–0.90)
  { id: "f1",  x: 0.12, y: 0.87, label: "Q3 budget overview",       topic: "finance",     owner: "alice",  year: 2025 },
  { id: "f2",  x: 0.18, y: 0.82, label: "Revenue forecast FY25",    topic: "finance",     owner: "alice",  year: 2025 },
  { id: "f3",  x: 0.22, y: 0.79, label: "Cost model Q2",            topic: "finance",     owner: "alice",  year: 2024 },
  { id: "f4",  x: 0.10, y: 0.74, label: "Expense report Oct",       topic: "finance",     owner: "bob",    year: 2025 },
  { id: "f5",  x: 0.25, y: 0.85, label: "Margin analysis H2",       topic: "finance",     owner: "carol",  year: 2025 },
  { id: "f6",  x: 0.16, y: 0.71, label: "Budget variance report",   topic: "finance",     owner: "bob",    year: 2024 },
  { id: "f7",  x: 0.28, y: 0.76, label: "Q4 earnings projection",   topic: "finance",     owner: "carol",  year: 2023 },
  { id: "f8",  x: 0.09, y: 0.83, label: "OpEx breakdown",           topic: "finance",     owner: "alice",  year: 2023 },
  { id: "f9",  x: 0.20, y: 0.68, label: "Headcount cost model",     topic: "finance",     owner: "dave",   year: 2025 },
  { id: "f10", x: 0.15, y: 0.90, label: "Annual budget draft",      topic: "finance",     owner: "dave",   year: 2024 },

  // Legal cluster — top-right (x: 0.70–0.90, y: 0.72–0.93)
  { id: "l1",  x: 0.75, y: 0.90, label: "Vendor contract 2025",     topic: "legal",       owner: "alice",  year: 2025 },
  { id: "l2",  x: 0.82, y: 0.85, label: "NDA template v3",          topic: "legal",       owner: "eve",    year: 2024 },
  { id: "l3",  x: 0.78, y: 0.78, label: "Liability clause review",  topic: "legal",       owner: "alice",  year: 2025 },
  { id: "l4",  x: 0.88, y: 0.82, label: "IP assignment form",       topic: "legal",       owner: "frank",  year: 2023 },
  { id: "l5",  x: 0.72, y: 0.84, label: "GDPR addendum",            topic: "legal",       owner: "frank",  year: 2025 },
  { id: "l6",  x: 0.85, y: 0.93, label: "SaaS terms of service",    topic: "legal",       owner: "eve",    year: 2024 },
  { id: "l7",  x: 0.80, y: 0.72, label: "Employment contract",      topic: "legal",       owner: "eve",    year: 2023 },
  { id: "l8",  x: 0.70, y: 0.76, label: "MSA draft",                topic: "legal",       owner: "frank",  year: 2024 },
  { id: "l9",  x: 0.90, y: 0.76, label: "Data processing agreement", topic: "legal",      owner: "alice",  year: 2025 },
  { id: "l10", x: 0.76, y: 0.88, label: "License agreement",        topic: "legal",       owner: "dave",   year: 2023 },

  // Engineering cluster — bottom-left (x: 0.08–0.30, y: 0.08–0.28)
  { id: "e1",  x: 0.10, y: 0.25, label: "Deployment pipeline",      topic: "engineering", owner: "alice",  year: 2025 },
  { id: "e2",  x: 0.18, y: 0.20, label: "Test coverage report",     topic: "engineering", owner: "grace",  year: 2024 },
  { id: "e3",  x: 0.22, y: 0.28, label: "API spec v2",              topic: "engineering", owner: "alice",  year: 2025 },
  { id: "e4",  x: 0.12, y: 0.14, label: "Incident runbook",         topic: "engineering", owner: "grace",  year: 2023 },
  { id: "e5",  x: 0.28, y: 0.22, label: "Code review guidelines",   topic: "engineering", owner: "henry",  year: 2025 },
  { id: "e6",  x: 0.08, y: 0.18, label: "CI/CD config",             topic: "engineering", owner: "henry",  year: 2024 },
  { id: "e7",  x: 0.25, y: 0.10, label: "Database migration plan",  topic: "engineering", owner: "grace",  year: 2023 },
  { id: "e8",  x: 0.15, y: 0.08, label: "Security audit findings",  topic: "engineering", owner: "henry",  year: 2024 },
  { id: "e9",  x: 0.20, y: 0.15, label: "Observability runbook",    topic: "engineering", owner: "alice",  year: 2023 },
  { id: "e10", x: 0.10, y: 0.28, label: "On-call schedule",         topic: "engineering", owner: "dave",   year: 2025 },

  // Marketing cluster — bottom-right (x: 0.70–0.90, y: 0.08–0.28)
  { id: "m1",  x: 0.75, y: 0.22, label: "Campaign ROI Q3",          topic: "marketing",   owner: "alice",  year: 2024 },
  { id: "m2",  x: 0.82, y: 0.18, label: "Brand guidelines v2",      topic: "marketing",   owner: "iris",   year: 2025 },
  { id: "m3",  x: 0.78, y: 0.28, label: "Social strategy 2025",     topic: "marketing",   owner: "iris",   year: 2025 },
  { id: "m4",  x: 0.88, y: 0.14, label: "Press release draft",      topic: "marketing",   owner: "iris",   year: 2023 },
  { id: "m5",  x: 0.72, y: 0.10, label: "SEO audit report",         topic: "marketing",   owner: "jack",   year: 2024 },
  { id: "m6",  x: 0.85, y: 0.24, label: "Email campaign metrics",   topic: "marketing",   owner: "jack",   year: 2025 },
  { id: "m7",  x: 0.80, y: 0.08, label: "Influencer brief",         topic: "marketing",   owner: "iris",   year: 2023 },
  { id: "m8",  x: 0.70, y: 0.20, label: "Competitive analysis",     topic: "marketing",   owner: "jack",   year: 2024 },
  { id: "m9",  x: 0.90, y: 0.20, label: "Paid search playbook",     topic: "marketing",   owner: "jack",   year: 2025 },
  { id: "m10", x: 0.76, y: 0.15, label: "Product launch plan",      topic: "marketing",   owner: "iris",   year: 2024 },

  // HR cluster — center (x: 0.40–0.60, y: 0.40–0.60)
  { id: "h1",  x: 0.45, y: 0.58, label: "Onboarding checklist",     topic: "hr",          owner: "alice",  year: 2025 },
  { id: "h2",  x: 0.52, y: 0.52, label: "PTO policy 2025",          topic: "hr",          owner: "kate",   year: 2025 },
  { id: "h3",  x: 0.48, y: 0.45, label: "Benefits handbook",        topic: "hr",          owner: "kate",   year: 2024 },
  { id: "h4",  x: 0.58, y: 0.55, label: "Performance review template", topic: "hr",       owner: "alice",  year: 2023 },
  { id: "h5",  x: 0.42, y: 0.48, label: "Org chart Q3",             topic: "hr",          owner: "kate",   year: 2024 },
  { id: "h6",  x: 0.55, y: 0.42, label: "Compensation bands",       topic: "hr",          owner: "lee",    year: 2025 },
  { id: "h7",  x: 0.60, y: 0.60, label: "Hiring rubric",            topic: "hr",          owner: "lee",    year: 2023 },
  { id: "h8",  x: 0.40, y: 0.55, label: "Training catalog",         topic: "hr",          owner: "lee",    year: 2024 },
  { id: "h9",  x: 0.50, y: 0.62, label: "Exit interview template",  topic: "hr",          owner: "alice",  year: 2023 },
  { id: "h10", x: 0.56, y: 0.48, label: "Leave request form",       topic: "hr",          owner: "kate",   year: 2025 },

  // Noise — scattered
  { id: "n1",  x: 0.35, y: 0.80, label: "Travel receipts Apr",      topic: "noise",       owner: "alice",  year: 2024 },
  { id: "n2",  x: 0.62, y: 0.35, label: "Pantry order form",        topic: "noise",       owner: "bob",    year: 2023 },
  { id: "n3",  x: 0.45, y: 0.20, label: "Building access request",  topic: "noise",       owner: "carol",  year: 2025 },
  { id: "n4",  x: 0.30, y: 0.50, label: "Catering quote",           topic: "noise",       owner: "dave",   year: 2024 },
  { id: "n5",  x: 0.65, y: 0.65, label: "IT equipment list",        topic: "noise",       owner: "alice",  year: 2023 },
  { id: "n6",  x: 0.38, y: 0.30, label: "Parking permit request",   topic: "noise",       owner: "eve",    year: 2025 },
  { id: "n7",  x: 0.55, y: 0.22, label: "Conference room booking",  topic: "noise",       owner: "frank",  year: 2024 },
  { id: "n8",  x: 0.28, y: 0.65, label: "Volunteer sign-up",        topic: "noise",       owner: "grace",  year: 2023 },
  { id: "n9",  x: 0.72, y: 0.48, label: "Office supply order",      topic: "noise",       owner: "henry",  year: 2024 },
  { id: "n10", x: 0.48, y: 0.78, label: "Event planning notes",     topic: "noise",       owner: "iris",   year: 2025 },
];

// ─── Queries ──────────────────────────────────────────────────────────────────
// visitedAt* sets are hand-authored to illustrate HNSW traversal.
// efSearch=16: ~12–14 nodes, Recall@5=0.60 (3 of 5 true top-5 found)
// efSearch=64: ~25–30 nodes, Recall@5=0.80 (4 of 5 found)
// efSearch=128: ~38–42 nodes, Recall@5=1.0 (all 5 found)
// efSearch=256: ~47–50 nodes, Recall@5=1.0 (no improvement — diminishing returns)

export const queries: Query[] = [
  {
    id: "q1",
    label: "quarterly revenue outlook",
    x: 0.18,
    y: 0.79,
    trueTop5: ["f2", "f3", "f1", "f6", "f8"],
    // At efSearch=16: enters at HR hub (h2), jumps to Finance via layer-2 link,
    // explores Finance core. Misses f6 and f8 (they're on the periphery).
    visitedAt16: ["h2", "h1", "h5", "f5", "f2", "f3", "f1", "f4", "f7", "f10", "n10", "n1", "n8"],
    // At efSearch=64: wider expansion, catches f6 but still misses f8.
    visitedAt64: ["h2", "h1", "h5", "h9", "h3", "h4", "f5", "f2", "f3", "f1", "f4", "f7", "f10", "f9", "f6", "n10", "n1", "n8", "n4", "e10", "l10", "l8", "l7", "l5", "h8", "h6", "h10"],
    // At efSearch=128: full Finance cluster explored, all 5 found.
    visitedAt128: ["h2", "h1", "h5", "h9", "h3", "h4", "h6", "h7", "h8", "h10", "f5", "f2", "f3", "f1", "f4", "f7", "f10", "f9", "f6", "f8", "n10", "n1", "n8", "n4", "n5", "e10", "e1", "l10", "l8", "l7", "l5", "n6", "n3", "n2", "n7", "n9", "e2", "e3", "e9"],
    // At efSearch=256: even more nodes explored, same 5 results. Diminishing returns.
    visitedAt256: ["h2", "h1", "h5", "h9", "h3", "h4", "h6", "h7", "h8", "h10", "f5", "f2", "f3", "f1", "f4", "f7", "f10", "f9", "f6", "f8", "n10", "n1", "n8", "n4", "n5", "e10", "e1", "e2", "e3", "e9", "e4", "e5", "e6", "e7", "e8", "l10", "l8", "l7", "l5", "l1", "l2", "l3", "l4", "l6", "n6", "n3", "n2", "n7", "n9"],
    recallAt16: 0.60,
    recallAt64: 0.80,
    recallAt128: 1.00,
    recallAt256: 1.00,
  },
  {
    id: "q2",
    label: "third-party vendor agreement",
    x: 0.80,
    y: 0.82,
    trueTop5: ["l2", "l6", "l10", "l1", "l4"],
    visitedAt16: ["h7", "h4", "n5", "n9", "l8", "l7", "l2", "l6", "l10", "l5", "l3", "l1", "n2"],
    visitedAt64: ["h7", "h4", "n5", "n9", "n2", "n7", "l8", "l7", "l2", "l6", "l10", "l5", "l3", "l1", "l4", "l9", "m9", "m6", "m3", "m2", "m8", "m1", "m5", "m10", "h6", "h10"],
    visitedAt128: ["h7", "h4", "h6", "h10", "n5", "n9", "n2", "n7", "l8", "l7", "l2", "l6", "l10", "l5", "l3", "l1", "l4", "l9", "m9", "m6", "m3", "m2", "m8", "m1", "m5", "m10", "m4", "m7", "e5", "e7", "e8", "n6", "n3", "n4", "f7", "f9", "h2", "h1", "h5"],
    visitedAt256: ["h7", "h4", "h6", "h10", "h2", "h1", "h5", "h3", "h8", "h9", "n5", "n9", "n2", "n7", "l8", "l7", "l2", "l6", "l10", "l5", "l3", "l1", "l4", "l9", "m9", "m6", "m3", "m2", "m8", "m1", "m5", "m10", "m4", "m7", "e5", "e7", "e8", "n6", "n3", "n4", "f7", "f9", "f6", "f4", "n8", "n10", "n1", "e10", "e2"],
    recallAt16: 0.60,
    recallAt64: 0.80,
    recallAt128: 1.00,
    recallAt256: 1.00,
  },
  {
    id: "q3",
    label: "CI/CD deployment config",
    x: 0.19,
    y: 0.18,
    trueTop5: ["e6", "e1", "e2", "e9", "e3"],
    visitedAt16: ["h5", "h3", "h8", "n4", "n6", "e10", "e1", "e6", "e2", "e4", "e9", "n3", "n7"],
    visitedAt64: ["h5", "h3", "h8", "h1", "h2", "n4", "n6", "n3", "n7", "e10", "e1", "e6", "e2", "e4", "e9", "e3", "e5", "e7", "e8", "f9", "f4", "f6", "n8", "n1", "n10", "f1"],
    visitedAt128: ["h5", "h3", "h8", "h1", "h2", "h6", "h4", "h7", "h9", "h10", "n4", "n6", "n3", "n7", "e10", "e1", "e6", "e2", "e4", "e9", "e3", "e5", "e7", "e8", "f9", "f4", "f6", "n8", "n1", "n10", "f1", "f3", "f2", "n2", "n5", "m5", "m7", "m10", "m4"],
    visitedAt256: ["h5", "h3", "h8", "h1", "h2", "h6", "h4", "h7", "h9", "h10", "n4", "n6", "n3", "n7", "e10", "e1", "e6", "e2", "e4", "e9", "e3", "e5", "e7", "e8", "f9", "f4", "f6", "n8", "n1", "n10", "f1", "f3", "f2", "n2", "n5", "m5", "m7", "m10", "m4", "m8", "m2", "m3", "m1", "m6", "l7", "l8", "l10", "l5", "l3"],
    recallAt16: 0.60,
    recallAt64: 0.80,
    recallAt128: 1.00,
    recallAt256: 1.00,
  },
];

// ─── efSearch levels for the slider demo ─────────────────────────────────────

export const efSearchLevels = [16, 32, 48, 64, 96, 128, 192, 256] as const;
export type EfSearchLevel = typeof efSearchLevels[number];

/**
 * Interpolate visited set and recall for a given efSearch value.
 * Uses the four anchor points (16, 64, 128, 256) and linearly interpolates
 * both the node count and recall between them.
 */
export function getVisitedAtEfSearch(query: Query, efSearch: number): {
  visited: string[];
  recall: number;
  nodesVisited: number;
  latencyMs: number;
} {
  // Anchor data: [efSearch, visitedCount, recall, latencyMs]
  const anchors: Array<[number, number, number, number]> = [
    [16,  query.visitedAt16.length,  query.recallAt16,  1.0],
    [64,  query.visitedAt64.length,  query.recallAt64,  1.8],
    [128, query.visitedAt128.length, query.recallAt128, 2.6],
    [256, query.visitedAt256.length, query.recallAt256, 3.8],
  ];

  // Find bracket
  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (efSearch >= anchors[i][0] && efSearch <= anchors[i + 1][0]) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
  }

  const t = lo[0] === hi[0] ? 1 : (efSearch - lo[0]) / (hi[0] - lo[0]);
  const nodesVisited = Math.round(lo[1] + t * (hi[1] - lo[1]));
  const recall = lo[2] + t * (hi[2] - lo[2]);
  const latencyMs = lo[3] + t * (hi[3] - lo[3]);

  // Choose the visited set from the nearest anchor
  let visited: string[];
  if (efSearch <= 40) visited = query.visitedAt16;
  else if (efSearch <= 96) visited = query.visitedAt64;
  else if (efSearch <= 192) visited = query.visitedAt128;
  else visited = query.visitedAt256;

  // Trim or expand to match interpolated count
  const sliced = visited.slice(0, Math.min(nodesVisited, visited.length));

  return { visited: sliced, recall: Math.min(1, recall), nodesVisited, latencyMs };
}

// ─── Topic color map ──────────────────────────────────────────────────────────

export const topicColors: Record<Point["topic"], string> = {
  finance:     "#8b5cf6",  // purple
  legal:       "#10b981",  // green
  engineering: "#3b82f6",  // blue (accent)
  marketing:   "#f97316",  // orange
  hr:          "#ec4899",  // pink
  noise:       "#9ca3af",  // grey
};
