import { useState } from "react";

// Mirror CSS variables project-wide
const COLOR_BORDER = "var(--color-border, #e5e7eb)";
const COLOR_MUTED = "var(--color-muted, #6b7280)";
const COLOR_SURFACE = "var(--color-surface, #f8f9fa)";
const COLOR_ACCENT = "var(--color-accent, #3b82f6)";
const COLOR_ACCENT_SOFT = "var(--color-accent-soft, #dbeafe)";
const COLOR_CACHE = "var(--color-cache, #f59e0b)";

// Sonnet pricing reference: $3 per 1M input tokens
const BASE_PRICE_PER_M = 3.0;
// Cache read discount: 0.1x base price
const READ_MULTIPLIER = 0.1;

type TtlTier = "5min" | "1hour";

const TTL_CONFIG: Record<TtlTier, { label: string; writeMultiplier: number }> = {
  "5min": { label: "5-minute (1.25x write)", writeMultiplier: 1.25 },
  "1hour": { label: "1-hour (2x write)", writeMultiplier: 2.0 },
};

function formatDollars(n: number): string {
  return "$" + n.toFixed(2);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
}

function costUsd(tokens: number, multiplier: number): number {
  return (tokens / 1_000_000) * BASE_PRICE_PER_M * multiplier;
}

