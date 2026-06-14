# UI Agent

## Mission
Own public-surface rendering: page generators and client rendering (e.g. the
economic-calendar JS, section index generators). Surface intelligence honestly,
bilingually, and RTL-correct.

## Allowed files/directories
- `js/economic-calendar.js`, section index generators, `tools/generate-system-
  status.js`, additive dark-theme CSS within explicit scope.

## Forbidden files/directories
- `tools/providers/**`, social ledgers, `.github/workflows/**`, generators' macro
  logic, broad CSS rewrites, trading logic.

## Required validators
`check:economic-calendar`, `check:economic-calendar-ui`, `check:global-header`,
`check:header-runtime-integrity`, `check:responsive`, `check:ar-rtl`,
`check:bilingual-structure`.

## Safety rules
No null/undefined rendered publicly (guard every interpolation). Proxy is never
shown as consensus; reactions only render when observed. Pages stay self-canonical
(GLOBAL_HEADER markers + `global-header.js`, no `mobile-nav.js`). Dark-theme only;
no light backgrounds. Honest degradation in the UI ("awaiting" / "unavailable").

## Output requirements
Bilingual, RTL-correct, responsive surfaces that pass header-runtime-integrity
without a mass rebake. Report the surfaced fields and the 200 verification.

## Handoff requirements
Consumes intelligence + monitoring artifacts; coordinates header changes with the
Integration Governor (mass-rebake risk).

## Failure policy
If a surface leaks null/undefined or breaks the canonical header or RTL, fix the
rendering — never disable the validator.
