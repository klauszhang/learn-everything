import { useState } from "react";

const BLOCK_SIZE = 12;
const BLOCK_GAP = 2;
const LOOKBACK = 20;

const C_HIT   = "#f59e0b";
const C_FRESH  = "#3b82f6";
const C_MISS   = "#fca5a5";
const C_EMPTY  = "#e5e7eb";
const C_BP     = "#6366f1";
type BlockState = "hit" | "fresh" | "miss" | "empty";
type SegStatus = "write" | "hit" | "miss" | "fresh";

interface Breakpoint { after: number; label: string; }
interface LookbackWindow { start: number; end: number; }

interface SegmentInfo {
  label: string;
  status: SegStatus;
  hasBp: boolean;
}

interface TurnData {
  id: string;
  label: string;
  segments: SegmentInfo[];
  segmentNote: string;
  blockCount: number;
  blockStates: BlockState[];
  breakpoints: Breakpoint[];
  lookbackWindows: LookbackWindow[];
  explanation: string;
}

function fill(count: number, state: BlockState): BlockState[] {
  return Array(count).fill(state);
}

const SEG_STYLES: Record<SegStatus, { bg: string; border: string; color: string; badge: string; badgeBg: string }> = {
  write: { bg: "#fef9c3", border: "#eab308", color: "#854d0e", badge: "WRITE", badgeBg: "#fef9c3" },
  hit:   { bg: "#fef3c7", border: "#f59e0b", color: "#92400e", badge: "HIT",   badgeBg: "#fef3c7" },
  miss:  { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b", badge: "MISS",  badgeBg: "#fee2e2" },
  fresh: { bg: "#f3f4f6", border: "#d1d5db", color: "#6b7280", badge: "FRESH", badgeBg: "#f3f4f6" },
};

const TURNS: TurnData[] = [
  {
    id: "turn1",
    label: "Turn 1",
    segments: [
      { label: "Tools + system prompt", status: "write", hasBp: true },
      { label: "History",               status: "write", hasBp: true },
      { label: "New turn",              status: "fresh", hasBp: false },
    ],
    segmentNote: "First request — all segments written to cache at each breakpoint.",
    blockCount: 10,
    blockStates: fill(10, "hit"),
    breakpoints: [{ after: 10, label: "Cache write" }],
    lookbackWindows: [],
    explanation:
      "Turn 1 sends 10 tokens. A breakpoint is placed at block 10 and the model writes a cache entry there. All 10 blocks are now cached.",
  },
  {
    id: "turn2",
    label: "Turn 2",
    segments: [
      { label: "Tools + system prompt", status: "hit",   hasBp: true },
      { label: "History",            status: "hit",   hasBp: true },
      { label: "New turn",              status: "fresh", hasBp: false },
    ],
    segmentNote: "Nothing changed — prefix hashes match. Cached segments skipped.",
    blockCount: 20,
    blockStates: [...fill(10, "hit"), ...fill(10, "fresh")],
    breakpoints: [{ after: 20, label: "Cache write" }],
    lookbackWindows: [{ start: 1, end: 20 }],
    explanation:
      "Turn 2 sends 20 tokens. The model scans back 20 blocks from block 20 and finds the Turn 1 cache entry at block 10. Blocks 1–10 are a cache hit (amber); blocks 11–20 are computed fresh (blue).",
  },
  {
    id: "turn3miss",
    label: "Turn 3 (miss)",
    segments: [
      { label: "Tools + system prompt", status: "miss", hasBp: false },
      { label: "History",            status: "miss", hasBp: false },
      { label: "New turn",              status: "miss", hasBp: false },
    ],
    segmentNote: "Single breakpoint too far from cached entry — lookback window misses.",
    blockCount: 40,
    blockStates: fill(40, "miss"),
    breakpoints: [{ after: 40, label: "Cache write?" }],
    lookbackWindows: [{ start: 21, end: 40 }],
    explanation:
      "Turn 3 sends 40 tokens with a single breakpoint at block 40. The lookback window only covers blocks 21–40, so the Turn 2 cache entry at block 20 is outside the window. All 40 blocks are recomputed — cache miss.",
  },
  {
    id: "turn3fixed",
    label: "Turn 3 (fixed)",
    segments: [
      { label: "Tools + system prompt", status: "hit",   hasBp: true },
      { label: "History",            status: "hit",   hasBp: true },
      { label: "New turn",              status: "fresh", hasBp: false },
    ],
    segmentNote: "Anchor breakpoint keeps the prefix inside the lookback window.",
    blockCount: 40,
    blockStates: [...fill(20, "hit"), ...fill(20, "fresh")],
    breakpoints: [
      { after: 20, label: "Anchor" },
      { after: 40, label: "Cache write" },
    ],
    lookbackWindows: [{ start: 1, end: 20 }],
    explanation:
      "With a second breakpoint placed at block 20, the model scans back from block 20 and finds the Turn 2 entry. Blocks 1–20 are a cache hit (amber); blocks 21–40 are fresh (blue). The anchor breakpoint keeps the prefix inside the window.",
  },
];

function blockColor(state: BlockState): string {
  switch (state) {
    case "hit":   return C_HIT;
    case "fresh": return C_FRESH;
    case "miss":  return C_MISS;
    case "empty": return C_EMPTY;
  }
}

function SegmentRow({ segments }: { segments: SegmentInfo[] }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
      {segments.map((seg, i) => {
        const s = SEG_STYLES[seg.status];
        return (
          <span key={i} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.3rem 0.65rem",
            borderRadius: "4px",
            fontSize: "0.78rem",
            fontFamily: "var(--font-mono, monospace)",
            background: s.bg,
            border: `1.5px solid ${s.border}`,
            color: s.color,
            whiteSpace: "nowrap",
          }}>
            {seg.label}
            {seg.status === "hit" && " ✓"}
            {seg.status === "miss" && " ✗"}
            {seg.hasBp && (
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: C_BP, marginLeft: "0.15rem" }}>▼ BP</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function BlockRow({ turn }: { turn: TurnData }) {
  const bpSet = new Set(turn.breakpoints.map((b) => b.after));
  const windowSet = new Set<number>();
  for (const w of turn.lookbackWindows) {
    for (let i = w.start; i <= w.end; i++) windowSet.add(i);
  }

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: `${BLOCK_GAP}px`,
      alignItems: "center",
      padding: "0.5rem 0",
    }}>
      {Array.from({ length: turn.blockCount }, (_, i) => {
        const blockNum = i + 1;
        const state = turn.blockStates[i];
        const hasBp = bpSet.has(blockNum);
        const inWindow = windowSet.has(blockNum);

        return (
          <span key={blockNum} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <span
              style={{
                display: "inline-block",
                width: `${BLOCK_SIZE}px`,
                height: `${BLOCK_SIZE}px`,
                borderRadius: "2px",
                backgroundColor: blockColor(state),
                flexShrink: 0,
                boxShadow: inWindow ? `0 0 0 1px ${C_FRESH}` : "none",
              }}
              title={`Block ${blockNum}: ${state}`}
            />
            {hasBp && (
              <span
                style={{
                  display: "inline-block",
                  width: "3px",
                  height: `${BLOCK_SIZE + 4}px`,
                  backgroundColor: C_BP,
                  borderRadius: "1px",
                  marginLeft: `${BLOCK_GAP}px`,
                  flexShrink: 0,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "1rem",
      marginTop: "1.25rem",
      paddingTop: "0.75rem",
      borderTop: "1px solid #e5e7eb",
      fontSize: "0.78rem",
      color: "#6b7280",
    }}>
      {[
        { color: "#fef9c3", border: "#eab308", label: "Cache write" },
        { color: "#fef3c7", border: C_HIT,     label: "Cache hit" },
        { color: C_FRESH,   border: C_FRESH,   label: "Fresh" },
        { color: "#fee2e2", border: "#fca5a5",  label: "Cache miss" },
      ].map(({ color, border, label }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", backgroundColor: color, border: `1.5px solid ${border}`, flexShrink: 0 }} />
          {label}
        </span>
      ))}
      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <span style={{ display: "inline-block", width: "3px", height: "14px", backgroundColor: C_BP, borderRadius: "1px", flexShrink: 0 }} />
        Breakpoint
      </span>
    </div>
  );
}

export default function PrefixMatchDemo() {
  const [activeId, setActiveId] = useState<string>(TURNS[0].id);
  const turn = TURNS.find((t) => t.id === activeId) ?? TURNS[0];

  const isSuccess = activeId === "turn3fixed";
  const isMiss    = activeId === "turn3miss";

  return (
    <div style={{
      fontFamily: "var(--font-body, sans-serif)",
      maxWidth: "var(--content-max, 720px)",
      padding: "1.5rem 0",
    }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }} role="tablist">
        {TURNS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeId}
            onClick={() => setActiveId(t.id)}
            style={{
              padding: "0.3rem 0.9rem",
              borderRadius: "9999px",
              border: `1px solid ${t.id === activeId ? "#6366f1" : "#e5e7eb"}`,
              background: t.id === activeId ? "#6366f1" : "#f8f9fa",
              color: t.id === activeId ? "#fff" : "#6b7280",
              fontFamily: "var(--font-body, sans-serif)",
              fontSize: "0.85rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Segment-level diagram */}
      <SegmentRow segments={turn.segments} />

      <div style={{
        fontSize: "0.78rem",
        color: "#6b7280",
        marginBottom: "1rem",
        paddingLeft: "0.25rem",
      }}>
        {turn.segmentNote}
      </div>

      {/* Block-level detail */}
      <div style={{
        padding: "0.75rem 1rem",
        background: "#fafafa",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
      }}>
        <div style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.72rem",
          color: "#6b7280",
          marginBottom: "0.25rem",
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.04em",
        }}>
          Token-level view — {turn.blockCount} blocks
        </div>

        <BlockRow turn={turn} />

        {/* Lookback window note */}
        {turn.lookbackWindows.length > 0 && (
          <div style={{
            fontSize: "0.75rem",
            color: "#6b7280",
            fontFamily: "var(--font-mono, monospace)",
            marginTop: "0.25rem",
          }}>
            Lookback window ({LOOKBACK} blocks):{" "}
            {turn.lookbackWindows.map((w, i) => (
              <span key={i}>
                blocks {w.start}–{w.end}
                {i < turn.lookbackWindows.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}

        {/* Breakpoint labels */}
        {turn.breakpoints.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            {turn.breakpoints.map((bp) => (
              <span key={bp.after} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.72rem",
                color: C_BP,
                fontFamily: "var(--font-mono, monospace)",
              }}>
                <span style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: C_BP,
                  flexShrink: 0,
                }} />
                block {bp.after}: {bp.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Explanation */}
      <div style={{
        marginTop: "1rem",
        padding: "0.75rem 1rem",
        borderRadius: "6px",
        border: `1px solid ${isMiss ? "#fca5a5" : isSuccess ? "#86efac" : "#e5e7eb"}`,
        background: isMiss ? "#fff5f5" : isSuccess ? "#f0fdf4" : "#f8f9fa",
        fontSize: "0.9rem",
        lineHeight: 1.55,
        color: "#374151",
      }}>
        {turn.explanation}
      </div>

      <Legend />
    </div>
  );
}
