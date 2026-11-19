#!/bin/bash
# A/B benchmark: baseline = $BASE (default HEAD), candidate = working tree.
# Both builds run in one browser session, interleaved per scenario.
#   BASE=<ref> BENCH_MODE=vdom ab.sh <name> [extra run.mjs args]
# No git stash: changed files are backed up, checked out from $BASE for the
# baseline build, then restored.
set -e
name=$1; shift
BASE=${BASE:-HEAD}
BENCH_MODE=${BENCH_MODE:-vapor}
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
V=packages/vapor
SCRATCH="${REPO_ROOT}/packages/vapor/scratch/perf"
mkdir -p "$SCRATCH"
tmp=$(mktemp -d)
paths="packages/core/src packages/core/package.json packages/vapor/rekaVapor.ts"
changed=$(git diff --name-only $BASE -- $paths; git ls-files --others --exclude-standard -- $paths)
added=$(git diff --name-only --diff-filter=A $BASE -- $paths; git ls-files --others --exclude-standard -- $paths)
for f in $changed; do [ -e "$f" ] && { mkdir -p "$tmp/$(dirname $f)"; cp "$f" "$tmp/$f"; }; done
restore() { for f in $changed; do [ -e "$tmp/$f" ] && { mkdir -p "$(dirname $f)"; cp "$tmp/$f" "$f"; }; done; }
trap restore EXIT
for f in $added; do rm -f "$f"; done
for f in $changed; do git cat-file -e "$BASE:$f" 2>/dev/null && git show "$BASE:$f" > "$f"; done
(cd $V && BENCH_MODE="$BENCH_MODE" npx vite build -c bench/vite.config.ts --logLevel error) && rm -rf $V/bench/dist/vapor-base && mv $V/bench/dist/$BENCH_MODE $V/bench/dist/vapor-base
restore; trap - EXIT
git diff --quiet $BASE -- $paths && [ "$BASE" != HEAD ] && echo "warning: no diff vs $BASE" >&2 || true
(cd $V && BENCH_MODE="$BENCH_MODE" npx vite build -c bench/vite.config.ts --logLevel error)
(cd $V && node bench/run.mjs --skip-build --modes "vapor-base,${BENCH_MODE}" --runs 15 "$@" --out "$SCRATCH/$name.json") > "$SCRATCH/$name.log" 2>&1
node - "$name" "$SCRATCH" "$BENCH_MODE" <<'JS'
const fs = require('fs'); const name = process.argv[2]; const scratch = process.argv[3]; const mode = process.argv[4]
const j = JSON.parse(fs.readFileSync(`${scratch}/${name}.json`))
const sel = (o, m) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => k.endsWith('/' + m)).map(([k, v]) => [k.replace('/' + m, '/x'), v]))
const pick = m => ({ timing: sel(j.timing, m), memory: sel(j.memory, m), bundle: { x: j.bundle[m] }, startup: { x: j.startup?.[m] } })
fs.writeFileSync(`/tmp/${name}-A.json`, JSON.stringify(pick('vapor-base')))
fs.writeFileSync(`/tmp/${name}-B.json`, JSON.stringify(pick(mode)))
JS
node $V/bench/compare.mjs --mode x /tmp/$name-A.json /tmp/$name-B.json | tee "$SCRATCH/$name.md"