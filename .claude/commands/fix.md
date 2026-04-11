# Fix Bug

Make the minimal change needed to fix the described bug. No planning docs, no phases, no tracking.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #9 (evidence over reasoning), #10 (decision ownership) throughout.

## What to do

1. **Read the relevant file(s)** — understand the current code before touching anything
2. **Find every copy of the broken logic** — grep the entire codebase. Fix all N copies or consolidate to one.
3. **Identify the exact lines causing the bug** — quote them before changing them
4. **Make the minimal fix** — change only what's broken, nothing else
5. **Add date-annotated comment** at the change site:
   `# [YYYY-MM-DD HH:MM] Fix: <one-line reason>`

## Self-Verification (required — show actual output, not "should work")

After the fix:

1. **Syntax check** — run `python3 -c "import <module>"` → show output (must be clean)
2. **Before/After** — show the specific behavior that was broken, then show it working
3. **Caller-perspective check** — test from the caller, not just the fixed function. Does the caller handle the new behavior correctly?
4. **Edge case** — if the bug was triggered by a specific input, show that input now works
5. **Contract check** — if the fix changes a return value, grep all consumers. Does each handle it?

## Output Format

```
Bug: [one-line description]

Root cause: [file:line] — [what the code was doing wrong]
Other copies: [list every other location this logic exists, or "none"]

Fix: [what changed and why]

Verification:
- Syntax: PASS
- Before: [broken behavior]
- After: [correct behavior, actual output]
- Edge case: [shown]
- Caller test: [shown]

FIXED ✅
```

If verification fails at any step: output **BLOCKED ❌ — [what failed]** and stop.

## Scope Rules

- Fix ONLY the reported bug — do not refactor, clean up, or "improve" surrounding code
- If you discover a second bug while fixing: note it, don't fix it (use /create-issue instead)
- If the fix requires touching more than 3 files: stop and recommend /explore + /create-plan instead
