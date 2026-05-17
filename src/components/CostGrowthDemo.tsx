import { useState } from "react";

const SYSTEM_TOKENS = 2000;
const HISTORY_PER_TURN = 500;
const NEW_MESSAGE_TOKENS = 150;
const CACHE_COST_FACTOR = 0.1;
const TURNS = 8;

interface TurnData {
  turn: number;
  system: number;
  history: number;
  newMessage: number;
  total: number;
}

function buildTurns(): TurnData[] {
  const turns: TurnData[] = [];
  for (let t = 1; t <= TURNS; t++) {
    const history = (t - 1) * HISTORY_PER_TURN;
    const total = SYSTEM_TOKENS + history + NEW_MESSAGE_TOKENS;
    turns.push({ turn: t, system: SYSTEM_TOKENS, history, newMessage: NEW_MESSAGE_TOKENS, total });
  }
  return turns;
}

const TURNS_DATA = buildTurns();
const MAX_TOTAL = TURNS_DATA[TURNS_DATA.length - 1].total;

function computeSummary(cached: boolean): { full: number; effective: number } {
  let full = 0;
  let effective = 0;
  for (const t of TURNS_DATA) {
    full += t.total;
    if (cached) {
      effective += (t.system + t.history) * CACHE_COST_FACTOR + t.newMessage;
    } else {
      effective += t.total;
    }
  }
  return { full, effective };
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

export default function CostGrowthDemo() {
  const [cached, setCached] = useState(false);
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);

  const summary = computeSummary(cached);
  const savedPct = Math.round(((summary.full - summary.effective) / summary.full) * 100);

  const BAR_MAX_PX = 480;

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .cgd-toggle-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .tc-tab {
          padding: 0.35rem 0.9rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          font-size: 0.82rem;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .tc-tab:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .tc-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .cgd-chart {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          margin-bottom: 1.5rem;
        }
        .cgd-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          position: relative;
        }
        .cgd-label {
          font-size: 0.8rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          width: 3rem;
          flex-shrink: 0;
          text-align: right;
        }
        .cgd-bar-track {
          flex: 1;
          height: 28px;
          display: flex;
          border-radius: var(--radius, 6px);
          overflow: hidden;
          position: relative;
          cursor: default;
        }
        .cgd-segment {
          height: 100%;
          transition: width 0.35s ease, opacity 0.35s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .cgd-segment-label {
          font-size: 0.68rem;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          padding: 0 4px;
          pointer-events: none;
          white-space: nowrap;
          overflow: hidden;
        }
        .cgd-tooltip {
          position: absolute;
          left: 3.75rem;
          top: calc(100% + 6px);
          background: var(--color-surface, #f8f9fa);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.55rem 0.75rem;
          font-size: 0.78rem;
          font-family: var(--font-mono, monospace);
          z-index: 10;
          pointer-events: none;
          min-width: 220px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .cgd-tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.2rem;
        }
        .cgd-tooltip-row:last-child {
          margin-bottom: 0;
          border-top: 1px solid var(--color-border, #e5e7eb);
          padding-top: 0.2rem;
          font-weight: 700;
        }
        .cgd-summary {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.875rem 1rem;
          background: var(--color-surface, #f8f9fa);
          font-size: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-bottom: 1rem;
        }
        .cgd-summary-line {
          display: flex;
          justify-content: space-between;
        }
        .cgd-summary-label {
          color: var(--color-muted, #6b7280);
        }
        .cgd-summary-value {
          font-family: var(--font-mono, monospace);
          font-weight: 600;
        }
        .cgd-savings-badge {
          display: inline-block;
          padding: 0.1rem 0.5rem;
          border-radius: 999px;
          background: var(--color-cache, #fef3c7);
          color: #92400e;
          font-size: 0.78rem;
          font-weight: 700;
          margin-left: 0.5rem;
        }
        .cgd-legend {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }
        .cgd-legend-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
        }
        .cgd-legend-swatch {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .cgd-note {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          margin-top: 0.5rem;
        }
        @keyframes cgd-stripe {
          from { background-position: 0 0; }
          to { background-position: 28px 0; }
        }
      `}</style>

      {/* Toggle */}
      <div className="cgd-toggle-row">
        <button
          className={`tc-tab${!cached ? " tc-tab--active" : ""}`}
          onClick={() => setCached(false)}
        >
          Without cache
        </button>
        <button
          className={`tc-tab${cached ? " tc-tab--active" : ""}`}
          onClick={() => setCached(true)}
        >
          With cache
        </button>
      </div>

      {/* Legend */}
      <div className="cgd-legend">
        <div className="cgd-legend-item">
          <div className="cgd-legend-swatch" style={{ background: "#6366f1" }} />
          System prompt + tools
        </div>
        <div className="cgd-legend-item">
          <div className="cgd-legend-swatch" style={{ background: "#9ca3af" }} />
          Conversation history
        </div>
        <div className="cgd-legend-item">
          <div className="cgd-legend-swatch" style={{ background: "var(--color-accent, #3b82f6)" }} />
          New message
        </div>
        {cached && (
          <div className="cgd-legend-item">
            <div
              className="cgd-legend-swatch"
              style={{
                background: "repeating-linear-gradient(45deg, #fde68a 0px, #fde68a 4px, #fef3c7 4px, #fef3c7 8px)",
              }}
            />
            Cached (0.1x cost)
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="cgd-chart">
        {TURNS_DATA.map((t) => {
          const systemPx = (t.system / MAX_TOTAL) * BAR_MAX_PX;
          const historyPx = (t.history / MAX_TOTAL) * BAR_MAX_PX;
          const newMsgPx = (t.newMessage / MAX_TOTAL) * BAR_MAX_PX;

          const cachedSystemPx = systemPx * CACHE_COST_FACTOR;
          const cachedHistoryPx = historyPx * CACHE_COST_FACTOR;

          const isHovered = hoveredTurn === t.turn;

          return (
            <div
              key={t.turn}
              className="cgd-row"
              onMouseEnter={() => setHoveredTurn(t.turn)}
              onMouseLeave={() => setHoveredTurn(null)}
            >
              <div className="cgd-label">T{t.turn}</div>

              <div
                className="cgd-bar-track"
                style={{ maxWidth: BAR_MAX_PX + "px" }}
              >
                {/* System segment */}
                <div
                  className="cgd-segment"
                  style={{
                    width: (cached ? cachedSystemPx : systemPx) + "px",
                    background: cached
                      ? "repeating-linear-gradient(45deg, #fde68a 0px, #fde68a 5px, #fef3c7 5px, #fef3c7 10px)"
                      : "#6366f1",
                    minWidth: cached ? "2px" : undefined,
                  }}
                >
                  {!cached && systemPx > 40 && (
                    <span className="cgd-segment-label" style={{ color: "#fff" }}>
                      sys
                    </span>
                  )}
                  {cached && cachedSystemPx > 24 && (
                    <span className="cgd-segment-label" style={{ color: "#92400e", fontSize: "0.6rem" }}>
                      0.1x
                    </span>
                  )}
                </div>

                {/* History segment */}
                {t.history > 0 && (
                  <div
                    className="cgd-segment"
                    style={{
                      width: (cached ? cachedHistoryPx : historyPx) + "px",
                      background: cached
                        ? "repeating-linear-gradient(45deg, #fcd34d 0px, #fcd34d 5px, #fef3c7 5px, #fef3c7 10px)"
                        : "#9ca3af",
                      minWidth: cached && t.history > 0 ? "2px" : undefined,
                    }}
                  >
                    {!cached && historyPx > 40 && (
                      <span className="cgd-segment-label" style={{ color: "#fff" }}>
                        hist
                      </span>
                    )}
                  </div>
                )}

                {/* New message segment */}
                <div
                  className="cgd-segment"
                  style={{
                    width: newMsgPx + "px",
                    background: "var(--color-accent, #3b82f6)",
                  }}
                />
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="cgd-tooltip">
                  <div className="cgd-tooltip-row">
                    <span>System + tools</span>
                    <span>{formatNum(t.system)}</span>
                  </div>
                  <div className="cgd-tooltip-row">
                    <span>History</span>
                    <span>{formatNum(t.history)}</span>
                  </div>
                  <div className="cgd-tooltip-row">
                    <span>New message</span>
                    <span>{formatNum(t.newMessage)}</span>
                  </div>
                  <div className="cgd-tooltip-row">
                    <span>Total</span>
                    <span>{formatNum(t.total)}</span>
                  </div>
                  {cached && (
                    <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#92400e" }}>
                      Effective cost: {formatNum(
                        Math.round((t.system + t.history) * CACHE_COST_FACTOR + t.newMessage)
                      )} tokens
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="cgd-summary">
        <div className="cgd-summary-line">
          <span className="cgd-summary-label">Total tokens (all turns, no cache)</span>
          <span className="cgd-summary-value">{formatNum(summary.full)}</span>
        </div>
        <div className="cgd-summary-line">
          <span className="cgd-summary-label">
            With caching
            {cached && (
              <span className="cgd-savings-badge">{savedPct}% saved</span>
            )}
          </span>
          <span className="cgd-summary-value">
            {formatNum(Math.round(summary.effective))}
          </span>
        </div>
      </div>

      <p className="cgd-note">Token counts are illustrative.</p>
    </div>
  );
}
