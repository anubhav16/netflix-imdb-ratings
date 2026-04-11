# Ship — Execute → Verify → Review → Deploy Loop

You are running the full ship loop. This orchestrates /execute → /verify → /review with automatic retry on failures, then deploys only when all gates pass.

**Do not skip steps. Do not proceed past a gate that has not passed.**

---

## Setup

Before starting, confirm:
1. A plan exists (from /create-plan). If not — STOP. Ask user to run /create-plan first.
2. RELEASE_NOTES.md has been updated for this version. If not — update it now before touching any code.
3. Note the current attempt counter: **Attempt 1 of 3**.

---

## Phase 1 — Execute

Run /execute for the current plan step (one step at a time).

Follow all rules from /execute exactly:
- Implement one step, show actual output, test edge cases
- Include date-annotated inline comments: `<!-- [YYYY-MM-DD HH:MM] Reason -->`
- Produce the standard /execute step output block

---

## Phase 2 — Verify

Run /verify on what was just implemented.

Follow all steps from /verify exactly:
1. Syntax + Validation Check
2. Smoke Test (normal, empty, bad input)
3. Caller-Perspective Test
4. Decision Ownership Check
5. Acceptance Criteria Sign-off

Collect all FAIL ❌ items into a list. Label them `[VERIFY FAIL]`.

---

## Phase 3 — Review

Run /review on all changed files.

Follow all sections from /review exactly:
- Fundamentals
- Logic
- Architecture

Collect all CRITICAL and HIGH issues into a list. Label them `[REVIEW CRITICAL]` or `[REVIEW HIGH]`.

---

## Gate Check

After both Phase 2 and Phase 3 complete, evaluate:

### ✅ GATE PASSED — all of the following are true:
- Zero `[VERIFY FAIL]` items
- Zero `[REVIEW CRITICAL]` items
- Zero `[REVIEW HIGH]` items

→ Print:
```
SHIP GATE: PASSED ✅ (Attempt X/3)
Proceeding to deployment.
```
→ Jump to Phase 5 — Deploy.

### ❌ GATE FAILED — any of the following exist:
- One or more `[VERIFY FAIL]` items
- One or more `[REVIEW CRITICAL]` or `[REVIEW HIGH]` items

→ Print:
```
SHIP GATE: FAILED ❌ (Attempt X/3)

Issues to fix:
[list every VERIFY FAIL, REVIEW CRITICAL, REVIEW HIGH item with file:line]
```

→ Check attempt counter:
- **Attempt ≤ 3**: Increment counter. Go to Phase 4 — Fix Iteration.
- **Attempt > 3**: STOP. Print:
  ```
  SHIP GATE: BLOCKED ❌ — 3 iterations exhausted.
  Cannot auto-resolve. Escalating to user.
  Unresolved issues:
  [list all remaining issues with file:line and severity]
  ```
  Do NOT deploy. Wait for user instruction.

---

## Phase 4 — Fix Iteration (only reached after gate failure)

This is a targeted fix pass — only fix the listed issues, nothing else.

1. For each `[VERIFY FAIL]` item: fix the failing code path
2. For each `[REVIEW CRITICAL]` item: fix the critical issue
3. For each `[REVIEW HIGH]` item: fix the high-severity issue
4. Do NOT refactor unrelated code. Do NOT expand scope.
5. Add date-annotated comment for each fix: `<!-- [YYYY-MM-DD HH:MM] Fix: <issue description> -->`

After all fixes applied → return to Phase 2 (Verify) with incremented attempt counter.

---

## Phase 5 — Deploy (only reached after gate passes)

Run /deploy. Follow all steps in /deploy exactly:
- Pre-flight check (verify + review gates confirmed)
- Update RELEASE_NOTES.md with version bump and changes
- Git commit (staged files listed explicitly)
- Git push

/deploy will produce its own Deploy Status Report. Include it in the final Ship Status Report below.

---

## Final Status Report (mandatory after Phase 5)

```
## Ship Status Report

Attempts needed: X/3
Gate passed on attempt: X

Version: [major.minor.patch]
Files changed: [list each file with line count delta]
Functions added/modified: [list with file:line]
Tests/verification run: [what was run, actual output shown]
Acceptance criteria: [PASS ✅ / FAIL ❌ per criterion with evidence]

--- Deploy Status (from /deploy) ---
[paste /deploy status report here]
------------------------------------

Known risks/unknowns: [list anything uncertain]
```
