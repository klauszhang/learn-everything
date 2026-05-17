import { useState } from "react";
import {
  LAYER_COUNT,
  TOKENS,
  PREFILL_TOKEN_COUNT,
  STEP_COSTS,
  TOTAL_NO_CACHE_FLOPS,
  TOTAL_WITH_CACHE_FLOPS,
} from "../data/cache";

const DECODE_STEPS = STEP_COSTS.length;

const COLOR_CACHE = "#f59e0b";
const COLOR_CACHE_SOFT = "#fef3c7";
const COLOR_ACCENT = "#3b82f6";
const COLOR_ACCENT_SOFT = "#dbeafe";
const COLOR_BORDER = "#e5e7eb";
const COLOR_SURFACE = "#f8f9fa";
const COLOR_MUTED = "#6b7280";

const CELL_W = 52;
const CELL_H = 36;
const LABEL_COL_W = 52;
const LABEL_ROW_H = 28;

const GRID_W = LABEL_COL_W + TOKENS.length * CELL_W;
const GRID_H = LABEL_ROW_H + LAYER_COUNT * CELL_H;

function KVGrid({
  filledUpToToken,
  activeToken,
}: {
  filledUpToToken: number;
  activeToken: number | null;
}) {
  return (
    <svg
      width={GRID_W}
      height={GRID_H}
      style={{ display: "block", overflow: "visible" }}
      aria-label="KV cache grid: rows are transformer layers, columns are tokens."
    >
      {TOKENS.map((tok, col) => (
        <text
          key={col}
          x={LABEL_COL_W + col * CELL_W + CELL_W / 2}
          y={LABEL_ROW_H - 6}
          textAnchor="middle"
          fontSize={10}
          fill={
            col === activeToken
              ? COLOR_ACCENT
              : col < filledUpToToken
              ? "#92400e"
              : COLOR_MUTED
          }
          fontWeight={col === activeToken ? "700" : "400"}
          fontFamily="ui-monospace, monospace"
        >
          {tok}
        </text>
      ))}

      {Array.from({ length: LAYER_COUNT }, (_, layer) => (
        <g key={layer}>
          <text
            x={LABEL_COL_W - 6}
            y={LABEL_ROW_H + layer * CELL_H + CELL_H / 2 + 4}
            textAnchor="end"
            fontSize={11}
            fill={COLOR_MUTED}
            fontFamily="ui-monospace, monospace"
          >
            {`L${layer}`}
          </text>

          {TOKENS.map((_, col) => {
            const isCached = col < filledUpToToken;
            const isActive = col === activeToken;
            const isEmpty = !isCached && !isActive;

            const fill = isActive
              ? COLOR_ACCENT_SOFT
              : isCached
              ? COLOR_CACHE_SOFT
              : COLOR_SURFACE;
            const stroke = isActive
              ? COLOR_ACCENT
              : isCached
              ? COLOR_CACHE
              : COLOR_BORDER;
            const strokeW = isActive || isCached ? 2 : 1;

            return (
              <g key={col}>
                <rect
                  x={LABEL_COL_W + col * CELL_W + 2}
                  y={LABEL_ROW_H + layer * CELL_H + 2}
                  width={CELL_W - 4}
                  height={CELL_H - 4}
                  rx={4}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                />
                {isCached && !isActive && (
                  <text
                    x={LABEL_COL_W + col * CELL_W + CELL_W / 2}
                    y={LABEL_ROW_H + layer * CELL_H + CELL_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#92400e"
                    fontFamily="ui-monospace, monospace"
                  >
                    K,V
                  </text>
                )}
                {isActive && (
                  <text
                    x={LABEL_COL_W + col * CELL_W + CELL_W / 2}
                    y={LABEL_ROW_H + layer * CELL_H + CELL_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={COLOR_ACCENT}
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace"
                  >
                    new
                  </text>
                )}
                {isEmpty && (
                  <text
                    x={LABEL_COL_W + col * CELL_W + CELL_W / 2}
                    y={LABEL_ROW_H + layer * CELL_H + CELL_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={COLOR_BORDER}
                    fontFamily="ui-monospace, monospace"
                  >
                    —
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function FlopsBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  soft?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.8rem",
          marginBottom: "0.2rem",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <span>{label}</span>
        <span style={{ color }}>{value} units</span>
      </div>
      <div
        style={{
          height: 14,
          background: COLOR_BORDER,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

const STEP_DESCRIPTIONS: string[] = [
  `Prefill complete — prompt tokens "${TOKENS.slice(0, PREFILL_TOKEN_COUNT).join(", ")}" are cached. Now decoding starts.`,
  ...STEP_COSTS.map((s, i) => {
    if (i === 0) return `First decode: compute K,V for "${s.token}" and cache it. Read cached K,V for all prompt tokens.`;
    return `Decode: compute K,V for "${s.token}", cache it. Read ${PREFILL_TOKEN_COUNT + i} cached entries per layer.`;
  }),
];

export default function KVCacheGrid() {
  const [decodeStep, setDecodeStep] = useState(0);

  const cachedUpTo = PREFILL_TOKEN_COUNT + decodeStep;
  const activeToken = decodeStep < DECODE_STEPS ? PREFILL_TOKEN_COUNT + decodeStep : null;

  const runningNoCacheFlops = STEP_COSTS.slice(0, decodeStep + 1).reduce(
    (acc, s) => acc + s.noCacheFlops,
    0
  );
  const runningWithCacheFlops = STEP_COSTS.slice(0, decodeStep + 1).reduce(
    (acc, s) => acc + s.withCacheFlops,
    0
  );

  const maxFlops = Math.max(TOTAL_NO_CACHE_FLOPS, TOTAL_WITH_CACHE_FLOPS);

  const atEnd = decodeStep >= DECODE_STEPS - 1;
  const atStart = decodeStep === 0;

  const currentCost = decodeStep < DECODE_STEPS ? STEP_COSTS[decodeStep] : null;

  return (
    <div style={{ maxWidth: 720, margin: "2rem 0" }}>
      {/* Top bar: step description + nav */}
      <div
        style={{
          background: COLOR_SURFACE,
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: 8,
          padding: "0.75rem 1rem",
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                padding: "0.1rem 0.4rem",
                borderRadius: 4,
                background: decodeStep === 0 ? COLOR_ACCENT_SOFT : COLOR_CACHE_SOFT,
                color: decodeStep === 0 ? "#1d4ed8" : "#92400e",
                border: `1px solid ${decodeStep === 0 ? COLOR_ACCENT : COLOR_CACHE}`,
              }}
            >
              {decodeStep === 0 ? "Prefill done" : `Decode ${decodeStep}`}
            </span>
            {currentCost && (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem", color: COLOR_ACCENT, fontWeight: 600 }}>
                → "{currentCost.token}"
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.78rem", color: COLOR_MUTED, lineHeight: 1.4 }}>
            {STEP_DESCRIPTIONS[decodeStep]}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button onClick={() => setDecodeStep((s) => Math.max(s - 1, 0))} disabled={atStart} style={btnStyle(atStart)}>
            ←
          </button>
          <button onClick={() => setDecodeStep((s) => Math.min(s + 1, DECODE_STEPS - 1))} disabled={atEnd} style={btnStyle(atEnd, true)}>
            Next step →
          </button>
          <button onClick={() => setDecodeStep(0)} style={btnStyle(false)}>
            Reset
          </button>
        </div>
      </div>

      {/* SVG Cache Grid */}
      <div
        style={{
          background: COLOR_SURFACE,
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "1rem",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            color: COLOR_MUTED,
            marginBottom: "0.75rem",
            display: "flex",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: COLOR_CACHE_SOFT,
                border: `2px solid ${COLOR_CACHE}`,
                borderRadius: 2,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            Cached K,V (computed once, read every step)
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: COLOR_ACCENT_SOFT,
                border: `2px solid ${COLOR_ACCENT}`,
                borderRadius: 2,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            New token (computing K,V now)
          </span>
        </div>

        <KVGrid filledUpToToken={cachedUpTo} activeToken={activeToken} />
      </div>

      {/* Side-by-side cost comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            border: `1px solid ${COLOR_BORDER}`,
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#374151" }}>
            Without KV cache
          </div>
          <div style={{ fontSize: "0.8rem", color: COLOR_MUTED, marginBottom: "0.75rem", lineHeight: 1.5 }}>
            Recomputes K,V for <em>every</em> prior token at each step.
          </div>
          {currentCost && (
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              This step: <strong style={{ color: "#dc2626" }}>{currentCost.noCacheFlops} units</strong>
            </div>
          )}
          <FlopsBar label="Total so far" value={runningNoCacheFlops} max={maxFlops} color="#dc2626" />
        </div>

        <div
          style={{
            border: `2px solid ${COLOR_CACHE}`,
            borderRadius: 8,
            padding: "1rem",
            background: COLOR_CACHE_SOFT,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#92400e" }}>
            With KV cache
          </div>
          <div style={{ fontSize: "0.8rem", color: "#78350f", marginBottom: "0.75rem", lineHeight: 1.5 }}>
            Only the new token's K,V computed. Prior entries read from cache.
          </div>
          {currentCost && (
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              This step: <strong style={{ color: "#92400e" }}>{currentCost.withCacheFlops} units</strong>
            </div>
          )}
          <FlopsBar label="Total so far" value={runningWithCacheFlops} max={maxFlops} color={COLOR_CACHE} />
        </div>
      </div>

      {/* Summary when done */}
      {atEnd && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          <strong>All {DECODE_STEPS} decode steps complete.</strong> Total cost
          without cache: <strong>{TOTAL_NO_CACHE_FLOPS} units</strong>. With
          cache: <strong>{TOTAL_WITH_CACHE_FLOPS} units</strong> — a{" "}
          <strong>
            {(TOTAL_NO_CACHE_FLOPS / TOTAL_WITH_CACHE_FLOPS).toFixed(1)}×
          </strong>{" "}
          reduction.
        </div>
      )}

      <span style={{ fontSize: "0.75rem", color: COLOR_MUTED }}>
        Illustrative — not real model output
      </span>
    </div>
  );
}

function btnStyle(disabled: boolean, primary = false): React.CSSProperties {
  return {
    padding: "0.35rem 0.75rem",
    borderRadius: 6,
    border: primary ? "none" : `1px solid ${COLOR_BORDER}`,
    background: disabled
      ? COLOR_SURFACE
      : primary
      ? COLOR_ACCENT
      : "#fff",
    color: disabled ? COLOR_MUTED : primary ? "#fff" : "#374151",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.82rem",
    fontWeight: primary ? 600 : 400,
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
}
