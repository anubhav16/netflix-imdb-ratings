# Verify Implementation

Run a complete end-to-end verification of what was just implemented.
Do NOT assume it works — prove it with actual output at every step.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #9 (evidence over reasoning), #10 (decision ownership) throughout.

## Step 1: Syntax + Import Check

Run each modified file through Python. Show actual output:
```
python3 -c "import <module_name>"
```
Expected: no output, no errors. If there's an ImportError or SyntaxError — BLOCKED. Fix first.

## Step 2: Unit Smoke Test

For each new or modified function, call it with:

1. **Normal realistic input** -> show actual output (sample rows, counts, values)
2. **Empty input** (empty DataFrame, empty list, no rows) -> show it returns gracefully, no crash
3. **Bad/missing data** (NaN values, missing column, missing symbol) -> show error is logged, not swallowed silently

Show ACTUAL output. Not descriptions. Not "it should return X."

## Step 3: Caller-Perspective Test

Do not only test the changed function in isolation. Test from the function that *calls* it, with inputs that exercise the changed path — including edge cases like empty returns, zero values, and None.

## Step 4: Decision Ownership Check

Grep the codebase for every other place the same decision is made. Confirm no parallel implementation contradicts or bypasses the change. If duplicates exist, flag as **HIGH**.

## Step 5: Writer/Reader Completeness Check (for constraint fixes)

If this fix enforces a constraint (budget, limit, threshold):

1. **Grep every writer** of the constrained field across the entire codebase
2. **Grep every reader** that consumes it before the execution boundary
3. **For each writer→execution path:** does the constraint get enforced?
4. Output:

| Writer | File:Line | Constrained? | Path to execution |
|--------|-----------|-------------|-------------------|

If ANY writer→execution path bypasses the constraint: **BLOCKED**. The fix is incomplete.

**This step exists because:** v2.61.5 fixed the allocator, v2.62.2 fixed the zero-value path, but neither checked that 3 agents pre-set the field and bypassed the allocator entirely. Exhaustive writer enumeration would have caught all 3 issues in one pass.

## Step 6: Data Integrity Check

For any DB read or write in this implementation:

**Read**: Run the actual query. Show row count, sample rows, any NaN in critical columns.

**Write**: Show before/after state. Confirm no NaN written, no phantom rows, no duplicates.

**DataFrame operations**: Confirm shape, columns, and dtypes match expected.

## Step 7: Trading-Domain Checks (if applicable)

- **Look-ahead bias**: Does the signal at bar T use only data from bars <= T?
- **OHLCV correctness**: Does TP/SL use intraday high/low (not close)?
- **Date range**: Does output cover the expected date range?
- **NaN propagation**: Are NaN values handled before they reach signal logic?

## Step 8: Tuple-Index Safety Check (only for agent/position functions)

For any function that accesses `position[N]` from a raw DB tuple:

1. Find the SELECT query that produces the tuple.
2. Map every `position[N]` to its actual column.
3. Cross-check against the query's column order.
4. Call the function with a raw tuple matching the exact column order. Show actual output.

If any index is wrong: **BLOCKED**.

## Step 9: Execution Boundary Defense Check (for capital/trading constraint fixes)

The execution boundary is the last function before real money moves (e.g., `auto_trader._execute_market_order()`).

1. Read the execution boundary function
2. Confirm it independently enforces the constraint — not relying on upstream callers to pass correct values
3. If the execution boundary trusts upstream without its own check: flag as **HIGH** — defense-in-depth violation

This is the safety net. Upstream enforcement is optimization; execution boundary enforcement is the guardrail.

## Step 10: Acceptance Criteria Sign-off

For each criterion defined in the plan:

| Criterion | Status | Evidence |
|---|---|---|
| [criterion from plan] | PASS / FAIL | [actual output proving it] |

## Final Sign-off

- If ALL steps pass: output **VERIFIED**
  - Then run: `echo "$(date '+%Y-%m-%d %H:%M:%S')" > .claude/.verified_pending`
- If ANY step fails: output **BLOCKED — [what failed and why]**
  - Do not proceed. Fix the failure. Re-run /verify.
