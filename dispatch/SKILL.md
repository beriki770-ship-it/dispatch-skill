---
name: dispatch
description: The orchestrator plans, cheaper agents execute. For any multi-part task, the main-loop model (Fable when available, otherwise Opus) stays the planner/orchestrator and dispatches subagents, each on the cheapest model tier that can do its piece well — Opus for judgment-heavy work, Sonnet for standard engineering, Haiku for mechanical work. Independent pieces run in parallel; the orchestrator verifies everything before reporting done. Also keeps the main conversation's context lean, and checkpoints all dispatch state to a file so a compacted or interrupted session loses no work.
---

# dispatch — the orchestrator plans, agents execute

The orchestrator's job in this mode is thinking, not typing: decompose, route, dispatch, verify, synthesize. The implementation happens in subagents running on cheaper models, each matched to its task.

**Who the orchestrator is:** whatever model runs the main loop. Fable when available; when it isn't, **Opus IS the orchestrator** and does all of this itself — plan, route, dispatch, verify, synthesize. The skill degrades by tier, never by disappearing.

## When NOT to use this

- The task is one small thing (one file, one fix, one answer) — dispatching costs more than doing. Just do it.
- The task needs continuous conversation with the user (design back-and-forth, decisions mid-way).
- Everything depends on everything (no parallelizable or delegable pieces).

## The flow

1. **Plan.** Break the task into concrete pieces with clear deliverables. Identify which pieces are independent (parallel) and which depend on others (sequential). Gather any context agents will need BEFORE dispatching — agents cannot ask questions. Write the plan into a **dispatch ledger** in the project's `HANDOFF.md` (see Session survival) before firing.
2. **Route.** Assign each piece a model tier using the table below. When torn between two tiers, take the cheaper one — the escalation ladder catches failures.
3. **Gate.** Small dispatch (≤5 agents, at most one Opus) → fire immediately, no ceremony. Bigger than that → show the user the plan first: pieces, tiers, rough scale. One short message, then wait for their go.
4. **Dispatch.** Independent pieces: multiple Agent calls in ONE message so they run concurrently. Dependent pieces: wait for the prerequisite, feed its result into the next prompt. Long-running pieces go `run_in_background` so orchestration never stalls. File conflicts: first choice is assigning agents **disjoint file sets** in the same tree — no isolation needed; only when two agents genuinely must touch the same files, give them `isolation: "worktree"`, and the orchestrator owns merging the worktrees back afterward.
5. **Verify.** Never trust an implementer's own summary. Breadth goes to a cheap **reviewer agent** (Sonnet): it reads the implementer's diff against the piece's goal and returns a short verdict. The orchestrator still runs the build/tests itself and spot-checks the critical hunks directly. UI changes get clicked through in the preview.
6. **Synthesize.** One coherent report to the user: what was done, what was verified, what's left. Update the ledger to final state.

## Routing table

| Tier | `model` | Give it | Examples |
|------|---------|---------|----------|
| **Haiku** | `haiku` | Mechanical work with zero judgment calls | Renames, find-replace across files, boilerplate from an explicit template, format conversions, moving files, extracting data, running a command and reporting output |
| **Sonnet** | `sonnet` | Standard engineering with a clear spec | Well-scoped features, tests for existing behavior, refactors inside one module, CRUD endpoints, styling from a mockup, docs, straightforward bug fixes, diff review |
| **Opus** | `opus` | Judgment-heavy pieces | Multi-file refactors, debugging with unclear cause, performance work, security-sensitive code, tricky edge cases, anything where a wrong local decision breaks other pieces |
| **Orchestrator** | (main loop — Fable, or Opus when Fable is unavailable) | Never delegated | The plan itself, decomposition, routing, resolving conflicts between agents' outputs, final verification, synthesis. Implements directly only when dispatch overhead exceeds the task, or after the escalation ladder is exhausted |

Read-only reconnaissance (find where X lives, map a subsystem) goes to the **Explore** agent type — it's built for that and can run on `haiku`/`sonnet`.

## Writing the agent prompt

Every dispatch prompt must be self-contained — the agent has none of this conversation. Include:

