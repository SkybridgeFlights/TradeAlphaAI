# TradeAlphaAI Engineering Constitution

This is the supreme, non-negotiable operating law for all engineering work on
this repository — by any human, Claude Code, or Codex agent. When any other
instruction conflicts with this document, this document wins. Phases add product;
this constitution preserves the platform.

## Non-negotiable rules

1. **Extend, do not rebuild.** Build on existing systems. Reuse generators,
   validators, and artifacts. Replacing a working subsystem requires explicit
   instruction and a migration that keeps every validator green.
2. **Surgical changes only.** Touch the minimum number of files and lines needed.
   No opportunistic refactors. No reformatting unrelated code.
3. **Push only green.** Never push a branch that leaves any required validator
   red. If a workflow is red — even from a pre-existing cause — fix it or report
   it explicitly before pushing.
4. **Never weaken validators.** A validator may be extended or made stricter,
   never loosened to make a change pass. Fix the code, not the gate.
5. **Never fabricate data.** No invented forecasts, reactions, prices, events,
   provider names, or health states. Missing data degrades honestly
   (`unavailable` / `awaiting` / `null`), never silently.
6. **Never commit secrets.** No API keys, tokens, or credentials in code, data,
   or front-end. `.claude/settings.local.json`, logs, and local artifacts are
   never committed.
7. **Never enable external social posting by default.** `ENABLE_X/FACEBOOK/
   INSTAGRAM/LINKEDIN_POSTING` default `false`. Live posting requires an explicit
   safe env flag.
8. **Preserve preview-only social** unless explicit safe flags are true. The
   approval queue, ledger, and adapter gates must stay intact.
9. **Preserve Telegram URL-verified gating.** Telegram delivery stays behind the
   existing URL-200-verified publisher path. Never add an ungated send.
10. **Preserve bilingual EN/AR parity.** Every public surface ships in both
    languages with matching structure.
11. **Preserve RTL integrity.** Arabic surfaces stay `dir="rtl"`, native, and
    layout-correct.
12. **Preserve deterministic artifacts.** Generation is deterministic and
    evidence-grounded. No nondeterministic or unsourced output in committed
    artifacts.
13. **Preserve workflow hardening and rebase safety.** Keep the `stage_intended`
    + fail-safe + fetch/rebase/regenerate commit pattern. Never disable
    `pull --rebase` safety.
14. **No broad CSS rewrites** unless explicitly scoped. Additive, dark-theme,
    RTL-aware CSS only; never reflow the whole stylesheet.
15. **No mass rebakes** (e.g. the 568-page global-header apply) unless required
    and fully validator-covered with revert-readiness.
16. **No touching trading logic** unless explicitly requested.
17. **No destructive deletions** without archive/validator proof that the target
    is safe to remove (no orphan/public-route invariant broken).
18. **Every generated artifact must have a source and reason.** Source
    attribution and an explicit purpose accompany every artifact and visual.
19. **Every public claim must be supported by an artifact/source.** No
    unsupported macro claims, predictions, or advice language.
20. **Every phase must return** files changed, validators run, production
    verification, remaining limitations, and an explicit **GO/NO-GO**.

## Enforcement

`tools/check-governance.js` (`npm run check:governance`) verifies this document
and the agent/skill layer exist and remain complete. It cannot be satisfied by
deleting rules — only by keeping the governance layer intact.
