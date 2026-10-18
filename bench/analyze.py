# Scores every benchmark run: hidden-judge bugs, cost, time, and which agents were dispatched.
import json, subprocess, os, collections, glob

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS = os.environ.get('RUNS') or os.path.join(os.environ.get('TMPDIR', '/tmp'), 'dispatch-bench')
JUDGE = os.path.join(HERE, 'judge', 'judge.js')
GRADE = {}  # bug id -> grade, read from BUGS.md table
for line in open(os.path.join(HERE, 'judge', 'BUGS.md'), encoding='utf-8'):
    cells = [c.strip() for c in line.split('|')]
    if len(cells) > 3 and cells[1].startswith('B') and cells[1][1:].isdigit():
        GRADE[cells[1]] = cells[2].lower()

secs = {}
if os.path.exists(f'{RUNS}/status.txt'):
    for l in open(f'{RUNS}/status.txt'):
        p = l.split()
        if len(p) == 3: secs[p[0]] = p[2].split('=')[1]

rows = []
import glob
# A "-review" log is the second (Opus) stage of a combo run: same repo copy, its cost is added to the combo.
for name in sorted(os.path.basename(p)[4:-6] for p in glob.glob(f'{RUNS}/log-*.jsonl') if not p.endswith('-review.jsonl')):
    log = f'{RUNS}/log-{name}.jsonl'
    if not os.path.exists(log): continue
    main_model = None; cost = None; turns = None; agents = []; tools = 0
    review = f'{RUNS}/log-{name}-review.jsonl'
    lines = open(log, encoding='utf-8').readlines()
    review_cost = 0
    if os.path.exists(review):
        for l in open(review, encoding='utf-8'):
            try: e = json.loads(l)
            except Exception: continue
            if e.get('type') == 'result': review_cost = e.get('total_cost_usd') or 0
    for l in lines:
        try: e = json.loads(l)
        except Exception: continue
        if e.get('type') == 'system' and e.get('subtype') == 'init' and main_model is None:
            main_model = e.get('model')
        if e.get('type') == 'assistant':
            for c in e['message'].get('content', []):
                if c.get('type') != 'tool_use': continue
                tools += 1
                if c['name'] in ('Agent', 'Task'):
                    i = c['input']
                    agents.append((i.get('model') or 'inherit', i.get('subagent_type', ''),
                                   (i.get('description') or '')[:50],
                                   'nested' if e.get('parent_tool_use_id') else 'main'))
        if e.get('type') == 'result':
            cost = e.get('total_cost_usd'); turns = e.get('num_turns')
    cost = (cost or 0) + review_cost
    out = subprocess.run(['node', JUDGE, f'{RUNS}/{name}'], capture_output=True, text=True, timeout=120).stdout.strip()
    try: j = json.loads(out.splitlines()[-1])
    except Exception: j = {}
    by = collections.Counter(); tot = collections.Counter()
    for b, g in GRADE.items():
        tot[g] += 1
        if j.get(b): by[g] += 1
    fixed = sum(1 for b in GRADE if j.get(b))
    rows.append(dict(name=name, fixed=fixed, cost=cost or 0, secs=secs.get(name), agents=len(agents),
                     agent_models=[a[0] for a in agents], missed=[b for b in GRADE if not j.get(b)]))
    print(f"== {name} ({main_model}) fixed={fixed}/16 regression={j.get('regression')} "
          f"cost=${(cost or 0):.2f} secs={secs.get(name)} main_turns={turns} tool_calls={tools}")
    print('   by grade: ' + ', '.join(f"{g} {by[g]}/{tot[g]}" for g in tot))
    print('   missed: ' + ','.join(b for b in GRADE if not j.get(b)))
    print(f'   agents ({len(agents)}): ' + '; '.join(f"{m}/{t}/{w}:{d}" for m, t, d, w in agents))

# Per-arm summary across repetitions (name without the -rN suffix).
json.dump(rows, open(f'{RUNS}/results.json', 'w'), indent=1)
arms = collections.defaultdict(list)
for r in rows: arms[r['name'].split('-r')[0]].append(r)
print('\nARM | runs | fixed each | mean fixed | mean $ | mean secs | runs that dispatched')
for a, rs in sorted(arms.items()):
    f = [r['fixed'] for r in rs]; c = [r['cost'] for r in rs]; s = [int(r['secs']) for r in rs if r['secs']]
    print(f"{a} | {len(rs)} | {f} | {sum(f)/len(f):.1f} | {sum(c)/len(c):.2f} | {sum(s)/len(s) if s else 0:.0f} | {sum(1 for r in rs if r['agents'])}")
