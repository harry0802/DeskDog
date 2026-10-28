---
name: do-work
description: Take one change to DeskDog from plan to commit, gated by type check and tests.
disable-model-invocation: true
---

# Do work

Take one change from intent to commit. The feedback loops decide when the change is done; your own read of the code is a hypothesis until they go green.

## 1. Plan

If the user handed you a plan or a `ready-for-agent` issue, that is the plan: go to step 2.

Otherwise read the parts of `GLOSSARY.md`, `docs/adr/`, and `docs/spec.md` that touch the change, then write the plan as a few bullets: files touched, behaviour added, and the test that will prove each behaviour. Done when every behaviour bullet names its test, or is marked as outside the Pet core (no test seam, type check only).

## 2. Implement

Pet core behaviour goes test-first (see "Testing Decisions" in `docs/spec.md`): write the Vitest test, watch it go **red** for the right reason, then write the code that turns it **green**. One behaviour at a time.

Code outside the Pet core (Electron shell, Pixi rendering, settings window) has no test seam; the type check is its loop. Keep logic out of those layers and in the Pet core, where a test can reach it.

## 3. Close the feedback loops

Run exactly `pnpm run type-check` and `pnpm run test`: `.claude/settings.json` pre-approves these two commands verbatim, so keep the `package.json` scripts under these names. Read each failure as information about the code, fix, and rerun. Change a test only when the plan's behaviour changed, never to make it pass.

When a fix leans on an implicit dependency (ordering by id as a tie-breaker, timing, insertion order), pin it with a test so a later change to that dependency goes red, and name it in the commit body.

Done when both loops are green in one run on the final code, and you saw that output. If a loop does not exist yet (no script, no tests), record which one was missing; that goes in the commit body.

## 4. Commit

Stage only this change's files. Message: imperative subject line; body says why, which loops ran green, which were missing, and any implicit dependency; `#<n>` when the work came from an issue.

The pre-commit hook (`.husky/pre-commit`) reruns Prettier on staged files, the type check, and the tests, and rejects the commit on any failure. A rejected commit is a **red** loop: read the hook output, go back to step 3, re-stage (Prettier may have rewritten files), and commit again. The hook is the final gate; get through it by making it pass, never with `--no-verify`.

Done when `git status` shows the change committed.

## 5. Hand off for QA

The loops cover the Pet core; how the dog looks and feels on the desktop is the human's to judge. List the manual QA steps for what this change touched outside the Pet core: what to launch, what gesture to perform, what to see. Done when every behaviour outside the Pet core has a QA step, or you state that the change has none.
