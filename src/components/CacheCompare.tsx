export default function CacheCompare() {
  return (
    <div className="cc-root">
      <div className="cc-grid">
        {/* KV Cache */}
        <div className="cc-card">
          <div className="cc-card-header cc-card-header--kv">
            <span className="cc-card-badge cc-card-badge--kv">KV Cache</span>
            <span className="cc-card-sub">Ch 2</span>
          </div>

          <div className="cc-diagram">
            <div className="cc-req">
              <div className="cc-req-label">Request</div>
              <div className="cc-req-bar">
                <div className="cc-seg cc-seg--prompt">prompt</div>
                <div className="cc-seg cc-seg--gen">↓ decode ↓</div>
              </div>
              <div className="cc-brace">
                <svg width="100%" height="16"><path d="M4 2 Q4 14, 50% 14 Q96% 14, 96% 2" fill="none" stroke="#f59e0b" strokeWidth="1.5" /></svg>
              </div>
              <div className="cc-brace-label" style={{ color: "#92400e" }}>K,V cached in GPU memory</div>
            </div>
            <div className="cc-freed">
              <span className="cc-freed-icon">✕</span> gone when request ends
            </div>
          </div>

          <ul className="cc-facts">
            <li><strong>Scope:</strong> one request</li>
            <li><strong>Where:</strong> GPU memory</li>
            <li><strong>Stores:</strong> K,V vectors per layer per token</li>
            <li><strong>Lifetime:</strong> gone when request ends</li>
            <li><strong>Cost:</strong> free, always on</li>
          </ul>
        </div>

        {/* Prompt Cache */}
        <div className="cc-card cc-card--active">
          <div className="cc-card-header cc-card-header--pc">
            <span className="cc-card-badge cc-card-badge--pc">Prompt Cache</span>
            <span className="cc-card-sub">Ch 3</span>
          </div>

          <div className="cc-diagram">
            <div className="cc-req">
              <div className="cc-req-label">Request 1</div>
              <div className="cc-req-bar">
                <div className="cc-seg cc-seg--prefix">system + tools</div>
                <div className="cc-seg cc-seg--new">new turn</div>
              </div>
            </div>
            <div className="cc-arrow">↓ K,V kept on server</div>
            <div className="cc-req">
              <div className="cc-req-label">Request 2</div>
              <div className="cc-req-bar">
                <div className="cc-seg cc-seg--hit">system + tools ✓</div>
                <div className="cc-seg cc-seg--new">new turn</div>
              </div>
            </div>
          </div>

          <ul className="cc-facts">
            <li><strong>Scope:</strong> across requests</li>
            <li><strong>Where:</strong> server-side</li>
            <li><strong>Stores:</strong> same K,V vectors, kept for reuse</li>
            <li><strong>Lifetime:</strong> ~5 min TTL, then dropped</li>
            <li><strong>Cost:</strong> writes cost more; reads are cheaper</li>
          </ul>
        </div>
      </div>

      <div className="cc-summary">
        Both cache the same K,V vectors from prefill.
        The KV cache keeps them for one request. The prompt cache keeps them
        on the server so the next request with the same prefix skips
        recomputing them — but the prefix must match exactly.
      </div>

      <style>{`
        .cc-root {
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .cc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        @media (max-width: 640px) {
          .cc-grid { grid-template-columns: 1fr; }
        }

        .cc-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
          background: var(--color-bg);
        }

        .cc-card--active {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent-soft);
        }

        .cc-card-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .cc-card-badge {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
        }

        .cc-card-badge--kv {
          background: var(--color-cache-soft);
          color: #92400e;
          border: 1px solid var(--color-cache);
        }

        .cc-card-badge--pc {
          background: var(--color-accent-soft);
          color: #1d4ed8;
          border: 1px solid var(--color-accent);
        }

        .cc-card-sub {
          font-size: 0.75rem;
          color: var(--color-muted);
        }

        .cc-diagram {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-3);
          margin-bottom: var(--space-3);
        }

        .cc-req {
          margin-bottom: 0.35rem;
        }

        .cc-req-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-muted);
          margin-bottom: 0.2rem;
        }

        .cc-req-bar {
          display: flex;
          gap: 2px;
          height: 26px;
        }

        .cc-seg {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.62rem;
          font-weight: 600;
          border-radius: 3px;
          padding: 0 0.4rem;
          white-space: nowrap;
          overflow: hidden;
        }

        .cc-seg--prompt {
          flex: 3;
          background: var(--color-cache-soft);
          border: 1px solid var(--color-cache);
          color: #92400e;
        }

        .cc-seg--gen {
          flex: 2;
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #166534;
        }

        .cc-seg--prefix {
          flex: 3;
          background: var(--color-accent-soft);
          border: 1px solid var(--color-accent);
          color: #1e40af;
        }

        .cc-seg--hit {
          flex: 3;
          background: #dcfce7;
          border: 1px solid #4ade80;
          color: #166534;
        }

        .cc-seg--new {
          flex: 1;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-muted);
        }

        .cc-brace {
          margin: 0.1rem 0;
        }

        .cc-brace-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-align: center;
        }

        .cc-freed {
          font-size: 0.68rem;
          color: #dc2626;
          text-align: center;
          margin-top: 0.35rem;
        }

        .cc-freed-icon {
          font-weight: 700;
        }

        .cc-arrow {
          font-size: 0.68rem;
          color: var(--color-accent);
          text-align: center;
          padding: 0.25rem 0;
          font-weight: 600;
        }

        .cc-facts {
          margin: 0;
          padding-left: 1.1rem;
          font-size: 0.78rem;
          line-height: 1.7;
          color: var(--color-text);
        }

        .cc-facts li {
          margin-bottom: 0.1rem;
        }

        .cc-summary {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-left-width: 4px;
          border-left-color: var(--color-accent);
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
          font-size: 0.85rem;
          line-height: 1.6;
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}
