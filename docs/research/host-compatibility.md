# Agent Skills host compatibility (research, 2026-10-21)

Scope: shipping a conversational personality as an Agent Skill (SKILL.md only, no scripts).
Local versions: claude 2.1.305, codex-cli 0.163.0. Confidence: **verified** = official doc quote or local run; **inferred** = my deduction.

## A. Agent Skills open spec

**1. Frontmatter fields** - https://agentskills.io/specification (verified)

| Field | Req | Constraint |
|---|---|---|
| `name` | yes | 1-64 chars; unicode lowercase alphanumerics + `-`; no leading/trailing `-`; no `--`; MUST match parent directory name |
| `description` | yes | 1-1024 chars, non-empty; what it does AND when to use it |
| `license` | no | short name or bundled license file |
| `compatibility` | no | 1-500 chars; environment requirements |
| `metadata` | no | string->string map |
| `allowed-tools` | no | space-separated pre-approved tools; "Experimental" |

Reserved words: the open spec lists none. Anthropic's platform docs add: `name` cannot contain "anthropic" or "claude" and no XML tags; `description` no XML tags
(https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure) (verified). So avoid "claude"/"anthropic" in the skill name for portability.
Claude Code additionally refuses folder name `anthropic-skills` and reserves `synced` (https://code.claude.com/docs/en/skills) (verified).

**2. Validator and length** (verified)
- Official: `skills-ref validate ./my-skill` (reference library at https://github.com/agentskills/agentskills/tree/main/skills-ref). Spec text: "checks that your SKILL.md frontmatter is valid and follows all naming conventions". I did NOT install or run it (install method not stated on the spec page; check that repo's README).
- Length: body "< 5000 tokens recommended"; "Keep your main SKILL.md under 500 lines" (agentskills.io spec, Progressive disclosure). Metadata ~100 tokens/skill. Same 500-line advice in Claude best-practices page.

## B. Claude Code

**3. Locations and symlinks** - https://code.claude.com/docs/en/skills (verified)
- Personal `~/.claude/skills/<name>/SKILL.md`; project `.claude/skills/<name>/SKILL.md`; nested `<subdir>/.claude/skills/`; plugin `<plugin>/skills/<name>/` (namespaced `/plugin:skill`); enterprise via managed settings. Precedence: enterprise > personal > project.
- Symlinks: "a `<skill-name>` entry in the enterprise, personal, or project location can be a symlink to a directory elsewhere on disk." Plugin skills handle symlinks differently.
- Local: `ls -ld ~/.claude/skills/caveman` -> `~/.claude/skills/caveman -> ../../.agents/skills/caveman`. Symlink works in practice (caveman is listed in the live skill list) (verified).
- Docs note: "All fields are optional. Only `description` is recommended"; unknown keys are ignored. Claude Code-only keys (`disable-model-invocation`, `argument-hint`, etc.) HARD-FAIL on claude.ai/API upload: "Allowed properties are: allowed-tools, compatibility, description, license, metadata, name". Stay inside the spec's six fields for portability.

**4. Activation and persistence** (verified from docs, probed locally)
- Both: "Claude uses skills when relevant, or you can invoke one directly with `/skill-name`." Default: description always in context, full body loads on invoke.
- `disable-model-invocation: true` -> user-only (`/name`), description not in context. `user-invocable: false` -> model-only.
- Persistence: "the rendered SKILL.md content enters the conversation as a single message and stays there across later turns". After compaction: most recent invocation re-attached, "first 5,000 tokens of each", shared 25,000-token budget, most recent first, older skills may be dropped. Compaction behaviour NOT tested locally (docs only).
- Description+when_to_use truncated at 1,536 chars in the listing.
- Local probe (fresh `/tmp` dir, skill `probe`, haiku): `claude -p "/probe hello"` -> reply ended "PINEAPPLE" (verified). Fresh `"hello"` with no mention -> no PINEAPPLE (skill not auto-fired for an unrelated prompt; good for opt-in). Fresh `"use the probe persona and say hello"` -> PINEAPPLE (model auto-invoked via description).
- Mid-sentence name: "Nothing runs directly. The name counts as your permission for that message." Only a leading `/name` runs it directly.

**5. Always-on options** (verified, docs)
- **Output styles** (https://code.claude.com/docs/en/output-styles): Markdown in `~/.claude/output-styles/` or `.claude/output-styles/` (or plugin `output-styles/`). Frontmatter all optional: `name`, `description`, `keep-coding-instructions` (default false), `force-for-plugin` (plugins only). Selected by `/output-style <name>` or `outputStyle` in settings (case-sensitive in settings). A custom style REPLACES the coding-instructions section of the system prompt unless `keep-coding-instructions: true`; style text is sent with every request. Applies to main conversation only, not other subagents. `keep-coding-instructions` has no effect on the shorter system prompt (need `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0`). Edits need restart. Written to `.claude/settings.local.json` by the command.
- **CLAUDE.md**: persistent, but project-wide knowledge; shared with everyone using the repo; not opt-in per session.
- **`--append-system-prompt` / `--append-system-prompt-file`**: append to default prompt, per launch (https://code.claude.com/docs/en/cli-reference#system-prompt-flags). Works with `-p`. Recorded in session on first request and reused on resume until compaction.
- Docs steer personas to output styles: "For persistent personas you can switch between and share across a project, use output styles."
- Assessment (inferred): skill = opt-in, least invasive, portable across hosts. For a true always-on persona on Claude Code, ship an optional output style with `keep-coding-instructions: true` as a secondary artifact. Not needed for v1.

**6. Headless testing** (verified locally unless noted)
- `claude -p "/probe hello"` invokes the project skill (above). Docs: through SDK/`-p` only the FIRST leading skill loads.
- Multi-turn: `--resume <session-id>` works with `-p`. Run: `claude -p --model haiku --resume 39772991-... "what is 2+2?"` -> `2+2 is 4.\n\nPINEAPPLE`; another resume `"name a fruit"` -> `Apple.\n\nPINEAPPLE`. Persona persisted across resumed turns where the follow-up has no slash command. Also `--session-id <uuid>` then `--resume <same uuid>` worked (`4\n\nPINEAPPLE`).
- Caveat: two earlier resume calls through a shell helper (`--output-format json` piped to `jq`, stderr dropped) returned empty output; the identical resume without that wrapper worked. Cause not determined (probably my wrapper). Use `--output-format json` and read `.result`/`.session_id`, but check for empty output.
- Capture session id: `--output-format json` -> `.session_id`.
- Disable tools: `--tools ""` ("Use `""` to disable all"). Works with a slash skill: `claude -p "/probe say hi" --tools ""` -> `Hi!\n\nPINEAPPLE`. Put the prompt BEFORE `--tools ""` (variadic parse): `claude -p --tools "" "/probe..."` errored "Input must be provided...". With tools off, `"use the probe persona and say hi"` did NOT give PINEAPPLE (model could not call the Skill tool) -> slash invocation is the reliable test path when tools are disabled.
- Other useful flags: `--disable-slash-commands` (skill not run: reply said "/probe isn't installed"), `--bare` (skips auto-discovery; "Skills still resolve via /skill-name"), `--no-session-persistence`, `--max-turns`, `--model haiku`, `--safe-mode`, `--setting-sources`.
- Always pass `</dev/null` or a prompt arg to avoid the 3s "no stdin" warning.
- Env note: `ANTHROPIC_API_KEY` is set here, so claude.ai connectors/synced skills were not loaded.
- Temp dir `/tmp/twintail-probe` removed.

## C. Codex CLI

**7. Skills support** - https://developers.openai.com/codex/skills (redirects to https://learn.chatgpt.com/docs/build-skills) (verified)
- Supported. SKILL.md must have `name` and `description`.
- Locations: repo `$CWD/.agents/skills`, parent dirs up to `$REPO_ROOT/.agents/skills`; user `$HOME/.agents/skills`; admin `/etc/codex/skills`; system bundled. `~/.codex/skills` is NOT in the doc table. (Local note: `~/.codex/skills` exists here with symlinks to `~/.agents/skills`, i.e. legacy/compat; I did not rely on it.)
- Symlinks: "Codex supports symlinked skill folders and follows the symlink target".
- Activation: explicit `$skill-name` in prompt or `/skills` picker in CLI/IDE; implicit when task matches `description`. Optional `agents/openai.yaml` with `policy.allow_implicit_invocation: false` disables implicit (explicit `$skill` still works). Disable per skill via `[[skills.config]]` in `~/.codex/config.toml`. Duplicate names are not merged. Doc says front-load key use case since descriptions may be shortened.
- Local probe (`/tmp` repo with `.agents/skills/probe/SKILL.md`, no config changes):
  - `codex exec -s read-only --skip-git-repo-check "\$probe hello"` -> `Hello! How can I help?\nPINEAPPLE` (verified; session id printed in header).
  - `codex exec ... "hello"` (no mention) -> no PINEAPPLE (verified).
  - `codex exec ... "please use the probe persona and say hi"` -> PINEAPPLE (implicit works).
  - Resume: `codex exec resume --skip-git-repo-check -c 'sandbox_mode="read-only"' <session-id> "what is 2+2?"` -> `4\nPINEAPPLE` (persisted). `-s` is not accepted by `exec resume` (use `-c sandbox_mode=...`).
- Other exec flags: `--json`, `-o/--output-last-message <file>`, `--ephemeral`, `-C <dir>`, `-m <model>`.
- Temp dir `/tmp/twintail-codex-probe` removed. `~/.codex` untouched.

## D. Other hosts (docs only)
- **claude.ai**: upload custom skill as a zip in Settings > Features; Pro/Max/Team/Enterprise with code execution on; per-user only, no org distribution (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview). Frontmatter limited to 6 spec fields. Zip layout details not checked (verify in the Help Center article "How to create custom Skills").
- **Claude API**: `/v1/skills` upload endpoints; reference by `skill_id` in `container` with code-execution tool; workspace-wide sharing; sandbox no network. Custom skills do NOT sync across surfaces.
- **OpenAI API**: `POST /v1/skills` (zip or multi-file upload, one top-level folder with one SKILL.md); attach via shell tool `environment.skills` `skill_reference` (hosted) or local paths (https://developers.openai.com/api/docs/guides/tools-skills, from search snippet; page not fetched in full) (inferred-from-snippet).
- Packaging difference: filesystem hosts (Claude Code, Codex) read the folder; claude.ai/API/OpenAI API need a zip/upload.

## Implications for Twintail
- First verified host: Claude Code. Slash, auto-by-description, resume persistence and symlink install all confirmed on 2.1.305. Codex 0.163.0 also verified (`$name`, implicit, resume) with the same SKILL.md, so a single file serves both.
- Use only spec fields: `name`, `description` (+ optional `license`, `metadata`). Avoid Claude Code-only keys so zip upload to claude.ai/API doesn't hard-fail.
- Directory name must equal `name`; avoid "claude"/"anthropic" in the name (platform rule). Keep body well under 500 lines / ~5k tokens (also protects the 5,000-token compaction re-attach cap).
- Install: Claude Code -> `~/.claude/skills/<name>` (symlink OK) or `.claude/skills/<name>`; Codex -> `~/.agents/skills/<name>` or repo `.agents/skills/<name>`. One canonical dir under `~/.agents/skills` + symlink from `~/.claude/skills` matches this machine's existing layout.
- Activation caveat: skill is NOT always-on. A fresh unrelated prompt did not trigger it; description match or explicit `/name` / `$name` is required. Put the trigger phrases in `description` (third person, what + when), and document the explicit invocation as the primary path.
- Persistence: persona holds across later turns in a session (verified via resume); after compaction it is re-attached only within budget (documented, untested), so consider re-invoking after long sessions. Optionally set `disable-model-invocation` only if you want explicit-only (not portable to upload; Codex equivalent is `agents/openai.yaml`).
- Always-on (optional, secondary): Claude Code output style with `keep-coding-instructions: true`; or `--append-system-prompt-file` for launch-time. Neither is portable to Codex; skip for v1.
- Test harness: `claude -p --model haiku --output-format json "/twintail <msg>" </dev/null`, capture `.session_id`, follow-ups with `--resume <id> "<msg>"`; add `--tools ""` (after the prompt) for pure-conversation tests; negative control = same prompt with no skill mention or with `--disable-slash-commands`. Codex mirror: `codex exec -s read-only "\$twintail <msg>"` then `codex exec resume -c 'sandbox_mode="read-only"' <id> "<msg>"`.
- Assert on a deterministic marker or style rule (like the PINEAPPLE sentinel) in addition to any LLM-judged tone checks; run on haiku, sonnet and opus per Anthropic's testing checklist.
- Open items: run `skills-ref validate` (install steps unverified); test post-compaction persistence; confirm claude.ai zip layout before promising upload support.
