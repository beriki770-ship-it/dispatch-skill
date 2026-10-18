---
name: dispatch
description: The orchestrator plans, cheaper agents execute. For any multi-part task, whatever model runs the main loop (Fable, Opus, Sonnet or even Haiku) stays the planner/orchestrator and dispatches subagents, each on the model tier that fits its piece — Haiku for checkable volume work, Sonnet for spec'd engineering, Opus for judgment (and the default when unsure), Fable only for multi-hour autonomous units or after Opus failed. The tier follows the task, never the orchestrator: any main model can send any tier, including tiers above itself. Tuned on a measured 24-run benchmark and Anthropic's published cost data. Independent pieces run in parallel; the orchestrator verifies everything before reporting done. Also keeps the main conversation's context lean, and checkpoints all dispatch state to a file so a compacted or interrupted session loses no work.
---

# dispatch — the orchestrator plans, agents execute

The orchestrator's job in this mode is thinking, not typing: decompose, route, dispatch, verify, synthesize. The implementation happens in subagents running on cheaper models, each matched to its task.

**Who the orchestrator is:** whatever model runs the main loop — Fable, Opus, Sonnet or Haiku. The skill works the same from every seat.

**The task picks the agent, never the orchestrator.** Each piece gets the tier that fits it exactly, judged from the piece alone:

