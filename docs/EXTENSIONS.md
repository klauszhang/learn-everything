# Extension Planning — learn-claude-code

## 1. Premise

The existing site walks a reader from raw text → tokens → embeddings → attention → layers → generation → KV cache → prompt cache. By the end they understand why Claude Code caches prefixes and how to keep those caches hot. But the journey stops at the boundary of a single model inference. Three open questions linger immediately: how does the model find the right context to include in the first place (Ch 2 plants this with the embedding scatter), what happens when the model needs live data or actions it can't perform alone (Ch 7 hints at tool definitions without explaining them), and what governs the creative vs. deterministic feel of responses (Ch 5's autoregressive loop raises it without answering it).

---

## 2. Candidate extension modules

### M-1 — Vectors as Semantic Addresses

**Why it follows from the existing site.** Ch 2 teaches that embeddings cluster semantically similar tokens. The natural next question is: if similar things are near each other, can you use distance to *find* things? This module answers yes — and makes the geometry concrete.

**Audience fit.** The geometric intuition is already established in Ch 2. This module needs only to extend "closeness means similarity" to "closeness lets you search." No new math. A real-world analogy (latitude/longitude as a 2D address space, embedding space as a 10,000-D address space) carries the whole idea.

**Prerequisites.** Ch 2 (Embeddings). Nothing else — this is the first extension module.

**One-diagram-one-demo idea.** Diagram: inline SVG showing a 2D embedding space with a query point and concentric rings indicating distance. Three candidate documents sit at different radii. The diagram makes "nearest neighbor" literal. Demo: a React island where the user selects a query phrase from a short list (five phrases, hand-authored), sees dots representing five candidate documents move relative to a fixed query dot, and a ranked result list updates. All distances are illustrative floats in `src/data/vector-search.ts` — no real vectors, no real computation.

**Closing takeaway angle.** When you paste a long document into Claude and ask "what does section 3 say about pricing?", Claude doesn't scan every word sequentially. Systems built around Claude chunk that document, embed the chunks, and use distance to pull only the relevant pieces — before the model ever reads a token.

**Hand-authored data needs.** `src/data/vector-search.ts` — five query phrases, five mock document chunks, a 2D coordinate for each chunk, and a pre-computed distance table (one float per query-chunk pair, kept small and round).

**Risks / pedagogical traps.** The common oversimplification is treating cosine similarity and Euclidean distance as interchangeable. For this audience, pick one (cosine is the practical standard) and use a geometric hand-wave: "we measure the angle between two arrows from the origin, not the gap between their tips." Do not introduce the formula. Also avoid implying embedding models are deterministic per phrase the way token embedding tables are — sentence embeddings depend on context.

**Depth.** Light

---

### M-2 — Approximate Nearest Neighbor Search (ANN)

**Why it follows from the existing site.** M-1 introduces vector search by distance. The immediate follow-up: a real document collection has millions of chunks. Checking every single distance is too slow. This module explains how ANN indexes (using HNSW as the concrete example) make the search tractable.

**Audience fit.** The core idea — skip unproductive areas of the map early, zoom in once you're close — is pure spatial intuition. The multi-layer graph structure of HNSW maps naturally onto the "zoom in" metaphor: you start with big jumps and take smaller steps as you approach the target. No graph theory required; the navigation analogy does the work.

**Prerequisites.** M-1 (Vectors as Semantic Addresses).

**One-diagram-one-demo idea.** Diagram: HTML/CSS layered map showing three layers — a sparse top layer (few nodes, long-range links), a mid layer, and a dense bottom layer. Arrows trace a search path from an entry point down through layers to a cluster. The diagram makes the "zoom in" metaphor visual. Demo: a React island with a "Step through search" button that animates through 4–5 search steps on a fixed tiny graph (7–9 nodes, hand-authored adjacency and coordinates). Each step highlights the current node, the neighbor being evaluated, and the decision to move or stop. Labels explain why the search descends to a lower layer.

