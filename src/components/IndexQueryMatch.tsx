/**
 * IndexQueryMatch.tsx
 *
 * Interactive demo: pick an index and a query from dropdowns.
 * Evaluates leftmost-prefix rule / expression-match rule and shows
 * "Index used / Partial / Not used" with a one-sentence reason.
 *
 * All data is hand-authored and illustrative.
 * Color convention:
 *   Green  (#16a34a) — index used
 *   Orange (#d97706) — partial match
 *   Red    (#dc2626) — not used
 * Amber is NOT used here (reserved for cache-semantic content).
 */

import { useState } from "react";
import { indexes, queries, getMatch } from "../data/indexing";
import type { MatchResult } from "../data/indexing";

// ── Result display config ────────────────────────────────────────────────────

const RESULT_CONFIG: Record<MatchResult, { label: string; color: string; bg: string; border: string }> = {
  "used": {
    label: "Index used",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#16a34a",
  },
  "partial": {
    label: "Partial — index used for some columns",
    color: "#92400e",
    bg: "#fffbeb",
    border: "#d97706",
  },
  "not-used": {
    label: "Not used — seq scan",
    color: "#991b1b",
    bg: "#fef2f2",
    border: "#dc2626",
  },
};

// ── Type badge colors ─────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  single:     { bg: "#eff6ff", color: "#1d4ed8" },
  composite:  { bg: "#f5f3ff", color: "#6d28d9" },
  covering:   { bg: "#ecfdf5", color: "#065f46" },
  partial:    { bg: "#fff7ed", color: "#9a3412" },
  expression: { bg: "#fdf4ff", color: "#7e22ce" },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function IndexQueryMatch() {
  const [indexId, setIndexId] = useState<string>(indexes[0].id);
  const [queryId, setQueryId] = useState<string>(queries[0].id);

  const selectedIndex = indexes.find((i) => i.id === indexId)!;
  const selectedQuery = queries.find((q) => q.id === queryId)!;
  const match = getMatch(indexId, queryId);

  const resultCfg = match ? RESULT_CONFIG[match.result] : null;
  const typeCfg = TYPE_COLORS[selectedIndex.type] ?? TYPE_COLORS.single;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%" }}>

      {/* ── Selector row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>

        {/* Index selector */}
        <div>
          <label style={labelStyle}>
            Index definition
          </label>
          <select
            value={indexId}
            onChange={(e) => setIndexId(e.target.value)}
            style={selectStyle}
          >
            {indexes.map((idx) => (
              <option key={idx.id} value={idx.id}>{idx.label}</option>
            ))}
          </select>
        </div>

        {/* Query selector */}
        <div>
          <label style={labelStyle}>
            Query
          </label>
          <select
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            style={selectStyle}
          >
            {queries.map((q) => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── DDL + SQL panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <div style={panelLabelStyle}>Index DDL</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <span style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "0.15rem 0.45rem",
              borderRadius: "4px",
              textTransform: "capitalize",
              background: typeCfg.bg,
              color: typeCfg.color,
              flexShrink: 0,
              marginTop: "0.15rem",
            }}>
              {selectedIndex.type}
            </span>
          </div>
          <pre style={codeBlockStyle}>{selectedIndex.ddl}</pre>
        </div>
        <div>
          <div style={panelLabelStyle}>Query SQL</div>
          <pre style={{ ...codeBlockStyle, marginTop: "1.6rem" }}>{selectedQuery.sql}</pre>
        </div>
      </div>

      {/* ── Result banner ── */}
      {resultCfg && match && (
        <div style={{
          border: `1px solid ${resultCfg.border}`,
          borderLeftWidth: "4px",
          borderRadius: "6px",
          background: resultCfg.bg,
          padding: "0.875rem 1rem",
        }}>
          <div style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: resultCfg.color,
            marginBottom: "0.35rem",
          }}>
            {resultCfg.label}
          </div>
          <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.55 }}>
            {match.reason}
          </div>
        </div>
      )}

      <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.75rem", fontStyle: "italic" }}>
        Results are illustrative, derived from the leftmost-prefix rule and expression-match semantics — not a real query planner.
      </p>
    </div>
  );
}

// ── Shared inline styles ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.35rem",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.65rem",
  borderRadius: "6px",
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  fontSize: "0.85rem",
  color: "#111827",
  cursor: "pointer",
  appearance: "auto",
};

const panelLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "0.4rem",
};

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: "0.6rem 0.75rem",
  background: "#1e293b",
  color: "#e2e8f0",
  borderRadius: "6px",
  fontSize: "0.78rem",
  lineHeight: 1.55,
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  overflowX: "auto",
  whiteSpace: "pre",
};
