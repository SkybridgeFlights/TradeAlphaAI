# Skill: Bilingual Safety

## Purpose
Keep every public surface in correct, native EN + AR with intact RTL — never ship
a half-translated or layout-broken Arabic surface.

## When to use
Any change to public surfaces, generators, or labels that render in both
languages.

## Do-not-use conditions
Do not show English macro-interpretation text on the Arabic surface; do not use
translated-English rhythm. Do not ship EN without the AR counterpart.

## Checklist
- [ ] Every new label added to both locale tables (EN + AR).
- [ ] Arabic is native phrasing, not literal translation.
- [ ] AR page is `dir="rtl"` with RTL-aware CSS (margin-inline mirroring).
- [ ] EN article has a matching AR file (same slug).
- [ ] Numeric and date rendering correct in RTL.

## Common failure modes
- Untranslated release/state labels in one locale.
- English narrative bleeding into the Arabic surface.
- Missing `[dir="rtl"]` mirroring for new badges.

## Required validators
`check:bilingual-structure`, `check:ar-rtl`, `check:language-purity`,
`check:responsive`.

## Example prompt fragment
"Add the `<label>` to both `T.en` and `T.ar` with native Arabic; add `[dir=rtl]`
mirroring; verify check:ar-rtl + check:bilingual-structure."
