# AGENTS.md — Implementation Strategy

This file tells an agent **how to execute this project**. `GOAL.md` tells you **what** to build. Read both at session start.

This is a long-running, multi-session project. The orchestrating agent (you, reading this) must stay lean. Bulk work gets delegated; you integrate results and make architectural calls.

---

## Tier the model by task complexity

Pick the cheapest model that will actually do the job well. Token spend matters because this session runs over many chapters across many sessions.

| Task shape | Model | Examples |
|---|---|---|
| Mechanical, well-specified, low judgment | **Haiku** | Generate `src/data/<topic>.ts` from a clear schema; produce a CSS module from a spec; rename symbols; write a README from a bulleted outline; convert a chapter outline into MDX scaffolding. |
| Implementation requiring judgment | **Sonnet** | Build a React island component (e.g. `AttentionMatrix.tsx`); write a chapter's prose; design `ChapterLayout.astro`; resolve a merge conflict; debug a runtime error. |
| Architectural calls, ambiguous problems, hard debugging | **Opus** | The orchestrator itself; deciding between competing approaches; root-causing a bug that survived one Sonnet pass; final integration review. |

Use the `Agent` tool's `model` parameter (`"haiku"` / `"sonnet"` / `"opus"`) when dispatching. **If unspecified, the subagent inherits your model** — wrong default for cheap mechanical work. Always set the tier explicitly.

**Rule of thumb:** if the task can be expressed in one paragraph and produces a predictable output, it's Haiku. If it needs judgment about user-facing copy, component design, or tradeoffs, it's Sonnet. If you're picking between two valid approaches and the wrong choice has lasting cost, that's an Opus call (and usually the orchestrator should do it directly).

---

## Subagents have two distinct roles

### 1. Consultants — single-shot focused work, no code edits

Use when you need an answer without polluting your own context.

- **Research:** "Look up what Anthropic's docs currently say about prompt-cache breakpoint limits and TTL pricing. Return only the facts, under 200 words."
- **Review:** "Read `src/components/AttentionMatrix.tsx` and the Ch 3 MDX. Flag any technical inaccuracies. Under 200 words."
- **Audit:** "Sweep all 8 chapter MDX files. List any claim stated more confidently than the underlying ML literature supports."
- **Search:** Use `Explore` for read-only file/symbol hunts. Use `general-purpose` for anything that needs synthesis.

**Always cap the report length** in the consultant's prompt. A 200-word ceiling forces them to distill — and protects your context.

### 2. Builders — implement a feature end-to-end in an isolated worktree

Used during the parallel chapter phase (one builder per chapter) and for any feature large enough to deserve its own branch.

Each builder's dispatch prompt must include:

- The absolute path to `GOAL.md`.
- The chapter number, slug, and target file paths.
- The worktree path it should work in.
- The branch it should commit to.
- Explicit instruction: "Read `GOAL.md` and `tasks/_shared.md` first. Update `tasks/<branch>.md` as you go. Commit incrementally — one logical change per commit, no squash."
- A definition of done: e.g. "Build green (`bun run build`), chapter renders in dev server, prev/next links wired to the right neighbors."

You verify (diff + build) before merging the builder's branch into `main`.

---

## Self-check and iterate until the limit is reached

A first-pass output is rarely the final product. Every agent — consultant, builder, **and the orchestrator itself** — must self-check its own output and iterate until either (a) no further meaningful improvement can be found, or (b) a stated limit is reached.

### Self-check questions the agent runs on its own output

- Does it meet the explicit definition of done from the dispatch prompt?
- Does it match the conventions in `GOAL.md` and `AGENTS.md`?
- Are there obvious bugs, dead code, or unhandled edge cases?
- Is anything stated more confidently than the evidence supports?
- For builder agents specifically:
  - Does `bun run build` pass cleanly?
  - Does the chapter render at the expected URL with no console errors?
  - Are prev / next links pointing at the right neighbors?
  - Do imported components actually exist?
- For consultant agents specifically: is the report under the word cap? Are claims sourced?

### Iteration limits (must be stated in the dispatch prompt)

Every dispatch prompt must include explicit limits so the agent knows when to stop:

