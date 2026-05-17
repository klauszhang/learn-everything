// SSEStream.tsx — interactive SSE event stream player.
// Three scenarios: plain text, tool use, and thinking. Play/pause/step controls.
// Toggle thinking on/off, tool_use on/off. Illustrative — no real API calls.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  textOnlyStream,
  toolUseStream,
  thinkingStream,
  type SseEvent,
} from '../data/streaming';

// ─── Types ───────────────────────────────────────────────────────────────────

type Scenario = 'text' | 'tool' | 'thinking';

interface BlockAcc {
  type: 'text' | 'tool_use' | 'thinking';
  textAcc: string;
  jsonAcc: string;
  parsed: Record<string, unknown> | null;
  parseError: string | null;
  closed: boolean;
}

interface PlayerState {
  events: SseEvent[];             // full rendered event log so far
  blocks: Record<number, BlockAcc>; // index → accumulator
  stopReason: string | null;
  complete: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<Scenario, string> = {
  text: 'Plain text',
  tool: 'Tool call',
  thinking: 'With thinking',
};

const STREAMS: Record<Scenario, SseEvent[]> = {
  text: textOnlyStream,
  tool: toolUseStream,
  thinking: thinkingStream,
};

const EVENT_COLOR: Record<string, string> = {
  message_start: '#3b82f6',
  message_delta: '#3b82f6',
  message_stop: '#3b82f6',
  content_block_start: '#22c55e',
  content_block_stop: '#22c55e',
  content_block_delta: '#6b7280', // overridden per delta type below
  ping: '#9ca3af',
  error: '#ef4444',
};

function getDeltaColor(event: SseEvent): string {
  const delta = (event.data as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
  const dtype = delta?.type as string | undefined;
  if (dtype === 'text_delta') return '#f59e0b';      // amber — not cache amber, just visible
  if (dtype === 'input_json_delta') return '#f97316'; // orange
  if (dtype === 'thinking_delta') return '#a855f7';   // purple
  if (dtype === 'signature_delta') return '#6b7280';  // grey — crypto token, not text
  return '#6b7280';
}

function getEventColor(event: SseEvent): string {
  if (event.eventType === 'content_block_delta') return getDeltaColor(event);
  return EVENT_COLOR[event.eventType] ?? '#6b7280';
}

function deltaLabel(event: SseEvent): string {
  const delta = (event.data as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
  if (!delta) return event.eventType;
  const dtype = delta.type as string;
  if (dtype === 'text_delta') return `text_delta`;
  if (dtype === 'input_json_delta') return `input_json_delta`;
  if (dtype === 'thinking_delta') return `thinking_delta`;
  if (dtype === 'signature_delta') return `signature_delta`;
  return event.eventType;
}

function eventLabel(event: SseEvent): string {
  if (event.eventType === 'content_block_delta') return deltaLabel(event);
  return event.eventType;
}

function previewData(event: SseEvent): string {
  const d = event.data as Record<string, unknown>;
  const delta = d?.delta as Record<string, unknown> | undefined;
  if (delta) {
    const dtype = delta.type as string;
    if (dtype === 'text_delta') return `"${String(delta.text ?? '').slice(0, 30)}"`;
    if (dtype === 'input_json_delta') return `"${String(delta.partial_json ?? '').slice(0, 30)}"`;
    if (dtype === 'thinking_delta') return `"${String(delta.thinking ?? '').slice(0, 30)}"`;
    if (dtype === 'signature_delta') return `sig(${String(delta.signature ?? '').slice(0, 16)}…)`;
  }
  const cb = d?.content_block as Record<string, unknown> | undefined;
  if (cb?.type) return `type:"${cb.type}"`;
  const msg = d?.message as Record<string, unknown> | undefined;
  if (msg?.usage) {
    const u = msg.usage as Record<string, unknown>;
    return `input_tokens:${u.input_tokens}`;
  }
  const dd = d?.delta as Record<string, unknown> | undefined;
  if (dd?.stop_reason) return `stop_reason:"${dd.stop_reason}"`;
  if (d?.type === 'message_stop') return '';
  return '';
}

function applyEvent(state: PlayerState, event: SseEvent): PlayerState {
  const d = event.data as Record<string, unknown>;
  const newBlocks = { ...state.blocks };

  if (event.eventType === 'content_block_start') {
    const idx = d.index as number;
    const cb = d.content_block as Record<string, unknown>;
    newBlocks[idx] = {
      type: cb.type as 'text' | 'tool_use' | 'thinking',
      textAcc: '',
      jsonAcc: '',
      parsed: null,
      parseError: null,
      closed: false,
    };
  } else if (event.eventType === 'content_block_delta') {
    const idx = d.index as number;
    const delta = d.delta as Record<string, unknown>;
    const block = { ...(newBlocks[idx] ?? { type: 'text', textAcc: '', jsonAcc: '', parsed: null, parseError: null, closed: false }) };
    if (delta.type === 'text_delta') block.textAcc += String(delta.text ?? '');
    if (delta.type === 'thinking_delta') block.textAcc += String(delta.thinking ?? '');
    if (delta.type === 'input_json_delta') block.jsonAcc += String(delta.partial_json ?? '');
    newBlocks[idx] = block;
  } else if (event.eventType === 'content_block_stop') {
    const idx = d.index as number;
    if (newBlocks[idx]) {
      const block = { ...newBlocks[idx] };
      block.closed = true;
      if (block.type === 'tool_use') {
        try {
          block.parsed = JSON.parse(block.jsonAcc) as Record<string, unknown>;
        } catch (e) {
          block.parseError = String((e as Error).message);
        }
      }
      newBlocks[idx] = block;
    }
  }

  const msgDelta = d?.delta as Record<string, unknown> | undefined;
  const stopReason = event.eventType === 'message_delta' ? (msgDelta?.stop_reason as string ?? null) : state.stopReason;
  const complete = event.eventType === 'message_stop';

  return {
    events: [...state.events, event],
    blocks: newBlocks,
    stopReason,
    complete,
  };
}

const EMPTY_STATE: PlayerState = { events: [], blocks: {}, stopReason: null, complete: false };

// ─── Component ───────────────────────────────────────────────────────────────

export default function SSEStream() {
  const [scenario, setScenario] = useState<Scenario>('tool');
  const [speed, setSpeed] = useState<number>(1);
  const [playing, setPlaying] = useState<boolean>(false);
  const [cursor, setCursor] = useState<number>(0);
  const [playerState, setPlayerState] = useState<PlayerState>(EMPTY_STATE);

  const streamRef = useRef(STREAMS[scenario]);
  const cursorRef = useRef(cursor);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep refs in sync
  cursorRef.current = cursor;
  playingRef.current = playing;
  speedRef.current = speed;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
    setCursor(0);
    setPlayerState(EMPTY_STATE);
  }, []);

  // When scenario changes, reset
  useEffect(() => {
    streamRef.current = STREAMS[scenario];
    reset();
  }, [scenario, reset]);

  // Scheduling logic
  const scheduleNext = useCallback((fromCursor: number, fromState: PlayerState) => {
    const stream = streamRef.current;
    if (fromCursor >= stream.length) {
      setPlaying(false);
      return;
    }
    const current = stream[fromCursor];
    const next = stream[fromCursor + 1];
    const delay = next ? (next.timestampOffsetMs - current.timestampOffsetMs) / speedRef.current : 300;

    timerRef.current = setTimeout(() => {
      if (!playingRef.current) return;
      const newCursor = fromCursor + 1;
      if (newCursor >= stream.length) {
        // apply last event
        const newState = applyEvent(fromState, stream[newCursor - 1]);
        setPlayerState(newState);
        setCursor(newCursor);
        setPlaying(false);
        return;
      }
      const newState = applyEvent(fromState, stream[newCursor]);
      setPlayerState(newState);
      setCursor(newCursor);
      scheduleNext(newCursor, newState);
    }, Math.max(delay, 80));
  }, []);

  // When playing turns on, start advancing
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    const stream = streamRef.current;
    if (cursorRef.current >= stream.length) {
      setPlaying(false);
      return;
    }
    // Apply the first event at cursor if cursor=0 and no events yet
    if (cursorRef.current === 0 && playerState.events.length === 0) {
      const newState = applyEvent(EMPTY_STATE, stream[0]);
      setPlayerState(newState);
      setCursor(1);
      scheduleNext(1, newState);
    } else {
      scheduleNext(cursorRef.current, playerState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handleStep = () => {
    if (playing) return;
    const stream = streamRef.current;
    const c = cursorRef.current;
    if (c >= stream.length) return;
    const newState = applyEvent(playerState, stream[c]);
    setPlayerState(newState);
    setCursor(c + 1);
  };

  const handlePlayPause = () => {
    const stream = streamRef.current;
    if (cursorRef.current >= stream.length && !playing) {
      // restart
      reset();
      return;
    }
    setPlaying(p => !p);
  };

  const stream = STREAMS[scenario];
  const done = cursor >= stream.length;
  const hasToolBlock = Object.values(playerState.blocks).some(b => b.type === 'tool_use');
  const hasThinkingBlock = Object.values(playerState.blocks).some(b => b.type === 'thinking');

  return (
    <div className="sse-player">
      {/* Controls row */}
      <div className="sse-controls">
        <div className="sse-scenario-btns">
          {(Object.keys(SCENARIO_LABELS) as Scenario[]).map(s => (
            <button
              key={s}
              className={`sse-btn-scenario ${scenario === s ? 'sse-btn-scenario--active' : ''}`}
              onClick={() => setScenario(s)}
            >
              {SCENARIO_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="sse-playbar">
          <button className="sse-btn-play" onClick={handlePlayPause} disabled={false}>
            {playing ? '⏸ Pause' : done ? '↺ Restart' : cursor === 0 ? '▶ Play' : '▶ Resume'}
          </button>
          <button className="sse-btn-step" onClick={handleStep} disabled={playing || done}>
            Step →
          </button>
          <button className="sse-btn-reset" onClick={reset}>Reset</button>
          <label className="sse-speed-label">
            Speed
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="sse-speed-slider"
            />
            <span className="sse-speed-val">{speed}×</span>
          </label>
        </div>
      </div>

      {/* Progress bar */}
      <div className="sse-progress-track">
        <div
          className="sse-progress-fill"
          style={{ width: `${stream.length ? (cursor / stream.length) * 100 : 0}%` }}
        />
      </div>

      {/* Main panels */}
      <div className="sse-panels">
        {/* Left: event log */}
        <div className="sse-panel sse-panel--log">
          <div className="sse-panel-header">Event log</div>
          <div className="sse-event-list">
            {playerState.events.length === 0 && (
              <div className="sse-empty">Press Play or Step to begin</div>
            )}
            {playerState.events.map((ev, i) => (
              <div key={i} className="sse-event-row">
                <span
                  className="sse-event-badge"
                  style={{ background: getEventColor(ev) + '22', color: getEventColor(ev), borderColor: getEventColor(ev) + '66' }}
                >
                  {eventLabel(ev)}
                </span>
                {previewData(ev) && (
                  <span className="sse-event-preview">{previewData(ev)}</span>
                )}
                {ev.annotation && (
                  <span className="sse-event-annotation">{ev.annotation}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: accumulation panels */}
        <div className="sse-panel sse-panel--acc">
          <div className="sse-panel-header">Output accumulation</div>

          {/* Thinking block if present */}
          {hasThinkingBlock && (() => {
            const blk = Object.values(playerState.blocks).find(b => b.type === 'thinking');
            if (!blk) return null;
            return (
              <div className="sse-acc-block sse-acc-block--thinking">
                <div className="sse-acc-label">thinking block {blk.closed ? <span className="sse-badge-closed">closed</span> : <span className="sse-badge-open">streaming</span>}</div>
                <div className="sse-acc-text sse-acc-text--thinking">
                  {blk.textAcc || <span className="sse-acc-empty">—</span>}
                </div>
              </div>
            );
          })()}

          {/* Text block */}
          {Object.entries(playerState.blocks)
            .filter(([, b]) => b.type === 'text')
            .map(([idx, blk]) => (
              <div key={idx} className="sse-acc-block sse-acc-block--text">
                <div className="sse-acc-label">text block (index {idx}) {blk.closed ? <span className="sse-badge-closed">closed</span> : <span className="sse-badge-open">streaming</span>}</div>
                <div className="sse-acc-text">
                  {blk.textAcc || <span className="sse-acc-empty">—</span>}
                </div>
              </div>
            ))}

          {/* Tool use block */}
          {hasToolBlock && (() => {
            const blk = Object.values(playerState.blocks).find(b => b.type === 'tool_use');
            if (!blk) return null;
            return (
              <div className={`sse-acc-block sse-acc-block--tool ${blk.closed ? 'sse-acc-block--tool-closed' : ''}`}>
                <div className="sse-acc-label">
                  tool_use block
                  {' '}
                  {blk.closed
                    ? (blk.parsed ? <span className="sse-badge-parsed">parsed ✓</span> : <span className="sse-badge-error">parse error</span>)
                    : <span className="sse-badge-open">accumulating — do not parse yet</span>
                  }
                </div>
                <div className={`sse-acc-json ${blk.closed ? (blk.parsed ? 'sse-acc-json--ok' : 'sse-acc-json--err') : 'sse-acc-json--pending'}`}>
                  {blk.closed && blk.parsed
                    ? JSON.stringify(blk.parsed, null, 2)
                    : blk.closed && blk.parseError
                      ? `SyntaxError: ${blk.parseError}`
                      : blk.jsonAcc || '{}'}
                </div>
              </div>
            );
          })()}

          {/* stop_reason */}
          {playerState.stopReason && (
            <div className="sse-stop-reason">
              <span className="sse-stop-label">stop_reason</span>
              <code className="sse-stop-value">&quot;{playerState.stopReason}&quot;</code>
              <span className="sse-stop-hint">
                {playerState.stopReason === 'end_turn' && '— generation complete'}
                {playerState.stopReason === 'tool_use' && '— execute tool and send results back'}
                {playerState.stopReason === 'max_tokens' && '— output truncated; check for incomplete JSON'}
              </span>
            </div>
          )}

          {playerState.events.length === 0 && (
            <div className="sse-empty">Output will appear here</div>
          )}
        </div>
      </div>

      <style>{`
        .sse-player {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
          overflow: hidden;
          font-size: 0.875rem;
        }

        .sse-controls {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          align-items: center;
          background: var(--color-bg);
        }

        .sse-scenario-btns {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .sse-btn-scenario {
          font-size: 0.8rem;
          padding: 0.2rem 0.7rem;
          border: 1px solid var(--color-border);
          border-radius: 999px;
          background: var(--color-bg);
          color: var(--color-muted);
          cursor: pointer;
          transition: all 0.1s;
        }

        .sse-btn-scenario--active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
        }

        .sse-playbar {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
          margin-left: auto;
        }

        .sse-btn-play, .sse-btn-step, .sse-btn-reset {
          font-size: 0.82rem;
          padding: 0.25rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          color: var(--color-text);
          cursor: pointer;
        }

        .sse-btn-play { border-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
        .sse-btn-play:hover { background: var(--color-accent-soft); }
        .sse-btn-step:disabled, .sse-btn-play:disabled { opacity: 0.4; cursor: not-allowed; }

        .sse-speed-label {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.78rem;
          color: var(--color-muted);
        }

        .sse-speed-slider { width: 70px; cursor: pointer; }
        .sse-speed-val { font-variant-numeric: tabular-nums; min-width: 2.5ch; }

        .sse-progress-track {
          height: 3px;
          background: var(--color-border);
        }

        .sse-progress-fill {
          height: 100%;
          background: var(--color-accent);
          transition: width 0.1s linear;
        }

        .sse-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 300px;
        }

        @media (max-width: 600px) {
          .sse-panels { grid-template-columns: 1fr; }
        }

        .sse-panel {
          padding: var(--space-3) var(--space-4);
          overflow: hidden;
        }

        .sse-panel--log {
          border-right: 1px solid var(--color-border);
        }

        .sse-panel-header {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted);
          margin-bottom: var(--space-2);
        }

        .sse-event-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 320px;
          overflow-y: auto;
        }

        .sse-event-row {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px;
        }

        .sse-event-badge {
          font-size: 0.72rem;
          font-family: var(--font-mono);
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .sse-event-preview {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--color-text);
          opacity: 0.75;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        .sse-event-annotation {
          font-size: 0.68rem;
          color: var(--color-muted);
          font-style: italic;
          flex-basis: 100%;
          padding-left: 0.5rem;
        }

        .sse-empty {
          color: var(--color-muted);
          font-size: 0.82rem;
          font-style: italic;
          padding: var(--space-2) 0;
        }

        .sse-acc-block {
          margin-bottom: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .sse-acc-label {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.2rem 0.6rem;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-muted);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .sse-acc-text {
          padding: var(--space-2) var(--space-3);
          font-size: 0.85rem;
          line-height: 1.5;
          min-height: 2.5rem;
          background: var(--color-bg);
        }

        .sse-acc-text--thinking {
          font-style: italic;
          color: #7c3aed;
          background: #f5f3ff;
        }

        .sse-acc-empty { color: var(--color-muted); }

        .sse-acc-json {
          font-family: var(--font-mono);
          font-size: 0.78rem;
          padding: var(--space-2) var(--space-3);
          white-space: pre;
          min-height: 3rem;
          line-height: 1.5;
        }

        .sse-acc-json--pending {
          background: #fff8f0;
          color: var(--color-muted);
          border-left: 3px solid #f97316;
        }

        .sse-acc-json--ok {
          background: #f0fdf4;
          color: #166534;
          border-left: 3px solid #22c55e;
        }

        .sse-acc-json--err {
          background: #fef2f2;
          color: #991b1b;
          border-left: 3px solid #ef4444;
        }

        .sse-badge-open {
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: #fff3cd;
          color: #92400e;
          border: 1px solid #f59e0b44;
        }

        .sse-badge-closed {
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: #e5e7eb;
          color: var(--color-muted);
        }

        .sse-badge-parsed {
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
          border: 1px solid #22c55e44;
        }

        .sse-badge-error {
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: #fee2e2;
          color: #991b1b;
        }

        .sse-stop-reason {
          margin-top: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .sse-stop-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted);
        }

        .sse-stop-value {
          font-family: var(--font-mono);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .sse-stop-hint {
          font-size: 0.75rem;
          color: var(--color-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
