// src/data/streaming.ts
// Hand-authored, illustrative SSE event streams for the streaming chapter demo.
// No real API calls — all timing and content is crafted for pedagogical clarity.

export interface SseEvent {
  timestampOffsetMs: number;
  eventType: string;
  data: Record<string, unknown>;
  annotation?: string;
}

// ─── Text-only stream ────────────────────────────────────────────────────────
// TTFT ~600ms, then decode at ~60 tokens/sec pace.
// Chunking matches realistic subword granularity (partial words, punctuation).

export const textOnlyStream: SseEvent[] = [
  {
    timestampOffsetMs: 0,
    eventType: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: 'msg_01ABCDtext',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 18, output_tokens: 1 },
      },
    },
    annotation: 'Prefill complete — first token on the way',
  },
  {
    timestampOffsetMs: 620,
    eventType: 'content_block_start',
    data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    annotation: 'Text block opens',
  },
  {
    timestampOffsetMs: 635,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'The' } },
  },
  {
    timestampOffsetMs: 655,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' sky' } },
  },
  {
    timestampOffsetMs: 675,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' is' } },
  },
  {
    timestampOffsetMs: 695,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' blue' } },
  },
  {
    timestampOffsetMs: 730,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' and' } },
  },
  {
    timestampOffsetMs: 760,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' clear' } },
  },
  {
    timestampOffsetMs: 790,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' today' } },
  },
  {
    timestampOffsetMs: 820,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '.' } },
  },
  {
    timestampOffsetMs: 860,
    eventType: 'content_block_stop',
    data: { type: 'content_block_stop', index: 0 },
    annotation: 'Text block closes',
  },
  {
    timestampOffsetMs: 880,
    eventType: 'message_delta',
    data: {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 9 },
    },
    annotation: 'stop_reason: "end_turn" — generation complete',
  },
  {
    timestampOffsetMs: 900,
    eventType: 'message_stop',
    data: { type: 'message_stop' },
    annotation: 'Stream closed',
  },
];

// ─── Tool-use stream ─────────────────────────────────────────────────────────
// Shows text block → gap (model deciding to call tool) → tool_use block.
// input_json_delta fragments use realistic subword chunking.

export const toolUseStream: SseEvent[] = [
  {
    timestampOffsetMs: 0,
    eventType: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: 'msg_01ABCDtool',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 42, output_tokens: 1 },
      },
    },
    annotation: 'Prefill complete',
  },
  {
    timestampOffsetMs: 580,
    eventType: 'content_block_start',
    data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    annotation: 'Text block opens (index 0)',
  },
  {
    timestampOffsetMs: 595,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: "I'll" } },
  },
  {
    timestampOffsetMs: 615,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' look' } },
  },
  {
    timestampOffsetMs: 640,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' that' } },
  },
  {
    timestampOffsetMs: 660,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' up.' } },
  },
  {
    timestampOffsetMs: 690,
    eventType: 'content_block_stop',
    data: { type: 'content_block_stop', index: 0 },
    annotation: 'Text block closes',
  },
  {
    timestampOffsetMs: 1190,
    eventType: 'content_block_start',
    data: {
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_01XYZ', name: 'extract_contact', input: {} },
    },
    annotation: '~500ms gap — model generating tokens that form the tool call decision',
  },
  {
    timestampOffsetMs: 1210,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"' },
    },
    annotation: 'JSON accumulation begins — do NOT parse yet',
  },
  {
    timestampOffsetMs: 1230,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: 'name' },
    },
  },
  {
    timestampOffsetMs: 1250,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '": "' },
    },
  },
  {
    timestampOffsetMs: 1280,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: 'Jane' },
    },
  },
  {
    timestampOffsetMs: 1300,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: ' Doe' },
    },
  },
  {
    timestampOffsetMs: 1325,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '", "' },
    },
  },
  {
    timestampOffsetMs: 1350,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: 'email' },
    },
  },
  {
    timestampOffsetMs: 1375,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '": "' },
    },
  },
  {
    timestampOffsetMs: 1405,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: 'jane' },
    },
  },
  {
    timestampOffsetMs: 1430,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '@' },
    },
  },
  {
    timestampOffsetMs: 1455,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: 'example' },
    },
  },
  {
    timestampOffsetMs: 1480,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '.com' },
    },
  },
  {
    timestampOffsetMs: 1510,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '"}' },
    },
  },
  {
    timestampOffsetMs: 1540,
    eventType: 'content_block_stop',
    data: { type: 'content_block_stop', index: 1 },
    annotation: 'Tool block closes — safe to JSON.parse() now',
  },
  {
    timestampOffsetMs: 1560,
    eventType: 'message_delta',
    data: {
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' },
      usage: { output_tokens: 28 },
    },
    annotation: 'stop_reason: "tool_use" — execute the tool and send results',
  },
  {
    timestampOffsetMs: 1580,
    eventType: 'message_stop',
    data: { type: 'message_stop' },
  },
];

