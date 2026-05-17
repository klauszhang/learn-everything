/**
 * VectorSearchDemo.tsx
 *
 * Interactive demo: select a query → the query marker animates to its 2D
 * position, the top-K nearest document dots highlight, and a ranked results
 * list updates with illustrative cosine scores.
 *
 * All data is hand-authored and illustrative — not real model output.
 * Color convention: --color-accent (soft blue) for the query marker and
 * top-K highlights. Amber is NOT used here (reserved for cache content).
 */

import { useState } from "react";
import { corpus, queries, topicColors } from "../data/vector-search";
import type { CorpusDoc, RetrievalQuery } from "../data/vector-search";

// SVG viewport dimensions
const W = 500;
const H = 370;
const PAD = 30;

// Top-K to highlight
const TOP_K = 3;

// Color tiers for highlighted results
const HIGHLIGHT_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd"] as const; // blue-500, blue-400, blue-300

// Score bar max width in px
const SCORE_BAR_MAX = 120;

export default function VectorSearchDemo() {
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);

  const activeQuery: RetrievalQuery | null =
    activeQueryId ? queries.find((q) => q.id === activeQueryId) ?? null : null;

  // Build a set of highlighted doc IDs → rank index (0-based)
  const highlightMap = new Map<string, number>();
  if (activeQuery) {
    activeQuery.rankedIds.slice(0, TOP_K).forEach((id, i) => {
      highlightMap.set(id, i);
    });
  }

  function getDocHighlight(doc: CorpusDoc): string | null {
    const rank = highlightMap.get(doc.id);
    if (rank === undefined) return null;
    return HIGHLIGHT_COLORS[rank] ?? HIGHLIGHT_COLORS[2];
  }

  // Map 2D coords to SVG space (the coords are already in [0,500]×[0,370] roughly)
  // Just clamp to the padded viewport
  function sx(x: number) { return Math.max(PAD, Math.min(W - PAD, x)); }
  function sy(y: number) { return Math.max(PAD, Math.min(H - PAD, y)); }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%" }}>
      {/* Query selector */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.85rem", color: "#6b7280", display: "block", marginBottom: "0.4rem" }}>
          Select a query to find nearest documents:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {queries.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveQueryId(activeQueryId === q.id ? null : q.id)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                border: activeQueryId === q.id ? "2px solid #3b82f6" : "1px solid #d1d5db",
                background: activeQueryId === q.id ? "#dbeafe" : "#f9fafb",
                color: activeQueryId === q.id ? "#1d4ed8" : "#374151",
                fontSize: "0.8rem",
                cursor: "pointer",
                fontWeight: activeQueryId === q.id ? 600 : 400,
                lineHeight: 1.3,
              }}
            >
              {q.text}
            </button>
          ))}
        </div>
      </div>

      {/* SVG scatter */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{
          display: "block",
          maxWidth: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          background: "#f8f9fa",
        }}
        aria-label="Illustrative 2D embedding scatter. Document positions are hand-authored for clarity, not computed from real vectors."
      >
        {/* Axis labels */}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">Dimension 1 (illustrative)</text>
        <text x="10" y={H / 2} textAnchor="middle" fontSize="10" fill="#9ca3af" transform={`rotate(-90, 10, ${H / 2})`}>Dimension 2</text>

        {/* Draw connector lines from query to top-K docs */}
        {activeQuery && activeQuery.rankedIds.slice(0, TOP_K).map((docId, i) => {
          const doc = corpus.find((d) => d.id === docId);
          if (!doc) return null;
          return (
            <line
              key={docId}
              x1={sx(activeQuery.coords2d[0])}
              y1={sy(activeQuery.coords2d[1])}
              x2={sx(doc.coords2d[0])}
              y2={sy(doc.coords2d[1])}
              stroke={HIGHLIGHT_COLORS[i]}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.65"
            />
          );
        })}

        {/* Document dots */}
        {corpus.map((doc) => {
          const hlColor = getDocHighlight(doc);
          const topicColor = topicColors[doc.topic].fill;
          const isHighlighted = hlColor !== null;
          const rank = highlightMap.get(doc.id);
          return (
            <g key={doc.id}>
              {/* Glow ring on highlighted docs */}
              {isHighlighted && (
                <circle
                  cx={sx(doc.coords2d[0])}
                  cy={sy(doc.coords2d[1])}
                  r="13"
                  fill="none"
                  stroke={hlColor!}
                  strokeWidth="2"
                  opacity="0.5"
                />
              )}
              <circle
                cx={sx(doc.coords2d[0])}
                cy={sy(doc.coords2d[1])}
                r="7"
                fill={isHighlighted ? hlColor! : topicColor}
                opacity={activeQuery && !isHighlighted ? 0.3 : 0.85}
                stroke={isHighlighted ? hlColor! : topicColor}
                strokeWidth="1"
              />
              {/* Rank badge */}
              {isHighlighted && rank !== undefined && (
                <text
                  x={sx(doc.coords2d[0])}
                  y={sy(doc.coords2d[1]) + 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="white"
                >
                  {rank + 1}
                </text>
              )}
              {/* Title label */}
              <text
                x={sx(doc.coords2d[0])}
                y={sy(doc.coords2d[1]) - 12}
                textAnchor="middle"
                fontSize="9"
                fill={isHighlighted ? "#1d4ed8" : "#6b7280"}
                fontWeight={isHighlighted ? "600" : "400"}
                opacity={activeQuery && !isHighlighted ? 0.4 : 1}
              >
                {doc.title}
              </text>
            </g>
          );
        })}

        {/* Query marker (star shape via polygon) */}
        {activeQuery && (
          <g>
            <circle
              cx={sx(activeQuery.coords2d[0])}
              cy={sy(activeQuery.coords2d[1])}
              r="18"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.4"
            />
            {/* Query dot */}
            <circle
              cx={sx(activeQuery.coords2d[0])}
              cy={sy(activeQuery.coords2d[1])}
              r="8"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={sx(activeQuery.coords2d[0])}
              y={sy(activeQuery.coords2d[1]) + 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="white"
            >
              Q
            </text>
            <text
              x={sx(activeQuery.coords2d[0])}
              y={sy(activeQuery.coords2d[1]) - 15}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#1d4ed8"
            >
              Query
            </text>
          </g>
        )}

        {/* Topic legend */}
        {Object.entries(topicColors).map(([topic, { fill, label }], i) => (
          <g key={topic} transform={`translate(${W - 90}, ${16 + i * 18})`}>
            <circle cx="6" cy="6" r="5" fill={fill} opacity="0.8" />
            <text x="15" y="10" fontSize="10" fill="#6b7280">{label}</text>
          </g>
        ))}

        {/* Illustrative note */}
        <text x="8" y={H - 8} fontSize="8" fill="#9ca3af">
          Illustrative — 2D hand-authored layout, not a projection of real vectors.
        </text>
      </svg>

      {/* Results list */}
      {activeQuery && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Top {TOP_K} nearest documents (cosine similarity):
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {activeQuery.rankedIds.slice(0, TOP_K).map((docId, i) => {
              const doc = corpus.find((d) => d.id === docId);
              if (!doc) return null;
              const score = activeQuery.topKScores[i] ?? 0;
              const barWidth = Math.round(score * SCORE_BAR_MAX);
              return (
                <div
                  key={docId}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: `1px solid ${HIGHLIGHT_COLORS[i]}`,
                    background: "#f0f7ff",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: HIGHLIGHT_COLORS[i],
                      color: "white",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e3a5f", marginBottom: "0.15rem" }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#6b7280", lineHeight: 1.4 }}>
                      {doc.body.slice(0, 90)}{doc.body.length > 90 ? "…" : ""}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#1d4ed8", fontWeight: 600 }}>
                      {score.toFixed(2)}
                    </div>
                    <div style={{ marginTop: "3px", height: "4px", borderRadius: "2px", background: "#dbeafe", width: `${SCORE_BAR_MAX}px` }}>
                      <div style={{ height: "100%", borderRadius: "2px", background: HIGHLIGHT_COLORS[i], width: `${barWidth}px` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem", fontStyle: "italic" }}>
            Scores are illustrative — computed from 8-dimensional hand-authored vectors, not a real embedding model.
          </p>
        </div>
      )}

      {!activeQuery && (
        <p style={{ fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic", marginTop: "0.75rem" }}>
          Select a query above to see the nearest documents highlighted.
        </p>
      )}
    </div>
  );
}
