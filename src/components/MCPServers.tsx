import { useState } from "react";
import { mockServers, BASE_TOOL_TOKENS } from "../data/mcp";

// ── styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    maxWidth: 720,
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 16,
  } as React.CSSProperties,
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  } as React.CSSProperties,
  panelHeader: {
    background: "#f8f9fa",
    borderBottom: "1px solid #e5e7eb",
    padding: "8px 12px",
    fontWeight: 700,
    fontSize: "0.8rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "#374151",
  },
  panelBody: {
    padding: 12,
  } as React.CSSProperties,
  serverRow: (enabled: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "10px 0",
    borderBottom: "1px solid #f3f4f6",
    opacity: enabled ? 1 : 0.45,
    transition: "opacity 0.2s",
  }),
  serverTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,
  toggle: (enabled: boolean) => ({
    width: 36,
    height: 20,
    borderRadius: 10,
    background: enabled ? "#3b82f6" : "#d1d5db",
    border: "none",
    cursor: "pointer",
    position: "relative" as const,
    flexShrink: 0,
    transition: "background 0.2s",
  }),
  toggleThumb: (enabled: boolean) => ({
    position: "absolute" as const,
    top: 2,
    left: enabled ? 18 : 2,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "left 0.2s",
  }),
  serverName: {
    fontWeight: 600,
    color: "#111827",
    fontSize: "0.88rem",
  } as React.CSSProperties,
  badge: (transport: "stdio" | "http") => ({
    fontSize: "0.68rem",
    fontFamily: "ui-monospace, monospace",
    padding: "1px 6px",
    borderRadius: 4,
    background: transport === "stdio" ? "#e0e7ff" : "#dcfce7",
    color: transport === "stdio" ? "#3730a3" : "#166534",
    fontWeight: 600,
  }),
  serverDesc: {
    fontSize: "0.78rem",
    color: "#6b7280",
  } as React.CSSProperties,
  subToggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: 46,
    fontSize: "0.76rem",
    color: "#6b7280",
  } as React.CSSProperties,
  subToggle: (active: boolean) => ({
    width: 28,
    height: 16,
    borderRadius: 8,
    background: active ? "#ef4444" : "#d1d5db",
    border: "none",
    cursor: "pointer",
    position: "relative" as const,
    flexShrink: 0,
    transition: "background 0.2s",
  }),
  subThumb: (active: boolean) => ({
    position: "absolute" as const,
    top: 1,
    left: active ? 13 : 1,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    transition: "left 0.2s",
  }),
  toolList: {
    listStyle: "none",
    margin: "6px 0 0 46px",
    padding: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
  },
  toolItem: {
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.75rem",
    color: "#374151",
    background: "#f3f4f6",
    borderRadius: 4,
    padding: "2px 7px",
    display: "inline-block",
  } as React.CSSProperties,
  // Right panel — tool list + cache meter
  cacheBar: (pct: number, cold: boolean) => ({
    height: 18,
    borderRadius: 4,
    background: cold ? "#fca5a5" : "#fde68a",
    width: `${Math.min(pct, 100)}%`,
    transition: "width 0.4s, background 0.3s",
    minWidth: pct > 0 ? 4 : 0,
  }),
  cacheBarTrack: {
    background: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
    height: 18,
    marginBottom: 4,
  } as React.CSSProperties,
  statusBadge: (cold: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 10px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: "0.72rem",
    letterSpacing: "0.05em",
    background: cold ? "#fee2e2" : "#fef3c7",
    color: cold ? "#991b1b" : "#92400e",
    border: `1px solid ${cold ? "#fca5a5" : "#f59e0b"}`,
  }),
  dot: (cold: boolean) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: cold ? "#ef4444" : "#f59e0b",
  }),
  toolEntry: {
    padding: "5px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "0.8rem",
  } as React.CSSProperties,
  toolEntryName: {
    fontFamily: "ui-monospace, monospace",
    fontWeight: 600,
    color: "#1d4ed8",
    fontSize: "0.78rem",
  } as React.CSSProperties,
  toolEntryServer: {
    fontSize: "0.7rem",
    color: "#9ca3af",
    marginLeft: 6,
  } as React.CSSProperties,
  emptyTools: {
    color: "#9ca3af",
    fontSize: "0.82rem",
    fontStyle: "italic",
    padding: "8px 0",
  } as React.CSSProperties,
  note: {
    fontSize: "0.72rem",
    color: "#9ca3af",
    marginTop: 8,
    lineHeight: 1.5,
  } as React.CSSProperties,
};