- **Goal** — one sentence, what done looks like.
- **Context** — exact file paths, project conventions to follow, relevant facts from the handoff file.
- **Deliverable** — exactly what to produce (files edited, data returned as raw text).
- **Boundaries** — what NOT to touch.
- **Self-check** — a command the agent should run to verify itself (build, test, lint) before returning.
- **Return format** — end every prompt by dictating this exact skeleton as the ONLY thing the agent returns:

  ```
  STATUS: done | partial | blocked
  CHANGED: <affected paths, one line each>
  VERIFIED-BY: <command run + its result, one line>
  NOTES: <≤5 lines — only what the orchestrator must know>
  ```

  No logs, no file dumps, no prose. This caps context cost and makes verification a scan.

If the deliverable is user-facing text or UI, state your writing/design guidelines inline in the prompt — the agent may not have access to your other skills.

## Follow-ups vs. escalation

Two different situations, two different moves:

- **Small miss** (approach was right, one thing missing — "also update the import in X"): message the **SAME agent** (SendMessage). It still has its context; a two-line nudge beats re-briefing a fresh agent from zero.
- **Real failure** (wrong approach, failed verification): retry ONCE with a **new agent one tier up**, including the failed output and why it failed. Fails again → the orchestrator fixes it directly.

Max two agent attempts per piece. Never silently accept broken output.

## Big uniform fan-outs → Workflow

When the plan contains many pieces of the same shape (~8+ — migrate N files, audit N pages, generate-then-verify N findings) and your environment has the **Workflow tool**, don't loop Agent calls by hand — use it. This skill being active counts as the user's opt-in for it. What it buys: schema-enforced structured returns (no format drift), `pipeline()` so items flow through stages without waiting for the slowest, adversarial-verify patterns, and per-agent `model`/`effort` overrides for the same tiering as the routing table. The moment a workflow launches, record its **runId and script path in the dispatch ledger** — if the session dies mid-run, the next session resumes with `resumeFromRunId` and every completed agent comes back from cache instead of being re-run and re-paid.

## Cost discipline

- Haiku is the default for anything mechanical. Opus only where Sonnet would plausibly get it wrong.
- Don't split a task thinner than its pieces are worth — five 30-second Haiku jobs are worse than one 3-minute Sonnet job.
- Cap concurrent heavy agents (~5); queue the rest.

## Context hygiene — keep the main conversation lean

Dispatching isn't only about cost; it's how the main context stays clean. An agent's context is disposable — it can read 40 files and die; the main conversation keeps only its conclusion. Rules:

- **Heavy reading goes to agents, never into the main context.** Exploring a codebase, scanning logs, reading long docs, sweeping many files — dispatch an Explore/general-purpose agent and take back only the answer. The orchestrator reads a full file directly only when it's about to edit that file itself.
- **The return-format skeleton is the cap.** An agent that returns 500 lines of raw output has polluted the main context; the dictated skeleton is what prevents it.
- **Verify with targeted reads.** Check an agent's work by reading the specific hunks it changed and running the test command — not by re-reading everything it read.
- **Don't relay raw agent output to the user.** Synthesize. If the full output matters, write it to a file and give the path instead of pasting it into chat.
- **Batch small mechanical items into one agent** instead of many round-trips — each dispatch/return cycle costs main-context tokens too.

## Token budget & session survival — never lose the work

The threat: the session hits its usage limit or gets compacted mid-dispatch, and everything that lived only in conversation text is gone. Defenses:

- **Dispatch ledger in the handoff file.** Before firing, write the plan as a checklist — per piece: description, tier, status (`pending / dispatched / returned / verified`) — and update it at every status change, not at the end. The test: a brand-new session reading only the ledger can continue mid-dispatch without asking anything.
- **Persist every verified piece immediately.** Files saved, committed if the project is a repo, BEFORE dispatching the next wave. The only copy of a result must never be chat text.
- **Finish fewer pieces fully rather than starting everything.** If the plan plausibly exceeds what's left of the session, cut it: complete and verify a subset, leave the rest `pending` in the ledger. Ten started + zero verified = everything lost; four verified + six pending = real progress.
- **Stay lean while orchestrating.** Short status messages, no re-deriving what's already established, batched dispatches, SendMessage instead of re-briefing, workflow runId recorded for cache-resume.
- **Wrap up gracefully, not abruptly.** At signs the session is stretching (compaction notices, a long heavy conversation), stop opening new pieces, checkpoint the ledger, and report exact state. The next conversation reads the handoff and continues — nothing is lost.

## Tuning notes (living)

When routing misses — a tier fails on work the table sent it, or an expensive tier was clearly unnecessary — append a dated line here so the table sharpens with real use instead of staying a guess:

- (none yet)
