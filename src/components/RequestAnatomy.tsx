import { useState } from "react";
import {
  ANATOMY_SEGMENTS,
  NORMAL_SCENARIOS,
  INVALIDATED_SCENARIOS,
  INVALIDATION_TOGGLES,
  type RequestScenario,
  type CacheStatus,
  type SegmentKind,
} from "../data/prompt-cache";

// ── Color helpers ─────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<SegmentKind, string> = {
  "system-prompt": "#e0e7ff", // indigo-100
  tools: "#ede9fe",           // violet-100
  files: "#dcfce7",           // green-100
  history: "#f1f5f9",         // slate-100
  "new-turn": "#f8fafc",      // slate-50
};

const SEGMENT_BORDER: Record<SegmentKind, string> = {
  "system-prompt": "#818cf8",
  tools: "#a78bfa",
  files: "#4ade80",
  history: "#94a3b8",
  "new-turn": "#cbd5e1",
};

const STATUS_STYLES: Record<CacheStatus, { bg: string; border: string; label: string; labelColor: string }> = {
  hit: {
    bg: "#fef3c7",        // amber-soft (--color-cache-soft)
    border: "#f59e0b",    // amber (--color-cache)
    label: "Cache hit",
    labelColor: "#92400e",
  },
  miss: {
    bg: "#f3f4f6",        // grey-100
    border: "#9ca3af",    // grey-400
    label: "Cache miss",
    labelColor: "#6b7280",
  },
  write: {
    bg: "#fef9c3",        // yellow-50
    border: "#eab308",    // yellow-500
    label: "Cache write",
    labelColor: "#854d0e",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface TooltipProps {
  text: string;
  visible: boolean;
}

function Tooltip({ text, visible }: TooltipProps) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1a1a1a",
        color: "#f9fafb",
        padding: "6px 10px",
        borderRadius: "5px",
        fontSize: "0.78rem",
        lineHeight: 1.45,
        whiteSpace: "normal",
        width: "220px",
        zIndex: 10,
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}

interface SegmentBarProps {
  segmentId: string;
  status: CacheStatus;
  statusNote: string;
  totalTokens: number;
  segmentTokens: number;
  breakpoint: boolean;
}

function SegmentBar({
  segmentId,
  status,
  statusNote,
  totalTokens,
  segmentTokens,
  breakpoint,
}: SegmentBarProps) {
  const [hovered, setHovered] = useState(false);
  const seg = ANATOMY_SEGMENTS.find((s) => s.id === segmentId)!;
  const style = STATUS_STYLES[status];
  const widthPct = Math.max(8, (segmentTokens / totalTokens) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
        flexShrink: 0,
        width: `${widthPct}%`,
        minWidth: "56px",
      }}
    >
      {/* Status badge */}
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: style.labelColor,
          marginBottom: "3px",
          whiteSpace: "nowrap",
        }}
      >
        {style.label}
      </div>

      {/* Segment block */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          height: "56px",
          background: style.bg,
          border: `2px solid ${style.border}`,
          borderRadius: "5px",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px",
          transition: "box-shadow 0.15s",
          boxShadow: hovered ? `0 0 0 3px ${style.border}55` : "none",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            textAlign: "center",
            color: "#374151",
            lineHeight: 1.3,
          }}
        >
          {seg.label}
        </span>

        <Tooltip text={statusNote} visible={hovered} />
      </div>

      {/* Breakpoint marker */}
      {breakpoint && (
        <div
          style={{
            position: "absolute",
            right: "-1px",
            top: "22px",
            height: "60px",
            width: "3px",
            background: "#6366f1",
            borderRadius: "2px",
            zIndex: 2,
          }}
          title="Cache breakpoint"
        >
          <div
            style={{
              position: "absolute",
              top: "-14px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.6rem",
              color: "#6366f1",
              fontWeight: 700,
              whiteSpace: "nowrap",
              background: "#fff",
              padding: "0 2px",
            }}
          >
            ▼BP
          </div>
        </div>
      )}
    </div>
  );
}

interface RequestColumnProps {
  scenario: RequestScenario;
}

