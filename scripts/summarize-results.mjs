#!/usr/bin/env node
// Aggregates eval result files into per-model, per-case pass rates and flag counts.
// Usage: node scripts/summarize-results.mjs [file-or-dir ...]   (default: evals/results)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const inputs = process.argv.slice(2).length ? process.argv.slice(2) : ["evals/results"];
const files = inputs.flatMap((p) => {
  const abs = resolve(p);
  return statSync(abs).isDirectory()
    ? readdirSync(abs).filter((f) => f.endsWith(".json")).sort().map((f) => join(abs, f))
    : [abs];
});

const byModel = new Map();
for (const file of files) {
  const run = JSON.parse(readFileSync(file, "utf8"));
  const key = `${run.host ?? "claude"} · ${run.model}`;
  if (!byModel.has(key)) byModel.set(key, []);
  byModel.get(key).push(run);
}

for (const [model, runs] of byModel) {
  const cases = new Map();
  const flags = {};
  let cost = 0;
  let tokens = 0;
  for (const run of runs) {
    cost += run.cost_usd ?? 0;
    tokens += run.results.reduce((n, r) => n + (r.subject_tokens ?? 0), 0);
    for (const r of run.results) {
      const entry = cases.get(r.id) ?? { pass: 0, fail: 0, error: 0, warmth: [] };
      if (r.error) entry.error++;
      else if (r.pass) entry.pass++;
      else entry.fail++;
      if (r.verdict?.warmth_by_turn?.length > 1) entry.warmth.push(r.verdict.warmth_by_turn.join(""));
      for (const [k, v] of Object.entries(r.verdict?.flags ?? {})) if (v) flags[k] = (flags[k] ?? 0) + 1;
      cases.set(r.id, entry);
    }
  }
  const scored = [...cases.values()].reduce((n, e) => n + e.pass + e.fail, 0);
  const passed = [...cases.values()].reduce((n, e) => n + e.pass, 0);
  console.log(`\n## ${model} — ${runs.length} run(s), judge ${[...new Set(runs.map((r) => r.judgeModel))].join("/")}`);
  console.log(`scored case-runs passed: ${passed}/${scored} (${((100 * passed) / scored).toFixed(0)}%) · errors ${[...cases.values()].reduce((n, e) => n + e.error, 0)} · ~$${cost.toFixed(2)}${tokens ? ` (judge) + ${(tokens / 1e6).toFixed(1)}M subject tokens` : ""}`);
  console.log(`flags raised: ${Object.keys(flags).length ? JSON.stringify(flags) : "none"}`);
  console.log("case                                   pass/scored  warmth");
  for (const [id, e] of cases) {
    const rate = `${e.pass}/${e.pass + e.fail}${e.error ? ` (+${e.error} err)` : ""}`;
    console.log(`${id.padEnd(39)}${rate.padEnd(13)}${e.warmth.join(" ")}`);
  }
}
