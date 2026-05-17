// extended-thinking.ts — hand-authored illustrative data for the extended-thinking chapter.
// None of this data comes from a real API call.
// All latency values, token counts, and response text are illustrative for teaching purposes.

export type EffortLevel = "none" | "low" | "medium" | "high";

export interface ThinkingExample {
  effort: EffortLevel;
  label: string;
  apiMode: string;
  thinkingTokens: number;
  answerTokens: number;
  /** Illustrative wall-clock latency in milliseconds before first answer token */
  latencyMs: number;
  /** Cost at Opus 4.7 rates ($25/MTok output). Illustrative. */
  costCents: number;
  thinkingText: string | null;
  answerText: string;
}

// Sample problem: multi-step math
export const SAMPLE_PROBLEM =
  "A train leaves City A at 9:00 AM traveling at 60 mph. Another train leaves City B (240 miles away) at 10:00 AM traveling at 80 mph toward City A. At what time do they meet?";

export const THINKING_EXAMPLES: ThinkingExample[] = [
  {
    effort: "none",
    label: "No thinking",
    apiMode: 'thinking: { type: "disabled" }',
    thinkingTokens: 0,
    answerTokens: 22,
    latencyMs: 400,
    costCents: 0.06,
    thinkingText: null,
    answerText:
      "The trains meet at approximately 11:24 AM. (Distance covered by Train A before they meet is about 144 miles.)",
  },
  {
    effort: "low",
    label: "Low effort",
    apiMode: 'thinking: { type: "adaptive" }, output_config: { effort: "low" }',
    thinkingTokens: 180,
    answerTokens: 30,
    latencyMs: 1800,
    costCents: 0.53,
    thinkingText:
      "Train A departs 9 AM at 60 mph. Train B departs 10 AM at 80 mph, 240 miles away.\n\nAt 10 AM, Train A has traveled 60 miles, so gap is 180 miles.\nCombined speed = 60 + 80 = 140 mph.\nTime to close: 180 / 140 ≈ 1.286 hours ≈ 1h 17m.\n10:00 AM + 1h 17m = 11:17 AM.",
    answerText:
      "The trains meet at approximately 11:17 AM. By 10 AM Train A has covered 60 miles, leaving 180 miles between them. Closing at 140 mph combined, they close that gap in about 1 hour 17 minutes.",
  },
  {
    effort: "medium",
    label: "Medium effort",
    apiMode: 'thinking: { type: "adaptive" }, output_config: { effort: "medium" }',
    thinkingTokens: 520,
    answerTokens: 48,
    latencyMs: 4200,
    costCents: 1.42,
    thinkingText:
      "Let me set up the problem carefully.\n\nTrain A: departs City A at 9:00 AM, speed 60 mph.\nTrain B: departs City B at 10:00 AM, speed 80 mph toward City A. Distance A→B = 240 miles.\n\nBy 10:00 AM (when Train B departs), Train A has already traveled 1 hour × 60 mph = 60 miles.\nRemaining gap at 10:00 AM: 240 − 60 = 180 miles.\n\nAfter 10:00 AM, trains approach each other:\n  Combined closing speed = 60 + 80 = 140 mph\n  Time to meet: 180 ÷ 140 = 9/7 hours ≈ 1.2857 hours\n  = 1 hour 17 minutes 8 seconds ≈ 1 hour 17 minutes\n\nMeeting time: 10:00 AM + 1h 17m = 11:17 AM.\n\nVerification:\n  Train A total distance: 2h 17m × 60 mph = 137 miles from City A.\n  Train B total distance: 1h 17m × 80 mph ≈ 103 miles from City B.\n  137 + 103 = 240 ✓",
    answerText:
      "The trains meet at **11:17 AM**.\n\nAt 10:00 AM, Train A has already traveled 60 miles, leaving 180 miles between the trains. They close that gap at a combined 140 mph, meeting after about 1 hour and 17 minutes. Verification: Train A covers 137 miles from City A; Train B covers 103 miles from City B — total 240 miles. ✓",
  },
  {
    effort: "high",
    label: "High effort",
    apiMode: 'thinking: { type: "adaptive" }, output_config: { effort: "high" }',
    thinkingTokens: 1240,
    answerTokens: 68,
    latencyMs: 9800,
    costCents: 3.27,
    thinkingText:
      "Setting up systematically.\n\nGiven:\n  City A to City B distance: 240 miles\n  Train A: departs City A at t=0 (9:00 AM), speed 60 mph\n  Train B: departs City B at t=1h (10:00 AM), speed 80 mph toward City A\n\nLet t = hours after 9:00 AM.\n\nTrain A position: x_A(t) = 60t  (measuring from City A)\nTrain B position: x_B(t) = 240 − 80(t−1) for t ≥ 1\n\nMeeting condition: x_A(t) = x_B(t)\n  60t = 240 − 80(t−1)\n  60t = 240 − 80t + 80\n  60t = 320 − 80t\n  140t = 320\n  t = 320/140 = 32/14 = 16/7 hours\n  = 2 hours 17 minutes 8.57 seconds\n  ≈ 2 hours 17 minutes after 9:00 AM\n  = 11:17 AM\n\nVerification:\n  x_A(16/7) = 60 × 16/7 = 960/7 ≈ 137.14 miles from A\n  x_B(16/7) = 240 − 80(16/7 − 1) = 240 − 80(9/7) = 240 − 720/7 = (1680−720)/7 = 960/7 ≈ 137.14 miles from A ✓\n\nEdge-case check: Do the trains pass each other before t=1? No — Train B hasn't departed yet.\nDoes Train A overshoot City B before they meet? x_A at t=1: 60 miles (well short of 240). ✓\n\nExact meeting time: 9:00 AM + 16/7 h = 9:00 AM + 2h 17m 8.57s ≈ 11:17 AM.",
    answerText:
      "The trains meet at **11:17 AM** (exactly 2 hours and ~17 minutes after 9:00 AM, or 16/7 hours).\n\nSetting Train A's position as `60t` and Train B's as `240 − 80(t−1)` (for t ≥ 1 hour), setting them equal gives `t = 16/7 ≈ 2.286 hours` after 9 AM — i.e., 11:17 AM. Both trains are then 960/7 ≈ 137.1 miles from City A, summing to exactly 240 miles. ✓",
  },
];

// Cache interaction scenario data
export interface CacheScenario {
  label: string;
  request: string;
  budgetTokens: number | null;
  systemCacheHit: boolean;
  messageCacheHit: boolean;
  note: string;
}

export const CACHE_SCENARIOS: CacheScenario[] = [
  {
    label: "Request 1 — warm-up",
    request: 'thinking: { type: "enabled", budget_tokens: 4000 }',
    budgetTokens: 4000,
    systemCacheHit: false,
    messageCacheHit: false,
    note: "First request. Nothing is cached yet.",
  },
  {
    label: "Request 2 — same budget",
    request: 'thinking: { type: "enabled", budget_tokens: 4000 }',
    budgetTokens: 4000,
    systemCacheHit: true,
    messageCacheHit: true,
    note: "Same budget_tokens. Both system prompt and message cache hit.",
  },
  {
    label: "Request 3 — budget changed",
    request: 'thinking: { type: "enabled", budget_tokens: 8000 }',
    budgetTokens: 8000,
    systemCacheHit: true,
    messageCacheHit: false,
    note:
      "budget_tokens changed to 8000. System prompt cache survives. Message-block cache invalidated — silent miss.",
  },
];
