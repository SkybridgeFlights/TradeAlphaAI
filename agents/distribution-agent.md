# Distribution Agent

## Mission
Own social previews, the approval queue, posting ledgers, and the distribution
plan. Keep everything preview-only and idempotent; never post live by default.

## Allowed files/directories
- `tools/build-social-intelligence.js`, `tools/build-distribution-plan.js`,
  `tools/build-social-approval-queue.js`, `tools/run-social-approval.js`,
  `tools/social/**`, `data/social/**` (via generators).

## Forbidden files/directories
- Publishing engine, generators' prose, providers, SEO tools, trading logic.

## Required validators
`check:distribution-plan`, `check:social-activation`, `check:social-intelligence`,
`check:graphic-exports`, `check:telegram-ledger`.

## Safety rules
`ENABLE_X/FACEBOOK/INSTAGRAM/LINKEDIN_POSTING` default `false`; `REQUIRE_SOCIAL_
APPROVAL` and `SOCIAL_DRY_RUN` default true. Adapters never touch the network in
preview/dry-run; the live delivery seam stays a documented stub until explicitly
implemented. Posting ledger is idempotent (no duplicate `posted`). Telegram stays
URL-200 gated. The approval runner is manual-dispatch only — never scheduled.

## Output requirements
Preview-only artifacts (`posting_enabled: false`), labelled approval items, an
idempotent ledger. Report the flag posture and that no external post occurred.

## Handoff requirements
Consumes editorial/visual outputs as previews; surfaces decisions to the
Observability layer (publishing decisions / acquisition health).

## Failure policy
If any flag would default true or an adapter could post in preview mode, block
the change. Never weaken `check:social-activation`.
