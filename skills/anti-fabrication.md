# Skill: Anti-Fabrication

## Purpose
Guarantee that no committed artifact, article, visual, or health state contains
an invented value. Missing data degrades honestly.

## When to use
Every generator, enrichment layer, reaction/regime engine, monitor, and article.

## Do-not-use conditions
Never invent forecasts, reactions, prices, events, provider names, or health
states to "fill a gap". Never present a historical proxy as consensus.

## Checklist
- [ ] Every value traces to a named source/artifact.
- [ ] Missing data → `null` / `unavailable` / `awaiting` / `indeterminate`.
- [ ] A surprise score requires actual + sourced forecast (or labelled proxy).
- [ ] A reaction is classified only with observed window data.
- [ ] The validator hard-fails fabricated/contradictory state.

## Common failure modes
- Defaulting a missing forecast to the prior print and calling it consensus.
- Classifying a reaction with no observed data.
- A monitor showing "healthy" for a stale/missing artifact.

## Required validators
`check:economic-intelligence`, `check:forecast-consensus`, `check:macro-reactions`,
`check:liquidity-regime`, `check:intelligence-monitor`.

## Example prompt fragment
"If `<input>` is missing, output `unavailable` and set the state honestly — do
not substitute or infer a value. Add a validator that fails on fabrication."
