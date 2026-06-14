# Skill: Editorial Narrative Quality

## Purpose
Produce flowing, causal, institutional prose (FT/Bloomberg-desk quality) that
stays deterministic and evidence-grounded.

## When to use
Article, brief, and outlook generation and any editorial-quality scoring.

## Do-not-use conditions
No banned filler ("markets are watching", "could potentially", "on the
sidelines"), no advice/buy-sell, no predictions, no generic SEO blocks.

## Checklist
- [ ] Connect release → reaction → liquidity/regime → cross-asset → divergence →
      what-next with real transitions.
- [ ] Reason about breadth/persistence, not just the headline.
- [ ] Reference the supporting visual/evidence rail.
- [ ] Score ≥ the quality floor in EN and AR; flag-free.
- [ ] Native Arabic rhythm, not translated English.

## Common failure modes
- Robotic section transitions and repeated phrasing.
- Filler/hedging clichés.
- Visual mentioned but not actually linked to the thesis.

## Required validators
`check:editorial-quality-articles`, `check:narrative-realism`,
`check:market-news-articles`, `check:bilingual-structure`, `check:language-purity`.

## Example prompt fragment
"Rewrite `<section>` as flowing causal prose that reasons about breadth and
references the evidence rail; keep it flag-free and ≥ the quality floor in EN+AR."
