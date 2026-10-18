#!/bin/bash
# Benchmark runner: one vague instruction against shop/, scored later by judge/judge.js.
#
# usage:  bench/run.sh <reps> <arm> [<arm> ...]
#   arm = <name>:<model>:<mode>
#   mode = solo    the model alone, no skill
#          plugin  the repo loaded as a plugin (--plugin-dir): skill loads only if Claude picks it, agents available
#          always  plugin + the skill appended to the system prompt (= the always-on CLAUDE.md install)
#          combo   haiku alone first, then opus reviews the diff (review-prompt.txt)
# example: bench/run.sh 3 opus-always:opus:always haiku-solo:haiku:solo combo:x:combo
#
# env: RUNS (output dir, default $TMPDIR/dispatch-bench), PARALLEL (default 3),
#      PROMPT_FILE (default bench/prompt-en.txt), START_AT (HH:MM, wait until then first)
# Each run is a fresh copy of shop/ (own git repo) so the agent can `git diff` its own work.
# Hooks are disabled for the run; your global CLAUDE.md still loads (Claude Code has no switch for that).
set -u
BENCH=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$BENCH")
RUNS=${RUNS:-${TMPDIR:-/tmp}/dispatch-bench}
PARALLEL=${PARALLEL:-3}
PROMPT_FILE=${PROMPT_FILE:-$BENCH/prompt-en.txt}
mkdir -p "$RUNS"
TIMEOUT=$(command -v timeout || command -v gtimeout) || { echo "needs GNU timeout (macOS: brew install coreutils)" >&2; exit 1; }
reps=$1; shift

claude_run() {  # dir model log promptfile [skillfile]
  local extra=()
  [ -n "${5:-}" ] && extra=(--append-system-prompt-file "$5")
  [ -n "${PLUGIN:-}" ] && extra+=(--plugin-dir "$ROOT")
  (cd "$1" && "$TIMEOUT" 3600 claude -p --model "$2" --no-session-persistence \
    --permission-mode bypassPermissions --settings '{"disableAllHooks":true}' ${extra[@]+"${extra[@]}"} \
    --output-format stream-json --verbose < "$4" > "$3" 2> "$3.err")
}

one() {  # run-name model mode
  local name=$1 model=$2 mode=$3 dir="$RUNS/$1" s
  rm -rf "$dir"; cp -r "$BENCH/shop" "$dir"
  # shop/ ships without .git (a nested repo can't live inside this one); give each copy its own baseline commit
  [ -d "$dir/.git" ] || (cd "$dir" && git init -q && git add -A && git -c user.name=Bench -c user.email=bench@example.com commit -qm initial)
  s=$(date +%s)
  case "$mode" in
    solo)  claude_run "$dir" "$model" "$RUNS/log-$name.jsonl" "$PROMPT_FILE" ;;
    plugin) PLUGIN=1 claude_run "$dir" "$model" "$RUNS/log-$name.jsonl" "$PROMPT_FILE" ;;
    always) PLUGIN=1 claude_run "$dir" "$model" "$RUNS/log-$name.jsonl" "$PROMPT_FILE" "$ROOT/skills/dispatch/SKILL.md" ;;
    combo) claude_run "$dir" haiku "$RUNS/log-$name.jsonl" "$PROMPT_FILE"
           claude_run "$dir" opus "$RUNS/log-$name-review.jsonl" "$BENCH/review-prompt.txt" ;;
  esac
  echo "$name exit=$? secs=$(( $(date +%s) - s ))" >> "$RUNS/status.txt"
}
export -f one claude_run; export BENCH ROOT RUNS PROMPT_FILE TIMEOUT

if [ -n "${START_AT:-}" ]; then  # single bounded sleep, never a polling loop
  now=$(date +%s); target=$(date -d "today $START_AT" +%s)
  [ "$target" -gt "$now" ] && sleep $(( target - now ))
fi

for r in $(seq "$reps"); do
  for arm in "$@"; do IFS=: read -r n m k <<< "$arm"; echo "$n-r$r $m $k"; done
done | xargs -P "$PARALLEL" -L 1 bash -c 'one $0 $1 $2'
echo DONE >> "$RUNS/status.txt"
