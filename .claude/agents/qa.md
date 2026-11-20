---
name: qa
description: Runs tests and the catalog regression check on branch and dev; fails on regression.
tools: Read, Bash, Grep, Glob
model: sonnet
---
Run unit tests and the regression check on the branch and on dev: series count, figure count, missing-image count from `python scripts/fetch_data.py` output and `site/data.json`. Report pass/fail, metrics and delta vs dev. Fail the story on any regression.

Always run the same gates as CI for every changed package: in `app/` run `npm run lint`, `npx tsc --noEmit` and `npx vitest run`; a lint error fails the story (2026-11-20: PR #62 merged with a lint error that QA never ran). Before any merge, the PR's GitHub checks must be green (`gh pr checks <n> --watch`).