// ── component ─────────────────────────────────────────────────────────────────
export default function MCPServers() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [updated, setUpdated] = useState<Record<string, boolean>>({});

  const toggleServer = (id: string) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // If disabling, also clear the "updated" state
      if (!next[id]) setUpdated((u) => ({ ...u, [id]: false }));
      return next;
    });
  };

  const toggleUpdated = (id: string) => {
    setUpdated((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const enabledServers = mockServers.filter((s) => enabled[s.id]);
  const anyUpdated = enabledServers.some((s) => updated[s.id]);

  const toolSegmentTokens =
    BASE_TOOL_TOKENS + enabledServers.reduce((sum, s) => sum + s.estimatedTokens, 0);

  const maxTokens = BASE_TOOL_TOKENS + mockServers.reduce((s, m) => s + m.estimatedTokens, 0);
  const barPct = (toolSegmentTokens / maxTokens) * 100;

  const cold = anyUpdated;

  const allToolEntries = enabledServers.flatMap((s) =>
    s.tools.map((t) => ({ server: s.name, tool: t }))
  );

  return (
    <div style={S.root}>
      <div style={S.grid}>
        {/* Left: server controls */}
        <div style={S.panel}>
          <div style={S.panelHeader}>Connected servers</div>
          <div style={S.panelBody}>
            {mockServers.map((srv) => {
              const on = !!enabled[srv.id];
              const upd = !!updated[srv.id];
              return (
                <div key={srv.id} style={S.serverRow(on)}>
                  <div style={S.serverTop}>
                    <button
                      style={S.toggle(on)}
                      onClick={() => toggleServer(srv.id)}
                      aria-pressed={on}
                      aria-label={`Toggle ${srv.name}`}
                    >
                      <span style={S.toggleThumb(on)} />
                    </button>
                    <span style={S.serverName}>{srv.name}</span>
                    <span style={S.badge(srv.transport)}>{srv.transport}</span>
                  </div>
                  <div style={{ ...S.serverDesc, marginLeft: 46 }}>{srv.description}</div>
                  {on && (
                    <>
                      <ul style={S.toolList}>
                        {srv.tools.map((t) => (
                          <li key={t.name}>
                            <span style={S.toolItem}>{t.name}</span>
                          </li>
                        ))}
                      </ul>
                      <div style={S.subToggleRow}>
                        <button
                          style={S.subToggle(upd)}
                          onClick={() => toggleUpdated(srv.id)}
                          aria-pressed={upd}
                          aria-label={`Simulate ${srv.name} server update`}
                        >
                          <span style={S.subThumb(upd)} />
                        </button>
                        <span style={upd ? { color: "#dc2626" } : {}}>
                          {upd ? "server updated — cache cold" : "simulate server update"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: tool list + cache meter */}
        <div style={S.panel}>
          <div style={S.panelHeader}>Host&rsquo;s merged tool list</div>
          <div style={S.panelBody}>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                  Tool-defs segment
                </span>
                <span style={S.statusBadge(cold)}>
                  <span style={S.dot(cold)} />
                  {cold ? "COLD" : "WARM"}
                </span>
              </div>
              <div style={S.cacheBarTrack}>
                <div style={S.cacheBar(barPct, cold)} />
              </div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>
                ~{toolSegmentTokens.toLocaleString()} tokens
                {cold && (
                  <span style={{ color: "#dc2626", marginLeft: 8 }}>
                    ← server update invalidated cache
                  </span>
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
              {allToolEntries.length === 0 ? (
                <div style={S.emptyTools}>No servers connected — only built-in tools.</div>
              ) : (
                allToolEntries.map(({ server, tool }) => (
                  <div key={`${server}.${tool.name}`} style={S.toolEntry}>
                    <span style={S.toolEntryName}>{tool.name}</span>
                    <span style={S.toolEntryServer}>via {server}</span>
                  </div>
                ))
              )}
            </div>

            <div style={S.note}>
              Token counts and cache state are illustrative — not real API measurements.
              Each enabled server adds its tool definitions to the segment Claude Code
              sends on every request.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
