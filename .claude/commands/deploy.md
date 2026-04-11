# Deploy

Push code to git. Only run after /ship gate has passed (or /review has passed for manual deploys).

---

## Pre-flight Check

Before any git command, confirm:
1. `/verify` output shows **VERIFIED ✅** — if not, STOP.
2. `/review` output shows zero CRITICAL and zero HIGH issues — if not, STOP.
3. No uncommitted changes to secret files, `.env`, or credentials.

If any check fails: STOP. Do not proceed. State which check failed and why.

---

## Step 1 — Update Release Notes

Update `RELEASE_NOTES.md` with:
- **Version bump**: major (breaking/large changes), minor (new features), patch (bug fixes/tweaks)
- **Date**: today's date
- **Summary**: one-line description of what changed
- **Changes**: bullet list of specific changes

If `RELEASE_NOTES.md` doesn't exist, create it with a version history table at the top.

---

## Step 2 — Git Commit

Stage only the files that were changed. List each file explicitly — never use `git add .` or `git add -A`.

```
git add <file1> <file2> ...
```

Show the staged file list (`git status`) before committing. Confirm no `.env`, `.log`, or secret files are staged.

Commit with this format:
```
git commit -m "fix/feat: [one-line summary]

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Show the commit hash after commit completes.

---

## Step 3 — Git Push

```
git push origin main
```

Show push output. Confirm no rejected refs or conflicts.

---

## Deploy Status Report (mandatory)

```
## Deploy Status Report

Pre-flight: PASS ✅ / FAIL ❌
Git commit: [hash]
Git push: PASS ✅ / FAIL ❌
```

If any step fails: STOP. Do not proceed to the next step. Report what failed and the exact error output.