- **Max iterations** — usually 3. Hard ceiling regardless of remaining issues.
- **Token budget** (optional) — "If you have spent more than X tokens, stop and report."
- **No-improvement break** — if an iteration produces no meaningful improvement over the previous one, stop. Don't spin.
- **Time guard** (optional) — for genuinely long jobs, a wall-clock budget.

Without limits the agent will either stop too early (one shot and done) or spin indefinitely. Both are failure modes.

### Mandatory reporting format

Every agent's final report ends with:

```
Iterations used: N of MAX
Improvements per iteration:
  1: <one line>
  2: <one line>
  …
Remaining issues NOT fixed: <list, or "none">
Reason for stopping: definition-of-done met | iteration limit hit | no-improvement break | token budget hit
```

If the agent hit a limit with known unresolved issues, it surfaces them explicitly so the orchestrator can decide whether to dispatch a follow-up rather than silently accepting incomplete work.

### Orchestrator self-check

Before declaring **any phase** done (bootstrap, skeleton, a chapter, README, final review), the orchestrator runs its own self-check pass:

1. Walk the success criteria in `GOAL.md` for this phase. For each: does the current state satisfy it? If not, dispatch a follow-up.
2. `git log feat/<branch>` — is the commit history clean and narratively readable, or does it need a cleanup pass before merge?
3. `bun run build` — green?
4. Are there any open `tasks/<branch>.md` notes flagging unresolved questions?

The orchestrator iterates the phase (dispatch more work, fix issues, re-merge) until self-check passes or it hits its own configured ceiling — at which point it surfaces the situation to the human rather than declaring victory.

---

## Parallel dispatch

When several independent tasks are ready (canonical case: chapters 1–7 after the skeleton lands), dispatch all of them in **one message** with multiple `Agent` tool calls in parallel. Sequential dispatch wastes wall-clock time for no benefit. Run independent consultant queries in parallel for the same reason.

---

## Context hygiene

Your context is the bottleneck of a long-running session. Discipline:

- **Don't re-read what hasn't changed.** Trust the file state the harness reports.
- **Capture decisions, drop noise.** When a subagent returns a 500-word report, distill it into 1–3 actionable lines (and write any cross-cutting decisions into `tasks/_shared.md`). Don't quote the whole report back.
- **Trust but verify edits.** A subagent's summary describes intent, not necessarily what landed. After any builder, check the diff (`git -C <worktree> diff`) and run `bun run build` before merging.
- **Move heavy investigation to subagents.** Grep sweeps, log trawls, broad searches → spawn an `Explore` or `general-purpose` agent and keep only the findings.
- **Prune `tasks/` periodically.** Once a branch is merged, archive its `tasks/<branch>.md` (move into `tasks/archive/` or delete) so the live coordination surface stays small.

---

## Resumption protocol (the long-running part)

When you pick up a session after a break, do this **in order, before taking action**:

1. `cat GOAL.md` — re-anchor on what we're building.
2. `cat AGENTS.md` — re-anchor on how to execute.
3. `git log --oneline --all` — see what's been done.
4. `git branch -a` and `git worktree list` — see what's in flight.
5. `ls tasks/` and read `tasks/_shared.md` plus any active `tasks/<branch>.md`.
6. Identify the next unblocked item in `GOAL.md`'s **Implementation order** section.
7. State in one sentence what you're picking up and why — then proceed.

The combination of **GOAL.md** (source of truth) + **AGENTS.md** (execution playbook) + **git log** (granular changelog) + **`tasks/`** (live coordination state) is designed to make resumption cheap. Keep all four honest.

---

## What the orchestrator should *not* delegate

- Reading `GOAL.md` and `AGENTS.md` at session start.
- Architectural decisions about the project shape.
- Merging feature branches into `main`.
- Final integration review before declaring a phase done.
- Anything a single `Read` or `Bash` call would resolve in seconds — delegating those wastes more tokens than it saves.

---

## Cost discipline checklist

Before every `Agent` call, ask:

1. **Is this delegatable at all?** (Or can I do it in one tool call?)
2. **What's the cheapest model that can do it well?** (Default to Haiku for spec'd work; only step up if the task needs judgment.)
3. **Can I cap the response length?** (Almost always yes for consultants.)
4. **Can I run this in parallel with other dispatches?** (If yes, batch in one message.)
5. **Am I clear what "done" looks like?** (Vague prompts produce bloated work.)

Five seconds of discipline here saves orders of magnitude in tokens across a long session.
