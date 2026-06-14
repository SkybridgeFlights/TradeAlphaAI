# Skill: Safe Workflow Editing

## Purpose
Edit GitHub Actions without breaking the hardened commit/push contract, leaking
unsafe behaviour, or reactivating legacy workflows.

## When to use
Any change under `.github/workflows/**`.

## Do-not-use conditions
Do not hand-edit the Autonomous Publishing Brain beyond minimal, justified
changes. Do not add scheduled live-posting.

## Checklist
- [ ] Preserve `stage_intended` + out-of-scope fail-safe + diagnostics + fetch/
      rebase/regenerate loop.
- [ ] Keep `ENABLE_*_POSTING: 'false'`.
- [ ] Validate YAML (`npx js-yaml`) and run `check:workflows`.
- [ ] Add new build/validate steps with `|| echo` graceful degradation.
- [ ] Dispatch the workflow and confirm a green run before declaring done.

## Common failure modes
- A new generator writes outside the staged paths → `git rebase` aborts on
  unstaged changes.
- Disabling `pull --rebase` safety.
- Reactivating an archived workflow.

## Required validators
`check:workflows`, YAML parse, and every validator the workflow's steps invoke;
a green dispatched run.

## Example prompt fragment
"Add `<build step>` + `<check>` to `<workflow>`; keep the hardened staging
intact, validate YAML + check:workflows, then dispatch and confirm green."
