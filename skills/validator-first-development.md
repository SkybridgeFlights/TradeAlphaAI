# Skill: Validator-First Development

## Purpose
Define the safety contract (the validator) before or alongside the feature, so
correctness is enforced mechanically, not by hope.

## When to use
Any new artifact, generator, surface, or workflow that could fabricate, contradict,
or leak unsafe output.

## Do-not-use conditions
Do not write a validator that merely rubber-stamps the output. The check must be
able to fail on bad input.

## Checklist
- [ ] Write the validator's hard-fail conditions first.
- [ ] Add negative tests proving each condition rejects bad input.
- [ ] Make the feature pass by being correct, not by loosening the check.
- [ ] Wire the validator into the owning workflow's validate gate.

## Common failure modes
- A validator that passes everything (no real assertions).
- Editing the validator to turn red into green.
- No negative tests, so the gate silently rots.

## Required validators
The new `check:*` plus its negative-test harness, and `check:workflows` after
wiring.

## Example prompt fragment
"Before implementing, write `tools/check-<x>.js` with hard-fail rules for
<conditions> and 5 negative tests. Then implement until it passes — without
weakening the check."
