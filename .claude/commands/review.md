# Code Review Task

Perform comprehensive code review of changed Python files. Be thorough but concise.
Read every file listed. Do not review what you haven't read.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #9 (evidence over reasoning), #10 (decision ownership) throughout.

## Python Fundamentals

- No bare `except:` — always catch specific exception types
- DB connections closed in `finally` blocks or context managers
- No hardcoded DB paths — must use `from config import DB_PATH, DATA_CACHE_DB_PATH`
- No unused imports
- No mutable default arguments (`def f(x=[])`)

## Data Integrity

- Empty DataFrame checked before use (`if df.empty: raise / return early`)
- NaN/None handled explicitly — never silently propagated downstream
- Date range boundaries correct — verify inclusive/exclusive as intended
- `fillna(0)` only where semantically correct (not masking real gaps)
- Column existence verified before access (`.get()` or `in df.columns`)

## Trading Domain (Critical — check every signal and backtest)

- **Look-ahead bias**: Signal at time T uses only data available at T (no future rows)
- **OHLCV correctness**: TP/SL use intraday high/low — NOT close price
- **Position sizing**: Computed from entry price, not current/future price
- **Rolling windows**: `rolling(N).mean()` shifts result by N-1 bars — verify alignment

## Logic

- Date filters correct — check both start and end endpoints
- Percentage calculations use correct denominators
- Sort order preserved where downstream logic depends on it
- Division-by-zero guarded where denominator can be 0

## Architecture

- Follows existing patterns and directory structure
- DB writes use parameterised queries (no f-string SQL)
- New code is reachable from its caller (not dead code)
- Failures are loud, not silent (`except Exception: pass` is a red flag)

## Decision Ownership (MANDATORY)

Grep for every other place the same decision exists. If the same question is answered in more than one place, flag as **HIGH** and recommend consolidation.

## Contract Review (MANDATORY)

For every function whose return value or behavior changed: grep all callers. Does each handle the new behavior — including empty, zero, None? Does any caller use truthiness (`if result:`) where 0 or empty list is valid? If any caller doesn't honor the new contract, flag as **CRITICAL**.

## Tuple Index Safety (only for agent/position functions)

For `position[N]` patterns: cross-check index against the SELECT query's column order. Wrong index = **CRITICAL**.

## Output Format

### ✅ Looks Good
- [item]

### ⚠️ Issues Found
- **[CRITICAL/HIGH/MEDIUM/LOW]** `file:line` — [issue description]
  - Fix: [specific fix]

### 📊 Summary
- Files reviewed: X
- Critical issues: X
- High issues: X
- Warnings: X

## Severity Levels
- **CRITICAL** — Data corruption, look-ahead bias, DB path bugs, crashes, wrong tuple index, broken contract
- **HIGH** — Silent failures, NaN propagation, duplicate decision logic, wrong price in TP/SL
- **MEDIUM** — Missing empty-DataFrame guard, unspecific exception catch
- **LOW** — Style, naming, minor maintainability

## Final Sign-off

After review is complete with no CRITICAL or HIGH issues:
- Run: `echo "$(date '+%Y-%m-%d %H:%M:%S')" > .claude/.reviewed_pending`
- If CRITICAL or HIGH issues were found and fixed: re-run /verify first, then /review again.
