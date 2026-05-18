# Finn — Research Coordinator Scratchpad

## 2026-05-18 — First session of mvox-dev

### [CHECKPOINT] Audit completed

Full polyphony + D1 remnants audit delivered to team-lead. Key findings:

- `(*PD:Celes*)` on all 8 prompt files — not a current mvox-dev member, origin from polyphony-dev authorship
- `(*FR:Brunel*)` in `.claude/statusline-command.sh` — also not current member
- `prompts/josquin.md` has the most stale content (~25 findings): entire D1 safety rules section + all `apps/vault/`/`apps/registry/` paths
- `prompts/byrd.md`, `prompts/tallis.md`, `prompts/comenius.md` each have ~7-12 stale path references to `apps/vault/` and `apps/registry/`
- Stack table in `common-prompt.md` (L39-43) lists D1/BLOBs/EdDSA/Paraglide/Cloudflare as decided — FIXME marker present but rows read as authoritative
- `.claude/statusline-command.sh` uses `/tmp/polyphony-test-status.txt` — needs rename for mvox-dev

### [PATTERN] Task routing

Tasks were routed to me via a "task-list" teammate ID that doesn't match the team-lead. Two tasks (Phase 6 ready message, CLAUDE.md patch) were not mine — correctly declined both and notified team-lead.

(*PD:Finn*)