**Closing takeaway angle.** ANN search is the reason vector databases can answer a query in milliseconds even over millions of documents. The trade-off (you might miss the single closest match) is intentional — 95% accuracy in 1 ms beats 100% accuracy in 10 seconds for every real retrieval use case.

**Hand-authored data needs.** `src/data/ann-search.ts` — a fixed graph of 9 nodes with (x, y) coordinates, layer assignments, adjacency lists, and a pre-planned 5-step search path with per-step annotations.

**Risks / pedagogical traps.** Two common mistakes: (1) implying HNSW is the only ANN algorithm (FAISS flat, IVF, ScaNN all exist — a one-line note that HNSW is the most widely deployed is enough); (2) making the "approximate" framing sound like a bug rather than a deliberate engineering choice. The chapter should be explicit: you trade a tiny chance of missing the closest match for a massive speed gain, and in retrieval that trade-off almost always wins.

**Depth.** Medium

---

### M-3 — Retrieval-Augmented Generation (RAG)

**Why it follows from the existing site.** Ch 7 shows that Claude Code's prompt cache holds system prompt + tool definitions + read files. The "read files" segment is exactly the retrieval step in a RAG pipeline — but Ch 7 doesn't explain how those files got selected. This module closes that gap and shows the full loop: embed the query, search, retrieve, inject into context, generate.

**Audience fit.** Every reader who asks "how does Claude know about my codebase?" is already asking this question. The concept is concrete — search first, then talk — and maps directly to things readers do manually (copy-paste relevant docs, ctrl-f in a file before asking a question). The pipeline is five steps, each explainable in one sentence.

**Prerequisites.** M-1 (Vectors as Semantic Addresses) required. M-2 (ANN Search) enriches it but is not blocking — M-3 can explain "the index finds nearest chunks quickly" without the reader needing HNSW mechanics first. Also benefits from Ch 7 for the "inject into context" step.

**One-diagram-one-demo idea.** Diagram: HTML/CSS horizontal pipeline — five labeled boxes connected by arrows: [Query] → [Embed query] → [Search index] → [Retrieved chunks] → [Stuff into context] → [Generate]. A second row shows the offline step: [Documents] → [Chunk] → [Embed chunks] → [Index]. The two rows share the search step so the reader sees both the build and query paths. Demo: a React island where the user picks one of three mock questions (hand-authored), and the UI animates through the pipeline steps: (1) the query appears, (2) two "retrieved" chunks highlight from a list of five, (3) a mock prompt is assembled showing [system prompt] + [retrieved chunk 1] + [retrieved chunk 2] + [question]. The final prompt panel makes the "stuff into context" step concrete.

**Closing takeaway angle.** RAG is why Claude can answer questions about your 500-page internal wiki without you pasting the whole thing. Retrieval decides what goes in the context window; the model handles the rest. The quality of the retrieval step determines the quality of the answer — garbage in, garbage out, even with a perfect model.

**Hand-authored data needs.** `src/data/rag.ts` — three mock questions, five mock document chunk summaries (title + two-sentence content), a lookup table mapping each question to two chunk indices (the "retrieval result"), a mock assembled prompt string per question.

