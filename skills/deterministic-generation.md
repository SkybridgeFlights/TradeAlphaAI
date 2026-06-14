# Skill: Deterministic Generation

## Purpose
Keep generation reproducible and evidence-grounded — same inputs produce the same
committed artifact, with no nondeterministic or unsourced output.

## When to use
Every artifact builder, article/brief generator, SVG renderer, and monitor.

## Do-not-use conditions
Do not introduce randomness, wall-clock-dependent content (beyond an honest
`generated_at`), or unsourced free text into committed artifacts.

## Checklist
- [ ] Output is a pure function of the input artifacts (+ timestamp).
- [ ] No `Math.random`, no network in the deterministic path.
- [ ] Re-running with the same inputs yields the same body.
- [ ] Unit-test the engine logic with synthetic inputs.

## Common failure modes
- Hidden time/locale dependence changing output between runs.
- Network calls in a path that is supposed to be offline-deterministic.
- Unsourced prose presented as analysis.

## Required validators
The artifact's own `check:*`, plus engine unit tests and negative tests.

## Example prompt fragment
"Make `<builder>` a pure deterministic function of its input artifacts; unit-test
the logic with synthetic inputs; no randomness or network in the core path."