export default function CachePricingCalc() {
  const [prefixSize, setPrefixSize] = useState(50_000);
  const [turns, setTurns] = useState(10);
  const [ttl, setTtl] = useState<TtlTier>("5min");

  const { writeMultiplier } = TTL_CONFIG[ttl];

  // Without caching: every turn re-sends the full prefix
  const noCacheTokens = prefixSize * turns;
  const noCacheCost = costUsd(noCacheTokens, 1);

  // With caching: turn 1 is a cache write, turns 2-N are cache reads
  const writeCost = costUsd(prefixSize, writeMultiplier);
  const readCost = costUsd(prefixSize, READ_MULTIPLIER);
  const withCacheCost = writeCost + Math.max(0, turns - 1) * readCost;
  const withCacheTokensEquiv =
    prefixSize * writeMultiplier + Math.max(0, turns - 1) * prefixSize * READ_MULTIPLIER;

  const savings = noCacheCost - withCacheCost;
  const savingsPct = noCacheCost > 0 ? (savings / noCacheCost) * 100 : 0;

  // Break-even: how many reads until cache write premium is paid off
  // Premium per prefix = (writeMultiplier - 1) * base_cost_per_prefix
  // Savings per read = (1 - READ_MULTIPLIER) * base_cost_per_prefix
  // Break-even reads = premium / savings_per_read = (writeMultiplier - 1) / (1 - READ_MULTIPLIER)
  const writePremium = writeMultiplier - 1; // e.g. 0.25 or 1.0
  const readSavingPerToken = 1 - READ_MULTIPLIER; // 0.9
  const breakEvenReads = writePremium / readSavingPerToken;
  const breakEvenWhole = Math.ceil(breakEvenReads);

  // Bar widths: scale both bars so "no cache" bar = 100%
  const withCacheBarPct = noCacheCost > 0 ? Math.min((withCacheCost / noCacheCost) * 100, 100) : 0;

  return (
    <div
      style={{
        maxWidth: "var(--content-max, 720px)",
        margin: "2rem 0",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      <style>{`
        .cpc-slider-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.25rem;
          margin-bottom: 1.75rem;
        }
        @media (max-width: 600px) {
          .cpc-slider-row {
            grid-template-columns: 1fr;
          }
        }
        .cpc-slider-card {
          background: ${COLOR_SURFACE};
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          padding: 1rem;
        }
        .cpc-slider-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.6rem;
        }
        .cpc-pill {
          display: inline-block;
          padding: 0.15rem 0.55rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .cpc-value-chip {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.85rem;
          font-weight: 700;
        }
        input[type="range"].cpc-range {
          width: 100%;
          cursor: pointer;
          height: 4px;
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          background: ${COLOR_BORDER};
        }
        input[type="range"].cpc-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .cpc-range-ends {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: ${COLOR_MUTED};
          margin-top: 0.25rem;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .tc-tab-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .tc-tab {
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          font-family: var(--font-mono, ui-monospace, monospace);
          cursor: pointer;
          border: 1px solid ${COLOR_BORDER};
          background: transparent;
          color: ${COLOR_MUTED};
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          line-height: 1.4;
        }
        .tc-tab--active {
          background: ${COLOR_CACHE};
          color: #fff;
          border-color: ${COLOR_CACHE};
        }
        .cpc-comparison {
          margin-bottom: 1.5rem;
        }
        .cpc-bar-row {
          margin-bottom: 1rem;
        }
        .cpc-bar-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.4rem;
        }
        .cpc-bar-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #374151;
        }
        .cpc-bar-meta {
          font-size: 0.78rem;
          color: ${COLOR_MUTED};
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .cpc-bar-track {
          height: 26px;
          background: ${COLOR_ACCENT_SOFT};
          border-radius: var(--radius, 8px);
          border: 1px solid ${COLOR_BORDER};
          overflow: hidden;
        }
        .cpc-bar-fill {
          height: 100%;
          border-radius: var(--radius, 8px);
          transition: width 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          font-size: 0.72rem;
          font-weight: 700;
          font-family: var(--font-mono, ui-monospace, monospace);
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
        }
        .cpc-savings-box {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: var(--radius, 8px);
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .cpc-savings-number {
          font-size: 1.5rem;
          font-weight: 800;
          color: #16a34a;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .cpc-savings-label {
          font-size: 0.85rem;
          color: #166534;
        }
        .cpc-breakeven {
          background: ${COLOR_SURFACE};
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          padding: 0.875rem 1.25rem;
          font-size: 0.85rem;
          color: #374151;
          line-height: 1.6;
        }
        .cpc-breakeven strong {
          font-family: var(--font-mono, ui-monospace, monospace);
          color: ${COLOR_ACCENT};
        }
        .cpc-note {
          font-size: 0.78rem;
          color: ${COLOR_MUTED};
          font-style: italic;
          margin-top: 0.75rem;
        }
      `}</style>

      {/* Inputs row */}
      <div className="cpc-slider-row">
        {/* Cached prefix size */}
        <div className="cpc-slider-card">
          <div className="cpc-slider-label">
            <span
              className="cpc-pill"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              Prefix size
            </span>
            <span className="cpc-value-chip" style={{ color: "#92400e" }}>
              {formatTokens(prefixSize)}
            </span>
          </div>
          <input
            type="range"
            className="cpc-range"
            min={1000}
            max={200000}
            step={1000}
            value={prefixSize}
            onChange={(e) => setPrefixSize(Number(e.target.value))}
            style={{ accentColor: COLOR_CACHE }}
          />
          <div className="cpc-range-ends">
            <span>1k</span><span>200k</span>
          </div>
        </div>

        {/* Number of turns */}
        <div className="cpc-slider-card">
          <div className="cpc-slider-label">
            <span
              className="cpc-pill"
              style={{ background: COLOR_ACCENT_SOFT, color: "#1e40af" }}
            >
              Turns
            </span>
            <span className="cpc-value-chip" style={{ color: "#1e40af" }}>
              {turns}
            </span>
          </div>
          <input
            type="range"
            className="cpc-range"
            min={1}
            max={50}
            step={1}
            value={turns}
            onChange={(e) => setTurns(Number(e.target.value))}
            style={{ accentColor: COLOR_ACCENT }}
          />
          <div className="cpc-range-ends">
            <span>1</span><span>50</span>
          </div>
        </div>

        {/* TTL tier */}
        <div className="cpc-slider-card">
          <div className="cpc-slider-label">
            <span
              className="cpc-pill"
              style={{ background: "#f3e8ff", color: "#6b21a8" }}
            >
              TTL tier
            </span>
          </div>
          <div className="tc-tab-group">
            {(Object.keys(TTL_CONFIG) as TtlTier[]).map((tier) => (
              <button
                key={tier}
                className={`tc-tab${ttl === tier ? " tc-tab--active" : ""}`}
                onClick={() => setTtl(tier)}
              >
                {TTL_CONFIG[tier].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cost comparison bars */}
      <div className="cpc-comparison">
        {/* Without cache bar */}
        <div className="cpc-bar-row">
          <div className="cpc-bar-header">
            <span className="cpc-bar-label">Without caching</span>
            <span className="cpc-bar-meta">
              {formatTokens(noCacheTokens)} tokens — {formatDollars(noCacheCost)}
            </span>
          </div>
          <div className="cpc-bar-track">
            <div
              className="cpc-bar-fill"
              style={{ width: "100%", background: "#ef4444" }}
            >
              {formatDollars(noCacheCost)}
            </div>
          </div>
        </div>

        {/* With cache bar */}
        <div className="cpc-bar-row">
          <div className="cpc-bar-header">
            <span className="cpc-bar-label">With caching</span>
            <span className="cpc-bar-meta">
              {formatTokens(withCacheTokensEquiv)} token-equiv — {formatDollars(withCacheCost)}
            </span>
          </div>
          <div className="cpc-bar-track">
            <div
              className="cpc-bar-fill"
              style={{
                width: `${Math.max(withCacheBarPct, 2)}%`,
                background: "#16a34a",
              }}
            >
              {withCacheBarPct > 20 ? formatDollars(withCacheCost) : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Savings summary */}
      <div className="cpc-savings-box">
        <div>
          <div className="cpc-savings-number">{savingsPct.toFixed(1)}% saved</div>
          <div className="cpc-savings-label">
            {formatDollars(savings)} reduction over {turns} turn{turns !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.82rem", color: "#166534", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
            Write: {formatDollars(writeCost)} ({writeMultiplier}x)
          </div>
          <div style={{ fontSize: "0.82rem", color: "#166534", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
            Reads: {formatDollars(readCost)} × {Math.max(0, turns - 1)} (0.1x each)
          </div>
        </div>
      </div>

      {/* Break-even line */}
      <div className="cpc-breakeven">
        Cache pays for itself after{" "}
        <strong>{breakEvenWhole} read{breakEvenWhole !== 1 ? "s" : ""}</strong>.{" "}
        The {writeMultiplier}x write premium ({writePremium > 0 ? "+" : ""}{(writePremium * 100).toFixed(0)}% over base) is
        offset by the 0.1x read discount (saving {(readSavingPerToken * 100).toFixed(0)}% per read),
        yielding a break-even at {breakEvenReads.toFixed(2)} reads.
        {turns >= breakEvenWhole ? (
          <span style={{ color: "#16a34a", marginLeft: "0.35rem" }}>
            At {turns} turns you are comfortably past break-even.
          </span>
        ) : (
          <span style={{ color: "#dc2626", marginLeft: "0.35rem" }}>
            At {turns} turn{turns !== 1 ? "s" : ""} you have not yet reached break-even.
          </span>
        )}
      </div>

      <p className="cpc-note">
        Costs use Sonnet pricing ($3/M input tokens) as reference.
        Cache reads are billed at 0.1x base; cache writes at {writeMultiplier}x base.
      </p>
    </div>
  );
}