// ─── Thinking stream ──────────────────────────────────────────────────────────
// thinking block (index 0) fully closes before text block (index 1) opens.
// signature_delta arrives just before content_block_stop on the thinking block.

export const thinkingStream: SseEvent[] = [
  {
    timestampOffsetMs: 0,
    eventType: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: 'msg_01ABCDthink',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 35, output_tokens: 1 },
      },
    },
    annotation: 'Prefill complete',
  },
  {
    timestampOffsetMs: 700,
    eventType: 'content_block_start',
    data: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    annotation: 'Thinking block opens (index 0) — always before text',
  },
  {
    timestampOffsetMs: 720,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'The user is asking' } },
  },
  {
    timestampOffsetMs: 760,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: ' about streaming. Let me' } },
  },
  {
    timestampOffsetMs: 810,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: ' think through the SSE event types...' } },
  },
  {
    timestampOffsetMs: 920,
    eventType: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'signature_delta',
        signature: 'ErUBCkYIBBgCIkDx7mN2pQs8vLkJ3hWzYqR9fT0aOmCb5nXdKlPwVeGuHrMjSiA1yZ4cBoDtNpFlQwUvXhYkJmRsETgZnO2d',
      },
    },
    annotation: 'Cryptographic integrity token — store, do not render',
  },
  {
    timestampOffsetMs: 940,
    eventType: 'content_block_stop',
    data: { type: 'content_block_stop', index: 0 },
    annotation: 'Thinking block closes',
  },
  {
    timestampOffsetMs: 960,
    eventType: 'content_block_start',
    data: { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    annotation: 'Text block opens (index 1) — always after thinking',
  },
  {
    timestampOffsetMs: 975,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Stream' } },
  },
  {
    timestampOffsetMs: 1000,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'ing' } },
  },
  {
    timestampOffsetMs: 1025,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' delivers' } },
  },
  {
    timestampOffsetMs: 1055,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' tokens' } },
  },
  {
    timestampOffsetMs: 1080,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' as they' } },
  },
  {
    timestampOffsetMs: 1110,
    eventType: 'content_block_delta',
    data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' are generated.' } },
  },
  {
    timestampOffsetMs: 1145,
    eventType: 'content_block_stop',
    data: { type: 'content_block_stop', index: 1 },
  },
  {
    timestampOffsetMs: 1165,
    eventType: 'message_delta',
    data: {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 22 },
    },
    annotation: 'stop_reason: "end_turn"',
  },
  {
    timestampOffsetMs: 1180,
    eventType: 'message_stop',
    data: { type: 'message_stop' },
  },
];

// ─── Sample tool definition (for prose reference) ────────────────────────────

export const sampleOutputTool = {
  name: 'extract_contact',
  description: 'Extract structured contact information from text.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Full name.' },
      email: { type: 'string', description: 'Email address.' },
      company: { type: 'string', description: 'Company or organization.' },
    },
    required: ['name', 'email'],
    additionalProperties: false,
  },
};

// ─── Sample outputs (shape vs. content illustration) ─────────────────────────

export const conformantOutput = { name: 'Jane Doe', email: 'jane@example.com' };

export const nonConformantOutput = {
  full_name: 'Jane Doe',   // wrong field name
  mail: 'jane@example.com', // wrong field name — required "email" missing
};

export const semanticallyWrongOutput = {
  name: 'Jane Doe',
  email: 'UNKNOWN',         // schema-valid string; content is wrong
  company: 'N/A',           // schema-valid string; content is wrong
};
