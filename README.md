# Dispatch: cheap agents do the simple work, Opus only gets the hard part

A Claude Code plugin with one skill and three agents. Your main model plans the job. Haiku agents sweep the whole scope and fix the simple things, and one Opus agent gets only the hard list, then reviews the whole diff.

I tested it rather than guessing. 45 runs on a 50-file repo with 16 planted bugs, a hidden judge, and one vague instruction: "go through the code and fix the bugs".

| Setup | Bugs fixed (of 16, mean of 3 runs) | Cost per run |
|---|---|---|
| Opus alone | 15.3 (missed bugs in 2 of 3 runs) | $1.63 |
| **Opus + Dispatch** | **16.0, every run** | **$2.33** |
| Haiku alone | 14.7 | $0.23 |
| **Haiku + Dispatch (always-on)** | **15.7** | **$1.55** |
| Fable alone | 15.0 | $4.28 |

- **The most reliable setup:** Opus with Dispatch found all 16 bugs in all 12 of its runs, across three versions of the skill. Opus alone found all 16 in only 1 of 3.
- **The best value:** Haiku as the main model with Dispatch matched Opus alone (15.7 vs 15.3) for slightly less ($1.55 vs $1.63). Haiku does the volume, and Dispatch brings Opus in exactly once.
- **Don't run it on Fable:** it cost more than Opus and scored lower.

## Install

**Plugin**, one command (needs Claude Code 2.1.292+ in the shell, 2.1.275+ inside a session):

```
claude plugin install dispatch --marketplace beriki770-ship-it/dispatch-skill
```

Or inside a session:

```
/plugin marketplace add beriki770-ship-it/dispatch-skill
/plugin install dispatch@dispatch-skill
```

**Make it always-on.** This is recommended, and essential if your main model is Haiku or Sonnet. A plugin skill loads only when Claude decides it's relevant. Opus picked it up on its own in every run, but Haiku didn't pick it up in any of them. Keep the plugin installed (the pinned agents live there) and paste the block from `PROMPT.txt` into `~/.claude/CLAUDE.md`. The benchmark's "always-on" rows used the full skill pinned to the system prompt; `PROMPT.txt` is its condensed form and wasn't benchmarked on its own.

**Manual install** if you don't use plugins: copy `skills/dispatch/` to `~/.claude/skills/dispatch/` and `agents/*.md` to `~/.claude/agents/`. Agents installed this way are called `sweeper`, `deep` and `reviewer`, without the `dispatch:` prefix.

## What's inside

- **`skills/dispatch/SKILL.md`** is the playbook:
  - the measured routing table
  - the "split by difficulty, never by folder" rule
  - a hard trigger that makes Haiku and Sonnet call Opus on big or security-touching jobs
  - a 150-turn cap per agent
  - a 4-line return format
  - a dispatch ledger, so a crashed session resumes where it stopped
- **The agents have their models pinned in the frontmatter**, so the right model runs even when the main loop forgets to pass `model`:

  | Agent | Model | Job |
  |---|---|---|
  | `dispatch:sweeper` | Haiku | Fixes mechanical and checkable issues across the whole scope. Returns a HARD list. |
  | `dispatch:deep` | Opus | Fixes only the HARD list, then reviews the full diff and hunts for misses. |
  | `dispatch:reviewer` | Sonnet | A mid-price diff review for jobs that didn't need a deep pass. |
- **`PROMPT.txt`** is the always-on version, short enough to paste into `CLAUDE.md`.
- **`bench/`** holds the whole benchmark: the repo, the hidden judge, the reference fix, the runner and the raw results. You can rerun every number above yourself.

## How it got here

The first version made things worse, and the benchmark showed why:

1. **v1: "route by tier".**
   - Opus + skill reached 16/16, but at $3.96, 2.4x the cost of Opus alone.
   - Across 24 runs, 22 agents were dispatched: 14 Opus, 8 Sonnet, **0 Haiku**. Opus split the work by folder, every folder held a hard bug, so every folder went to Opus.
   - Haiku and Sonnet as main models sent zero agents in 12 runs, with or without the skill.
2. **v2: split by difficulty, plus pinned agents.**
   - Haiku sweepers started doing the volume, for 6 to 16 cents per run.
   - Opus still cost $3.38, because it ran several Opus agents plus a Sonnet reviewer.
3. **v2.1: exactly one Opus pass.**
   - $2.33 with 16/16 every run.
   - The hard trigger fired in 3 of 3 Haiku runs, up from 2 of 3.

The money is almost all in Opus contexts. The Haiku stage costs cents. So the lever is how many times Opus has to load the job, and Dispatch now makes that once.

## Honest limits

- It's one synthetic JavaScript repo with three runs per cell. Treat it as a direction, not a law, and rerun `bench/` on your own kind of work.
- My own global `CLAUDE.md` loaded in every run, because Claude Code has no switch to turn it off. Your numbers will shift.
- Costs are what Claude Code reports (`total_cost_usd`, subagents included). On a subscription they're an API-price estimate.
- On small jobs, a few files or one dependent chain, Dispatch tells the model not to dispatch at all. Anthropic's own measurements say a single model wins there. See the "When NOT to use this" section of the skill.

Benchmark total: 45 runs, $93.82.

## Pairs well with

[handoff-skill](https://github.com/beriki770-ship-it/handoff-skill). The dispatch ledger lives in the `HANDOFF.md` that skill maintains.

## License

MIT. Built by [Wild Digital Moments](https://digital.wildmoments.at/).
