/**
 * AnnIndexDemo.tsx
 *
 * Interactive efSearch slider demo for the ANN Vector Indexes chapter.
 *
 * Shows a 60-point scatter with a query marker. As you raise the efSearch
 * slider, more nodes light up (the HNSW exploration grows) and the recall
 * and work-done counters update. The key lesson: the jump from efSearch=16
 * to efSearch=64 adds a lot of recall; from efSearch=128 to efSearch=256
 * adds almost none — diminishing returns are tangible.
 *
 * All data is hand-authored and illustrative. Not real model output.
 * Color convention:
 *   - Topic colors for resting dots (via topicColors map)
 *   - var(--color-accent) blue for visited/explored nodes
 *   - true top-5 results shown with a ring in var(--color-accent)
 *   - Query marker in var(--color-accent)
 * Amber is NOT used here — reserved for cache-semantic content per house style.
 */

import { useState, useMemo } from "react";
import { points, queries, topicColors, getVisitedAtEfSearch } from "../data/ann-index";

// SVG viewport
const SVG_W = 520;
const SVG_H = 380;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 24;

const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

// Convert [0,1] coords to SVG space
function sx(x: number) { return PAD_L + x * PLOT_W; }
function sy(y: number) { return PAD_T + (1 - y) * PLOT_H; } // flip y so 0 is bottom

const MIN_EF = 16;
const MAX_EF = 256;

const DEFAULT_QUERY_ID = "q1";

