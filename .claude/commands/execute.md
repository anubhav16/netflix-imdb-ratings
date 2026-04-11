# Execute Implementation

Implement **one step at a time** exactly as planned. Do not batch multiple steps.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #9 (evidence over reasoning), #10 (decision ownership) throughout.

## Implementation Requirements

- Write elegant, minimal, modular code
- Adhere strictly to existing code patterns, conventions, and best practices
- Include date-annotated inline comments for every change:
  `# [YYYY-MM-DD HH:MM] Reason for this change`
- After implementing each step: update the tracking document with emoji status and overall progress %

## Self-Verification (MANDATORY — do not skip or abbreviate)

After implementing each step, before marking it done:

### 1. Syntax Check
Run the file through Python to confirm no import or syntax errors:
```
python3 -c "import <module_name>"
```
Show the actual output. Must be clean.

### 2. Run and Show Output
Call each new/modified function with realistic test input.
Show **ACTUAL output** — sample rows, row counts, column names, values.

### 3. Caller-Perspective Test
Test from the function that *calls* the new/modified code. Confirm the caller behaves correctly with the actual output — including empty returns, zero values, and None.

### 4. Decision Ownership Check
Before writing new logic, grep for every existing implementation of the same decision. If one exists, call it. If multiple exist, consolidate.

### 5. Writer Audit (for constraint/enforcement changes)
If this step modifies a constraint or enforcement path:
```
grep -rn 'constrained_field' --include="*.py"
```
Confirm the fix covers ALL writers, not just the one that triggered the bug. If any writer is uncovered, the step is incomplete — extend the fix before proceeding.

### 6. Edge Cases
Explicitly test and show:
- Empty input -> confirm no crash, appropriate return
- NaN / missing values -> confirm handled, not propagated
- Missing symbol or date -> confirm error is logged, not silently swallowed
- **Zero and falsy values** -> confirm `0`, `""`, `[]`, `None` are handled distinctly (not collapsed by `or` / `if value` / truthiness checks)

### 7. Acceptance Criteria Check
Compare actual output against the plan's Acceptance Criteria for this step.
State explicitly for each criterion: **PASS** or **FAIL** with evidence.

### 8. Gate
- If ALL criteria PASS: mark step Done, proceed to next step
- If ANY criterion FAILS: **STOP**. Fix the issue. Re-run verification. Do not proceed until fixed.

## Output Per Step

```
## Step N: [Name] — Done

Changes made:
- [file:line] — [what changed and why]

Verification:
- Syntax: PASS
- Run output: [actual output shown]
- Caller test: [shown]
- Writer audit: [N writers found, all covered / X uncovered — BLOCKED]
- Edge cases: [shown, including falsy-value test]
- Acceptance criteria: PASS / FAIL

Progress: X% complete
```
