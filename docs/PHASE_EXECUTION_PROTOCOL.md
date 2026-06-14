# Phase Execution Protocol

The reusable checklist every phase follows. Deviation requires an explicit,
stated reason. This protocol is how the Engineering Constitution is applied in
practice.

## The checklist

1. **Audit first.** Read the existing systems the phase touches. Understand what
   already exists before writing anything. Extend, do not rebuild.
2. **Identify exact files.** Enumerate the precise files that will change.
3. **Declare allowed changes.** State the allowed and forbidden directories for
   this mission (see the Agent Operating Model).
4. **Implement minimal changes.** Surgical edits only. No unrelated refactors,
   no reformatting, no broad CSS rewrites.
5. **Run targeted validators.** Run the validators directly covering the change
   first, for the fastest failure signal.
6. **Run the full affected suite.** Then run every validator the change could
   plausibly affect (production, responsive, RTL, bilingual, indexing, SEO,
   distribution, queue reconciliation, workflows, governance).
7. **Inspect the git diff.** Review exactly what is staged.
8. **Exclude unrelated files.** Never commit `.claude/settings.local.json`, logs,
   local artifacts, or brain-regenerated `data/**` that should sync via rebase.
9. **Commit with a clear message.** Describe root cause, change, and safety.
10. **Pull/rebase safely.** `git fetch` + `git rebase origin/main`; on artifact
    drift, regenerate + restage + continue. Never disable rebase safety.
11. **Push** — only when green.
12. **Verify production.** Confirm the relevant URLs return 200 and the live
    artifacts/behaviour reflect the change; confirm social stays preview-only.
13. **Return the final report.** Files changed, validators run, production
    verification, remaining limitations honestly stated, and **GO/NO-GO**.

## Hard stops

- A red validator → fix or honestly report before pushing. Push only green.
- A request to weaken a gate, fabricate data, commit a secret, or enable live
  social posting by default → refuse and surface the conflict.
- A change that would break bilingual parity, RTL, or determinism → redesign.
