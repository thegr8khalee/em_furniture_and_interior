#!/usr/bin/env node
/**
 * Lint ratchet.
 *
 * The frontend carries pre-existing ESLint errors. Gating CI on zero would make
 * the build red on arrival; ignoring lint lets the debt grow. So the gate is on
 * the count per file: it may fall, never rise.
 *
 * Per file rather than per workspace on purpose — a total-only gate lets you fix
 * one error in A while adding one in B and still pass. This names the file that
 * regressed instead of dumping every pre-existing error.
 *
 *   node .github/scripts/lint-ratchet.mjs frontend            # check
 *   node .github/scripts/lint-ratchet.mjs frontend --update   # rewrite baseline
 *
 * --update only ever lowers counts or drops files; it refuses to raise one, so
 * it cannot be used to wave a regression through.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [workspace, flag] = process.argv.slice(2);
if (!workspace) {
  console.error('usage: lint-ratchet.mjs <workspace> [--update]');
  process.exit(2);
}
const update = flag === '--update';

const root = process.cwd();
const baselineFile = path.join(root, '.github/lint-baseline.json');
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const recorded = baseline[workspace]?.files;

if (!recorded) {
  console.error(`No baseline recorded for workspace "${workspace}" in ${baselineFile}`);
  process.exit(2);
}

let results;
try {
  const out = execSync('npx eslint . --format json', {
    cwd: path.join(root, workspace),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  results = JSON.parse(out);
} catch (error) {
  // ESLint exits non-zero when it reports errors; the JSON is still on stdout.
  if (!error.stdout) {
    console.error('ESLint failed to run:', error.message);
    process.exit(2);
  }
  results = JSON.parse(error.stdout);
}

const rel = (f) => path.relative(path.join(root, workspace), f.filePath).split(path.sep).join('/');
const current = new Map(results.filter((f) => f.errorCount > 0).map((f) => [rel(f), f]));

const regressions = [];
const improvements = [];

for (const [file, entry] of current) {
  const allowed = recorded[file] ?? 0;
  if (entry.errorCount > allowed) regressions.push({ file, allowed, actual: entry.errorCount, entry });
  else if (entry.errorCount < allowed) improvements.push({ file, allowed, actual: entry.errorCount });
}
for (const file of Object.keys(recorded)) {
  if (!current.has(file)) improvements.push({ file, allowed: recorded[file], actual: 0 });
}

const total = results.reduce((n, f) => n + f.errorCount, 0);
const allowedTotal = Object.values(recorded).reduce((a, b) => a + b, 0);
console.log(`${workspace}: ${total} errors across ${current.size} files (baseline ${allowedTotal})`);

if (update) {
  const next = {};
  for (const [file, entry] of [...current].sort(([a], [b]) => a.localeCompare(b))) {
    const allowed = recorded[file] ?? 0;
    if (entry.errorCount > allowed) {
      console.error(`Refusing to raise the baseline for ${file} (${allowed} -> ${entry.errorCount}).`);
      process.exit(1);
    }
    next[file] = entry.errorCount;
  }
  baseline[workspace].files = next;
  writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline updated: ${Object.keys(next).length} files, ${total} errors.`);
  process.exit(0);
}

if (regressions.length > 0) {
  console.error('\nNew lint errors. Fix these before merging:\n');
  for (const { file, allowed, actual, entry } of regressions) {
    console.error(`${file}  (${allowed} allowed, ${actual} found)`);
    for (const m of entry.messages) {
      if (m.severity !== 2) continue;
      console.error(`  ${m.line}:${m.column}  ${m.message}  ${m.ruleId ?? ''}`);
    }
    console.error('');
  }
  process.exit(1);
}

if (improvements.length > 0) {
  console.log(`\n${improvements.length} file(s) improved. Run with --update and commit the baseline:`);
  for (const { file, allowed, actual } of improvements.slice(0, 10)) {
    console.log(`  ${file}: ${allowed} -> ${actual}`);
  }
}
