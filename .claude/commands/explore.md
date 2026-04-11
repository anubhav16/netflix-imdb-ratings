# Initial Exploration Stage

Your task is NOT to implement this yet, but to fully understand and prepare.

Apply CLAUDE.md Engineering Philosophy #8 (trace end-to-end), #10 (decision ownership) throughout.

## Your responsibilities:

- Analyze and understand the existing codebase thoroughly
- Determine exactly how this feature integrates, including dependencies, structure, edge cases, and constraints
- Clearly identify anything unclear or ambiguous
- List all questions or ambiguities you need clarified

## Mandatory: Inventory First

Before proposing any design or approach:

1. **Search for existing implementations**: Use grep to find similar functions, classes, or patterns.
   List everything you find that can be reused. Never design new when existing works.

2. **Trace one call chain**: Follow how the scheduler or main entry point invokes similar logic.
   This prevents designing code that can't be reached.

3. **Data source map**: For each data dependency this feature needs, identify:
   - Which DB / file / API it comes from
   - Which function/query produces it
   - Whether it could be empty, null, stale, or timezone-naive

## Your exploration output must include:

### Reuse Inventory
> List of existing functions/modules directly reusable. State file path and function name.

### Data Source Map
> For each data dependency: source → table/column → potential issues (empty, NaN, stale)

### Open Questions
> List every ambiguity. Ask before assuming.

### Integration Points
> Where does this plug into existing code? What calls it? What does it call?

### Consumer Map
> For every function this feature will modify or replace: list every caller and what it does with the return value.

### Decision Ownership Audit
> For the core decision this feature makes: grep for every place that decision is currently made. If more than one exists, recommend consolidation before building.

---

Remember: your job is not to implement (yet). Just explore, map, and ask. We will go back and forth until you have no further questions. Do NOT assume any requirements or scope beyond explicitly described details.

Please confirm that you fully understand and I will describe the problem I want to solve.
