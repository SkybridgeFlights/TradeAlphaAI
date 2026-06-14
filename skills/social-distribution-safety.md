# Skill: Social Distribution Safety

## Purpose
Keep multi-platform distribution preview-only and idempotent — prepare for live
posting without ever posting live by default.

## When to use
Any change to social previews, approval queue, adapters, posting ledger, or the
distribution plan.

## Do-not-use conditions
Never default `ENABLE_*_POSTING` true. Never let an adapter touch the network in
preview/dry-run. Never schedule the approval runner. Never add an ungated
Telegram send.

## Checklist
- [ ] Posting flags default `false`; approval + dry-run default true.
- [ ] Adapter network reachable only in `live` mode after every gate.
- [ ] Posting ledger idempotent (no duplicate `posted`).
- [ ] Approval runner manual-dispatch only.
- [ ] Telegram stays URL-200 gated.

## Common failure modes
- A flag defaulting true, or an adapter calling the network in preview.
- A proxy/duplicate slipping into the ledger.
- A scheduled trigger on the approval runner.

## Required validators
`check:social-activation`, `check:distribution-plan`, `check:social-intelligence`,
`check:telegram-ledger`.

## Example prompt fragment
"Wire `<platform>` adapter so it stays preview-only by default and only reaches
the network in live mode after all gates; verify check:social-activation stays
green."
