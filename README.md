# Dispatch — your top model plans, cheaper agents do the work

A rule for Claude Code that turns any multi-part task into an orchestrated one:
the main model (Fable, or Opus if that's what you run) breaks the task down, then
sends each piece to a subagent on the cheapest model that can handle it — Haiku
for mechanical work, Sonnet for standard engineering, Opus for the hard parts.
Independent pieces run in parallel. The orchestrator verifies everything itself
before saying "done".

Three things you get out of it:

- **Lower cost.** Opus-level reasoning only where it's needed; the bulk runs on
  Sonnet and Haiku.
- **A clean main conversation.** Agents do the heavy file-reading in their own
  disposable context and return a four-line structured result. Your session
  doesn't fill up with noise.
- **Crash-proof progress.** Every dispatch keeps a ledger in the project's
  `HANDOFF.md`, updated on every status change, and each verified piece is saved
  to disk immediately. If the session hits its limit mid-task, a fresh session
  reads the ledger and continues — nothing is lost.

There are two ways to install it. **Option A is the reliable one.**

---

## Option A — always-on rule (recommended)

Works in **Claude Code** (CLI, desktop app, or claude.ai/code).

1. Open (or create) `~/.claude/CLAUDE.md`
   - Windows: `C:\Users\<you>\.claude\CLAUDE.md`
   - Mac/Linux: `~/.claude/CLAUDE.md`
2. Paste in the block from `PROMPT.txt` (the part below the `---` line).
3. Done. It applies to every multi-part task in every session, automatically.

## Option B — install as a skill

Also for Claude Code. Skills load when Claude decides they're relevant, so this
is slightly less bulletproof than Option A — but it carries the full playbook
(routing table, escalation ladder, session-survival rules) in more detail.

1. Copy the `dispatch` folder into `~/.claude/skills/` so you end up with:
   `~/.claude/skills/dispatch/SKILL.md`
2. (Recommended) Add this line to your `~/.claude/CLAUDE.md` so it truly always
   applies:

   ```
   # dispatch
   For ANY multi-part task, follow ~/.claude/skills/dispatch/SKILL.md as the
   default operating mode — no need to be asked.
   ```

Best of both: do A **and** B. The CLAUDE.md block guarantees the behavior; the
skill file supplies the full detail when it loads.

## Which model is "the orchestrator"?

Whatever runs your main conversation — Fable, Opus, Sonnet or Haiku. The tier
of each subagent is picked from its piece of work, never from the orchestrator,
so any main model can dispatch any tier, including ones above itself: Haiku
sends Opus, and Opus sends Fable for hours-long autonomous units or once Opus itself has failed. If the main model
is weaker than the job (running Haiku as the main loop on a real refactor,
say), it hands the plan and the final review up to a stronger agent and keeps
only the bookkeeping. If a tier isn't available on your account, it uses the
next one down and says so.

## Measured, not guessed

The routing was tuned on a benchmark: a 50-file repo with 16 seeded bugs and a
hidden judge, one vague line ("fix the bugs"), four main models with and
without the skill, three runs each (24 runs). Mean bugs fixed out of 16:

| Main loop | Without skill | With skill |
|---|---|---|
| Haiku | 14.7 ($0.23) | 15.0 ($0.24) |
| Sonnet | 10.3 ($0.47) | 13.0 ($0.61) |
| Opus | 15.3 ($1.63) | **16.0 every run ($3.96)** |
| Fable | 15.0 ($4.28) | 16.0 ($5.89) |

What changed because of it: Haiku and Sonnet main loops never dispatched on
their own, so the skill now forces an Opus review on big or security-touching
jobs; Fable was demoted to "only for multi-hour autonomous units or after Opus failed"; Haiku got wider work
wherever the result can be checked; and every fix agent is told that green
tests are not the finish line. It's one synthetic JavaScript repo and three runs
per cell, so read it as a direction, not a law.

## Pairs well with

[handoff-skill](https://github.com/beriki770-ship-it/handoff-skill) — the
dispatch ledger lives in the `HANDOFF.md` file that skill maintains. Together:
orchestrated execution + zero context loss between sessions.

## Requirements

Claude Code with subagents (the Agent tool). The Workflow section only applies
if your environment has the Workflow tool — everything else works without it.
