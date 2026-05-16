// prompt-cache.ts — data for Ch 7 (07-prompt-cache.mdx)
// All data is hand-authored and illustrative — not real model output.

// ── Segment types ─────────────────────────────────────────────────────────────

export type SegmentKind =
  | "system-prompt"
  | "tools"
  | "files"
  | "history"
  | "new-turn";

export interface Segment {
  id: string;
  kind: SegmentKind;
  label: string;
  description: string;
  /** Approximate token count (illustrative) */
  tokens: number;
  /** Whether a cache breakpoint follows this segment */
  breakpoint: boolean;
}

// ── Anatomy diagram — segments of a typical Claude Code request ───────────────

export const ANATOMY_SEGMENTS: Segment[] = [
  {
    id: "system-prompt",
    kind: "system-prompt",
    label: "System prompt",
    description:
      "Claude Code's instructions and personality — stable across all turns in a session.",
    tokens: 800,
    breakpoint: true,
  },
  {
    id: "tools",
    kind: "tools",
    label: "Tool definitions",
    description:
      "Descriptions of every tool Claude Code can call (read_file, run_bash, etc.) — changes only when tools are added or updated.",
    tokens: 1200,
    breakpoint: true,
  },
  {
    id: "files",
    kind: "files",
    label: "Read files",
    description:
      "File contents Claude Code has read so far — grows as more files are opened.",
    tokens: 3500,
    breakpoint: true,
  },
  {
    id: "history",
    kind: "history",
    label: "Conversation history",
    description:
      "All prior turns in the session — grows with each exchange.",
    tokens: 600,
    breakpoint: false,
  },
  {
    id: "new-turn",
    kind: "new-turn",
    label: "New user message + tool outputs",
    description:
      "Your latest message and any fresh tool results — always new, never cached.",
    tokens: 120,
    breakpoint: false,
  },
];

// ── Request scenarios — two consecutive turns side by side ────────────────────

export type CacheStatus = "hit" | "miss" | "write";

export interface RequestSegment {
  segmentId: string;
  status: CacheStatus;
  /** Human-readable explanation shown on hover */
  statusNote: string;
}

export interface RequestScenario {
  id: string;
  label: string;
  segments: RequestSegment[];
}

/** Normal two-turn scenario: nothing changed between turns. */
export const NORMAL_SCENARIOS: RequestScenario[] = [
  {
    id: "req-1",
    label: "Request 1 — first turn",
    segments: [
      {
        segmentId: "system-prompt",
        status: "write",
        statusNote: "Cache written for the first time.",
      },
      {
        segmentId: "tools",
        status: "write",
        statusNote: "Cache written for the first time.",
      },
      {
        segmentId: "files",
        status: "write",
        statusNote: "Cache written for the first time.",
      },
      {
        segmentId: "history",
        status: "miss",
        statusNote: "No breakpoint here — processed fresh.",
      },
      {
        segmentId: "new-turn",
        status: "miss",
        statusNote: "Always fresh — your new message is never cached.",
      },
    ],
  },
  {
    id: "req-2",
    label: "Request 2 — next turn (nothing changed)",
    segments: [
      {
        segmentId: "system-prompt",
        status: "hit",
        statusNote:
          "Exact match — served from cache. Tokens skipped.",
      },
      {
        segmentId: "tools",
        status: "hit",
        statusNote:
          "Exact match — served from cache. Tokens skipped.",
      },
      {
        segmentId: "files",
        status: "hit",
        statusNote:
          "Exact match — served from cache. Tokens skipped.",
      },
      {
        segmentId: "history",
        status: "miss",
        statusNote: "No breakpoint — reprocessed. Includes last reply.",
      },
      {
        segmentId: "new-turn",
        status: "miss",
        statusNote: "Your new message — always fresh.",
      },
    ],
  },
];

/** Invalidated scenario: something in an early segment changed. */
export const INVALIDATED_SCENARIOS: RequestScenario[] = [
  {
    id: "req-1-inv",
    label: "Request 1 — first turn",
    segments: NORMAL_SCENARIOS[0].segments,
  },
  {
    id: "req-2-inv",
    label: "Request 2 — after changing a tool definition",
    segments: [
      {
        segmentId: "system-prompt",
        status: "hit",
        statusNote:
          "System prompt unchanged — still hits.",
      },
      {
        segmentId: "tools",
        status: "miss",
        statusNote:
          "Tool definition changed → prefix no longer matches. Cache cold from here.",
      },
      {
        segmentId: "files",
        status: "miss",
        statusNote:
          "Follows tools in the prefix — also cold because the match broke upstream.",
      },
      {
        segmentId: "history",
        status: "miss",
        statusNote: "No breakpoint — reprocessed as usual.",
      },
      {
        segmentId: "new-turn",
        status: "miss",
        statusNote: "Always fresh.",
      },
    ],
  },
];

// ── Invalidation toggle labels ─────────────────────────────────────────────────

export interface InvalidationToggle {
  id: string;
  label: string;
  description: string;
  /** Which segment becomes the invalidation point */
  invalidatesAt: SegmentKind;
}

export const INVALIDATION_TOGGLES: InvalidationToggle[] = [
  {
    id: "normal",
    label: "Normal turn",
    description: "Nothing changed between requests.",
    invalidatesAt: "new-turn", // nothing invalidated
  },
  {
    id: "tool-change",
    label: "Tool definition changed",
    description:
      "A tool was added, removed, or its description was edited — the prefix no longer matches from 'Tools' onward.",
    invalidatesAt: "tools",
  },
  {
    id: "system-prompt-change",
    label: "System prompt edited",
    description:
      "Any change to the system prompt breaks the cache at the very first breakpoint.",
    invalidatesAt: "system-prompt",
  },
];