export default function AnnIndexDemo() {
  const [efSearch, setEfSearch] = useState(64);
  const [queryId, setQueryId] = useState(DEFAULT_QUERY_ID);

  const query = queries.find((q) => q.id === queryId) ?? queries[0];

  const { visited, recall, nodesVisited, latencyMs } = useMemo(
    () => getVisitedAtEfSearch(query, efSearch),
    [query, efSearch],
  );

  const visitedSet = new Set(visited);
  const top5Set = new Set(query.trueTop5);

  // Points found = intersection of visited and top5
  const foundSet = new Set(visited.filter((id) => top5Set.has(id)));

  return (
    <div className="ann-demo">
      {/* Controls */}
      <div className="ann-controls">
        <div className="ann-query-row">
          <label className="ann-label" htmlFor="ann-query-select">Query</label>
          <select
            id="ann-query-select"
            className="ann-select"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
          >
            {queries.map((q) => (
              <option key={q.id} value={q.id}>"{q.label}"</option>
            ))}
          </select>
        </div>

        <div className="ann-slider-row">
          <label className="ann-label" htmlFor="ann-ef-slider">
            Search effort <span className="ann-param">(efSearch = {efSearch})</span>
          </label>
          <div className="ann-slider-wrap">
            <span className="ann-slider-end-label">Less work</span>
            <input
              id="ann-ef-slider"
              type="range"
              min={MIN_EF}
              max={MAX_EF}
              step={4}
              value={efSearch}
              onChange={(e) => setEfSearch(Number(e.target.value))}
              className="ann-slider"
            />
            <span className="ann-slider-end-label">More work</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="ann-stats">
        <div className="ann-stat">
          <div className="ann-stat-value">{nodesVisited}</div>
          <div className="ann-stat-name">Nodes visited</div>
        </div>
        <div className="ann-stat-divider" />
        <div className="ann-stat">
          <div className="ann-stat-value">{(recall * 100).toFixed(0)}%</div>
          <div className="ann-stat-name">Recall@5</div>
        </div>
        <div className="ann-stat-divider" />
        <div className="ann-stat">
          <div className="ann-stat-value">{latencyMs.toFixed(1)} ms</div>
          <div className="ann-stat-name">Est. query time <span className="ann-note">(illustrative)</span></div>
        </div>
        <div className="ann-stat-divider" />
        <div className="ann-stat">
          <div className="ann-stat-value">{nodesVisited} / 60</div>
          <div className="ann-stat-name">Work done</div>
        </div>
      </div>

      {/* SVG scatter */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width={SVG_W}
        height={SVG_H}
        className="ann-svg"
        aria-label="Illustrative 2D scatter of 60 document points. Highlighted points show the HNSW exploration path for the selected query and efSearch level."
      >
        {/* Cluster region labels */}
        <text x={sx(0.18)} y={sy(0.97)} textAnchor="middle" fontSize={10} fill="#8b5cf6" opacity={0.7} fontFamily="system-ui,sans-serif">Finance</text>
        <text x={sx(0.80)} y={sy(0.97)} textAnchor="middle" fontSize={10} fill="#10b981" opacity={0.7} fontFamily="system-ui,sans-serif">Legal</text>
        <text x={sx(0.19)} y={sy(0.02)} textAnchor="middle" fontSize={10} fill="#3b82f6" opacity={0.7} fontFamily="system-ui,sans-serif">Engineering</text>
        <text x={sx(0.80)} y={sy(0.02)} textAnchor="middle" fontSize={10} fill="#f97316" opacity={0.7} fontFamily="system-ui,sans-serif">Marketing</text>
        <text x={sx(0.50)} y={sy(0.66)} textAnchor="middle" fontSize={10} fill="#ec4899" opacity={0.7} fontFamily="system-ui,sans-serif">HR</text>

        {/* All points */}
        {points.map((pt) => {
          const cx = sx(pt.x);
          const cy = sy(pt.y);
          const baseColor = topicColors[pt.topic];
          const isVisited = visitedSet.has(pt.id);
          const isTop5 = top5Set.has(pt.id);
          const isFound = foundSet.has(pt.id);

          // Outer ring for top-5 results that were actually found
          const ringColor = isFound ? "var(--color-accent)" : "transparent";
          const dotColor = isVisited ? "var(--color-accent)" : baseColor;
          const dotOpacity = isVisited ? 1 : 0.28;
          const dotR = isTop5 ? 6.5 : 5;

          return (
            <g key={pt.id}>
              {/* Result ring for found top-5 */}
              {isTop5 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={dotR + 4}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={2}
                  opacity={isFound ? 0.9 : 0}
                />
              )}
              {/* Dot */}
              <circle
                cx={cx}
                cy={cy}
                r={dotR}
                fill={dotColor}
                opacity={dotOpacity}
              >
                <title>{pt.label} ({pt.topic}){isVisited ? " — visited" : ""}{isFound ? " ✓ in results" : ""}</title>
              </circle>
            </g>
          );
        })}

        {/* Query marker */}
        <circle
          cx={sx(query.x)}
          cy={sy(query.y)}
          r={9}
          fill="var(--color-accent)"
          stroke="white"
          strokeWidth={2.5}
        />
        <text
          x={sx(query.x)}
          y={sy(query.y) + 4}
          textAnchor="middle"
          fontSize={9}
          fill="white"
          fontWeight="700"
          fontFamily="system-ui,sans-serif"
        >
          Q
        </text>

        {/* Footnote */}
        <text x={8} y={SVG_H - 4} fontSize={8} fill="#9ca3af" fontFamily="system-ui,sans-serif">
          Illustrative — hand-authored layout, not real model output.
        </text>
      </svg>

      {/* Legend */}
      <div className="ann-legend">
        <span className="ann-legend-item">
          <span className="ann-dot ann-dot--topic" style={{ background: "#8b5cf6" }} />
          Unvisited (topic color)
        </span>
        <span className="ann-legend-item">
          <span className="ann-dot ann-dot--visited" />
          Visited by HNSW
        </span>
        <span className="ann-legend-item">
          <span className="ann-dot ann-dot--result" />
          Top-5 result found
        </span>
        <span className="ann-legend-item">
          <span className="ann-dot ann-dot--query" />
          Query
        </span>
      </div>

      {/* Recall result summary */}
      <div className="ann-result-summary">
        <strong>{foundSet.size} of 5</strong> nearest neighbors found at efSearch={efSearch}.
        {efSearch >= 128 && recall >= 1.0 && (
          <span className="ann-note"> Raising efSearch further checks more nodes but finds the same results — diminishing returns.</span>
        )}
        {efSearch < 64 && (
          <span className="ann-note"> Try raising efSearch to explore more of the graph and improve recall.</span>
        )}
      </div>

      <style>{`
        .ann-demo {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
          background: var(--color-surface);
          margin: var(--space-6) 0;
          max-width: 100%;
          overflow-x: auto;
        }

        .ann-controls {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .ann-query-row,
        .ann-slider-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .ann-label {
          font-size: 0.85rem;
          color: var(--color-muted);
          white-space: nowrap;
          min-width: 110px;
        }

        .ann-param {
          font-family: var(--font-mono);
          color: var(--color-accent);
        }

        .ann-select {
          font-size: 0.85rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 0.2rem 0.4rem;
          background: var(--color-bg);
          color: var(--color-text);
          cursor: pointer;
        }

        .ann-slider-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
          min-width: 200px;
        }

        .ann-slider-end-label {
          font-size: 0.75rem;
          color: var(--color-muted);
          white-space: nowrap;
        }

        .ann-slider {
          flex: 1;
          accent-color: var(--color-accent);
          cursor: pointer;
        }

        .ann-stats {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
          row-gap: var(--space-3);
        }

        .ann-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
          flex: 1;
        }

        .ann-stat-value {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--color-accent);
          font-family: var(--font-mono);
          line-height: 1.1;
        }

        .ann-stat-name {
          font-size: 0.72rem;
          color: var(--color-muted);
          text-align: center;
          margin-top: 2px;
        }

        .ann-stat-divider {
          width: 1px;
          height: 36px;
          background: var(--color-border);
          flex-shrink: 0;
        }

        .ann-note {
          font-size: 0.7rem;
          color: var(--color-muted);
        }

        .ann-svg {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 0 auto;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }

        .ann-legend {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-top: var(--space-3);
          font-size: 0.78rem;
          color: var(--color-muted);
        }

        .ann-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ann-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ann-dot--topic {
          opacity: 0.4;
        }

        .ann-dot--visited {
          background: var(--color-accent);
        }

        .ann-dot--result {
          background: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
        }

        .ann-dot--query {
          background: var(--color-accent);
          border: 2px solid white;
          box-shadow: 0 0 0 1.5px var(--color-accent);
        }

        .ann-result-summary {
          margin-top: var(--space-3);
          font-size: 0.875rem;
          color: var(--color-text);
          border-top: 1px solid var(--color-border);
          padding-top: var(--space-3);
        }
      `}</style>
    </div>
  );
}