- **Dispatch upward freely.** A Haiku or Sonnet main loop sends Opus; Opus sends Fable when Opus itself has failed on the piece. The orchestrator's own tier is never a ceiling.
- **No inflation, no deflation.** An expensive orchestrator still sends renames to Haiku; a cheap one never sends a security fix to Haiku because that's "its level".
- **Orchestrator weaker than the task?** If the main loop sits below the hardest judgment in the job (e.g. Haiku or Sonnet running a multi-part refactor), it delegates the thinking upward too: the **plan** comes from an Opus planner agent (Fable only if Opus has failed), and the **final review** from an agent at least as strong as the hardest piece. The main loop then runs the ledger, dispatches and checks evidence mechanically. Running a weak main loop this way costs one extra planner call, which is still cheaper than a wrong plan.
- **Hard trigger, because weak mains don't escalate on their own.** Measured: in 12 runs of a vague one-line "fix the bugs" on a 50-file repo, Haiku and Sonnet main loops dispatched **zero** agents, with or without this skill — they named the right routing when asked, and still worked solo. So it is not left to judgment: a Haiku or Sonnet main loop whose job touches **more than ~20 files, or any auth / payment / money / upload / security code**, MUST dispatch at least one **Opus reviewer** over the finished diff before reporting done.
- **Tier unavailable** (the alias is rejected, the account doesn't have it) → use the next tier down that exists and note the substitution in the ledger. Never silently drop to the bottom.

## When NOT to use this

- The task is one small thing (one file, one fix, one answer) — dispatching costs more than doing. Just do it.
- The task needs continuous conversation with the user (design back-and-forth, decisions mid-way).
- Everything depends on everything (no parallelizable or delegable pieces).
- **The work is one dependent chain, or fits comfortably in one context.** Anthropic measured that for such work the lead model alone at lower effort beat orchestrator-plus-workers in every case; delegation paid off only for independent pieces, work larger than one context window, or routine work with a long cost tail. Multi-agent runs cost ~15x the tokens of a chat — the pieces have to be worth it.

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
| **Haiku** | `haiku` | Volume work whose result can be **checked** (tests, a spec, a judge, a diff) | Renames, find-replace, boilerplate, format conversions, extraction, sweeps, link/screenshot checks — and first-pass bug sweeps on code with tests or a spec (measured: 15/16 seeded bugs for $0.24, vs 16/16 for $3.96 on Opus+dispatch). Never the only judge on security, money or client code: it missed the same bug in 6/6 runs. Its price jumps 5x above a 100K-token prompt — keep its units small |
| **Sonnet** | `sonnet` | Standard engineering with a clear spec and a clear finish line | Well-scoped features, tests for existing behavior, refactors inside one module, CRUD endpoints, styling from a mockup, docs, straightforward bug fixes, diff review |
| **Opus** | `opus` | Judgment-heavy pieces — and **the default when unsure** (Anthropic's own advice) | Multi-file refactors, debugging with unclear cause, performance work, security-sensitive code, tricky edge cases, anything where a wrong local decision breaks other pieces |
| **Fable** | `fable` | Only (a) an autonomous unit that runs for hours / deep research, or (b) a piece **Opus already failed** at higher effort | Never a default, never for volume, never the "hard piece" tier by reflex. Measured: as main loop it reached the same 16/16 as Opus at +49% cost, and solo it scored below solo Opus at 2.6x the price; Anthropic's SWE-bench data shows the same score as Opus at ~5x cost per solved task |
| **Orchestrator** | (main loop — any model) | Routing, the ledger and synthesis stay here; the plan and final review go UP to a stronger agent when the main loop is below the hardest piece | The plan itself, decomposition, routing, resolving conflicts between agents' outputs, final verification, synthesis. Implements directly only when dispatch overhead exceeds the task, or after the escalation ladder is exhausted |

Always pass the **alias** (`haiku` / `sonnet` / `opus` / `fable`), never a dated model id — the alias follows each new generation, a pinned id goes stale.

**Effort is a routing field too.** Anthropic: "tuning effort is often a better lever than switching models." Where a checker exists (tests, judge, spec), run the unit at low/medium effort first and re-run **only the failures** one effort level or one tier up — Anthropic measured ~97% solved for $0.17 per task this way vs 95.3% for $0.29 with everything at high. Set effort once per agent; changing top-level effort mid-session breaks the cache.

**Cheap pass, strong check.** For a broad sweep (all bugs, all pages, all links): Haiku does the pass, then one Opus agent reviews what Haiku changed and what it may have missed. Cheaper than Opus doing everything; not yet benchmarked here — measure before relying on it for client work.

**Model resolution order** (Claude Code): the per-call `model` parameter > the agent definition's frontmatter > `CLAUDE_CODE_SUBAGENT_MODEL` > the parent's model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` silently overrides every per-call choice — check for it if routing seems ignored. `/tasks` shows which model each agent actually ran on.

`subagent_type: "fork"` ignores `model` entirely — a fork always inherits the orchestrator's model, so it is never a way to save tokens.

Read-only reconnaissance (find where X lives, map a subsystem) goes to the **Explore** agent type — it's built for that and can run on `haiku`/`sonnet`. Trap: when the main loop is Fable, built-in Explore runs on **Opus** — pass `model: "haiku"` per call, or define your own Explore agent with `model: haiku`.

## Writing the agent prompt

Every dispatch prompt must be self-contained — the agent has none of this conversation. Include:

- **Goal** — one sentence, what done looks like.
- **Context** — exact file paths, project conventions to follow, relevant facts from the handoff file.
- **Deliverable** — exactly what to produce (files edited, data returned as raw text).
- **Boundaries** — what NOT to touch.
- **Write gate** — if the agent may write code, paste this block verbatim (agents can't load skills, and unrequested code is the main source of garbage in a fan-out):

  ```
  WRITE GATE — before you write any code:
  List every unit you intend to write (file / function / route / config key / dependency).
  For each, name the CONCRETE caller that will reach it (file:line, route, entry point)
  or the line of this task that asks for it verbatim. No named caller → do not write it.
  Prefer editing existing code over adding a file. Zero new code is a valid outcome.
  Never cut error handling on things that really fail, input validation, or accessibility.
  Report: PLANNED: <n units> / WROTE: <m units> — one line per unit with its caller.
  ```

  Reject a return that doesn't carry `PLANNED / WROTE`.
- **Green tests are not done.** For any fix / audit / review piece, say in the prompt: passing tests only prove what the tests cover — after they pass, go through the code the tests don't reach, and compare the public API (export names, routes, parameters) against the README/spec. Measured: Sonnet stopped at "all tests pass" in 3 of 6 runs, fixing exactly the 8 test-covered bugs out of 16; an export name that contradicted the README was missed in 16 of 24 runs across all models.
- **Self-check** — a command the agent should run to verify itself (build, test, lint) before returning. **For anything visual, the self-check must be a rendered page the agent reads back with its own eyes** — scrolled viewport screenshots it actually opens, plus computed styles (`getComputedStyle`) on text and its background. Tag-balance checks, "0 external refs" and valid-HTML parses are NOT verification: in one measured run an agent passed all of those and shipped body text the same colour as its card background, a block at near-zero contrast, and a contact form that silently discarded every submission. Don't trust a bare `chrome --headless --screenshot` on animated content either (it can capture before the animation lands) — drive the browser over CDP, or scroll and re-capture. Agents must never kill a shared process such as the user's browser.
- **Return format** — end every prompt by dictating this exact skeleton as the ONLY thing the agent returns:

  ```
  STATUS: done | partial | blocked
  CHANGED: <affected paths, one line each>
  VERIFIED-BY: <command run + its result, one line>
  NOTES: <≤5 lines — only what the orchestrator must know>
  ```

  No logs, no file dumps, no prose. This caps context cost and makes verification a scan. A return without `STATUS` and a real `VERIFIED-BY` (a command and its result, not "looks good") counts as **unverified** — bounce it once, and if it comes back the same, treat the piece as not done.

If the deliverable is user-facing text or UI, state your writing/design guidelines inline in the prompt — the agent may not have access to your other skills.

## Follow-ups vs. escalation

Two different situations, two different moves:

- **Small miss** (approach was right, one thing missing — "also update the import in X"): message the **SAME agent** (SendMessage). It still has its context; a two-line nudge beats re-briefing a fresh agent from zero.
- **Real failure** (wrong approach, failed verification): retry ONCE with a **new agent one step up** — higher effort first if the tier was right, otherwise one tier up — including the failed output and why it failed. Re-run only the failed units, never the whole batch. Fails again → the orchestrator fixes it directly.

Max two agent attempts per piece. Never silently accept broken output.

## Big uniform fan-outs → Workflow

When the plan contains many pieces of the same shape (~8+ — migrate N files, audit N pages, generate-then-verify N findings) and your environment has the **Workflow tool**, don't loop Agent calls by hand — use it. This skill being active counts as the user's opt-in for it. What it buys: schema-enforced structured returns (no format drift), `pipeline()` so items flow through stages without waiting for the slowest, adversarial-verify patterns, and per-agent `model`/`effort` overrides for the same tiering as the routing table. The moment a workflow launches, record its **runId and script path in the dispatch ledger** — if the session dies mid-run, the next session resumes with `resumeFromRunId` and every completed agent comes back from cache instead of being re-run and re-paid.

## Cost discipline

- Haiku is the default for anything mechanical or checkable. Opus where Sonnet would plausibly get it wrong. Compare **cost per finished task**, not per token — a cheap model that needs three retries is not cheap.
- **Scale the number of agents to the job** (Anthropic's rule against over-investing): a lookup = 1 agent, a comparison = 2-4, more only for real breadth. In the benchmark, 3 sweep agents + 1 reviewer was enough for a 50-file repo.
- Don't split a task thinner than its pieces are worth — five 30-second Haiku jobs are worse than one 3-minute Sonnet job.
- **Cap concurrency by the machine, not by ambition.** Every agent is its own process tree (CLI, node, often a browser). Default ~3 at once; go to 4-5 only when there's real free RAM (~5 GB+). Each agent holds **at most one headless browser**, closes it as soon as its step is done, and checks free memory before opening one. Measured: an uncapped parallel fan-out, every agent with its own Chrome, pushed a 54 GB machine to ~47 GB commit — everything paged and the desktop took minutes to recover.
- **Turn cap — cache reads are the real bill.** Every turn re-reads the agent's whole context, so cost ≈ context size × turns. Measured: three uncapped Opus agents (two reviewers, one fact extraction; ~3,300 / ~2,000 / ~2,150 turns) burned ~2.85B tokens — 73% of everything spent in that window. Rules for every dispatch:
  - State a turn budget in the prompt: **≤150 turns**. At ~120 the agent writes its progress to a file and returns `partial`; a FRESH agent continues from that file. Never keep a long agent alive with SendMessage for more than a nudge.
  - One agent, one unit (one page, one module, one chapter) — never "the whole repo" in one agent.
  - **Critic, review and fact-extraction agents default to `sonnet`.** If Opus must judge, it judges the written summary file in a short run.
  - Images stay in context forever: review screenshots/frames as contact sheets; single full-size images only on suspicion (max ~8 per run).
  - Command output goes to a log file; the agent reads the tail only.
  - If you have a lean custom agent type with a small tool list and `maxTurns`, use it for long media/render work instead of general-purpose.
  - After a run, check each agent's usage: one over ~150 tool uses is a finding to report, not a normal result.

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

- 2026-10: uncapped reviewer/extraction agents on Opus were the single biggest cost line (see Turn cap) → reviews moved to Sonnet, ≤150-turn budget in every prompt.
- 2026-10: too many parallel agents with one browser each exhausted RAM → concurrency capped at ~3 (5 with free RAM), one browser per agent.
- 2026-10-18 benchmark: 50-file repo, 16 seeded bugs (hidden judge), one vague line "fix the bugs", 4 main models x {skill, no skill} x 3 runs = 24 runs, $51.93. Mean bugs fixed / mean cost:

  | Main loop | Without skill | With skill |
  |---|---|---|
  | Haiku | 14.7, $0.23 | 15.0, $0.24 |
  | Sonnet | 10.3, $0.47 | 13.0, $0.61 |
  | Opus | 15.3, $1.63 | **16.0 (3/3 runs), $3.96** |
  | Fable | 15.0, $4.28 | 16.0, $5.89 |

  Only Opus and Fable mains dispatched (3/3 each: 3 sweep agents + a reviewer). Haiku and Sonnet never did → added the hard trigger, demoted Fable, widened Haiku to checkable work, added "green tests are not done".
