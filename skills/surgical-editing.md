# Skill: Surgical Editing

## Purpose
Make the smallest possible change that fully solves the task — preserving
everything else exactly.

## When to use
Every edit to existing code. Especially large/shared files (generators,
workflows, stylesheets).

## Do-not-use conditions
Never use as an excuse to leave a real bug half-fixed. Surgical ≠ incomplete —
finish the scope, just don't expand it.

## Checklist
- [ ] Read the target region before editing.
- [ ] Match surrounding style, naming, and comment density.
- [ ] Change only the lines the task requires; no reformatting.
- [ ] Unique, exact `old_string` for each edit.
- [ ] Re-read the diff: nothing unrelated changed.

## Common failure modes
- Reformatting a whole file and burying the real change.
- Renaming/reflowing unrelated code.
- Editing generated artifacts by hand instead of the generator.

## Required validators
The validators covering the touched file, plus `git diff --cached` review.

## Example prompt fragment
"Make a surgical edit to `<file>`: change only `<exact region>`. Do not reformat
or touch anything else. Show the diff."
