import { useState } from "react";
import {
  embeddings,
  nearestNeighbors,
  clusterColors,
  type EmbeddingPoint,
} from "../data/embeddings";

// SVG canvas bounds (in "data" units). Points have x ∈ [1,9], y ∈ [2,9].
const DATA_X_MIN = 0.5;
const DATA_X_MAX = 9.5;
const DATA_Y_MIN = 1.0;
const DATA_Y_MAX = 9.5;

// SVG viewport size in pixels
const SVG_W = 440;
const SVG_H = 320;
const PAD = 24;

function dataToSvg(x: number, y: number): [number, number] {
  const sx =
    PAD +
    ((x - DATA_X_MIN) / (DATA_X_MAX - DATA_X_MIN)) * (SVG_W - 2 * PAD);
  // y axis is flipped in SVG (top = 0)
  const sy =
    PAD +
    ((DATA_Y_MAX - y) / (DATA_Y_MAX - DATA_Y_MIN)) * (SVG_H - 2 * PAD);
  return [sx, sy];
}

function formatVector(vec: number[]): string {
  return "[" + vec.map((v) => v.toFixed(2)).join(", ") + "]";
}

export default function EmbeddingScatter() {
  const [hovered, setHovered] = useState<EmbeddingPoint | null>(null);

  const neighbors = hovered ? nearestNeighbors[hovered.token] : [];

  const isHighlighted = (pt: EmbeddingPoint) =>
    hovered !== null &&
    (pt.token === hovered.token || neighbors.includes(pt.token));

  return (
    <div style={{ maxWidth: "600px", margin: "1.5rem 0" }}>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0 0 0.5rem" }}>
        Illustrative demo — data is hand-authored, not from a real model.
        Hover a point to see its vector and nearest neighbors.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* SVG scatter plot */}
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            background: "var(--color-surface)",
            cursor: "default",
            maxWidth: "100%",
          }}
        >
          {/* Cluster region labels */}
          {[
            { label: "royalty", lx: 2.1, ly: 9.0 },
            { label: "gender",  lx: 3.7, ly: 4.4 },
            { label: "animal",  lx: 7.5, ly: 9.0 },
            { label: "science", lx: 6.8, ly: 1.4 },
            { label: "number",  lx: 4.7, ly: 1.7 },
          ].map(({ label, lx, ly }) => {
            const [sx, sy] = dataToSvg(lx, ly);
            return (
              <text
                key={label}
                x={sx}
                y={sy}
                textAnchor="middle"
                fontSize="10"
                fill={clusterColors[label]}
                opacity={0.6}
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {label}
              </text>
            );
          })}

          {/* Neighbor connection lines */}
          {hovered &&
            neighbors.map((neighborToken) => {
              const neighbor = embeddings.find((p) => p.token === neighborToken);
              if (!neighbor) return null;
              const [x1, y1] = dataToSvg(hovered.x, hovered.y);
              const [x2, y2] = dataToSvg(neighbor.x, neighbor.y);
              return (
                <line
                  key={neighborToken}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  opacity={0.6}
                />
              );
            })}

          {/* Data points */}
          {embeddings.map((pt) => {
            const [sx, sy] = dataToSvg(pt.x, pt.y);
            const isActive = hovered?.token === pt.token;
            const isNeighbor = neighbors.includes(pt.token);
            const dimmed =
              hovered !== null && !isActive && !isNeighbor;

            const r = isActive ? 10 : isNeighbor ? 8 : 7;
            const fill = isActive
              ? "var(--color-accent)"
              : isNeighbor
              ? "var(--color-accent)"
              : clusterColors[pt.cluster];
            const fillOpacity = dimmed ? 0.25 : isActive ? 1 : isNeighbor ? 0.7 : 0.85;

            return (
              <g
                key={pt.token}
                onMouseEnter={() => setHovered(pt)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={sx}
                  cy={sy}
                  r={r + 6}
                  fill="transparent"
                />
                <circle
                  cx={sx}
                  cy={sy}
                  r={r}
                  fill={fill}
                  fillOpacity={fillOpacity}
                  stroke={isActive ? "var(--color-accent)" : "white"}
                  strokeWidth={isActive ? 2 : 1}
                />
                <text
                  x={sx}
                  y={sy - r - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill={dimmed ? "var(--color-muted)" : "var(--color-text)"}
                  opacity={dimmed ? 0.4 : 1}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={isActive ? "700" : "400"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {pt.token}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Info panel */}
        <div
          style={{
            minWidth: "160px",
            maxWidth: "240px",
            padding: "0.75rem 1rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          }}
        >
          {hovered ? (
            <>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                "{hovered.token}"
              </div>
              <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                cluster: {hovered.cluster}
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: "0.25rem" }}>
                  vector (6-dim, truncated):
                </div>
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    wordBreak: "break-all",
                    color: "var(--color-text)",
                    display: "block",
                  }}
                >
                  {formatVector(hovered.vector)}
                </code>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: "0.35rem" }}>
                  nearest neighbors:
                </div>
                <ul style={{ margin: 0, paddingLeft: "1rem", lineHeight: 1.8 }}>
                  {nearestNeighbors[hovered.token].map((n) => (
                    <li
                      key={n}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        color: "var(--color-accent)",
                      }}
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <span style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
              Hover a point to inspect its vector.
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.6rem 1.2rem",
          marginTop: "0.75rem",
          fontSize: "0.78rem",
          color: "var(--color-muted)",
        }}
      >
        {Object.entries(clusterColors).map(([cluster, color]) => (
          <span key={cluster} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: color,
                opacity: 0.85,
              }}
            />
            {cluster}
          </span>
        ))}
      </div>
    </div>
  );
}
