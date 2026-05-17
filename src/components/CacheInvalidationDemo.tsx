import { useState } from "react";

type SegmentKey = "tools" | "system" | "history" | "message";

type SegmentStatus = "cached" | "reprocessed";

interface Scenario {
  id: string;
  label: string;
  statuses: Record<SegmentKey, SegmentStatus>;
  explanation: string;
  flash: SegmentKey[];
}

interface ScenarioGroup {
  label: string;
  scenarios: Scenario[];
}

const ALL_MISS: Record<SegmentKey, SegmentStatus> = { tools: "reprocessed", system: "reprocessed", history: "reprocessed", message: "reprocessed" };
const SYS_BREAK: Record<SegmentKey, SegmentStatus> = { tools: "cached", system: "reprocessed", history: "reprocessed", message: "reprocessed" };
const SAFE: Record<SegmentKey, SegmentStatus> = { tools: "cached", system: "cached", history: "cached", message: "reprocessed" };

const SCENARIO_GROUPS: ScenarioGroup[] = [
  {
    label: "Safe",
    scenarios: [
      {
        id: "baseline",
        label: "Normal turn",
        statuses: SAFE,
        explanation: "Nothing changed. Tools, system prompt, and previous turns all hit the cache. Only the latest exchange and new message are processed.",
        flash: [],
      },
      {
        id: "compact",
        label: "/compact",
        statuses: { tools: "cached", system: "cached", history: "reprocessed", message: "reprocessed" },
        explanation: "Compaction rewrites and shortens the conversation history — all previous turns are replaced with a summary. Tools and system prompt are identical and still hit.",
        flash: ["history", "message"],
      },
      {
        id: "subagent",
        label: "Subagent call",
        statuses: SAFE,
        explanation: "Subagents run as separate requests with their own context. The parent conversation's cached prefix is unaffected — tools, system prompt, and previous turns still hit.",
        flash: [],
      },
      {
        id: "read-file",
        label: "Read / edit a file",
        statuses: SAFE,
        explanation: "File contents appear as tool-call results inside the latest exchange — not in the cached prefix. Reading or editing files doesn't touch tools, system prompt, or previous turns.",
        flash: [],
      },
      {
        id: "thinking",
        label: "Toggle thinking",
        statuses: SAFE,
        explanation: "Extended thinking is a separate API parameter — it's not part of the token stream. Toggling it or changing the budget doesn't alter any cached tokens.",
        flash: [],
      },
    ],
  },
  {
    label: "System prompt breaks",
    scenarios: [
      {
        id: "edit-system",
        label: "Edit CLAUDE.md",
        statuses: SYS_BREAK,
        explanation: "CLAUDE.md is injected into the system prompt. Editing it — even adding a space — changes the system prompt tokens. Tools are unchanged and still hit, but everything after is reprocessed.",
        flash: ["system", "history", "message"],
      },
      {
        id: "change-hooks",
        label: "Change hooks",
        statuses: SYS_BREAK,
        explanation: "Hook configurations are included in the system prompt. Adding, removing, or editing a hook changes system prompt tokens — tools stay cached, but everything from the system prompt onward is reprocessed.",
        flash: ["system", "history", "message"],
      },
      {
        id: "permission-change",
        label: "Change permissions",
        statuses: SYS_BREAK,
        explanation: "Permission settings (allowedTools, blockedTools) are embedded in the system prompt. Changing them alters the system prompt tokens — tools still hit, but everything after is reprocessed.",
        flash: ["system", "history", "message"],
      },
    ],
  },
  {
    label: "Full invalidation",
    scenarios: [
      {
        id: "add-mcp",
        label: "Add MCP server",
        statuses: ALL_MISS,
        explanation: "MCP servers register new tools. Tool definitions are first in the token stream — adding tools changes the very start of the prefix and invalidates the entire cache.",
        flash: ["tools", "system", "history", "message"],
      },
      {
        id: "add-skill",
        label: "Add a /skill",
        statuses: ALL_MISS,
        explanation: "Custom skills register as new tools. Adding one changes the tool definitions at the start of the token stream — the entire cache is invalidated.",
        flash: ["tools", "system", "history", "message"],
      },
      {
        id: "reload-plugins",
        label: "/reload-plugins",
        statuses: ALL_MISS,
        explanation: "Reloading re-discovers all MCP servers and tools from scratch. Even if nothing changed, the tool list is rebuilt — any reordering or timing difference breaks the prefix match.",
        flash: ["tools", "system", "history", "message"],
      },
      {
        id: "switch-model",
        label: "Switch model",
        statuses: ALL_MISS,
        explanation: "The cache is model-scoped. Switching from Sonnet to Opus (or vice versa) means no prior cached state exists — every segment is reprocessed from scratch.",
        flash: ["tools", "system", "history", "message"],
      },
    ],
  },
];

interface SegmentDef {
  key: SegmentKey;
  label: string;
  tokens: string;
  detail: string;
  bg: string;
}

const SEGMENTS: SegmentDef[] = [
  {
    key: "tools",
    label: "Tool definitions",
    tokens: "~1,200 tokens",
    detail: "read_file  |  write_file  |  bash",
    bg: "#ede9fe",
  },
  {
    key: "system",
    label: "System prompt",
    tokens: "~800 tokens",
    detail:
      'You are Claude, an AI assistant. Be concise, accurate, and helpful...',
    bg: "#e0e7ff",
  },
  {
    key: "history",
    label: "Conversation history",
    tokens: "grows each turn",
    detail: "Turn 1 … Turn 2 … Turn 3 …",
    bg: "#f1f5f9",
  },
  {
    key: "message",
    label: "New message",
    tokens: "~120 tokens",
    detail: "Add error handling to the form submit handler.",
    bg: "#f8fafc",
  },
];

const GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Safe": { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
  "System prompt breaks": { bg: "#fefce8", border: "#fde047", text: "#854d0e" },
  "Full invalidation": { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
};

export default function CacheInvalidationDemo() {
  const [activeScenario, setActiveScenario] = useState<Scenario>(SCENARIO_GROUPS[0].scenarios[0]);
  const [flashing, setFlashing] = useState<Set<SegmentKey>>(new Set());

  function applyScenario(scenario: Scenario) {
    if (scenario.flash.length > 0) {
      setFlashing(new Set(scenario.flash));
      setTimeout(() => setFlashing(new Set()), 600);
    }
    setActiveScenario(scenario);
  }

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .cid-group {
          margin-bottom: 0.75rem;
        }
        .cid-group-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
        }
        .cid-group-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          border: 1px solid;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .cid-group-line {
          flex: 1;
          height: 1px;
          background: var(--color-border, #e5e7eb);
        }
        .cid-tabs {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .cid-tab {
          padding: 0.3rem 0.75rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          font-size: 0.78rem;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .cid-tab:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .cid-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .cid-stack {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin: 1.25rem 0;
        }
        .cid-segment {
          display: flex;
          align-items: stretch;
          border-radius: var(--radius, 6px);
          overflow: hidden;
          border: 1px solid var(--color-border, #e5e7eb);
          transition: border-color 0.2s;
        }
        .cid-segment-accent {
          width: 4px;
          flex-shrink: 0;
          transition: background-color 0.25s;
        }
        .cid-segment-body {
          flex: 1;
          padding: 0.65rem 0.85rem;
          min-width: 0;
        }
        .cid-segment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.3rem;
        }
        .cid-segment-label {
          font-size: 0.82rem;
          font-weight: 600;
          font-family: var(--font-body, system-ui, sans-serif);
          color: #374151;
        }
        .cid-segment-tokens {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          white-space: nowrap;
        }
        .cid-segment-detail {
          font-size: 0.8rem;
          font-family: var(--font-mono, monospace);
          color: #4b5563;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cid-badge {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 0.15rem 0.55rem;
          border-radius: 999px;
          white-space: nowrap;
          transition: background 0.2s, color 0.2s;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .cid-badge--cached {
          background: var(--color-cache, #f59e0b);
          color: #78350f;
        }
        .cid-badge--reprocessed {
          background: #fef2f2;
          color: #991b1b;
        }
        @keyframes cid-flash {
          0%   { opacity: 1; }
          20%  { opacity: 0.35; }
          50%  { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .cid-segment--flash {
          animation: cid-flash 0.55s ease-out;
        }
        .cid-explanation {
          font-size: 0.875rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
          line-height: 1.6;
          padding: 0.75rem 1rem;
          background: var(--color-surface, #f8f9fa);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
        }
        .cid-legend {
          display: flex;
          gap: 1rem;
          margin-bottom: 0;
        }
        .cid-legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .cid-legend-swatch {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
      `}</style>

      {/* Grouped scenario buttons */}
      {SCENARIO_GROUPS.map((group) => {
        const colors = GROUP_COLORS[group.label];
        return (
          <div key={group.label} className="cid-group">
            <div className="cid-group-header">
              <span
                className="cid-group-label"
                style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
              >
                {group.label}
              </span>
              <span className="cid-group-line" />
            </div>
            <div className="cid-tabs">
              {group.scenarios.map((sc) => (
                <button
                  key={sc.id}
                  className={`cid-tab${activeScenario.id === sc.id ? " cid-tab--active" : ""}`}
                  onClick={() => applyScenario(sc)}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Segment stack */}
      <div className="cid-stack">
        {SEGMENTS.map((seg) => {
          const status = activeScenario.statuses[seg.key];
          const isCached = status === "cached";
          const isFlashing = flashing.has(seg.key);
          const accentColor = isCached
            ? "var(--color-cache, #f59e0b)"
            : "#ef4444";

          return (
            <div
              key={seg.key}
              className={`cid-segment${isFlashing ? " cid-segment--flash" : ""}`}
              style={{ background: seg.bg }}
            >
              <div
                className="cid-segment-accent"
                style={{ background: accentColor }}
              />
              <div className="cid-segment-body">
                <div className="cid-segment-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="cid-segment-label">{seg.label}</span>
                    <span className="cid-segment-tokens">{seg.tokens}</span>
                  </div>
                  <span
                    className={`cid-badge${isCached ? " cid-badge--cached" : " cid-badge--reprocessed"}`}
                  >
                    {isCached ? "CACHED" : "MISS"}
                  </span>
                </div>
                <div className="cid-segment-detail">{seg.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend + Explanation */}
      <div className="cid-legend" style={{ marginBottom: "0.75rem" }}>
        <div className="cid-legend-item">
          <div
            className="cid-legend-swatch"
            style={{ background: "var(--color-cache, #f59e0b)" }}
          />
          Cached
        </div>
        <div className="cid-legend-item">
          <div className="cid-legend-swatch" style={{ background: "#fca5a5" }} />
          Miss
        </div>
      </div>
      <div className="cid-explanation">{activeScenario.explanation}</div>
    </div>
  );
}
