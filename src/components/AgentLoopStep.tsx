/**
 * AgentLoopStep.tsx — Interactive step-through demo for the agents chapter.
 *
 * Shows a scripted 8-step agent debug session (fix failing auth tests):
 *   - Conversation panel: tool calls and results appear one step at a time
 *   - Step counter + "Next step" / "Reset" buttons
 *   - Cumulative token bar: amber = cached prefix (constant), grey = growing history
 *
 * All data is ILLUSTRATIVE — hand-authored, not from a real model.
 * hydration: client:visible
 */

import { useState } from "react";
import { agentTrace, type AgentTurn } from "../data/agents";

// ---------------------------------------------------------------------------
// Styles (plain CSS-in-JS objects — no external deps)
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "inherit",
    maxWidth: 720,
    margin: "0 auto",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  btn: {
    padding: "7px 18px",
    fontSize: "0.85rem",
    fontWeight: 600,
    borderRadius: 6,
    border: "1.5px solid #3b82f6",
    background: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  btnReset: {
    background: "none",
    border: "1.5px solid #d1d5db",
    color: "#374151",
  },
  counter: {
    fontSize: "0.82rem",
    color: "#6b7280",
    fontVariantNumeric: "tabular-nums",
  },
  conversation: {
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
    background: "#fafafa",
  },
  turnRow: {
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "0.84rem",
    lineHeight: 1.55,
    animation: "fadeSlide 0.2s ease",
  },
  turnLabel: {
    fontSize: "0.67rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    marginBottom: 3,
  },
  turnContent: {
    color: "#374151",
  },
  toolPill: {
    display: "inline-block",
    fontSize: "0.7rem",
    fontFamily: "ui-monospace, monospace",
    background: "#ede9fe",
    color: "#5b21b6",
    border: "1px solid #c4b5fd",
    borderRadius: 4,
    padding: "1px 7px",
    marginRight: 6,
    fontWeight: 600,
  },
  finalRow: {
    background: "#f0fdf4",
    borderColor: "#86efac",
  },
  // Token bar
  tokenBarWrap: {
    marginBottom: 6,
  },
  tokenBarLabel: {
    fontSize: "0.72rem",
    color: "#6b7280",
    marginBottom: 6,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenBarTrack: {
    height: 22,
    borderRadius: 4,
    background: "#f1f5f9",
    overflow: "hidden",
    display: "flex",
    border: "1px solid #e2e8f0",
  },
  tokenBarCached: {
    background: "#f59e0b",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.63rem",
    fontWeight: 700,
    color: "#78350f",
    transition: "width 0.3s ease",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    paddingLeft: 4,
  },
  tokenBarHistory: {
    background: "#e2e8f0",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    fontSize: "0.63rem",
    color: "#475569",
    transition: "width 0.3s ease",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    paddingRight: 4,
  },
  legend: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
    fontSize: "0.73rem",
    color: "#6b7280",
    marginTop: 8,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    display: "inline-block",
    flexShrink: 0,
  },
  illustrative: {
    fontSize: "0.68rem",
    color: "#94a3b8",
    marginTop: 12,
    fontStyle: "italic",
  },
  completeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#166534",
    background: "#dcfce7",
    border: "1.5px solid #86efac",
    borderRadius: 6,
    padding: "4px 12px",
    marginLeft: 8,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function turnColor(t: AgentTurn): React.CSSProperties {
  if (t.type === "final") return { background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" };
  if (t.type === "user") return { background: "#f8fafc", borderBottom: "1px solid #f0f0f0" };
  return { background: "#fff", borderBottom: "1px solid #f0f0f0" };
}

function turnLabelColor(t: AgentTurn): string {
  if (t.type === "final") return "#16a34a";
  if (t.type === "user") return "#64748b";
  return "#4f46e5";
}

function turnLabelText(t: AgentTurn, idx: number): string {
  if (t.type === "final") return "Final answer — loop exits";
  if (t.type === "user") return `Tool result (turn ${Math.ceil((idx + 1) / 2)})`;
  return `Model output — turn ${Math.ceil((idx + 1) / 2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentLoopStep() {
  const [step, setStep] = useState(0); // 0 = nothing shown yet

  const MAX = agentTrace.length;
  const visibleTurns = agentTrace.slice(0, step);
  const currentTurn = step > 0 ? agentTrace[step - 1] : null;
  const done = step >= MAX;

  // Token bar math
  const MAX_TOKENS = agentTrace[MAX - 1].totalContextTokens;
  const currentTokens = currentTurn ? currentTurn.totalContextTokens : agentTrace[0].cachedTokens;
  const cachedTokens = agentTrace[0].cachedTokens; // constant
  const historyTokens = Math.max(0, currentTokens - cachedTokens);

  const cachedPct = (cachedTokens / MAX_TOKENS) * 100;
  const historyPct = (historyTokens / MAX_TOKENS) * 100;

  return (
    <div style={s.root}>
      {/* CSS keyframe for fade-in animation */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Controls */}
      <div style={s.controls}>
        <button
          style={{ ...s.btn, ...(done ? s.btnDisabled : {}) }}
          onClick={() => !done && setStep((n) => n + 1)}
          disabled={done}
          aria-label="Advance to next step"
        >
          {step === 0 ? "Start" : "Next step"} →
        </button>

        <button
          style={{ ...s.btn, ...s.btnReset }}
          onClick={() => setStep(0)}
          aria-label="Reset demo"
        >
          Reset
        </button>

        <span style={s.counter}>
          {step === 0
            ? "0 of " + MAX + " steps"
            : `Step ${step} of ${MAX}`}
        </span>

        {done && (
          <span style={s.completeBadge} role="status">
            Loop complete — stop_reason: end_turn
          </span>
        )}
      </div>

      {/* Conversation panel */}
      {step === 0 ? (
        <div
          style={{
            ...s.conversation,
            padding: "20px 14px",
            color: "#9ca3af",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          Press "Start" to begin the agent trace.
        </div>
      ) : (
        <div style={s.conversation} role="log" aria-live="polite" aria-label="Agent conversation">
          {visibleTurns.map((turn, i) => (
            <div key={i} style={{ ...s.turnRow, ...turnColor(turn) }}>
              <div style={{ ...s.turnLabel, color: turnLabelColor(turn) }}>
                {turnLabelText(turn, i)}
              </div>
              <div style={s.turnContent}>
                {turn.toolName && (
                  <span style={s.toolPill}>{turn.toolName}</span>
                )}
                {turn.toolInput && (
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "0.78rem",
                      color: "#4338ca",
                      marginRight: 6,
                    }}
                  >
                    {turn.toolInput}
                  </span>
                )}
                {turn.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Token bar */}
      <div style={s.tokenBarWrap}>
        <div style={s.tokenBarLabel}>
          <span>Context window</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {step === 0 ? `${cachedTokens.toLocaleString()} tokens` : `${currentTokens.toLocaleString()} tokens`}
          </span>
        </div>
        <div style={s.tokenBarTrack} role="img" aria-label="Context token bar showing cached prefix in amber and growing history in grey">
          <div
            style={{
              ...s.tokenBarCached,
              width: `${cachedPct.toFixed(1)}%`,
              minWidth: cachedPct > 3 ? undefined : 0,
            }}
            title={`Cached prefix: ${cachedTokens.toLocaleString()} tokens (stable)`}
          >
            {cachedPct > 8 ? "cached" : ""}
          </div>
          <div
            style={{
              ...s.tokenBarHistory,
              width: `${historyPct.toFixed(1)}%`,
            }}
            title={`Conversation history: ${historyTokens.toLocaleString()} tokens (fresh compute)`}
          >
            {historyPct > 8 ? `+${historyTokens.toLocaleString()}` : ""}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <span style={s.legendItem}>
          <span style={{ ...s.swatch, background: "#f59e0b" }} />
          Cached prefix — system prompt + tool defs (paid once, reused each turn)
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.swatch, background: "#e2e8f0", border: "1px solid #cbd5e1" }} />
          Conversation history — grows each step, fresh compute per turn
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.swatch, background: "#ede9fe", border: "1px solid #c4b5fd" }} />
          Model output with tool call
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.swatch, background: "#f8fafc", border: "1px solid #e2e8f0" }} />
          Tool result (returned to model)
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.swatch, background: "#f0fdf4", border: "1px solid #bbf7d0" }} />
          Final answer — no tool call, loop exits
        </span>
      </div>

      <p style={s.illustrative}>
        Illustrative — all steps, token counts, and content are hand-authored. No real model or API involved.
      </p>
    </div>
  );
}
