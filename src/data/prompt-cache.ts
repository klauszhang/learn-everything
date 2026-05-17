// prompt-cache.ts — data for Part II Ch 3 (07-prompt-cache.mdx)
// All data is hand-authored and illustrative — not real model output.

export type SegmentKind =
  | "system-prompt"
  | "tools"
  | "history"
  | "new-turn";

export interface Segment {
  id: string;
  kind: SegmentKind;
  label: string;
  description: string;
  tokens: number;
  breakpoint: boolean;
}

export const ANATOMY_SEGMENTS: Segment[] = [
  {
    id: "tools",
    kind: "tools",
    label: "Tool definitions",
    description:
      "Descriptions of every tool the model can call — first in the token stream. Changes here invalidate the entire cache.",
    tokens: 1200,
    breakpoint: true,
  },
  {
    id: "system-prompt",
    kind: "system-prompt",
    label: "System prompt",
    description:
      "Instructions and personality — stable across all turns in a session.",
    tokens: 800,
    breakpoint: true,
  },
  {
    id: "history",
    kind: "history",
    label: "Conversation history",
    description:
      "All prior turns, tool calls, and their results — unchanged turns are part of the cached prefix.",
    tokens: 2000,
    breakpoint: false,
  },
  {
    id: "new-turn",
    kind: "new-turn",
    label: "New message",
    description:
      "Your latest message — always new, never cached.",
    tokens: 120,
    breakpoint: false,
  },
];

export type CacheStatus = "hit" | "miss" | "write";

export interface RequestSegment {
  segmentId: string;
  status: CacheStatus;
  statusNote: string;
}

export interface RequestScenario {
  id: string;
  label: string;
  segments: RequestSegment[];
}

export const NORMAL_SCENARIOS: RequestScenario[] = [
  {
    id: "req-1",
    label: "Request 1 — first turn",
    segments: [
      { segmentId: "tools", status: "write", statusNote: "Cache written for the first time." },
      { segmentId: "system-prompt", status: "write", statusNote: "Cache written for the first time." },
      { segmentId: "history", status: "miss", statusNote: "No history yet — processed fresh." },
      { segmentId: "new-turn", status: "miss", statusNote: "Always fresh." },
    ],
  },
  {
    id: "req-2",
    label: "Request 2 — next turn (nothing changed)",
    segments: [
      { segmentId: "tools", status: "hit", statusNote: "Exact match — served from cache." },
      { segmentId: "system-prompt", status: "hit", statusNote: "Exact match — served from cache." },
      { segmentId: "history", status: "hit", statusNote: "Previous turns unchanged — cache hit." },
      { segmentId: "new-turn", status: "miss", statusNote: "Always fresh." },
    ],
  },
];

export const TOOL_CHANGED_SCENARIOS: RequestScenario[] = [
  {
    id: "req-1-tool",
    label: "Request 1 — first turn",
    segments: NORMAL_SCENARIOS[0].segments,
  },
  {
    id: "req-2-tool",
    label: "Request 2 — after changing a tool",
    segments: [
      { segmentId: "tools", status: "miss", statusNote: "Tool changed — prefix broken. Everything downstream is cold." },
      { segmentId: "system-prompt", status: "miss", statusNote: "Cold — prefix broke upstream at tools." },
      { segmentId: "history", status: "miss", statusNote: "Cold — prefix broke upstream." },
      { segmentId: "new-turn", status: "miss", statusNote: "Always fresh." },
    ],
  },
];

export const SYSTEM_CHANGED_SCENARIOS: RequestScenario[] = [
  {
    id: "req-1-sys",
    label: "Request 1 — first turn",
    segments: NORMAL_SCENARIOS[0].segments,
  },
  {
    id: "req-2-sys",
    label: "Request 2 — after editing system prompt",
    segments: [
      { segmentId: "tools", status: "hit", statusNote: "Tools unchanged — still a cache hit." },
      { segmentId: "system-prompt", status: "miss", statusNote: "System prompt edited — prefix breaks here." },
      { segmentId: "history", status: "miss", statusNote: "Cold — prefix broke upstream." },
      { segmentId: "new-turn", status: "miss", statusNote: "Always fresh." },
    ],
  },
];

export interface InvalidationToggle {
  id: string;
  label: string;
  description: string;
  invalidatesAt: SegmentKind;
}

export const INVALIDATION_TOGGLES: InvalidationToggle[] = [
  {
    id: "normal",
    label: "Normal turn",
    description: "Nothing changed between requests. Previous turns are part of the cached prefix.",
    invalidatesAt: "new-turn",
  },
  {
    id: "tool-change",
    label: "Tool changed",
    description:
      "A tool was added, removed, or reworded. Tools are first in the token stream — this breaks the entire cache.",
    invalidatesAt: "tools",
  },
  {
    id: "system-prompt-change",
    label: "System prompt edited",
    description:
      "Tools unchanged (still cached), but the system prompt changed — cache breaks from that point onward.",
    invalidatesAt: "system-prompt",
  },
];
