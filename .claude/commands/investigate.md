# Production Incident Investigation

You are conducting a **forensic investigation** of a live production issue.

**You do not stop until you have evidence for every claim. You do not guess. You do not say "likely" unless you have tried and failed to find proof.**

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #9 (evidence over reasoning), #10 (decision ownership) throughout.

---

## Phase 1 — Orient (logs first, code second)

1. Identify the stocks/agents/components named in the incident.
3. Build a **chronological timeline** from logs before reading any code:
   - Every decision point (BUY/SELL/HOLD/EXIT/SKIP) with values
   - Every WARNING or ERROR mentioning the affected entities
   - Any threshold/config values shown — note if they change mid-session

---

## Phase 2 — Trace the Full Decision Path

For the decision that went wrong (e.g., "why did this happen?", "why didn't this this step fire?"):

1. **Identify every component in the path** — from signal generation to final outcome. List them in order.
2. **For each component:** Read the actual source. Quote the exact decision logic. Note inputs and outputs.
3. **At each handoff between components:** What does component N pass to component N+1? Does N+1 handle all possible outputs from N (including empty, zero, None, error)?
4. **Find every parallel implementation** — grep for every other place this same decision is made. If the decision exists in multiple places, all of them are in scope.

Do not hardcode which components to check. Follow the actual code path for THIS incident.

---

## Phase 2B — Writer/Reader Audit (MANDATORY for any constraint violation)

**When the bug involves a constraint being violated** (budget cap, position limit, exposure limit, risk threshold, or any config value that should limit behavior):

1. **Name the constraint field(s):** What config value should limit what signal/trade field? (e.g., "AGENT_ALLOCATIONS[agent] should cap allocated_amount")

2. **Find EVERY WRITER** — grep the entire codebase for every place the constrained field is set:
   ```
   grep -rn 'field_name\s*=' --include="*.py"
   grep -rn "'field_name'" --include="*.py"  # dict key assignment
   ```
   Output a table:

   | Writer | File:Line | Value source | Respects constraint? |
   |--------|-----------|-------------|---------------------|

3. **Find EVERY READER** — grep for every place the field is consumed:
   ```
   grep -rn 'field_name' --include="*.py"
   ```
   Output a table:

   | Reader | File:Line | What it does with the value | Enforces constraint? |
   |--------|-----------|---------------------------|---------------------|

4. **Trace every Writer→Reader→Execution path:** For each writer, follow its value through each reader until it reaches the execution boundary (the function that places real trades / modifies real data). At each hop, ask:
   - Does a skip/bypass condition exist that could route around enforcement?
   - Does a falsy check (`if value`, `value or fallback`) treat valid constraint values (0, empty) as missing?
   - Does a fallback path exist that ignores the constraint?

5. **If ANY path from writer to execution boundary bypasses the constraint: that is a finding**, even if other paths enforce it correctly.

**This phase is not optional.** Skipping it is how the same bug gets "fixed" 3 times. The v2.61.5/v2.62.2/v2.64.2 budget bypass survived because Phase 2 found one broken path each time without checking whether other paths also bypassed enforcement.

---

## Phase 3 — Query the DB (Live State)

Run on AWS — never local:


Report: exact DB state, order_id verification (see CLAUDE.md position safety rules), any metadata that could override behavior.

---

## Phase 4 — Check Git History for Regression

```bash
git log --format="%h %ai %s" -- <affected_files> | head -20
```

Report: exact commit hash that introduced the bug, whether it correlates with when the symptom first appeared in logs.

**Repeat-offender check:** Search RELEASE_NOTES.md for prior fixes to the same constraint/field:
```
grep -i 'budget\|allocation\|<constraint_keyword>' RELEASE_NOTES.md | head -20
```
If the same constraint has been fixed before: this is a **systemic failure**. The findings must include WHY the prior fix didn't hold, and the fix must address the systemic gap (not just this instance).

---

## Phase 5 — Mandatory Output

Do not summarize narrative. Output a **findings table** — one row per issue found.

### Required columns:
| # | Severity | File:Line | What the code does | What it should do | Evidence (log line or code quote) | P&L Impact |

### Severity definitions:
- **CRITICAL** — Trade placed/missed incorrectly, wrong price, data corrupted, decision logic disabled
- **HIGH** — Silent failure, stale data consumed, wrong threshold, bypass path exists
- **MEDIUM** — Missing guard, wrong log level, single-path inconsistency
- **LOW** — Wrong comment, naming, style

### Writer/Reader Audit Summary (if Phase 2B was triggered):
| Writer | Enforces constraint? | Reader that consumes it | Reaches execution unchecked? |
|--------|---------------------|------------------------|------------------------------|

### For each affected entity, output a decision simulation:
Show the actual values from logs/DB, trace through each layer of the decision path, show the math, and state whether the system decision was correct.

---

## Rules

1. **Every claim needs a source** — log line with timestamp, or file:line quote.
2. **Simulate with real numbers** — use actual values from logs, not placeholders.
3. **Trace the full path** — from trigger to outcome, every layer.
4. **Find every copy** — if the broken logic exists in N places, report all N.
5. **Git blame every bug** — identify the commit that introduced it.
6. **No "likely" without evidence** — say "unverified" if you can't prove it.
7. **Report what you could NOT check** — missing logs, no DB access, etc. are findings too.
8. **Every writer must be accounted for** — if a field has N writers and only M are constrained, report the N-M unconstrained writers as findings. A constraint enforced on 2 of 3 paths is not enforced.
9. **Check the execution boundary** — the last function before real money moves MUST independently enforce the constraint. Upstream-only enforcement is a finding (defense-in-depth violation).