function RequestColumn({ scenario }: RequestColumnProps) {
  const totalTokens = ANATOMY_SEGMENTS.reduce((sum, s) => sum + s.tokens, 0);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "#374151",
          marginBottom: "10px",
          paddingBottom: "6px",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {scenario.label}
      </div>

      <div
        style={{
          display: "flex",
          gap: "3px",
          alignItems: "flex-end",
          overflowX: "auto",
          paddingBottom: "4px",
        }}
      >
        {scenario.segments.map((seg) => {
          const anatomy = ANATOMY_SEGMENTS.find((a) => a.id === seg.segmentId)!;
          return (
            <SegmentBar
              key={seg.segmentId}
              segmentId={seg.segmentId}
              status={seg.status}
              statusNote={seg.statusNote}
              totalTokens={totalTokens}
              segmentTokens={anatomy.tokens}
              breakpoint={anatomy.breakpoint && seg.segmentId !== "history" && seg.segmentId !== "new-turn"}
            />
          );
        })}
      </div>

      {/* Token legend */}
      <div
        style={{
          marginTop: "8px",
          fontSize: "0.7rem",
          color: "#6b7280",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {scenario.segments.map((seg) => {
          const anatomy = ANATOMY_SEGMENTS.find((a) => a.id === seg.segmentId)!;
          const style = STATUS_STYLES[seg.status];
          return (
            <span key={seg.segmentId} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: style.bg,
                  border: `1.5px solid ${style.border}`,
                }}
              />
              {anatomy.label}: ~{anatomy.tokens.toLocaleString()} tkns
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function StatusLegend() {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        fontSize: "0.78rem",
        marginBottom: "16px",
        padding: "10px 14px",
        background: "#f8f9fa",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
      }}
    >
      {(["hit", "write", "miss"] as CacheStatus[]).map((status) => {
        const s = STATUS_STYLES[status];
        return (
          <span key={status} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: "14px",
                height: "14px",
                borderRadius: "3px",
                background: s.bg,
                border: `2px solid ${s.border}`,
              }}
            />
            <span style={{ color: s.labelColor, fontWeight: 600 }}>{s.label}</span>
          </span>
        );
      })}
      <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6366f1" }}>
        <span style={{ fontWeight: 700 }}>▼BP</span>
        <span style={{ color: "#6b7280" }}>Cache breakpoint</span>
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RequestAnatomy() {
  const [toggleIdx, setToggleIdx] = useState(0);

  const isNormal = toggleIdx === 0;
  const scenarios = isNormal ? NORMAL_SCENARIOS : INVALIDATED_SCENARIOS;
  const toggle = INVALIDATION_TOGGLES[toggleIdx];

  return (
    <div
      style={{
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      {/* Toggle row */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "#374151",
            marginBottom: "8px",
          }}
        >
          Scenario:
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {INVALIDATION_TOGGLES.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setToggleIdx(i)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "2px solid",
                borderColor: i === toggleIdx ? "#3b82f6" : "#d1d5db",
                background: i === toggleIdx ? "#dbeafe" : "#f9fafb",
                color: i === toggleIdx ? "#1d4ed8" : "#374151",
                fontWeight: i === toggleIdx ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scenario description */}
        <div
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            background:
              isNormal
                ? "#f0fdf4"
                : "#fff7ed",
            border: `1px solid ${isNormal ? "#86efac" : "#fed7aa"}`,
            borderRadius: "6px",
            fontSize: "0.82rem",
            color: "#374151",
          }}
        >
          {toggle.description}
          {!isNormal && (
            <span
              style={{
                display: "block",
                marginTop: "4px",
                fontWeight: 600,
                color: "#c2410c",
              }}
            >
              Cache goes cold from "{ANATOMY_SEGMENTS.find(s => s.kind === toggle.invalidatesAt)?.label}" onward.
            </span>
          )}
        </div>
      </div>

      <StatusLegend />

      {/* Side-by-side requests */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {scenarios.map((scenario) => (
          <RequestColumn key={scenario.id} scenario={scenario} />
        ))}
      </div>

      <p
        style={{
          marginTop: "16px",
          fontSize: "0.72rem",
          color: "#9ca3af",
          fontStyle: "italic",
        }}
      >
        Illustrative only — token counts, segment sizes, and cache states are
        hand-authored to demonstrate the concept. Hover any segment for details.
      </p>
    </div>
  );
}
