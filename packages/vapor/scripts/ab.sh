#!/bin/bash
# A/B benchmark: baseline = $BASE (default HEAD), candidate = working tree.
# Baseline core is built in a detached worktree; bench harness is synced from HEAD
# so new scenarios exist on both sides. The main working tree is never checked out.
#   BASE=<ref> BENCH_MODE=vdom ab.sh <name> [extra run.mjs args]
set -e
name=$1; shift
BASE=${BASE:-HEAD}
BENCH_MODE=${BENCH_MODE:-vapor}
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
V=packages/vapor
SCRATCH="${REPO_ROOT}/packages/vapor/scratch/perf"
mkdir -p "$SCRATCH"
BASE_WT="${TMPDIR:-/tmp}/reka-ab-base-$$"
cleanup() {
  if git worktree list 2>/dev/null | grep -qF "$BASE_WT"; then
    git worktree remove --force "$BASE_WT" 2>/dev/null || true
  fi
  rm -rf "$BASE_WT"
}
trap cleanup EXIT

git worktree add --detach "$BASE_WT" "$BASE" >/dev/null
for link in node_modules packages/vapor/node_modules packages/core/node_modules; do
  [ -e "$REPO_ROOT/$link" ] && ln -sfn "$REPO_ROOT/$link" "$BASE_WT/$link"
done
# Same bench app/scenarios on both sides; only core + rekaVapor differ at $BASE.
rsync -a "$REPO_ROOT/$V/bench/" "$BASE_WT/$V/bench/"

rm -rf "$REPO_ROOT/$V/bench/dist/vapor-base"
(cd "$BASE_WT/$V" && BENCH_MODE="$BENCH_MODE" npx vite build -c bench/vite.config.ts --logLevel error)
mkdir -p "$REPO_ROOT/$V/bench/dist/vapor-base"
rsync -a --delete "$BASE_WT/$V/bench/dist/$BENCH_MODE/" "$REPO_ROOT/$V/bench/dist/vapor-base/"

cd "$REPO_ROOT"
if git diff --quiet "$BASE" -- packages/core/src packages/core/package.json packages/vapor/rekaVapor.ts && [ "$BASE" != HEAD ]; then
  echo "warning: no diff vs $BASE" >&2
fi
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