# Plan Creation Stage

Based on our full exchange, produce a markdown plan document.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #10 (decision ownership) throughout.

## If input is from /investigate

Before writing any steps, produce this mapping table:

| Finding # | Severity | Addressed in Step | Reason if skipped |
|---|---|---|---|
| [#] | CRITICAL/HIGH/MEDIUM/LOW | Step N | — |

- Every CRITICAL and HIGH row **must** map to a Step — no exceptions
- MEDIUM/LOW may be skipped only if explicitly out of scope — state why
- If any CRITICAL/HIGH is unmapped: **BLOCKED** — do not write the plan

## Requirements for the plan:

- Include clear, minimal, concise steps
- Track the status of each step using these emojis:
  - 🟩 Done
  - 🟨 In Progress
  - 🟥 To Do
- Include dynamic tracking of overall progress percentage (at top)
- Do NOT add extra scope or unnecessary complexity beyond explicitly clarified details
- Steps should be modular, elegant, minimal, and integrate seamlessly within the existing codebase
- **Each step must include Acceptance Criteria** — a specific, measurable output that proves the step worked
- Steps execute one at a time. Do not proceed to Step N+1 until Step N criteria are confirmed

## Markdown Template:

# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Short summary of what we're building and why.

## Critical Decisions
Key architectural/implementation choices made during exploration:
- Decision 1: [choice] - [brief rationale]
- Decision 2: [choice] - [brief rationale]

## Reuse Inventory
Existing functions/modules to reuse (do not rewrite these):
- `path/to/module.py` → `function_name()` — [what it does]

## Blast Radius
Run `grep -r "changed_module\|changed_function" --include="*.py"` before planning.
List every caller, shared DB table, or agent that touches the same code path:

| At risk | Why | Regression check |
|---|---|---|
| [file:fn] | [shares X] | [exact call to verify after fix] |

## Consumer & Ownership Checks
- For every function whose return value will change: list all callers. Flag any that use truthiness on values where 0/empty/None is valid.
- For the core decision this plan addresses: grep for every place it's currently made. If >1 exists, plan must consolidate first.

## Tasks:

- [ ] 🟥 **Step 1: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2
  - **Acceptance Criteria**: [specific, measurable output]
  - **Test Input**: [exact example input to use during /verify]
  - **Gate**: Do NOT proceed to Step 2 until Step 1 criteria are confirmed PASS ✅

- [ ] 🟥 **Step 2: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2
  - **Acceptance Criteria**: [specific, measurable]
  - **Test Input**: [example]
  - **Gate**: Do NOT proceed to Step 3 until Step 2 criteria are confirmed PASS ✅

...

- [ ] 🟥 **Final Step: Regression Sweep**
  - For each row in Blast Radius table: run the listed check, show actual output
  - **Gate**: All rows must show PASS ✅ — BLOCKED until then

Again, it's still not time to build yet. Just write the clear plan document. No extra complexity or extra scope beyond what we discussed.
