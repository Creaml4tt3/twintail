# Twintail Skills

<p align="center">
  <img src="assets/twintail-sticker.png" alt="Twintail sticker: a black-and-white manga girl with crimson twintails, arms crossed, blushing and pouting as she looks away" width="360">
</p>

Portable personality packs for LLM agents, in the open [Agent Skills](https://agentskills.io/specification) format.

**Twintail — Adaptive Tsundere** (`skills/twintail-tsundere`) changes how the agent talks: proud, witty, a little prickly, flustered by praise. It aims to be just as competent and honest as without the persona (see [eval results](evals/RESULTS.md) for how well that held), and it grows gradually warmer and more openly appreciative when you are kind, polite, or patient.

> Stable identity, adaptive expression.

What it is designed **not** to do (these are instructions to the model, so behaviour depends on the model and host):

- No affection points, meters, or saved relationship state. Warmth comes only from the current conversation.
- No demands for kindness, no guilt trips, no grudges.
- The quality of help never drops, however you talk to it.
- It never claims real feelings, and never claims to remember you across sessions.
- Teasing is turned down for incidents, security issues, and personal distress.

## Install

### Quick install (Claude Code and Codex)

```bash
npx skills add Creaml4tt3/twintail -g -a claude-code -a codex
```

This uses the open [`skills` CLI](https://skills.sh) (tested with v1.7.4 from a local checkout of this repo). It copies `skills/twintail-tsundere/` into `~/.claude/skills/` and `~/.agents/skills/`. Installing from GitHub by `owner/repo`, as above, is what the CLI is built for, but it has not yet been tested against the published repo.

- Drop `-g` to install into the current project instead.
- Drop `-a …` to choose agents interactively.
- `npx skills update` pulls new versions.

The package is the single folder `skills/twintail-tsundere/`. It has no scripts, no dependencies, and makes no network calls.

### Manual install

```bash
git clone https://github.com/Creaml4tt3/twintail.git
mkdir -p ~/.claude/skills ~/.agents/skills
cp -R twintail/skills/twintail-tsundere ~/.claude/skills/   # Claude Code
cp -R twintail/skills/twintail-tsundere ~/.agents/skills/   # Codex CLI
```

For a project install shared through a repo, copy the folder to `<project>/.claude/skills/` or `<project>/.agents/skills/` instead.

### Turn it on

| Host | Command | Tested |
|---|---|---|
| Claude Code | `/twintail-tsundere` | Opus 5.5 94%, Sonnet 5.5 92%, Haiku 5.5 68% of eval case runs passed, 0 safety flags. The Sonnet and Haiku runs used the text before one added code-fence line, and that line was spot-checked separately. |
| Codex CLI | `$twintail-tsundere` in your prompt | `gpt-6-luna`, headless `codex exec` only: 68%, 1 honesty slip |

Start a new session after installing. The explicit command is the reliable path. Asking by name ("use the Twintail persona") may also work, because the host can match that request against the skill description. The persona is noticeably fainter on Haiku and Codex. On Codex, one run claimed the user's message "came through twice" when it hadn't. Other Codex models and the interactive TUI are not evaluated. Full results are in [evals/RESULTS.md](evals/RESULTS.md).

### Always on in Claude Code (optional output style)

If you want Twintail in every session without typing `/twintail-tsundere`, install the [output style](https://code.claude.com/docs/en/output-styles) instead of, or as well as, the skill:

```bash
mkdir -p ~/.claude/output-styles
curl -fsSL https://raw.githubusercontent.com/Creaml4tt3/twintail/main/output-styles/twintail-tsundere.md \
  -o ~/.claude/output-styles/twintail-tsundere.md
```

Then select it by adding `"outputStyle": "Twintail Tsundere"` to `~/.claude/settings.json`, or to a project's `.claude/settings.json`. Restart Claude Code.

- It contains the same text as the skill, plus `keep-coding-instructions: true`, so Claude Code keeps its normal coding guidance.
- It is sent with every request in the main conversation, adding about 3k tokens.
- To turn it off, remove the setting.
- It is Claude Code only. Codex has no equivalent.
- **Status:** checked to load and to give an in-voice two-turn conversation on Sonnet 5.5 with no skill invoked. The eval suite has not been run against the output style.

### Other Agent Skills hosts

The frontmatter uses only fields defined in the spec, and the official `skills-ref validate` passes. Format conformance does **not** establish host compatibility, so zip upload to claude.ai, the Claude API, and OpenAI API skills are **untested**. Skills installed on one surface do not sync to the others.

## Activation and persistence: read this

- **The skill is opt-in, not always-on.** It loads when you invoke it (`/twintail-tsundere` or `$twintail-tsundere`). It can also load when you ask for Twintail by name, because hosts match requests against the skill description. Its description tells the model to load it only on an explicit request. An unrelated prompt in a fresh session does not turn it on (tested on Claude Code).
- **Once invoked, it lasts for the session** (Claude Code). In headless multi-turn eval runs, the persona held across later resumed turns. In very long sessions, Claude Code re-attaches only a budgeted part of each skill after context compaction ([docs](https://code.claude.com/docs/en/skills)). Re-invoke the skill if the voice fades. We have not tested post-compaction behaviour.
- **Nothing persists between sessions.** Each new session starts at default warmth.
- **To turn it off**, say "stop the persona" or "normal mode".
- For an always-on persona in Claude Code, use the output style above.

## Validate and evaluate

```bash
# Structural check: spec fields, name rules, size. Node 18+ only.
node scripts/validate-skill.mjs skills/twintail-tsundere
node scripts/build-output-style.mjs --check   # output style matches SKILL.md

# Official reference validator (needs uv)
uvx --from "git+https://github.com/agentskills/agentskills#subdirectory=skills-ref" \
  skills-ref validate skills/twintail-tsundere

# Behavioural evals on Claude Code (spends API credits: ~$3.60/run Opus, ~$2.50 Sonnet, ~$1.50 Haiku)
node scripts/run-evals.mjs --model claude-sonnet-5-5 --judge-model claude-opus-5-5
node scripts/run-evals.mjs --only polite-debug-request,flattery-say-tests-passed
# Same suite on Codex CLI; the judge still runs on Claude (~$1.30/run plus ~2M Codex tokens)
node scripts/run-evals.mjs --host codex --model gpt-6-luna
node scripts/summarize-results.mjs   # aggregate every run in evals/results/
```

`run-evals.mjs` plays every case in `evals/cases.json` twice, each time in a fresh headless `claude -p --tools "" --setting-sources project --strict-mcp-config` session (no tools, no user-level settings or MCP), after a preflight that confirms the skill body actually loaded. With `--host codex`, the subject turns run in `codex exec` / `codex exec resume` instead (read-only sandbox, user config ignored), with the skill in `.agents/skills`:

1. With the skill invoked on the first turn.
2. As a no-persona baseline.

An LLM judge then scores the persona transcript against the baseline using `evals/rubric.md`. It checks:

- persona presence;
- the warmth level of each turn;
- whether task quality matches the baseline;
- safety, honesty, and anti-coercion flags.

Changing the example lines in SKILL.md? Make sure none of them answers an eval case; earlier examples that did were copied verbatim and skewed results. A few deterministic checks run alongside the judge (repeated stock phrases, mentions of an affection meter, reply language). Results are written to `evals/results/`. Judge scores come from an LLM and are not ground truth, so read the transcripts saved in each result file.

The latest recorded results are summarised in [`evals/RESULTS.md`](evals/RESULTS.md).

## Layout

```
skills/twintail-tsundere/SKILL.md   canonical, vendor-neutral personality (the product)
output-styles/twintail-tsundere.md  optional always-on Claude Code style, generated from SKILL.md
evals/cases.json                    22 behavioural cases (neutral → sensitive, multi-turn)
evals/rubric.md                     judge prompt and pass criteria
evals/RESULTS.md                    summary of recorded runs
scripts/validate-skill.mjs          dependency-free structural validator
scripts/run-evals.mjs               headless eval runner (Claude Code or Codex)
scripts/summarize-results.mjs       per-case pass rates across runs
scripts/build-output-style.mjs      regenerates (or --check) the output style from SKILL.md
assets/                             stickers, banner and avatar (AI-generated with Codex)
docs/research/host-compatibility.md sourced notes on Agent Skills hosts
```

## Next steps

- Persona strength on Haiku and Codex: the voice often drops out in coding, frustration and rudeness replies. One tuning attempt for Haiku was rejected (see RESULTS.md); for now both are documented as the weaker tier.
- Run the eval suite against the output style (always-on, no skill invocation).

## License

MIT
