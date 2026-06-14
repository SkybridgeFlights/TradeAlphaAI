# Skill: Integration Governance

## Purpose
Merge multi-agent or multi-domain work into one clean, green, verified commit
without file conflicts or scope creep.

## When to use
Whenever a phase touches multiple domains or multiple agents contributed changes.

## Do-not-use conditions
Do not merge work where two contributors edited the same workflow/generator. Do
not commit unrelated or brain-regenerated `data/**` that should sync via rebase.

## Checklist
- [ ] Confirm non-overlapping file ownership across contributors.
- [ ] Stage only intended files; exclude `.claude/settings.local.json`, logs,
      and origin-owned artifacts.
- [ ] Run the full affected suite (production, workflows, governance + domain).
- [ ] Rebase safely on `origin/main`; regenerate artifacts on drift.
- [ ] Push only green; verify production (200s, preview-only social).

## Common failure modes
- Re-staging origin's newer artifacts because local HEAD is behind.
- Two agents' edits colliding on one file.
- Pushing before a green dispatched run.

## Required validators
`check:production`, `check:workflows`, `check:governance`, plus every domain
validator the merge touches.

## Example prompt fragment
"Integrate the macro + UI changes: confirm no file overlap, stage only intended
files, run the full affected suite + check:governance, rebase safely, push green,
verify production."
