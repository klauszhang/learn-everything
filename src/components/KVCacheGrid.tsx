import { useState } from "react";
import {
  LAYER_COUNT,
  TOKENS,
  PREFILL_TOKEN_COUNT,
  STEP_COSTS,
  TOTAL_NO_CACHE_FLOPS,
  TOTAL_WITH_CACHE_FLOPS,
} from "../data/cache";

// Total decode steps in the demo
const DECODE_STEPS = STEP_COSTS.length;

// Colors from CSS variables — pulled at runtime for SVG fills
// We use inline style strings to stay consistent with global.css vars
const COLOR_CACHE = "#f59e0b"; // --color-cache (amber)
const COLOR_CACHE_SOFT = "#fef3c7"; // --color-cache-soft
const COLOR_ACCENT = "#3b82f6"; // --color-accent (blue)
const COLOR_ACCENT_SOFT = "#dbeafe"; // --color-accent-soft
const COLOR_BORDER = "#e5e7eb";
const COLOR_SURFACE = "#f8f9fa";
const COLOR_MUTED = "#6b7280";

// Grid layout constants
const CELL_W = 52;
const CELL_H = 36;
const LABEL_COL_W = 52; // space for "L0" labels
const LABEL_ROW_H = 28; // space for token labels

const GRID_W = LABEL_COL_W + TOKENS.length * CELL_W;
const GRID_H = LABEL_ROW_H + LAYER_COUNT * CELL_H;

function KVGrid({
  filledUpToToken, // columns 0..filledUpToToken-1 are cached
  activeToken,     // this column is the "new" active token being computed
}: {
  filledUpToToken: number;
  activeToken: number | null;
}) {
  return (
    <svg
      width={GRID_W}
      height={GRID_H}
      style={{ display: "block", overflow: "visible" }}
      aria-label="KV cache grid: rows are transformer layers, columns are tokens. Amber cells are cached K/V pairs; blue cell is the token being decoded now."
    >
      {/* Token column labels */}
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

      {/* Layer row labels + cells */}
      {Array.from({ length: LAYER_COUNT }, (_, layer) => (
        <g key={layer}>
          {/* "L0" … "L3" label */}
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

          {/* One cell per token */}
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
  soft,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  soft: string;
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

export default function KVCacheGrid() {
  // decodeStep: 0 = just finished prefill, ready to generate first decode token
  const [decodeStep, setDecodeStep] = useState(0);

  // At decodeStep s:
  //   - tokens 0..PREFILL_TOKEN_COUNT-1 are always cached (prefill is done)
  //   - tokens PREFILL_TOKEN_COUNT..PREFILL_TOKEN_COUNT+s-1 are also cached (prior decode steps)
  //   - token PREFILL_TOKEN_COUNT+s is the active "new" token (if s < DECODE_STEPS)
  const cachedUpTo = PREFILL_TOKEN_COUNT + decodeStep;
  const activeToken = decodeStep < DECODE_STEPS ? PREFILL_TOKEN_COUNT + decodeStep : null;

  // Running FLOPs totals up to and including current step
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

  function stepForward() {
    setDecodeStep((s) => Math.min(s + 1, DECODE_STEPS - 1));
  }
  function stepBack() {
    setDecodeStep((s) => Math.max(s - 1, 0));
  }
  function reset() {
    setDecodeStep(0);
  }

  const currentCost = decodeStep < DECODE_STEPS ? STEP_COSTS[decodeStep] : null;

  return (
    <div style={{ maxWidth: 720, margin: "2rem 0" }}>
      {/* SVG Cache Grid */}
      <div
        style={{
          background: COLOR_SURFACE,
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "1.25rem",
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
            Cached K,V (read from memory)
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
            New token (compute Q/K/V now)
          </span>
        </div>

        <KVGrid filledUpToToken={cachedUpTo} activeToken={activeToken} />

        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: COLOR_MUTED,
          }}
        >
          <strong>Decode step {decodeStep + 1}</strong> of {DECODE_STEPS}
          {currentCost && (
            <>
              {" "}— generating token{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, monospace",
                  color: COLOR_ACCENT,
                }}
              >
                "{currentCost.token}"
              </code>
            </>
          )}
        </div>
      </div>

      {/* Side-by-side cost comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        {/* No cache panel */}
        <div
          style={{
            border: `1px solid ${COLOR_BORDER}`,
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.85rem",
              marginBottom: "0.5rem",
              color: "#374151",
            }}
          >
            Without KV cache
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: COLOR_MUTED,
              marginBottom: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            Re-processes <em>all</em> prior tokens through every layer at each step.
            Cost grows with sequence length.
          </div>
          {currentCost && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.85rem",
                marginBottom: "0.5rem",
              }}
            >
              This step:{" "}
              <strong style={{ color: "#dc2626" }}>
                {currentCost.noCacheFlops} units
              </strong>
            </div>
          )}
          <FlopsBar
            label="Total so far"
            value={runningNoCacheFlops}
            max={maxFlops}
            color="#dc2626"
            soft="#fee2e2"
          />
        </div>

        {/* With cache panel */}
        <div
          style={{
            border: `2px solid ${COLOR_CACHE}`,
            borderRadius: 8,
            padding: "1rem",
            background: COLOR_CACHE_SOFT,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.85rem",
              marginBottom: "0.5rem",
              color: "#92400e",
            }}
          >
            With KV cache
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#78350f",
              marginBottom: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            Only the new token's Q/K/V are computed. Prior K,V read from cache.
            Cost stays constant per step.
          </div>
          {currentCost && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.85rem",
                marginBottom: "0.5rem",
              }}
            >
              This step:{" "}
              <strong style={{ color: "#92400e" }}>
                {currentCost.withCacheFlops} units
              </strong>
            </div>
          )}
          <FlopsBar
            label="Total so far"
            value={runningWithCacheFlops}
            max={maxFlops}
            color={COLOR_CACHE}
            soft={COLOR_CACHE_SOFT}
          />
        </div>
      </div>

      {/* Totals when done */}
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
          reduction. (Illustrative numbers.)
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          onClick={stepBack}
          disabled={atStart}
          style={buttonStyle(atStart)}
        >
          ← Back
        </button>
        <button
          onClick={stepForward}
          disabled={atEnd}
          style={buttonStyle(atEnd, true)}
        >
          Next step →
        </button>
        <button onClick={reset} style={buttonStyle(false)}>
          Reset
        </button>
        <span style={{ fontSize: "0.75rem", color: COLOR_MUTED, marginLeft: "auto" }}>
          Illustrative — not real model output
        </span>
      </div>
    </div>
  );
}

function buttonStyle(disabled: boolean, primary = false): React.CSSProperties {
  return {
    padding: "0.45rem 1rem",
    borderRadius: 6,
    border: primary ? "none" : `1px solid ${COLOR_BORDER}`,
    background: disabled
      ? COLOR_SURFACE
      : primary
      ? COLOR_ACCENT
      : "#fff",
    color: disabled ? COLOR_MUTED : primary ? "#fff" : "#374151",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.85rem",
    fontWeight: primary ? 600 : 400,
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
}
