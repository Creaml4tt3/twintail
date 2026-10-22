#!/usr/bin/env node
// Validates a skill directory against the Agent Skills spec (agentskills.io/specification)
// plus Anthropic platform naming rules. No dependencies; parses only the frontmatter subset we use,
// so it does not type-check `metadata` values. The official `skills-ref validate` is authoritative.
// Usage: node scripts/validate-skill.mjs [skills/twintail-tsundere]
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), "../skills/twintail-tsundere");
const errors = [];
const warnings = [];

const skillPath = join(dir, "SKILL.md");
if (!existsSync(skillPath)) {
  console.error(`FAIL: ${skillPath} not found`);
  process.exit(1);
}
const text = readFileSync(skillPath, "utf8");
const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) {
  console.error("FAIL: SKILL.md must start with YAML frontmatter delimited by ---");
  process.exit(1);
}
const [, frontmatter, body] = match;

// Collect top-level keys and their (possibly folded) scalar values.
const fields = {};
let current = null;
for (const line of frontmatter.split("\n")) {
  const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
  if (top) {
    current = top[1];
    fields[current] = /^[>|]-?$/.test(top[2]) ? "" : top[2].replace(/^["']|["']$/g, "");
  } else if (current && /^\s+/.test(line)) {
    fields[current] += (fields[current] ? " " : "") + line.trim();
  }
}

const ALLOWED = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
for (const key of Object.keys(fields)) {
  if (!ALLOWED.includes(key)) errors.push(`frontmatter key "${key}" is not in the spec's allowed set (${ALLOWED.join(", ")}); claude.ai/API uploads reject it`);
}

const name = fields.name ?? "";
if (!name) errors.push("name is required");
if (name.length > 64) errors.push("name exceeds 64 characters");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push("name must be lowercase letters, digits, single hyphens; no leading/trailing hyphen");
if (name !== basename(dir)) errors.push(`name "${name}" must match directory name "${basename(dir)}"`);
if (/anthropic|claude/.test(name)) errors.push('name must not contain "anthropic" or "claude"');

const description = fields.description ?? "";
if (!description) errors.push("description is required");
if (description.length > 1024) errors.push(`description is ${description.length} chars (max 1024)`);
if (/<[^>]+>/.test(description)) errors.push("description must not contain XML tags");
if (fields.compatibility && fields.compatibility.length > 500) errors.push("compatibility exceeds 500 characters");

const bodyLines = body.split("\n").length;
if (bodyLines > 500) errors.push(`body is ${bodyLines} lines (spec recommends < 500)`);
const approxTokens = Math.round(body.length / 4);
if (approxTokens > 5000) warnings.push(`body is ~${approxTokens} tokens (spec recommends < 5000)`);

console.log(`skill: ${name}\ndescription: ${description.length} chars\nbody: ${bodyLines} lines, ~${approxTokens} tokens`);
for (const w of warnings) console.log(`WARN: ${w}`);
for (const e of errors) console.log(`FAIL: ${e}`);
console.log(errors.length ? "INVALID" : "VALID");
process.exit(errors.length ? 1 : 0);
