import { useState } from "react";

// Color constants (mirrors CSS variables used project-wide)
const COLOR_BORDER = "var(--color-border, #e5e7eb)";
const COLOR_MUTED = "var(--color-muted, #6b7280)";
const COLOR_SURFACE = "var(--color-surface, #f8f9fa)";
const COLOR_ACCENT = "var(--color-accent, #3b82f6)";
const COLOR_ACCENT_SOFT = "var(--color-accent-soft, #dbeafe)";
const COLOR_CACHE = "var(--color-cache, #f59e0b)";

// Formula variable colors
const COLOR_LAYERS = "#4f46e5";  // indigo
const COLOR_TOKENS = "#059669";  // green
const COLOR_DMODEL = "#7c3aed"; // purple

// Reference GPU memory thresholds in GB
const GPU_CONSUMER = 24;
const GPU_SERVER = 80;

// Bar display max (clamp display at 2× server threshold for readability)
const BAR_DISPLAY_MAX = GPU_SERVER * 2;

function formatGB(gb: number): string {
  if (gb < 1) return (gb * 1024).toFixed(0) + " MB";
  return gb.toFixed(2) + " GB";
}

export default function KVMemoryCalc() {
  const [layers, setLayers] = useState(96);
  const [tokens, setTokens] = useState(32000);
  const [dModel, setDModel] = useState(8192);
  const [gqaEnabled, setGqaEnabled] = useState(false);
  const GQA_DIVISOR = 8;

  // KV cache formula: layers × tokens × 2 (K and V) × d_model × 2 bytes (float16)
  const rawBytes = layers * tokens * 2 * dModel * 2;
  const effectiveBytes = gqaEnabled ? rawBytes / GQA_DIVISOR : rawBytes;
  const effectiveGB = effectiveBytes / 1e9;

  // Bar fill: clamp to display max, split into normal and overflow
  const barPct = Math.min((effectiveGB / BAR_DISPLAY_MAX) * 100, 100);
  const consumerPct = (GPU_CONSUMER / BAR_DISPLAY_MAX) * 100;
  const serverPct = (GPU_SERVER / BAR_DISPLAY_MAX) * 100;
  const overflowStart = serverPct;
  const amberPct = effectiveGB <= GPU_SERVER ? barPct : serverPct;
  const redPct = effectiveGB > GPU_SERVER ? barPct - serverPct : 0;

  return (
    <div
      style={{
        maxWidth: "var(--content-max, 720px)",
        margin: "2rem 0",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      <style>{`
        .kvm-slider-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          margin-bottom: 1.75rem;
        }
        @media (max-width: 600px) {
          .kvm-slider-row {
            grid-template-columns: 1fr;
          }
        }
        .kvm-slider-card {
          background: ${COLOR_SURFACE};
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          padding: 1rem;
        }
        .kvm-slider-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.6rem;
        }
        .kvm-pill {
          display: inline-block;
          padding: 0.15rem 0.55rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .kvm-value-chip {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.85rem;
          font-weight: 700;
        }
        input[type="range"].kvm-range {
          width: 100%;
          cursor: pointer;
          height: 4px;
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          background: ${COLOR_BORDER};
        }
        input[type="range"].kvm-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .kvm-formula-box {
          background: ${COLOR_SURFACE};
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .kvm-formula-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.3rem;
          font-size: 1.05rem;
          line-height: 2;
        }
        .kvm-formula-sep {
          color: ${COLOR_MUTED};
          font-size: 1.1rem;
        }
        .kvm-result {
          font-size: 1.5rem;
          font-weight: 700;
          cursor: help;
          border-bottom: 1px dashed ${COLOR_MUTED};
          display: inline-block;
        }
        .kvm-bar-container {
          margin-bottom: 1.5rem;
        }
        .kvm-bar-track {
          position: relative;
          height: 28px;
          background: ${COLOR_ACCENT_SOFT};
          border-radius: var(--radius, 8px);
          overflow: visible;
          border: 1px solid ${COLOR_BORDER};
        }
        .kvm-bar-fill-amber {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: ${COLOR_CACHE};
          border-radius: var(--radius, 8px) 0 0 var(--radius, 8px);
          transition: width 0.2s ease;
        }
        .kvm-bar-fill-red {
          position: absolute;
          top: 0;
          height: 100%;
          background: #ef4444;
          border-radius: 0;
          transition: width 0.2s ease, left 0.2s ease;
        }
        .kvm-bar-marker {
          position: absolute;
          top: -4px;
          bottom: -4px;
          width: 2px;
          background: #374151;
          opacity: 0.5;
        }
        .kvm-gqa-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          background: ${COLOR_SURFACE};
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          margin-bottom: 0.75rem;
        }
        .kvm-toggle {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }
        .kvm-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .kvm-toggle-track {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background: ${COLOR_BORDER};
          cursor: pointer;
          transition: background 0.2s;
        }
        .kvm-toggle input:checked + .kvm-toggle-track {
          background: ${COLOR_ACCENT};
        }
        .kvm-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
          pointer-events: none;
        }
        .kvm-toggle input:checked ~ .kvm-toggle-thumb {
          transform: translateX(16px);
        }
        .kvm-note {
          font-size: 0.78rem;
          color: ${COLOR_MUTED};
          font-style: italic;
          margin-top: 0.4rem;
        }
      `}</style>

      {/* Sliders */}
      <div className="kvm-slider-row">
        {/* Layers */}
        <div className="kvm-slider-card">
          <div className="kvm-slider-label">
            <span
              className="kvm-pill"
              style={{
                background: "#ede9fe",
                color: COLOR_LAYERS,
              }}
            >
              Layers
            </span>
            <span className="kvm-value-chip" style={{ color: COLOR_LAYERS }}>
              {layers}
            </span>
          </div>
          <input
            type="range"
            className="kvm-range"
            min={4}
            max={128}
            step={4}
            value={layers}
            onChange={(e) => setLayers(Number(e.target.value))}
            style={{ accentColor: COLOR_LAYERS }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: COLOR_MUTED, marginTop: "0.25rem" }}>
            <span>4</span><span>128</span>
          </div>
        </div>

        {/* Context tokens */}
        <div className="kvm-slider-card">
          <div className="kvm-slider-label">
            <span
              className="kvm-pill"
              style={{
                background: "#d1fae5",
                color: COLOR_TOKENS,
              }}
            >
              Context tokens
            </span>
            <span className="kvm-value-chip" style={{ color: COLOR_TOKENS }}>
              {tokens.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            className="kvm-range"
            min={1024}
            max={200000}
            step={1024}
            value={tokens}
            onChange={(e) => setTokens(Number(e.target.value))}
            style={{ accentColor: COLOR_TOKENS }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: COLOR_MUTED, marginTop: "0.25rem" }}>
            <span>1k</span><span>200k</span>
          </div>
        </div>

        {/* d_model */}
        <div className="kvm-slider-card">
          <div className="kvm-slider-label">
            <span
              className="kvm-pill"
              style={{
                background: "#ede9fe",
                color: COLOR_DMODEL,
              }}
            >
              d_model
            </span>
            <span className="kvm-value-chip" style={{ color: COLOR_DMODEL }}>
              {dModel.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            className="kvm-range"
            min={512}
            max={16384}
            step={512}
            value={dModel}
            onChange={(e) => setDModel(Number(e.target.value))}
            style={{ accentColor: COLOR_DMODEL }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: COLOR_MUTED, marginTop: "0.25rem" }}>
            <span>512</span><span>16k</span>
          </div>
        </div>
      </div>

      {/* Formula display */}
      <div className="kvm-formula-box">
        <div className="kvm-formula-line">
          <span style={{ color: COLOR_LAYERS, fontWeight: 700 }}>{layers}</span>
          <span className="kvm-formula-sep">layers</span>
          <span className="kvm-formula-sep">×</span>
          <span style={{ color: COLOR_TOKENS, fontWeight: 700 }}>{tokens.toLocaleString()}</span>
          <span className="kvm-formula-sep">tokens</span>
          <span className="kvm-formula-sep">× 2 ×</span>
          <span style={{ color: COLOR_DMODEL, fontWeight: 700 }}>{dModel.toLocaleString()}</span>
          <span className="kvm-formula-sep">d_model</span>
          <span className="kvm-formula-sep">× 2 bytes</span>
          {gqaEnabled && (
            <>
              <span className="kvm-formula-sep">÷</span>
              <span style={{ color: COLOR_ACCENT, fontWeight: 700 }}>{GQA_DIVISOR}</span>
              <span className="kvm-formula-sep">(GQA)</span>
            </>
          )}
          <span className="kvm-formula-sep">=</span>
          <span
            className="kvm-result"
            title={`Exact: ${effectiveBytes.toLocaleString()} bytes`}
            style={{
              color: effectiveGB > GPU_SERVER ? "#dc2626" : effectiveGB > GPU_CONSUMER ? "#d97706" : "#059669",
            }}
          >
            {formatGB(effectiveGB)}
          </span>
        </div>
        <p className="kvm-note">Assumes float16 (2 bytes per element). Uses d_model as a simplification — real models store d_head × n_kv_heads per layer, which equals d_model only for standard MHA.</p>
      </div>

      {/* Memory bar */}
      <div className="kvm-bar-container">
        {/* Marker labels above the bar */}
        <div style={{ position: "relative", height: "1.25rem", marginBottom: "0.25rem" }}>
          <span
            style={{
              position: "absolute",
              left: `${consumerPct}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: "0.7rem",
              color: COLOR_MUTED,
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
            }}
          >
            RTX 4090 — {GPU_CONSUMER} GB
          </span>
          <span
            style={{
              position: "absolute",
              left: `${serverPct}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: "0.7rem",
              color: COLOR_MUTED,
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
            }}
          >
            A100 / H100 — {GPU_SERVER} GB
          </span>
        </div>

        {/* Bar track */}
        <div className="kvm-bar-track">
          <div
            className="kvm-bar-fill-amber"
            style={{
              width: `${amberPct}%`,
              borderRadius: redPct > 0
                ? "var(--radius, 8px) 0 0 var(--radius, 8px)"
                : "var(--radius, 8px)",
            }}
          />
          {redPct > 0 && (
            <div
              className="kvm-bar-fill-red"
              style={{
                left: `${overflowStart}%`,
                width: `${redPct}%`,
                borderRadius: barPct >= 100
                  ? "0 var(--radius, 8px) var(--radius, 8px) 0"
                  : "0",
              }}
            />
          )}
          <div className="kvm-bar-marker" style={{ left: `${consumerPct}%` }} />
          <div className="kvm-bar-marker" style={{ left: `${serverPct}%` }} />
        </div>

        {/* Scale labels below the bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            color: COLOR_MUTED,
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            marginTop: "0.35rem",
          }}
        >
          <span>0 GB</span>
          <span>{BAR_DISPLAY_MAX / 2} GB</span>
          <span>{BAR_DISPLAY_MAX} GB</span>
        </div>
      </div>

      {/* GQA toggle */}
      <div className="kvm-gqa-row">
        <label className="kvm-toggle" aria-label="Enable GQA divisor">
          <input
            type="checkbox"
            checked={gqaEnabled}
            onChange={(e) => setGqaEnabled(e.target.checked)}
          />
          <span className="kvm-toggle-track" />
          <span className="kvm-toggle-thumb" />
        </label>
        <span style={{ color: "#374151" }}>
          Grouped Query Attention (GQA)
        </span>
      </div>

      {/* GQA explainer diagram */}
      <div className="kvm-gqa-explainer" style={{ display: gqaEnabled ? "block" : "none" }}>
        <div className="kvm-gqa-compare">
          {/* Standard MHA */}
          <div className="kvm-gqa-panel">
            <div className="kvm-gqa-panel-title">Standard (MHA)</div>
            <div className="kvm-gqa-panel-sub">Each Q head has its own K,V pair</div>
            <div className="kvm-gqa-heads">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="kvm-gqa-head-group">
                  <div className="kvm-gqa-q">Q{i + 1}</div>
                  <div className="kvm-gqa-kv">K{i + 1},V{i + 1}</div>
                </div>
              ))}
            </div>
            <div className="kvm-gqa-count">8 Q heads → <strong>8 KV pairs</strong></div>
          </div>

          {/* GQA */}
          <div className="kvm-gqa-panel kvm-gqa-panel--active">
            <div className="kvm-gqa-panel-title">Grouped (GQA)</div>
            <div className="kvm-gqa-panel-sub">Multiple Q heads share one K,V pair</div>
            <div className="kvm-gqa-heads">
              {Array.from({ length: 2 }, (_, g) => (
                <div key={g} className="kvm-gqa-shared-group">
                  <div className="kvm-gqa-q-row">
                    {Array.from({ length: 4 }, (__, qi) => (
                      <div key={qi} className="kvm-gqa-q kvm-gqa-q--small">Q{g * 4 + qi + 1}</div>
                    ))}
                  </div>
                  <svg width="100%" height="16" style={{ display: "block" }}>
                    <line x1="12.5%" y1="0" x2="50%" y2="14" stroke={COLOR_MUTED} strokeWidth="1" />
                    <line x1="37.5%" y1="0" x2="50%" y2="14" stroke={COLOR_MUTED} strokeWidth="1" />
                    <line x1="62.5%" y1="0" x2="50%" y2="14" stroke={COLOR_MUTED} strokeWidth="1" />
                    <line x1="87.5%" y1="0" x2="50%" y2="14" stroke={COLOR_MUTED} strokeWidth="1" />
                  </svg>
                  <div className="kvm-gqa-kv kvm-gqa-kv--shared">K{g + 1},V{g + 1}</div>
                </div>
              ))}
            </div>
            <div className="kvm-gqa-count">8 Q heads → <strong>2 KV pairs</strong> ({GQA_DIVISOR}÷ less memory)</div>
          </div>
        </div>
      </div>

      <style>{`
        .kvm-gqa-explainer {
          margin-bottom: 0.75rem;
        }
        .kvm-gqa-compare {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (max-width: 600px) {
          .kvm-gqa-compare {
            grid-template-columns: 1fr;
          }
        }
        .kvm-gqa-panel {
          border: 1px solid ${COLOR_BORDER};
          border-radius: var(--radius, 8px);
          padding: 0.75rem;
          background: #fff;
        }
        .kvm-gqa-panel--active {
          border-color: ${COLOR_ACCENT};
          background: ${COLOR_ACCENT_SOFT};
        }
        .kvm-gqa-panel-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 0.15rem;
        }
        .kvm-gqa-panel-sub {
          font-size: 0.7rem;
          color: ${COLOR_MUTED};
          margin-bottom: 0.6rem;
        }
        .kvm-gqa-heads {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 0.5rem;
        }
        .kvm-gqa-head-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .kvm-gqa-shared-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 90px;
        }
        .kvm-gqa-q-row {
          display: flex;
          gap: 3px;
        }
        .kvm-gqa-q {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          padding: 0.15rem 0.3rem;
          border-radius: 3px;
          background: ${COLOR_ACCENT_SOFT};
          border: 1px solid ${COLOR_ACCENT};
          color: #1e40af;
        }
        .kvm-gqa-q--small {
          font-size: 0.55rem;
          padding: 0.1rem 0.2rem;
        }
        .kvm-gqa-kv {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          padding: 0.15rem 0.3rem;
          border-radius: 3px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          color: #92400e;
        }
        .kvm-gqa-kv--shared {
          font-weight: 600;
        }
        .kvm-gqa-count {
          font-size: 0.72rem;
          color: ${COLOR_MUTED};
        }
      `}</style>
    </div>
  );
}
