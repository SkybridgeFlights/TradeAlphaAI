# Skill: Visual Evidence Design

## Purpose
Design charts/SVGs/rails that prove a point — every visual answers "why does this
exist?" and reinforces the narrative with evidence.

## When to use
Any chart, SVG panel, or evidence rail tied to an article or dashboard.

## Do-not-use conditions
No decorative visuals, no retail-TA aesthetics, no fabricated metric primitives,
no light-theme backgrounds.

## Checklist
- [ ] State the analytical reason the visual exists.
- [ ] The article references the visual and vice versa.
- [ ] Dark-theme, typography-first, RTL-aware.
- [ ] Renderer cannot invent numbers (no metric primitives).
- [ ] Preview-only export with source hash.

## Common failure modes
- A graphic disconnected from the thesis.
- Renderer fabricating values.
- Light backgrounds breaking the dark theme.

## Required validators
`check:editorial-graphics`, `check:graphic-exports`, `check:editorial-visuals`,
`check:responsive`, `check:ar-rtl`.

## Example prompt fragment
"Add an evidence rail that isolates per-asset confirm/diverge; the article must
reference it; dark-theme + RTL; no fabricated numbers; verify check:editorial-
visuals."
