import { useState } from "react";
import {
  ANATOMY_SEGMENTS,
  NORMAL_SCENARIOS,
  TOOL_CHANGED_SCENARIOS,
  SYSTEM_CHANGED_SCENARIOS,
  INVALIDATION_TOGGLES,
  type RequestScenario,
  type CacheStatus,
} from "../data/prompt-cache";

const STATUS_STYLES: Record<CacheStatus, { bg: string; border: string; label: string; longLabel: string; labelColor: string }> = {
  hit: {
    bg: "#fef3c7",
    border: "#f59e0b",
    label: "HIT",
    longLabel: "Cache hit",
    labelColor: "#92400e",
  },
  miss: {
    bg: "#f3f4f6",
    border: "#9ca3af",
    label: "MISS",
    longLabel: "Cache miss",
    labelColor: "#6b7280",
  },
  write: {
    bg: "#fef9c3",
    border: "#eab308",
    label: "WRITE",
    longLabel: "Cache write",
    labelColor: "#854d0e",
  },
};

function Tooltip({ text, visible }: { text: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute",
      top: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1a1a1a",
      color: "#f9fafb",
      padding: "6px 10px",
      borderRadius: "5px",
      fontSize: "0.75rem",
      lineHeight: 1.4,
      whiteSpace: "normal",
      width: "max-content",
      maxWidth: "200px",
      zIndex: 50,
      pointerEvents: "none",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    }}>
      {text}
    </div>
  );
}

function RequestColumn({ scenario }: { scenario: RequestScenario }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const totalTokens = ANATOMY_SEGMENTS.reduce((sum, s) => sum + s.tokens, 0);

  return (
    <div>
      <div style={{
        fontSize: "0.8rem",
        fontWeight: 700,
        color: "#374151",
        marginBottom: "10px",
        paddingBottom: "6px",
        borderBottom: "2px solid #e5e7eb",
      }}>
        {scenario.label}
      </div>

      <div style={{
        display: "flex",
        gap: "3px",
        alignItems: "flex-end",
        overflow: "hidden",
      }}>
        {scenario.segments.map((seg) => {
          const anatomy = ANATOMY_SEGMENTS.find((a) => a.id === seg.segmentId)!;
          const style = STATUS_STYLES[seg.status];
          const widthPct = Math.max(10, (anatomy.tokens / totalTokens) * 100);
          const hovered = hoveredId === seg.segmentId;
          const showBp = anatomy.breakpoint && seg.segmentId !== "history" && seg.segmentId !== "new-turn";

          return (
            <div
              key={seg.segmentId}
              style={{
                position: "relative",
                width: `${widthPct}%`,
                minWidth: 0,
                flexShrink: 1,
              }}
            >
              <div style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: style.labelColor,
                marginBottom: "3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {style.label}
              </div>

              <div
                onMouseEnter={() => setHoveredId(seg.segmentId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: "100%",
                  height: "48px",
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2px",
                  overflow: "hidden",
                  boxShadow: hovered ? `0 0 0 3px ${style.border}55` : "none",
                }}
              >
                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  textAlign: "center",
                  color: "#374151",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}>
                  {anatomy.label}
                </span>
                <Tooltip text={seg.statusNote} visible={hovered} />
              </div>

              {showBp && (
                <div style={{
                  position: "absolute",
                  right: "-2px",
                  top: "16px",
                  height: "52px",
                  width: "3px",
                  background: "#6366f1",
                  borderRadius: "2px",
                  zIndex: 2,
                }} title="Cache breakpoint">
                  <div style={{
                    position: "absolute",
                    top: "-13px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "0.55rem",
                    color: "#6366f1",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    background: "#fff",
                    padding: "0 2px",
                  }}>
                    ▼BP
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: "8px",
        fontSize: "0.68rem",
        color: "#6b7280",
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
      }}>
        {scenario.segments.map((seg) => {
          const anatomy = ANATOMY_SEGMENTS.find((a) => a.id === seg.segmentId)!;
          const s = STATUS_STYLES[seg.status];
          return (
            <span key={seg.segmentId} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                background: s.bg,
                border: `1.5px solid ${s.border}`,
                flexShrink: 0,
              }} />
              {anatomy.label.split(" ")[0]}: ~{anatomy.tokens.toLocaleString()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div style={{
      display: "flex",
      gap: "14px",
      flexWrap: "wrap",
      fontSize: "0.78rem",
      marginBottom: "16px",
      padding: "8px 12px",
      background: "#f8f9fa",
      borderRadius: "6px",
      border: "1px solid #e5e7eb",
    }}>
      {(["hit", "write", "miss"] as CacheStatus[]).map((status) => {
        const s = STATUS_STYLES[status];
        return (
          <span key={status} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: s.bg,
              border: `2px solid ${s.border}`,
            }} />
            <span style={{ color: s.labelColor, fontWeight: 600 }}>{s.longLabel}</span>
          </span>
        );
      })}
      <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#6366f1" }}>
        <span style={{ fontWeight: 700 }}>▼BP</span>
        <span style={{ color: "#6b7280" }}>Breakpoint</span>
      </span>
    </div>
  );
}

export default function RequestAnatomy() {
  const [toggleIdx, setToggleIdx] = useState(0);

  const toggle = INVALIDATION_TOGGLES[toggleIdx];
  const scenarios =
    toggleIdx === 0 ? NORMAL_SCENARIOS :
    toggle.id === "tool-change" ? TOOL_CHANGED_SCENARIOS :
    SYSTEM_CHANGED_SCENARIOS;
  const isNormal = toggleIdx === 0;

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      maxWidth: "var(--content-max, 720px)",
    }}>
      {/* Toggle row */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "#374151",
          marginBottom: "8px",
        }}>
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
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{
          marginTop: "10px",
          padding: "10px 14px",
          background: isNormal ? "#f0fdf4" : "#fff7ed",
          border: `1px solid ${isNormal ? "#86efac" : "#fed7aa"}`,
          borderRadius: "6px",
          fontSize: "0.82rem",
          color: "#374151",
        }}>
          {toggle.description}
          {!isNormal && (
            <span style={{
              display: "block",
              marginTop: "4px",
              fontWeight: 600,
              color: "#c2410c",
            }}>
              Cache goes cold from "{ANATOMY_SEGMENTS.find(s => s.kind === toggle.invalidatesAt)?.label}" onward.
            </span>
          )}
        </div>
      </div>

      <StatusLegend />

      {/* Stacked requests (not side-by-side) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {scenarios.map((scenario) => (
          <RequestColumn key={scenario.id} scenario={scenario} />
        ))}
      </div>

      <p style={{
        marginTop: "16px",
        fontSize: "0.72rem",
        color: "#9ca3af",
        fontStyle: "italic",
      }}>
        Illustrative only — token counts and cache states are hand-authored.
        Hover any segment for details.
      </p>
    </div>
  );
}
