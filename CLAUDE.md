# Project details 

| Item | Value |
|---|---|
| Project name | `minifigures-extractor` |
| Goal (one or two sentences) | `extract pictures of all minifigures sets there is` |
| Users / consumers | `me` |
| Inputs and outputs | `create a html or mobile website that shows all sets theme, clicking on each theme will take you to a page with a hero banner of all figures and pictures (one after the other) of all minifigures (one at a time)` |

Where a project detail conflicts with a generic rule below, the project detail wins.

---

# Generic rules (same for every project, do not edit per project)

## 1. Understand before building
- Make sure you understand the requirement. For any product or solution question that is unclear or marked
  "unknown" above, ask the product owner: **one question at a time, with your recommended option**. For
  technical choices, pick a sensible default, say which one, and keep going.
- If the owner did a similar task in an earlier project, ask how it was done (or read that project) before choosing
  a method. Reuse what worked.
- Be innovative: when there is a clearly better approach than the one asked for, propose it in one or two lines
  with the trade-off. Then do what the owner decides.
- Choose the simplest path that answers the current question. Don't build infrastructure the current step doesn't need.

## 2. How to talk to the owner
- **One step per message.** Give one step, wait for the result, then the next. No long instruction lists.
- Lead with the answer. Short, plain replies in English, even when the owner writes in another language.
- Full scripts, not snippets. Code comments in English.
- Every file you deliver comes with three things: **what it is, how to install it, how to use it**. Step 1 goes in
  the reply; the full guide goes in a README next to the file.
- Tell the owner when the context is getting full and a new session is needed (update HANDOFF first).

## 3. Be proactive
- When something fails, investigate it yourself: read the error, code and logs, run commands, reproduce, test a fix.
  Don't ask the owner to look up what you can check yourself.
- Come back with a finding: "Cause: X (evidence: file:line or output). Fix: Y." If not found: what you checked,
  what you ruled out, and the next test.
- Ask before anything hard to undo: pushing to shared branches, deleting, production, real customer data.
  Reading, running tests, scratch scripts and feature branches need no approval.

## 4. Kickoff (first session, or when docs/backlog.md is missing)
Do these one at a time and show the owner each result before the next:
1. **Understand:** read README, this file, `docs/`, the git branches and any related earlier project. List the open
   product questions and ask the most important one first.
2. **Plan:** write `docs/backlog.md` (short):
   - **MVPs.** MVP 0 is the smallest thing that proves the idea with real inputs (a POC). Each later MVP adds one
     usable capability.
   - **Epics** per MVP (`E1`, `E2`...) and **stories** (`E1-01`): title, one-line goal, acceptance criteria,
     size S/M/L, model (section 6), status Ready / In progress / Done.
   - Mark stories with UI (they start with 3 mockups) and stories needing installs (they deliver a script).
   Wait for the owner's approval of the backlog.
3. **Agents:** create the role agents in `.claude/agents/` (section 5).
4. **Context files:** create `docs/HANDOFF.md`, `docs/decisions.md`, `docs/archive/` (section 9).

## 5. Agents (roles)
Each story passes these roles. Create them as `.claude/agents/<name>.md` files with this front matter:
`name`, `description`, `tools`, `model`, then the instruction text.

| Agent | Model | Tools | Instruction |
|---|---|---|---|
| `coder` | sonnet | Read, Edit, Write, Bash, Grep, Glob | Implement exactly one Ready story on `feature/<story-id>-<slug>`. Tests first, then code; run tests and linter. Touch only what the story needs. No secrets in code. Finish with: files changed, tests run and result, open questions. |
| `code-reviewer` | sonnet (opus for L stories) | Read, Grep, Glob, Bash | Review `git diff dev...HEAD` and run the tests. List findings: severity (blocking / should-fix / nit), file:line, problem, fix. Check acceptance criteria, edge cases, error paths, sensitive data in logs. Don't edit files. |
| `design-reviewer` | opus | Read, Grep, Glob | Review a plan, schema, API or architecture change against the design docs. Report conflicts with accepted decisions, security gaps, scope creep, missing tests. Say "No blocking findings" when none. Don't edit files. |
| `qa` | sonnet | Read, Bash, Grep, Glob | Run unit tests and the project's regression or evaluation set on the branch and on dev. Report pass/fail, metrics and delta vs dev. Fail the story on any regression. |
| `security-reviewer` (only with personal data, credentials or cloud calls) | opus | Read, Grep, Glob, Bash | Look for secrets, sensitive data in logs or errors, unvalidated input, prompts built from untrusted text, broad permissions, new outbound hosts. Blocking findings first. Don't edit files. |

If sub-agents are blocked on this PC (org policy), run each role as a separate, clearly labelled pass in the main
session, in the same order, with the same instructions.

## 6. Model choice by task and story size
Use the newest model available (check `/model`). Agents name the model by alias so a new model needs no file edits.

| Work | Alias | Model |
|---|---|---|
| Design, architecture, debugging, design review, security review, code review of L stories | `opus` | newest Opus |
| Coding, code review of S/M stories, QA, extraction | `sonnet` | newest Sonnet |
| Simple, repetitive, bulk tasks | `haiku` | newest Haiku |

- L stories get a design review before coding.
- A new model replaces the old one for the project's own task (e.g. extraction) only after it scores at least as
  well on the project's test or golden set. Record the result in `docs/decisions.md`.
- Run independent stories in parallel only when they touch different files. Keep each agent brief short.

## 7. Story flow (every story)
1. Design review for M/L stories or any contract/API change.
2. `coder` on `feature/<story-id>-<slug>` from `dev`.
3. `code-reviewer`, then `qa` (and `security-reviewer` when relevant). Fix blocking findings.
4. PR into `dev`. `test` for integration. `master` is production and gets releases only.
5. Update `docs/backlog.md` and `docs/HANDOFF.md`.
Build incrementally: small changes, one story at a time, even when given several jobs at once.

## 9. Context and handoff
- Keep working docs precise and short. Archive old decisions, resolved bugs and superseded plans in
  `docs/archive/` unless they matter for current or future work.
- `docs/HANDOFF.md` (under one page): current state, next step, open questions, links to the other docs.
  Update it at every milestone and at the end of every session.
- `docs/decisions.md`: one line per decision: date, decision, reason.
- **Crash resume:** after an unexpected shutdown, open Claude Code in the same folder and run `claude --continue`
  (or `claude --resume` to pick a session), read `docs/HANDOFF.md`, and continue from its next step.

## 10. UI and human review
- Before building any UI, show **3 mockup alternatives** and wait for the owner's choice.
- Human review or labelling defaults to a **local browser page**: the image or source beside the fields, a dropdown
  per item (correct / wrong / missing), keyboard shortcuts, CSV/JSON export. Not a spreadsheet.