**Risks / pedagogical traps.** Three traps: (1) implying RAG guarantees correct answers — the model can still hallucinate if the retrieved chunks are ambiguous or if it ignores them; (2) conflating RAG with fine-tuning — they are completely different (RAG changes what's in the context; fine-tuning changes the weights); (3) implying a specific vector database product. This chapter stays entirely product-agnostic and uses the phrase "a vector index" throughout.

**Depth.** Medium

---

### M-4 — Sampling: Temperature, Top-p, Top-k

**Why it follows from the existing site.** Ch 5 (Generation) introduces autoregressive decoding but deliberately sidesteps *how* the model picks the next token from the probability distribution. A natural question after Ch 5 is: why does Claude sometimes give different answers to the same prompt, and how do I make it more or less creative?

**Audience fit.** Readers who use Claude daily have already tuned temperature or accepted defaults they don't understand. The intuition — a biased dice roll over the vocabulary — is accessible. Three concrete scenarios (math answer, creative writing, code completion) ground each parameter setting.

**Prerequisites.** Ch 5 (Generation) only.

**One-diagram-one-demo idea.** Diagram: inline SVG bar chart of a mock probability distribution over 8 next-token candidates (e.g., "sunny", "cloudy", "rainy", "cold", "warm", "perfect", "awful", "fine"). The bars are hand-authored. Temperature slider controls flatten or sharpen the bars in a simplified illustrative way. Demo: a React island with three sliders (temperature 0–2, top-k 1–8, top-p 0–1). As the reader adjusts, the bar chart updates to show which tokens are "in play" (above the cut-off highlighted amber, the rest greyed). A "Sample" button picks a token at random (weighted by the mock distribution) and appends it to a one-sentence mock completion. All probability values are illustrative — no real softmax.

**Closing takeaway angle.** Temperature is the most misunderstood parameter in AI products. Lower is not always better: a temperature of 0 (greedy decoding) makes code predictable but makes creative writing repetitive. The parameter that actually matters most for safety is neither temperature nor top-p — it's the training, which determines the shape of the distribution before any sampling occurs.

**Hand-authored data needs.** `src/data/sampling.ts` — eight candidate tokens with mock logit values, a simplified temperature-scaling function (for illustration only, not real softmax), three preset scenarios (math / creative / code) with recommended slider positions.

**Risks / pedagogical traps.** Top-p and top-k interact in ways most explanations get wrong — applying both means whichever cuts first wins. Be explicit that Claude's API uses temperature and top-p, not top-k, as the primary knobs, but explain top-k first because it is conceptually simpler. Do not imply that temperature 0 is deterministic in all models — beam search and other factors can affect this, but for this audience "temperature 0 ≈ deterministic" is close enough with a brief caveat.

**Depth.** Light

---

### M-5 — Tool Use and Function Calling

**Why it follows from the existing site.** Ch 7 shows tool definitions as a segment in the prompt — a named list of things Claude is allowed to call. But what actually happens when Claude decides to use one? This module explains the request/response loop: Claude signals a tool call, the host runs it, the result comes back as a new message, and generation continues.

**Audience fit.** Every Claude Code user has seen tool calls in the interface without knowing the underlying mechanism. The conversation metaphor (Claude writes a message that says "please run this"; the host replies with the result; Claude continues) maps directly to chat-turn intuition.

**Prerequisites.** Ch 7 (Prompt Cache) for the tool-definitions-in-context picture. Ch 5 (Generation) for the stop/resume mechanics.

**One-diagram-one-demo idea.** Diagram: HTML/CSS sequence diagram (three columns: User / Claude / Tool Host) showing a 4-step exchange: (1) user sends question, (2) Claude responds with a `tool_use` block instead of text, (3) host executes the tool and sends back `tool_result`, (4) Claude sends a final text reply. Arrows flow left-to-right between columns. Demo: a React island simulating a 2-step tool-call conversation. The reader sees a mock user question ("What files are in my project?"), clicks "Step", watches Claude's `tool_use` block appear (formatted JSON, hand-authored), clicks "Step" again to see the mock `tool_result`, then clicks once more to see Claude's final reply. Each step is pre-scripted; no real API call.

**Closing takeaway angle.** Tool use is why Claude Code can edit files, run tests, and search the web — capabilities that have nothing to do with the model's weights and everything to do with the message loop. The model never directly touches your filesystem; it asks, you (or Claude Code) execute, and the result flows back into the conversation.

**Hand-authored data needs.** `src/data/tool-use.ts` — three mock tool definitions (name, description, mock parameters), one pre-scripted conversation thread with user message, tool_use block, tool_result, and final reply.

**Risks / pedagogical traps.** Two traps: (1) implying Claude *executes* the tool — it doesn't; it requests execution and the host decides whether to honor the request; (2) conflating client tools (host-executed) with server tools (Anthropic-executed, like web search). Mention the distinction in one sentence but do not dwell on it. Keep the demo focused on the client-side loop, which is what most readers encounter.

**Depth.** Light

---

### M-6 — Agents and Orchestration

**Why it follows from the existing site.** M-5 explains a single tool call. This module asks: what happens when the model needs to call several tools in sequence, check its own work, and decide when it is done? That loop is an agent.

**Audience fit.** Readers who use Claude Code have experienced multi-step agent behavior: Claude reads a file, edits it, runs a test, reads the error, edits again. Making the loop explicit — observe, think, act, repeat — gives readers a model for when to trust the agent and when to intervene.

**Prerequisites.** M-5 (Tool Use), Ch 5 (Generation).

**One-diagram-one-demo idea.** Diagram: HTML/CSS loop diagram — four boxes arranged in a cycle: [Observe] → [Think] → [Act] → [Check] → back to [Observe]. An outer box labeled "Agent loop" wraps them. Annotations show what corresponds to each step in Claude Code terms: observe = read context, think = model forward pass, act = tool call, check = look at tool result. Demo: a React island running a 4-step mock agent solving "find the bug in this function." Each step auto-plays on click: (1) Claude reads the function (mock tool call), (2) Claude identifies a likely bug, (3) Claude edits the file (mock tool call), (4) Claude runs the test and sees a pass. A small "Turn N of 4" counter shows the loop count. All steps are pre-scripted.

**Closing takeaway angle.** An agent is not magic — it is the tool-call loop from M-5 running until a stop condition is met. The hardest engineering problems in agentic systems are not about the model; they are about loop termination (when does the agent decide it is done?), error recovery (what if a tool call fails?), and scope control (how do you prevent runaway tool use?).

**Hand-authored data needs.** `src/data/agents.ts` — a 4-step scripted agent trace with step type (observe / think / act / check), mock tool call and result per act step, running "turn" counter.

**Risks / pedagogical traps.** Do not present agents as autonomous or sentient. The loop is a while-loop controlled by the model's output; each iteration is just a generation step. Also avoid the common framing that more iterations = better — loops that fail to terminate or that drift from the original goal are real failure modes, and the chapter should name them.

**Depth.** Medium

---

### M-7 — Context-Window Management and Compaction

**Why it follows from the existing site.** Ch 7 explains prompt caching in terms of stable prefixes. A natural follow-up: what happens when a long conversation eventually fills the context window? Something has to be dropped or summarized. This module explains the options and their cache implications.

**Audience fit.** Any reader who has noticed Claude starting to "forget" earlier parts of a long conversation has encountered this. The concept is simple — window = finite, older content gets dropped or compressed — and the practical implications (keep important context near the top, or re-inject it) are immediately actionable.

**Prerequisites.** Ch 7 (Prompt Cache), Ch 0 (Why caching matters).

**One-diagram-one-demo idea.** Diagram: HTML/CSS scrolling-window timeline — a horizontal strip of conversation turns, with a "context window" rectangle sliding rightward over them. Turns older than the window are greyed out. Two strategies are shown side-by-side: (1) sliding window (drop old turns), (2) compaction (summarize old turns into a summary block). Demo: a React island with a "Next turn" button that advances through a mock 10-turn conversation. At turn 7, a "Context full" banner triggers; the user sees both strategies animated — the sliding window drops turns 1–3, the compaction strategy replaces them with a one-paragraph summary block. Cache hit/miss indicators update accordingly.

**Closing takeaway angle.** Claude Code handles compaction automatically, but understanding it explains a common support question: "Why did Claude forget my earlier instructions?" Because those instructions left the window, or were compressed into a summary that lost nuance. Placing important instructions in the system prompt (which lives at the top of the cache) rather than the conversation keeps them alive.

**Hand-authored data needs.** `src/data/compaction.ts` — a 10-turn mock conversation (one sentence per turn), a mock summary string that "compacts" turns 1–4, token counts per turn showing window fill.

**Risks / pedagogical traps.** Avoid implying that compaction is lossless — it is a summarization and can drop details. Also avoid brand-specific claims about exactly how Claude Code manages compaction; frame everything as "one approach" rather than "what Claude Code does internally."

**Depth.** Light

---

### M-8 — Inference-Time Optimizations Beyond KV Cache

**Why it follows from the existing site.** Ch 6 explains the KV cache as the primary inference optimization. But readers who follow AI news will have heard terms like "quantization" and "speculative decoding." A brief module names the landscape without going deep, so readers understand that the KV cache is one of several complementary techniques.

**Audience fit.** This is harder than the others — quantization in particular requires a bit of "what is a floating-point number" scaffolding. Keep this module at survey level: name each technique, give the intuition, state the trade-off. No implementation, no math.

**Prerequisites.** Ch 6 (KV Cache internal).

**One-diagram-one-demo idea.** Diagram: HTML/CSS comparison table with three rows (Quantization, Speculative Decoding, Batched Serving) and three columns (What it does, What it trades off, When it helps). The table is the diagram — clean and scannable. Demo: a React island with three "technique cards," each expandable. Click to reveal a one-paragraph explanation and a simple before/after metric (e.g., "model size: 70 GB → 18 GB at 4-bit" — illustrative, not real). No animation needed; the card pattern is familiar from FAQ UIs.

**Closing takeaway angle.** When Anthropic ships a faster, cheaper model, these optimizations are often responsible — not a bigger GPU budget. Understanding their trade-offs helps readers interpret benchmark claims: "4-bit quantized" means slightly lower precision in exchange for 4x smaller memory footprint, which is usually invisible in practice.

**Hand-authored data needs.** `src/data/inference-opts.ts` — three technique descriptions with mock before/after metrics, trade-off summaries, and "helps when" notes.

**Risks / pedagogical traps.** Do not conflate quantization (precision reduction) with pruning (weight removal) — they are different techniques. Do not imply speculative decoding is universally deployed; it depends on having a suitable draft model. Keep all metric numbers clearly labeled "illustrative."

**Depth.** Light

---

### M-9 — Long-Context Techniques (RoPE / Sliding Window)

**Why it follows from the existing site.** Ch 3 (Attention) explains that each token attends to earlier positions. Ch 7 deals with the context window as a finite resource. But neither explains how the model handles very long sequences — where simply extending the attention matrix would be prohibitively expensive.

**Audience fit.** This is the deepest topic on the list — positional encoding and sliding attention windows require more scaffolding. Recommend framing it as optional depth ("want to understand why Claude has a 200K-token window?") rather than core curriculum. A good analogy for RoPE: the model encodes positions as clock-face angles; far-apart tokens have very different angles; nearby tokens are similar. The math is skippable.

**Prerequisites.** Ch 3 (Attention), Ch 7 (Prompt Cache) — the context window framing.

**One-diagram-one-demo idea.** Diagram: inline SVG showing a long sequence of tokens; a sliding window rectangle covers the most recent N tokens; earlier tokens are shown as accessible only through a "compressed summary" track at the top. The dual-track design illustrates both sliding-window attention and the rationale for memory/retrieval hybrids. Demo: a React island where a slider sets sequence length (100 → 10,000 tokens, mock scale). A heat-map-style bar shows which tokens the current position can "see" — full window at short lengths, sliding window kicking in at long lengths. No real attention computation — just a position indicator.

**Closing takeaway angle.** A 200K context window is not the same as a model that pays equal attention to every token across 200K positions. At long ranges, attention patterns thin out and earlier content can be effectively invisible without architectural tricks. Retrieval into context (M-3) and long-context attention are complementary approaches to the same problem.

**Hand-authored data needs.** `src/data/long-context.ts` — mock sequence lengths (short/medium/long), mock "attention reachability" profiles (which positions are visible at each length setting).

**Risks / pedagogical traps.** RoPE math is genuinely hard; do not attempt to explain it mechanistically. The only intuition needed is: position is encoded as a relative angle, and that encoding degrades gracefully at long distances. Also do not imply all long-context problems are solved — at very long contexts, model behavior can still degrade even when technically within the window.

**Depth.** Deep (candidate for optional/advanced track)

---

### M-10 — Multimodal: Vision Tokens

**Why it follows from the existing site.** Ch 1 (Tokens) teaches that text gets chunked into token IDs before the model sees it. A natural question: what happens to an image? This module shows that images go through an analogous process — pixels are chunked into patch embeddings — and then flow through the same transformer architecture.

**Audience fit.** Readers who have used Claude's vision feature have already sent images without knowing the mechanism. The patch-tiling concept is visually intuitive and the "same embedding table idea, but for image patches" framing reuses existing mental models cleanly.

**Prerequisites.** Ch 1 (Tokens), Ch 2 (Embeddings).

**One-diagram-one-demo idea.** Diagram: inline SVG showing a small (illustrative) 8x8 image divided into a 2x2 grid of patches. Each patch has an arrow pointing to a vector. A second column shows those vectors entering the same transformer stack as text tokens. The diagram makes "images become tokens" concrete. Demo: a React island where the user picks from three stock mock images (represented as colored ASCII-art grids, hand-authored, no real images). A "Tokenize" button divides the grid into patches and numbers them, then shows a list of mock patch IDs alongside mock text tokens for a caption. The reader sees text and image tokens queued into the same sequence.

**Closing takeaway angle.** When you send Claude a screenshot, it does not "see" the image as a human does — it processes a sequence of patch embeddings interleaved with text token embeddings, all going through the same attention machinery. This means very small or low-contrast details in an image can be poorly represented if they fall in a single patch, just as very rare words are poorly represented as single tokens.

**Hand-authored data needs.** `src/data/vision.ts` — three mock 8x8 "images" as color grids (ASCII/CSS), patch tiling specs, mock patch IDs.

**Risks / pedagogical traps.** Do not specify exactly how many tokens an image costs in Claude — this changes and is model-specific. Do not imply Claude understands image content through pixels alone; the vision encoder is a specialized component whose details are outside scope. Keep the message at the architectural level: images → patches → embeddings → transformer.

**Depth.** Light

---

### M-11 — MCP and the Tool Ecosystem

**Why it follows from the existing site.** M-5 explains individual tool calls. MCP (Model Context Protocol) is a standardization layer that lets Claude discover and use tools from third-party servers without custom integration code per tool. Since the primary audience of this site is Claude Code users, and Claude Code ships MCP support, a brief orientation is warranted — but this is a "connect the concepts" module, not a tutorial.

**Audience fit.** Claude Code users encounter MCP servers in setup flows without understanding what they provide. A one-chapter orientation — "MCP is the USB standard for AI tools; tools from any server plug into the same socket" — is all that's needed. Deep MCP architecture (client/server transport, authentication) is explicitly out of scope.

**Prerequisites.** M-5 (Tool Use).

**One-diagram-one-demo idea.** Diagram: HTML/CSS showing Claude in the center, with arrows pointing to three named MCP servers (e.g., "File system server," "GitHub server," "Search server"). Each server has a small box listing two tool names it exposes. The diagram makes "Claude discovers tools from remote servers" concrete. Demo: a React island showing a mock "tool discovery" step — Claude receives a list of 5 tools from two mock servers (tool name + one-line description). The user clicks "Ask Claude to use a tool" and sees the same tool_use flow from M-5 but with the tool name now coming from the discovered list. No real MCP protocol; the discovery step is a pre-scripted JSON list.

**Closing takeaway angle.** MCP does not change what Claude can do with any individual tool; it changes how tools are discovered and connected. For Claude Code users: when you add an MCP server, you are extending the tool definitions segment of every request — the part Ch 7 warned you is a silent cache invalidator. Adding many MCP servers increases your token overhead and can push cache breakpoints.

**Hand-authored data needs.** `src/data/mcp.ts` — two mock MCP servers, each with 2–3 tool definitions, a mock discovery response, a pre-scripted single tool-call exchange.

**Risks / pedagogical traps.** Do not attempt to explain MCP transport protocols (stdio, SSE, HTTP) — they are implementation details. Do not position MCP as an Anthropic-exclusive feature; it is an open standard. Keep the focus on user-facing behavior: "you install a server, Claude gains tools."

**Depth.** Light

---

### Modules noted but excluded

**Fine-tuning and RLHF.** These are training-side topics. The site's stated non-goal is "no training." Fine-tuning modifies model weights; RAG and tool use do not. A single sentence of differentiation in M-3 (RAG) is sufficient. No dedicated module.

**Embedding model providers and benchmarks.** A survey of OpenAI vs. Cohere vs. Voyage vs. local models is explicitly a non-goal for this site. M-1 uses the phrase "an embedding model" throughout without naming any provider.

---

## 3. Recommended track

Ship these four modules, in this order:

**M-1 → M-3 → M-4 → M-5**

### Rationale

**M-1 (Vectors as Semantic Addresses)** first. It is the lightest module, requires only Ch 2 as a prerequisite, and has the highest payoff-to-difficulty ratio. It also seeds the geometric intuition that M-2 and M-3 depend on. Crucially, readers who have just finished the existing eight chapters are still "in the zone" — this extends the narrative without a context switch.

**M-3 (RAG)** second. Skip M-2 (ANN) for the initial track. The ANN internals are interesting but not required to understand RAG at a conceptual level; the demo in M-3 can say "an index finds the nearest chunks quickly" without the reader needing HNSW mechanics. Shipping M-3 before M-2 keeps the track at reader-facing payoff — the answer to "how does Claude know about my codebase?" — rather than infrastructure internals. M-2 becomes optional depth alongside M-3, or ships in a follow-up wave.

**M-4 (Sampling)** third. It requires only Ch 5 and adds no prerequisite from the first three extension modules. It breaks up the retrieval theme with a pure-generation question that many readers are already asking. The demo is satisfying and low-complexity to build. Placing it here prevents the track from becoming all-retrieval before tool use lands.

**M-5 (Tool Use)** fourth. By now the reader understands what goes into the context (RAG), what governs the generation (sampling), and the full lifecycle of Ch 0–7. Tool use is the final conceptual piece that explains Claude Code's behavior: the model calls tools it cannot perform itself, results re-enter the context, and the cycle continues. This closes the narrative arc that Ch 7 opened with "tool definitions" as a cached segment.

### What to defer

M-2 (ANN), M-6 (Agents), and M-7 (Compaction) form a natural second wave. M-6 depends on M-5, and M-7 connects back to Ch 7 — together they complete the agentic picture. M-8–M-11 are optional depth for technically curious readers and do not need to be on the main reading path.

---

## 4. Connections to existing chapters

### M-1 — Vectors as Semantic Addresses

- **Ch 2 (Embeddings):** the embedding scatter already shows semantic clusters and proximity. M-1 makes the operational leap: "if similar things cluster, you can use distance to search." Ch 2's interactive hover-over-a-point demo is the direct precursor to M-1's nearest-neighbor demo.
- **Ch 3 (Attention):** the Q/K dot product in Ch 3 *is* a similarity computation — queries and keys are vectors, and attention weight is their closeness. M-1 reuses that geometric intuition in a retrieval context.

### M-3 — RAG

- **Ch 7 (Prompt Cache):** the "read files" segment of a Claude Code request is the injection step in a RAG pipeline. Ch 7 names it without explaining how those files were selected. M-3 closes the loop.
- **Ch 2 (Embeddings):** Ch 2's closing callout notes that "the embedding lookup is a pure table read." M-3 generalizes this to sentence/chunk embeddings, where the lookup is replaced by a similarity search.

### M-4 — Sampling

- **Ch 5 (Generation):** the autoregressive step demo in Ch 5 shows tokens being appended without explaining how the model chooses which token. Ch 5's "step" button is the setup; M-4's demo is the answer.
- **Ch 1 (Tokens):** Ch 1 notes that the model assigns probabilities over its vocabulary. M-4 makes that probability distribution interactive.

### M-5 — Tool Use

- **Ch 7 (Prompt Cache):** tool definitions appear as a named, cached segment. Ch 7 warns that changing tool definitions invalidates the cache. M-5 explains what those definitions actually do — they instruct Claude what tools it can request.
- **Ch 3 (Attention):** Ch 3's causal mask establishes that generation is sequential. M-5 shows that a generation sequence can be interrupted mid-stream by a tool call and then resumed — extending the sequential model to an interactive loop.

---

## 5. Open questions

1. **Vector search: one module or two?** M-1 and M-2 can be merged into one chapter ("How vector search works") or kept separate as written. Merging simplifies the track but makes one chapter considerably heavier. Keeping them separate allows readers to stop after the concept without wading into HNSW mechanics. Decision needed before implementation begins.

2. **Callout evolution: cache-specific or general?** Every existing chapter ends with a "How this connects to the cache" callout. Extension modules that have little direct cache relevance (M-4 Sampling, M-10 Vision) will need either a forced cache angle or a rebranded callout ("How this connects to your daily Claude use"). Decide whether to evolve the component or keep the convention strictly cache-anchored.

3. **Chapter numbering and navigation.** The existing chapters are numbered 0–7. Extension modules need a numbering scheme that signals optionality — sequential (8, 9, 10…), lettered (A, B, C…), or a separate track with a different sidebar section. This is a nav/UX decision that affects `ChapterLayout.astro` and the sidebar TOC before any content is written.

4. **M-2 (ANN): core track or optional depth?** The recommended track defers M-2, but it is a prerequisite for the full RAG story. If readers notice the gap ("you said the index finds things quickly — how?"), M-2 should be linked as optional reading from M-3 rather than skipped entirely. Decide whether M-2 ships in the first extension wave or only after RAG feedback confirms the gap is felt.

5. **Multimodal scope.** M-10 (Vision Tokens) is light and self-contained but involves mock "images" that require a creative demo approach (ASCII-art or CSS grids) since the site has no backend and no real images in demos. Decide whether the visual conceit works or whether M-10 should be deferred until a richer demo pattern is designed.

6. **Demo complexity ceiling.** The recommended track includes M-3 (RAG pipeline animation), which is the most complex demo on the list — a multi-step animated sequence with three distinct UI states. If the build time for M-3 is significantly higher than for M-1 or M-4, it may be worth building M-1 → M-4 → M-5 first, then M-3 as a second wave. Assess during skeleton/spike.

---

## 6. Non-goals (carrying forward and extended)

### Inherited from GOAL.md

- No math beyond intuition — no matrix multiplication, no linear algebra proofs, no softmax formulas.
- No training content — no backpropagation, no RLHF, no fine-tuning mechanics. A single sentence differentiating RAG from fine-tuning in M-3 is allowed; that is a factual clarification, not training content.
- No real model inference — all demo data is hand-authored in `src/data/`. No API calls, no model weights, no real vectors.
- No multi-language i18n, no comprehensive accessibility audit beyond semantic HTML.
- No dark mode, automated tests, backend, analytics, or telemetry.
- No production deployment guides — the site teaches concepts, not operational runbooks.
- No vendor comparison — no ranking or comparison of embedding model providers (OpenAI, Cohere, Voyage, etc.), vector database vendors (Pinecone, Weaviate, Chroma, etc.), or cloud inference providers.

### New non-goals for extension modules

- Not a survey of embedding model providers. M-1 and M-3 use the phrase "an embedding model" and never name a vendor.
- Not a vector database tutorial. M-3 explains what a vector index is and why it is fast; it does not explain how to set up, configure, or operate any specific product.
- Not an agents framework tutorial. M-6 explains the agent loop conceptually; it does not cover LangChain, LlamaIndex, or any orchestration framework.
- Not an MCP server implementation guide. M-11 orients the reader to what MCP provides; it does not explain transport protocols, authentication, or how to write an MCP server.
- Not a benchmark survey. M-8 (Inference Optimizations) mentions techniques by name but does not compare specific model versions, vendors, or hardware configurations.
- Not a fine-tuning or RLHF guide — consistent with the inherited non-goal above. No dedicated module on either topic.
