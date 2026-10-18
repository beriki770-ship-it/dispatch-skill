# The benchmark

Reproduce every number in the main README yourself.

## What's here
- **`shop/`**: the codebase under test. It's a small Node.js e-commerce library with 50 source files, 110 tests and zero dependencies, and each run gets its own git baseline. 16 bugs were planted in it:
  - 5 mechanical
  - 5 standard
  - 4 security
  - 2 cross-module

  The visible tests catch 8 of them. Nothing in the code hints at which lines are wrong.
- **`judge/judge.js`**: the hidden judge, one behavioural check per bug plus a regression check. `judge/BUGS.md` is the answer key.
- **`ref/`**: a reference fix. The judge scores the untouched `shop/` 0/16 and `ref/` 16/16, and the regression check passes on both.
- **`prompt.txt`**: the line every run got. Ours was Hebrew; `prompt-en.txt` is the English equivalent ("Go through the code and fix the bugs.").
- **`run.sh`**: the runner.
- **`analyze.py`**: the scorer.
- **`results/`**: raw results from our runs. Round 1 is the first 24 runs (skill v1), rounds 2-4 are v2 and v2.1.

Don't show `judge/`, `ref/` or `BUGS.md` to the model you're testing. Each run works on a fresh copy of `shop/` in your temp dir.

## Run it
Needs Claude Code (logged in), Node 20+, Python 3, bash 4+ and GNU `timeout` (Git Bash on Windows works; on macOS `brew install coreutils bash`, and `START_AT` needs GNU date).

```bash
# 3 runs each: Opus alone, Opus with the plugin, Haiku alone
RUNS=/tmp/dispatch-bench bash bench/run.sh 3 opus-solo:opus:solo opus-plugin:opus:plugin haiku-solo:haiku:solo
RUNS=/tmp/dispatch-bench python bench/analyze.py
```

Modes:
- `solo`: the model alone.
- `plugin`: this repo loaded with `--plugin-dir`, the way a real install works. The skill loads only if Claude picks it.
- `always`: the plugin plus the skill pinned to the system prompt, which equals the always-on install.
- `combo`: Haiku alone, then one Opus pass over the diff.

Defaults are `PARALLEL=3` and `PROMPT_FILE=bench/prompt-en.txt`.

## Honest limits
- It's one synthetic JavaScript repo with three runs per cell, so read the results as a direction and not a law.
- Your own `~/.claude/CLAUDE.md` loads into every run, because Claude Code has no switch to turn that off. Ours did too.
- Costs are the `total_cost_usd` Claude Code reports, including subagents. On a subscription they're an API-price estimate.
