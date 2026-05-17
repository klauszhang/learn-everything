/**
 * AccessShapeChooser.tsx
 *
 * Interactive demo: pick query type + data size, see which strategy wins.
 * Uses the hand-authored strategy matrix from src/data/data-search.ts.
 *
 * Rendered with client:visible — hydrates when the component scrolls into view.
 */
import { useState } from "react";
import {
  strategyMatrix,
  type QueryType,
  type DataSize,
} from "../data/data-search";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const QUERY_TYPES: { value: QueryType; label: string; description: string }[] = [
  { value: "exact",    label: "Exact match",  description: "WHERE id = 42 / hash lookup" },
  { value: "range",    label: "Range",         description: "WHERE age BETWEEN 30 AND 40" },
  { value: "prefix",   label: "Prefix",        description: "autocomplete, starts-with" },
  { value: "fulltext", label: "Full-text",     description: "MATCH AGAINST / search box" },
  { value: "fuzzy",    label: "Fuzzy",         description: "typo-tolerant / spell-check" },
];

const DATA_SIZES: { value: DataSize; label: string }[] = [
  { value: "1K", label: "1 K rows" },
  { value: "1M", label: "1 M rows" },
  { value: "1B", label: "1 B rows" },
];

// Strategy → color class suffix
const STRATEGY_COLOR: Record<string, string> = {
  "Linear scan":                       "linear",
  "Hash table":                         "hash",
  "Sorted array + binary search":       "binary",
  "B+-tree":                            "btree",
  "Trie / radix tree":                  "trie",
  "Inverted index (BM25)":              "inverted",
  "Inverted index + two-stage rerank":  "inverted",
  "BK-tree or n-gram index":            "fuzzy",
  "N-gram inverted index + rerank":     "fuzzy",
  "Linear scan + edit distance":        "linear",
};

function strategyColor(winner: string): string {
  for (const [key, cls] of Object.entries(STRATEGY_COLOR)) {
    if (winner.startsWith(key) || key.startsWith(winner)) return cls;
  }
  // fall through: check partial
  for (const [key, cls] of Object.entries(STRATEGY_COLOR)) {
    if (winner.includes(key.split(" ")[0])) return cls;
  }
  return "default";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccessShapeChooser() {
  const [queryType, setQueryType] = useState<QueryType>("exact");
  const [dataSize, setDataSize] = useState<DataSize>("1M");

  const entry = strategyMatrix.find(
    (e) => e.queryType === queryType && e.dataSize === dataSize
  );

  const colorKey = entry ? strategyColor(entry.winner) : "default";

  return (
    <div className="asc-root" data-color={colorKey}>
      <style>{`
        .asc-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          margin: var(--space-8) 0;
        }

        .asc-controls {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-6);
          margin-bottom: var(--space-6);
        }

        .asc-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .asc-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-muted);
        }

        .asc-options {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .asc-btn {
          padding: 0.3rem 0.75rem;
          border-radius: 4px;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          font-size: 0.85rem;
          cursor: pointer;
          line-height: 1.4;
          color: var(--color-text);
          transition: background 0.1s, border-color 0.1s;
        }
        .asc-btn:hover {
          border-color: var(--color-accent);
        }
        .asc-btn--active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
          font-weight: 600;
        }

        .asc-result {
          border-radius: var(--radius);
          padding: var(--space-4) var(--space-6);
          border-left: 4px solid var(--color-accent);
          background: var(--color-accent-soft);
        }

        .asc-result__winner {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: var(--space-2);
        }

        .asc-result__why {
          font-size: 0.9rem;
          color: var(--color-text);
          line-height: 1.55;
        }

        .asc-result__badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.15rem 0.5rem;
          border-radius: 3px;
          margin-right: var(--space-2);
          vertical-align: middle;
        }

        /* Strategy badge colors — intentionally distinct from amber (reserved for cache) */
        [data-color="linear"]   .asc-result { border-left-color: #6b7280; background: #f3f4f6; }
        [data-color="linear"]   .asc-result__badge { background: #6b7280; color: #fff; }
        [data-color="hash"]     .asc-result { border-left-color: #7c3aed; background: #f5f3ff; }
        [data-color="hash"]     .asc-result__badge { background: #7c3aed; color: #fff; }
        [data-color="binary"]   .asc-result { border-left-color: #2563eb; background: #dbeafe; }
        [data-color="binary"]   .asc-result__badge { background: #2563eb; color: #fff; }
        [data-color="btree"]    .asc-result { border-left-color: #0891b2; background: #e0f2fe; }
        [data-color="btree"]    .asc-result__badge { background: #0891b2; color: #fff; }
        [data-color="trie"]     .asc-result { border-left-color: #059669; background: #d1fae5; }
        [data-color="trie"]     .asc-result__badge { background: #059669; color: #fff; }
        [data-color="inverted"] .asc-result { border-left-color: #dc2626; background: #fee2e2; }
        [data-color="inverted"] .asc-result__badge { background: #dc2626; color: #fff; }
        [data-color="fuzzy"]    .asc-result { border-left-color: #d97706; background: #fef3c7; }
        [data-color="fuzzy"]    .asc-result__badge { background: #d97706; color: #fff; }

        .asc-none {
          color: var(--color-muted);
          font-size: 0.9rem;
        }
      `}</style>

      <div className="asc-controls">
        <div className="asc-field">
          <div className="asc-label">Query shape</div>
          <div className="asc-options">
            {QUERY_TYPES.map((qt) => (
              <button
                key={qt.value}
                className={`asc-btn${queryType === qt.value ? " asc-btn--active" : ""}`}
                onClick={() => setQueryType(qt.value)}
                title={qt.description}
              >
                {qt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="asc-field">
          <div className="asc-label">Data size</div>
          <div className="asc-options">
            {DATA_SIZES.map((ds) => (
              <button
                key={ds.value}
                className={`asc-btn${dataSize === ds.value ? " asc-btn--active" : ""}`}
                onClick={() => setDataSize(ds.value)}
              >
                {ds.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {entry ? (
        <div className="asc-result">
          <div className="asc-result__winner">
            <span className="asc-result__badge">{queryType} / {dataSize}</span>
            {entry.winner}
          </div>
          <div className="asc-result__why">{entry.why}</div>
        </div>
      ) : (
        <div className="asc-none">No entry for this combination.</div>
      )}
    </div>
  );
}
