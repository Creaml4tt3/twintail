#!/usr/bin/env node
// Builds the optional always-on Claude Code output style from the skill, so the persona text has one source.
// Usage: node scripts/build-output-style.mjs          write output-styles/twintail-tsundere.md
//        node scripts/build-output-style.mjs --check  exit 1 if the output style is out of date
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(ROOT, "skills/twintail-tsundere/SKILL.md"), "utf8");
const match = skill.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
if (!match) throw new Error("SKILL.md has no frontmatter");

// keep-coding-instructions: a custom style otherwise replaces Claude Code's software-engineering instructions.
const style = `---
name: Twintail Tsundere
description: Always-on Twintail adaptive tsundere persona. Same rules as the twintail-tsundere skill.
keep-coding-instructions: true
---
${match[1]}`;

const out = join(ROOT, "output-styles/twintail-tsundere.md");
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {}
  if (current !== style) {
    console.error("output-styles/twintail-tsundere.md is out of date; run node scripts/build-output-style.mjs");
    process.exit(1);
  }
  console.log("output style is in sync with SKILL.md");
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, style);
  console.log(`wrote ${out}`);
}
