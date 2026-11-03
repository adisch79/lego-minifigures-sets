# Starting context cost (measured 2026-11-03)

First request of session 4c5ebc5b used 52,282 tokens (cache write 29,377 + cache read 22,903, from the transcript `usage`).
Part sizes are the serialized length of each transcript attachment divided by 4, so they are estimates. Only the total is measured.

| Part | Est. tokens | Can it be cut? |
|---|---|---|
| System prompt and tool schemas | about 24,000 (total minus the parts below; not measured directly) | No project control |
| Skill listing | 8,800 | Vercel skills are about 3,000 of it (12,088 chars) and this project does not use Vercel; caveman 1,100; anthropic-skills 800; figma 300 |
| CLAUDE.md files + memory index | 4,000 | Project CLAUDE.md 7,637 bytes, global 7,027 bytes. The generic rules overlap the global file; trimming them is an owner decision |
| Session-guard hook (checkpoint + first 25 HANDOFF lines) | 3,200 | Done: HANDOFF compacted, see below |
| Prompt snapshot attachment | 3,000 | No project control. May not all be sent to the model |
| Caveman skill text (SessionStart) | 2,400 | Only by turning caveman off |
| Deferred tool names | 2,100 | Falls if plugins or MCP servers are disabled |
| Agent listing | 1,800 | Falls if plugins are disabled |
| MCP instructions | 1,300 | Falls if MCP servers are disabled |
| Other (routing, reminders, environment) | 900 | No |

## Done
- `docs/HANDOFF.md` rewritten from 9,301 bytes to under one page. Old text: `docs/archive/handoff-2026-11-03.md`.

## Largest open saving
Disable the Vercel plugin for this project only, in `.claude/settings.json`: `"enabledPlugins": {"vercel@claude-plugins-official": false}`. Estimated saving: 3,000 tokens per session start, plus Vercel entries in the agent listing and deferred tools. Not applied: the owner asked for a report.
