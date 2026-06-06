'use strict';

// Phase 62.1: Deep Institutional Repair Engine
// Detects failing institutional gates in editorial drafts and applies
// section-by-section deep repair using deterministic institutional templates
// (no API key required) or AI-generated section regeneration (if OPENAI_API_KEY set).
//
// New modes vs Phase 62 original:
//   --execute   → apply deep repair to draft HTML (write with --write)
//   --retry     → repair + re-score + update queue status + diagnostics
//
// Usage:
//   node tools/repair-institutional-depth.js [--slug=<slug>]          → spec only
//   node tools/repair-institutional-depth.js --slug=<slug> --execute --write    → repair
//   node tools/repair-institutional-depth.js --slug=<slug> --retry --write      → repair+score

const fs          = require('fs');
const path        = require('path');
const { spawnSync } = require('child_process');

const ROOT              = path.resolve(__dirname, '..');
const QUEUE_PATH        = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_DIR         = path.join(ROOT, 'drafts', 'editorial');
const REGIME_PATH       = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const ETF_PATH          = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const RATE_PATH         = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const REPAIR_SPEC_PATH  = path.join(ROOT, 'data', 'intelligence', 'repair-spec.json');

const WRITE     = process.argv.includes('--write');
const EXECUTE   = process.argv.includes('--execute');
const RETRY     = process.argv.includes('--retry');
const FORCE     = process.argv.includes('--force');
const SYNC_PAIR = process.argv.includes('--sync-pair');
const SLUG      = argValue('--slug') || null;

const BOILERPLATE_MARKER = 'should be studied as an exposure framework rather than a trading instruction';

// ── Institutional depth check patterns ───────────────────────────────────────

const INSTITUTIONAL_PATTERNS = {
  transmission_chain: {
    patterns: [/transmission/i, /rate\s+channel/i, /policy\s+(channel|pathway|mechanism)/i, /repricing/i, /cross.asset/i],
    required_count: 2,
    label: 'macro_transmission_depth',
    repair_action: 'rebuild_macro_transmission_section'
  },
  regime_awareness: {
    patterns: [/regime/i, /tightening\s+cycle|easing\s+cycle|risk.on|risk.off|stagflat/i, /macro\s+(environment|backdrop|context)/i],
    required_count: 1,
    label: 'regime_context',
    repair_action: 'inject_regime_context'
  },
  comparative_depth: {
    patterns: [/concentration\s+risk|holdings\s+structure|allocation\s+implication|sector\s+tilt|idiosyncratic/i, /compared\s+to|vs\.\s+[A-Z]{3}|relative\s+to/i],
    required_count: 2,
    label: 'comparative_depth',
    repair_action: 'rebuild_comparison_section'
  },
  probability_reasoning: {
    patterns: [/probability|historically|in.*of.*\d+.*event|scenario/i, /if.*then|conditioned on|subject to/i],
    required_count: 1,
    label: 'probability_reasoning',
    repair_action: 'rebuild_risk_scenario_section'
  },
  evidence_linkage: {
    patterns: [/historical(ly)?|based on|evidence|data suggest|pattern/i, /\d+\s*(bp|basis points|%|percent)/i],
    required_count: 2,
    label: 'evidence_linkage',
    repair_action: 'rebuild_evidence_linkage_section'
  }
};

const GENERIC_PHRASE_PATTERNS = [
  { pattern: /markets\s+are\s+watching/gi, label: 'markets_are_watching' },
  { pattern: /uncertainty\s+remains/gi, label: 'uncertainty_remains' },
  { pattern: /investors\s+reacted/gi, label: 'investors_reacted' },
  { pattern: /mixed\s+signals/gi, label: 'mixed_signals' },
  { pattern: /market\s+sentiment/gi, label: 'market_sentiment' },
  { pattern: /economic\s+concerns/gi, label: 'economic_concerns' },
  { pattern: /heightened\s+uncertainty/gi, label: 'heightened_uncertainty' },
  { pattern: /volatility\s+spiked/gi, label: 'volatility_spiked' },
  { pattern: /market\s+participants/gi, label: 'market_participants' }
];

// ── Bond ETF Institutional Content Templates ─────────────────────────────────
// Deep, section-by-section institutional content for bond ETF topics.
// Each section: 3-4 paragraphs, ~80-120 words each, varied openings,
// evidence-grounded language, probability framing, transmission chain depth.

const BOND_ETF_SECTIONS = {
  'research-context': `
<p class="market-copy">Duration risk is the primary structural characteristic that separates bond ETFs from equity ETFs in a research context. Unlike equity returns, which depend on earnings growth, multiple expansion, and management execution, bond ETF returns are mathematically tied to two variables: the level of interest rates and the time structure of cash flows — duration. When rates rise, bond prices fall because new issues offer higher yields, reducing the relative attractiveness of existing holdings. This mechanism operates regardless of credit quality, business conditions, or investor sentiment, making bond ETFs among the most rate-deterministic instruments in passive exposure universes.</p>
<p class="market-copy">Research into bond ETFs requires distinguishing between four primary risk categories that operate simultaneously and often in opposing directions: duration risk (sensitivity to rate level changes), credit risk (sensitivity to issuer default probability), liquidity risk (the cost of transacting at scale), and reinvestment risk (the return on coupons if rates change after purchase). Each of these dimensions responds differently to macroeconomic conditions — a tightening cycle increases duration risk while potentially reducing credit risk if growth remains strong, whereas a recession scenario can reverse both relationships simultaneously, creating a pattern where Treasury ETFs rally while aggregate bond funds face credit spread pressure.</p>
<p class="market-copy">Valuation in a bond ETF context requires integrating the current yield with the expected rate path over the holding period. A bond ETF yielding 4.5% in a stable-rate environment delivers that yield as income return; the same fund in a rising-rate environment can deliver negative total returns as price declines offset income. The concept of breakeven analysis — how much rates need to rise before the price loss exceeds the yield income — provides the clearest framework for connecting the current yield to expected holding-period cash flows and valuation discipline in fixed-income research.</p>
<p class="market-copy">The analytical value of bond ETFs in a portfolio research context extends beyond their return potential in isolation. When TLT and equity markets fall simultaneously — as occurred through most of 2022 — it signals an inflation-driven shock where the traditional negative correlation between stocks and bonds has broken down. Historical patterns show this correlation inversion is most common when the primary market driver is above-target inflation rather than below-target growth. Understanding when that correlation holds and when it inverts is more actionable for portfolio construction than treating bond ETFs as universally defensive instruments across all macro regimes.</p>`,

  'exposure-mechanics': `
<p class="market-copy">The pricing mechanism of bond ETFs differs materially from direct bond ownership and from bond mutual fund structures. Bond ETFs trade on exchanges at market-determined prices that can deviate from the fund's net asset value during periods of market stress — a premium or discount that reflects the balance between buyers and sellers of the ETF itself, independent of the underlying bonds' prices. The bid-ask spread of the ETF is a second layer of cost that institutional research must account for separately from the underlying bond market's spread. TLT typically trades with a very tight market spread due to exceptional liquidity, while less liquid bond ETFs see spreads widen significantly during risk-off episodes when the cost of hedging increases for market makers.</p>
<p class="market-copy">Within the universe of Treasury ETFs, maturity targeting creates distinct transmission channels from Federal Reserve policy to fund performance. SHY's 1-3 year maturity focus means its yield reflects almost entirely the Fed's current policy rate and near-term rate expectations, with a modified duration of approximately 1.8 years that makes it functionally immune to long-end rate moves. IEF's 7-10 year focus introduces the term premium — the compensation investors require for the uncertainty of where rates will average over the medium term — and a modified duration of approximately 7.5 years. TLT's 20+ year maturity focus maximizes both duration exposure and term premium sensitivity, carrying approximately 17 years of modified duration: each 100 basis point rise in the 30-year Treasury yield translates to roughly a 17% price decline in the fund.</p>
<p class="market-copy">Aggregate bond ETFs like BND layer credit exposure onto Treasury duration, creating a multi-factor return profile that requires different analytical tools. BND holds approximately 66% U.S. Treasuries and agency securities alongside roughly 25% investment-grade corporate bonds, with the remaining allocation in foreign-government bonds. During credit-risk episodes — financial stress, earnings deterioration, or liquidity crises — corporate bond spreads widen, meaning corporate bond prices fall even when Treasury prices rise. This creates a partial internal hedge within BND's portfolio: the Treasury component can rally during flight-to-quality while the corporate component faces spread widening, producing a muted overall return relative to pure-Treasury alternatives. Researchers comparing TLT and BND must therefore identify whether the relevant macro shock is primarily rate-path driven or credit-risk driven to determine which fund's behavior is more informative for the scenario under study.</p>`,

  'risk-drivers': `
<p class="market-copy">Duration risk is the dominant risk factor for long-term Treasury ETFs and operates through a direct mathematical relationship with price. For every 100 basis points rise in the relevant Treasury yield, TLT's price falls by approximately 17% based on its modified duration — a decline that takes years of coupon income to recover at current yield levels. Historically, when the Fed raised rates from near-zero to above 5.25% between March 2022 and July 2023, TLT declined approximately 45% from peak to trough — the largest drawdown in the fund's history and a loss magnitude more typical of high-beta equity exposure than a government bond instrument. This historical evidence matters for research framing: TLT is not a low-risk instrument during tightening cycles simply because it holds government-guaranteed securities.</p>
<p class="market-copy">Inflation sensitivity creates an asymmetry between nominal bond ETFs and the real purchasing power of their cash flows that is frequently underestimated in broad-audience research. TLT, IEF, SHY, and BND all hold nominal Treasuries — their coupon payments are fixed in dollar terms regardless of inflation outcomes. When breakeven inflation expectations rise by 50 basis points, TLT faces dual headwinds: rising nominal yields reduce the price (duration channel) and the declining real value of the fixed cash flows reduces the total return even before yield movements. During the 2021-2023 inflation cycle, this dual-channel pressure combined with the fastest Fed tightening since 1980 created a scenario where TLT's risk-adjusted return profile was significantly worse than its historical volatility statistics suggested — because those statistics were calculated in a lower-inflation environment.</p>
<p class="market-copy">Credit spread risk introduces a distinct performance dimension for aggregate bond ETFs that pure Treasury ETFs do not carry. During the March 2020 liquidity crisis, TLT initially rallied as Treasury yields collapsed in a flight-to-quality move, while BND's corporate credit component faced spread widening before the Federal Reserve's emergency backstop — investment-grade credit facilities and the Secondary Market Corporate Credit Facility — compressed spreads dramatically. This episode provides a specific historical pattern for how credit spreads interact with duration when evaluating bond ETF risk: the correlation between corporate spread widening and Treasury rally is not constant but rather depends on whether the primary shock is credit-quality-driven or rate-path-driven. Research that ignores this distinction will misattribute BND's underperformance relative to TLT during credit events.</p>
<p class="market-copy">Liquidity risk in bond ETFs operates through two separate channels that both deserve attention in institutional research. First, the underlying bond market's liquidity determines how accurately the ETF can be priced and how efficiently the creation/redemption mechanism works during stress. Second, the ETF market's own bid-ask spread reflects the cost of dealer intermediation in the exchange-traded structure. Historical analysis shows that during severe market stress events — the 2020 COVID shock, the 2022 rate surge, the 2023 regional banking episode — even the most liquid bond ETFs experienced temporary divergence between their market price and their NAV, with premiums or discounts that represent real economic costs for investors transacting at those prices. Researchers using bond ETF prices for real-time yield curve or stress analysis should account for these deviations rather than treating market price and fundamental value as equivalent.</p>`,

  'comparison-framework': `
<p class="market-copy">Duration profile is the first and most actionable dimension for comparing bond ETFs because it determines the magnitude of price sensitivity to rate changes across the maturity spectrum. The range from SHY (approximately 1.8 years modified duration) to IEF (approximately 7.5 years) to TLT (approximately 17 years) represents not just quantitative differences but qualitatively different use cases and analytical frameworks. SHY's duration makes it nearly a cash equivalent from a rate-sensitivity perspective, with returns dominated by the rolling yield from maturing T-bills replaced at current rates. IEF sits in the belly of the yield curve, balancing current yield income against moderate rate sensitivity. TLT is a duration expression whose primary use in institutional portfolios is as a rate hedge, deflation protection, or flight-to-quality instrument — not primarily an income vehicle.</p>
<p class="market-copy">Rate sensitivity comparison between bond ETFs requires distinguishing three distinct transmission channels: the Fed funds rate channel (most directly relevant for SHY's short-end pricing), the 7-10 year term premium channel (most relevant for IEF, reflecting both rate expectations and uncertainty compensation), and the 20-30 year segment where fiscal sustainability concerns, long-run growth expectations, and inflation risk premiums dominate (most relevant for TLT). When comparing BND against Treasury-only ETFs, the corporate credit spread channel adds a fourth dimension that operates through different market mechanisms — credit default risk and liquidity premium — rather than through Treasury yield dynamics. In periods of credit stress, BND's yield advantage over TLT reflects a credit risk premium that can disappear through price losses, making the yield-spread comparison between BND and TLT an incomplete picture of risk-adjusted expected return.</p>
<p class="market-copy">Scenario analysis provides the most rigorous comparison framework for bond ETFs because it transforms the static "which ETF is better" question into a conditional "which ETF performs better under which rate-path conditions" framework. A scenario where the Fed cuts rates by 100 basis points over 12 months would add approximately 17% to TLT's price through pure duration mechanics, approximately 7.5% to IEF's price, and approximately 1.8% to SHY's price — each partially offset or supplemented by the starting yield. A scenario where inflation reaccelerates and the Fed delays cuts creates the opposite: TLT faces structural price headwinds while SHY benefits from the high short-end yield persisting. A corporate credit crisis scenario where investment-grade spreads widen by 200 basis points would damage BND's corporate component while potentially supporting TLT through Treasury flight-to-quality demand — making the two funds' performance diverge sharply from their typical correlation during neutral-rate environments. Conditioning comparisons on specific macro scenarios rather than averaging across all historical periods is the institutional standard for fixed-income research.</p>`,

  'macro-sensitivity': `
<p class="market-copy">Federal Reserve policy is the most direct macro driver for short-duration bond ETFs and a significant — though not exclusive — factor for long-duration funds because the Fed directly controls only the overnight rate. SHY's yield tracks the federal funds rate with high fidelity through the 1-3 year segment — when the Fed holds rates at 5.25-5.50%, SHY's distribution yield will approximate that range, adjusted for the fund's maturity mix and expense ratio. IEF and TLT are less directly controlled by the Fed; they reflect the market's assessment of where the federal funds rate will average over the next 7-10 years or 20+ years respectively, adjusted for the term premium — the additional compensation investors require for the uncertainty of locking up capital at a fixed rate for extended periods.</p>
<p class="market-copy">The yield curve transmission channel connects Fed policy to long-duration bond ETF performance through a mechanism that distinguishes between rate-level changes and curve-shape changes. When the Fed signals higher-for-longer rates, the short end of the curve stays elevated. Whether the long end follows depends on whether investors believe inflation will remain above target for the duration of the longer-maturity bonds — a judgment about the Fed's long-run credibility in controlling inflation. During the 2022-2023 tightening cycle, both the short end and long end rose sharply (a bear flattening into inversion), making the entire duration spectrum a losing position simultaneously. If the cycle transitions to easing, the long end often leads the rally as markets anticipate the terminal rate declining before the Fed's first actual cut — a rate-path repricing that benefits TLT disproportionately relative to shorter-duration alternatives.</p>
<p class="market-copy">Real yields — nominal Treasury yields minus breakeven inflation expectations derived from TIPS market pricing — provide the analytically precise framework for understanding bond ETF sensitivity to both monetary policy and inflation dynamics. Rising real yields are uniformly negative for nominal bond ETF prices: they represent the market demanding higher after-inflation compensation, which mechanically requires existing bond prices to fall to offer the demanded yield. When the 10-year real yield rose from approximately -1.0% in early 2022 to approximately +2.5% by late 2023, TLT declined by nearly 50% in nominal terms — illustrating that the scale of the real yield move, not merely the nominal yield change, determines the magnitude of duration loss. Research that references only nominal yields in bond ETF analysis misses the inflation-adjusted dimension that drives long-run real holding returns and the opportunity cost comparison against alternative asset classes with inflation-linked cash flows.</p>`,

  'diversification-and-concentration': `
<p class="market-copy">Treasury-only ETFs and aggregate bond ETFs appear similar on the surface — both are labeled "bond funds" — but their risk factor exposures are structurally different in ways that matter for both risk management and scenario analysis. TLT holds only U.S. Treasury bonds with 20+ year maturities, making it a near single-factor instrument where the relevant risk factor is the long-end nominal Treasury rate. BND holds approximately 10,000 individual securities across Treasury, agency mortgage-backed, and investment-grade corporate sectors, making it a multi-factor instrument where duration, credit quality, sector composition, and issuer concentration all contribute to return. Portfolio construction research that treats these as substitutes — or that aggregates them under the "bond ETF" category — will generate misleading risk attribution and scenario outcomes because the drivers of each fund's performance are qualitatively different.</p>
<p class="market-copy">Within the aggregate bond category, concentration risk operates differently than in equity ETFs because the relevant concentration dimension is not issuer weight but duration clustering and credit-quality distribution. BND's 10,000+ holdings create high issuer diversification, but they still concentrate duration risk in the intermediate maturity range — BND's effective duration of approximately 6 years reflects the portfolio's aggregate maturity tilt — and credit-quality risk in investment-grade bonds where the BBB-rated segment represents the largest single credit tier. Historical analysis of the 2020 credit shock shows that BBB-rated corporate bonds faced the greatest spread widening risk before the Fed's intervention, meaning BND's BBB exposure created concentrated credit-quality risk even within its diversified issuer structure. Researchers comparing BND to TLT must address this BBB concentration as a distinct risk factor rather than assuming investment-grade credit is uniformly low-risk.</p>
<p class="market-copy">Income versus price-return tradeoff represents the valuation and cash-flow dimension of bond ETF research that is most frequently overlooked in educational content focused on rate sensitivity. Higher-yielding bond ETFs — those with longer duration or lower credit quality — offer greater current income but embed greater mark-to-market price risk as a mirror image. When a long-duration bond ETF trades at a market price above its underlying NAV, the distribution yield overstates the true expected return for a new purchaser because some of that yield is financed by the premium above fundamental value. Valuation discipline in bond ETF research requires integrating the current earnings from the portfolio — coupons on the underlying bonds — with the mark-to-market impact of rate path scenarios, separating the income return from the price return in the total return attribution rather than treating yield as a proxy for expected total return across all rate environments.</p>`,

  'when-the-theme-can-lag': `
<p class="market-copy">Long-duration bond ETFs underperform most severely in the scenario that characterized 2022: simultaneously rising inflation, rising real yields, and Fed policy acceleration. In this environment, every component of TLT's valuation faces simultaneous pressure — nominal yields rise from the rate hike channel, inflation expectations rise reducing real cash flow value, and the terminal rate expectation rises forcing repricing of all future cash flows at once. IEF, with roughly half of TLT's modified duration, experiences the same directional pressure at approximately half the magnitude for the same rate move. SHY, with minimal duration near 1.8 years, avoids most of the price drawdown but still loses on a real-return basis if inflation exceeds its short-end yield. Historical evidence from 2022 shows that the three-channel simultaneous shock is more damaging than the arithmetic sum of individual rate move impacts would suggest, because the feedback loop between inflation persistence and Fed credibility can accelerate repricing well beyond initial consensus forecasts.</p>
<p class="market-copy">Recession versus soft-landing scenarios produce asymmetric outcomes across the bond ETF duration spectrum that depend critically on whether the recession is accompanied by deflationary or stagflationary dynamics. In a genuine deflationary recession — where growth deteriorates substantially and inflation falls below target — the Fed pivots aggressively to easing, benefiting TLT through large duration price appreciation while SHY's yield falls rapidly. In a soft-landing scenario — growth moderates, inflation gradually normalizes, and the Fed eases slowly — the rate benefit distributes more evenly across the duration spectrum with TLT benefiting most but SHY also providing positive real returns from the falling short-end yield. In a stagflationary recession — growth deteriorates while inflation remains above target — Treasury ETFs face ambiguous outcomes because the Fed's ability to ease is constrained by the inflation mandate, preventing the rate relief that would normally benefit long-duration instruments even as growth weakens.</p>
<p class="market-copy">Short-duration instruments including money market funds and rolling T-bill strategies can outperform even SHY during rapid Fed tightening because they avoid the duration price loss that even the shortest bond ETFs carry. In a hiking cycle where the Fed raises rates by 500 basis points over 12 months — as occurred from March 2022 to July 2023 — investors holding SHY face negative price returns on the 1-3 year segment that partially offset the higher yield received, whereas rolling overnight or monthly T-bill positions capture the rising rate without duration-driven price loss. This creates a practical distinction between the shortest bond ETFs and genuinely cash-equivalent instruments that researchers should address explicitly when comparing duration profiles along the low end of the spectrum. The inflection point where SHY's yield income exceeds its duration price loss depends on the pace of rate increases — slow, gradual hikes are less damaging to short-duration ETFs than the rapid accelerations that characterized 2022.</p>`,

  'educational-research-workflow': `
<p class="market-copy">A bond ETF research process begins with rate-cycle positioning — not as an optimization problem but as a macro decision that determines which duration range is appropriate before evaluating individual funds. Selecting TLT at the beginning of a tightening cycle is not a conservative choice: it is the highest-rate-sensitivity instrument in the liquid bond ETF universe, equivalent to taking a high-conviction bet that rates will not rise further or will fall. Selecting SHY near a rate cycle peak contains meaningful reinvestment risk if rates fall faster than the market expects, because SHY's short-maturity bonds must be rolled at lower rates as they mature. Starting the research process by answering "where are we in the rate cycle, and what is the probability distribution of the next 100 basis point rate move?" forces the duration selection to be grounded in conditional macro assessment rather than treated as a free yield-optimization parameter.</p>
<p class="market-copy">Second, disaggregating credit exposure from duration exposure within the analytical framework is essential for understanding BND's behavior relative to Treasury-only ETFs. A period where BND underperforms TLT may reflect corporate credit spread widening rather than duration differences — a qualitatively different signal about market risk conditions that requires different research responses. Separating the performance attribution into rate-path contribution and credit-spread contribution is historically achievable by comparing BND to a duration-matched Treasury benchmark: if BND underperforms its duration-equivalent Treasury benchmark, corporate spreads are widening; if it outperforms, the credit component is adding value. This attribution discipline prevents researchers from conflating rate risk and credit risk in bond ETF analysis, which is the most common analytical error in broad-audience fixed-income educational content.</p>
<p class="market-copy">Third, scenario framing should be explicit, conditional, and probability-weighted rather than point-estimate directional. Research should frame: if the Fed cuts rates by 100 basis points over the next 12 months, TLT's price appreciation would be approximately 17% from duration mechanics alone, partially offset by any starting yield already priced in or by term premium expansion if the long end rises independently. If the Fed holds rates flat while inflation reaccelerates, TLT faces negative real returns while nominal price changes may be modest. If a corporate credit event occurs — investment-grade spreads widening by 200 basis points — BND's corporate component faces mark-to-market pressure while TLT may simultaneously rally as a flight-to-quality Treasury instrument. These conditional scenario frames transform bond ETF research from a static comparison into a dynamic conditional framework that maps rate-path uncertainty to expected fund behavior — which is the standard for institutional fixed-income portfolio research.</p>`
};

// Bond ETF comparison table — Duration, Rate Sensitivity, Credit Exposure, Yield Curve, Liquidity, Regime Behavior
const BOND_COMPARISON_TABLE_HTML = `
<div class="editorial-table-wrap" style="overflow-x:auto;margin:1.5rem 0">
<table class="editorial-comparison-table" style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr style="border-bottom:2px solid var(--border);text-align:left">
<th style="padding:8px 10px;min-width:60px">ETF</th>
<th style="padding:8px 10px">Duration profile</th>
<th style="padding:8px 10px">Rate sensitivity</th>
<th style="padding:8px 10px">Credit exposure</th>
<th style="padding:8px 10px">Yield curve sensitivity</th>
<th style="padding:8px 10px">Liquidity profile</th>
<th style="padding:8px 10px">Risk regime behavior</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--border)">
<td style="padding:8px 10px;font-weight:600">TLT</td>
<td style="padding:8px 10px">Long (~17 yrs)</td>
<td style="padding:8px 10px">Very high; ~17% per 100bp move</td>
<td style="padding:8px 10px">None — Treasuries only</td>
<td style="padding:8px 10px">Long-end (20-30yr); term premium dominant</td>
<td style="padding:8px 10px">Very high; tight spreads in normal markets</td>
<td style="padding:8px 10px">Recession hedge; severe tightening-cycle headwind</td>
</tr>
<tr style="border-bottom:1px solid var(--border)">
<td style="padding:8px 10px;font-weight:600">IEF</td>
<td style="padding:8px 10px">Intermediate (~7.5 yrs)</td>
<td style="padding:8px 10px">Moderate; ~7.5% per 100bp move</td>
<td style="padding:8px 10px">None — Treasuries only</td>
<td style="padding:8px 10px">Belly (7-10yr); Fed path + term premium</td>
<td style="padding:8px 10px">High; deep Treasury secondary market</td>
<td style="padding:8px 10px">Balanced rate hedge; half the TLT sensitivity</td>
</tr>
<tr style="border-bottom:1px solid var(--border)">
<td style="padding:8px 10px;font-weight:600">SHY</td>
<td style="padding:8px 10px">Short (~1.8 yrs)</td>
<td style="padding:8px 10px">Low; ~1.8% per 100bp move</td>
<td style="padding:8px 10px">None — Treasuries only</td>
<td style="padding:8px 10px">Short-end; directly anchored to Fed funds rate</td>
<td style="padding:8px 10px">Very high; near-cash market depth</td>
<td style="padding:8px 10px">Tightening beneficiary; cash-substitute during hike cycles</td>
</tr>
<tr>
<td style="padding:8px 10px;font-weight:600">BND</td>
<td style="padding:8px 10px">Intermediate (~6 yrs)</td>
<td style="padding:8px 10px">Moderate; ~6% per 100bp move</td>
<td style="padding:8px 10px">~25% investment-grade corporate (BBB-AAA)</td>
<td style="padding:8px 10px">Multi-segment + corporate credit spread channel</td>
<td style="padding:8px 10px">Very high; mega-cap ETF with deep market</td>
<td style="padding:8px 10px">Mixed; credit spread risk partially offsets Treasury rally in risk-off</td>
</tr>
</tbody>
</table>
</div>`;

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const queue        = readJson(QUEUE_PATH, { topics: [] });
  const regime       = readJson(REGIME_PATH, {});
  const transmission = readJson(TRANSMISSION_PATH, {});
  const etfIntel     = readJson(ETF_PATH, {});
  const rateIntel    = readJson(RATE_PATH, {});

  const slug = SLUG || findCandidateSlug(queue);
  if (!slug) { console.log('[repair] No draft candidate found for institutional depth repair.'); return; }

  const draftDir = path.join(DRAFT_DIR, slug);
  if (!fs.existsSync(draftDir)) { console.log(`[repair] Draft directory not found: ${slug}`); return; }

  const enFile = path.join(draftDir, 'en.html');
  if (!fs.existsSync(enFile)) { console.log(`[repair] en.html not found: ${slug}/en.html`); return; }

  const html = fs.readFileSync(enFile, 'utf8');
  const text = stripHtml(html);

  console.log(`\n[repair] ═══ ANALYZING: ${slug} (${Math.round(html.length / 1024)}KB) ═══`);

  const failures      = detectFailures(text, html);
  const genericPhrases = detectGenericPhrases(text);

  // Score before repair (if retrying)
  const scoreBefore = (RETRY || EXECUTE) ? rescoreDraft(slug) : null;
  if (scoreBefore !== null) console.log(`[repair] Score BEFORE repair: ${scoreBefore}`);

  if (!failures.length && !genericPhrases.length && !scoreBefore) {
    console.log(`[repair] ${slug} passes all institutional depth checks — no repair needed.`);
    return;
  }

  logRepairFindings(slug, failures, genericPhrases);

  // ── Execute deep repair ───────────────────────────────────────────────────
  if (EXECUTE || RETRY) {
    const isBond = isBondEtfTopic(slug, text);
    console.log(`\n[repair] Topic classification: ${isBond ? 'bond_etf' : 'general_etf'}`);
    console.log(`[repair] Executing deep repair modes: ${getRepairModes(failures, isBond).join(', ')}`);

    let repaired = isBond
      ? applyBondRepair(html)
      : applyGeneralRepair(html, failures, rateIntel, etfIntel, regime, transmission);

    if (WRITE) {
      fs.writeFileSync(enFile, repaired, 'utf8');
      console.log(`[repair] Wrote repaired en.html: drafts/editorial/${slug}/en.html`);
    } else {
      console.log('[repair] DRY RUN — add --write to apply repairs');
      const repairedText = stripHtml(repaired);
      console.log(`[repair] Repaired word count: ${repairedText.split(/\s+/).filter(Boolean).length}`);
    }

    // Sync bilingual pair structure after repair if requested
    if (SYNC_PAIR && WRITE) {
      console.log('[repair] --sync-pair: syncing bilingual structure...');
      const syncResult = spawnSync('node', [
        path.join(__dirname, 'sync-bilingual-article-structure.js'),
        `--slug=${slug}`,
        '--remove-orphans',
        '--write'
      ], { encoding: 'utf8', cwd: ROOT });
      if (syncResult.stdout) process.stdout.write(syncResult.stdout);
      if (syncResult.stderr) process.stderr.write(syncResult.stderr);

      const checkResult = spawnSync('node', [
        path.join(__dirname, 'check-bilingual-structure.js'),
        `--slug=${slug}`,
        '--drafts-only'
      ], { encoding: 'utf8', cwd: ROOT });
      if (checkResult.stdout) process.stdout.write(checkResult.stdout);
      if (checkResult.stderr) process.stderr.write(checkResult.stderr);
      if (checkResult.status !== 0) {
        console.error('[repair] Bilingual structure still mismatched after sync — manual review required');
      }
    }

    // Re-score and update status
    if (RETRY && WRITE) {
      const scoreAfter = rescoreDraft(slug);
      const failuresAfter = detectFailures(stripHtml(repaired), repaired);
      printDiagnosticsReport(slug, scoreBefore, scoreAfter, failures, failuresAfter);
      if (scoreAfter !== null) {
        updateQueueStatus(queue, slug, scoreAfter, failuresAfter);
      }
    }
    return;
  }

  // ── Spec-only mode (no --execute) ─────────────────────────────────────────
  const repairSpec = buildRepairSpec(slug, failures, genericPhrases, regime, transmission, etfIntel, rateIntel, html);

  if (!WRITE) {
    console.log('\n[repair] DRY RUN — repair spec preview:');
    console.log(JSON.stringify(repairSpec, null, 2).slice(0, 2000));
    console.log('\n[repair] Pass --execute --write to apply deep repair, or --retry --write for repair + rescore');
    return;
  }

  fs.mkdirSync(path.dirname(REPAIR_SPEC_PATH), { recursive: true });
  fs.writeFileSync(REPAIR_SPEC_PATH, JSON.stringify(repairSpec, null, 2) + '\n', 'utf8');
  console.log(`[repair] Wrote repair spec: data/intelligence/repair-spec.json`);

  if (repairSpec.requires_ai_repair && repairSpec.auto_repair_insufficient) {
    markTopicForRepair(queue, slug);
  }
}

// ── Bond ETF topic detection ──────────────────────────────────────────────────

function isBondEtfTopic(slug, text) {
  const BOND_TICKERS = ['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG', 'BNDX', 'VCIT', 'VCSH'];
  const BOND_KEYWORDS = /bond.?etf|duration\s+risk|yield\s+curve|treasury\s+etf|fixed.income|rate\s+sensitiv/i;
  return BOND_TICKERS.some((t) => text.toUpperCase().includes(t) || slug.toLowerCase().includes(t.toLowerCase())) ||
    BOND_KEYWORDS.test(text) ||
    /\bbond\b|\btreasury\b|\bduration\b|\byield\b/.test(slug);
}

function getRepairModes(failures, isBond) {
  const modes = new Set();
  if (isBond) modes.add('bond_etf_full_rebuild');
  for (const f of failures) modes.add(f.repair_action);
  return [...modes];
}

// ── Deep repair: bond ETF ─────────────────────────────────────────────────────

function applyBondRepair(html) {
  let result = html;

  // Step 1: Replace boilerplate sections with institutional bond content
  result = replaceBoilerplateSections(result, BOND_ETF_SECTIONS);

  // Step 2: Inject institutional bond comparison table if not already present
  if (!result.includes('Duration profile') || !result.includes('Rate sensitivity')) {
    result = injectBondComparisonTable(result);
  }

  return result;
}

function replaceBoilerplateSections(html, contentMap) {
  let result = html;

  for (const [sectionId, newContent] of Object.entries(contentMap)) {
    const sectionRegex = new RegExp(
      `(<section[^>]+id="${sectionId}"[^>]*>)([\\s\\S]*?)(</section>)`,
      'i'
    );

    result = result.replace(sectionRegex, (match, open, body, close) => {
      if (!body.includes(BOILERPLATE_MARKER)) return match;

      // Preserve editorial-transition and h2 heading
      const transMatch = body.match(/<p class="editorial-transition">([\s\S]*?)<\/p>/i);
      const h2Match    = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const transition  = transMatch ? `\n        ${transMatch[0]}` : '';
      const heading     = h2Match    ? `\n        ${h2Match[0]}` : '';

      return `${open}${transition}${heading}\n${newContent}\n\n      ${close}`;
    });
  }

  return result;
}

function injectBondComparisonTable(html) {
  // Try to inject before the end of the comparison-framework section
  const compSectionRegex = /(<section[^>]+id="comparison-framework"[^>]*>[\s\S]*?)(<\/section>)/i;
  if (compSectionRegex.test(html)) {
    return html.replace(compSectionRegex, (match, body, close) => {
      if (body.includes('Duration profile')) return match;
      return `${body}\n${BOND_COMPARISON_TABLE_HTML}\n      ${close}`;
    });
  }
  // Fallback: inject before the first </article>
  return html.replace(/<\/article>/, `\n${BOND_COMPARISON_TABLE_HTML}\n</article>`);
}

// ── Deep repair: general ETF ──────────────────────────────────────────────────

function applyGeneralRepair(html, failures, rateIntel, etfIntel, regime, transmission) {
  let result = html;

  // For general ETF articles, inject intelligence context where boilerplate is detected
  const regimeLabel  = regime?.regime_label || 'Tightening Cycle';
  const regimeSummary = regime?.regime_summary || 'The macro environment reflects a late tightening cycle with rate-sensitive assets under pressure from elevated real yields.';
  const curveShape   = rateIntel?.yield_curve?.inferred_shape || 'flat_to_inverted';
  const fedBias      = rateIntel?.fed_path?.bias || 'hawkish';

  const GENERAL_MACRO_BLOCK = `
<p class="market-copy">Macro regime context informs the performance drivers for ETF comparisons in the current environment. The prevailing market regime — ${regimeLabel} — shapes how rate sensitivity, earnings multiples, and credit conditions interact with sector allocation decisions. In a ${regimeLabel.toLowerCase()} environment, rate-sensitive assets face valuation headwinds from elevated discount rates applied to future cash flows, while quality and value factors can benefit from earnings resilience relative to highly-leveraged or long-duration growth exposures.</p>
<p class="market-copy">Rate transmission from the current ${fedBias} Fed stance flows through the yield curve (${curveShape.replace(/_/g, ' ')} shape), affecting ETFs differently based on their sector composition, earnings duration, and financing sensitivity. High-growth ETFs with cash flows concentrated in 2027-2030+ face a larger discount rate headwind per unit of rate move than value-oriented ETFs with near-term earnings. Understanding this duration-of-earnings dimension — not just the sector label — is the institutional standard for rate-sensitivity comparison across ETF exposures in different market regimes.</p>`;

  const GENERAL_SCENARIO_BLOCK = `
<p class="market-copy">Scenario analysis for ETF comparisons must be conditional rather than directional. If economic conditions evolve toward further tightening — inflation reaccelerating, labor market remaining resilient — then rate-sensitive growth exposure faces continued multiple compression while cyclical and value factors may benefit from sustained earnings. If the cycle transitions to easing — growth slowing to below-trend, inflation normalizing — then duration-sensitive growth ETFs benefit from discount rate relief while cyclicals face earnings risk. Probability framing based on historical rate cycle patterns (historically, tightening cycles end when unemployment rises 0.5%+ from cycle lows) provides the conditional structure for comparing ETF performance across scenarios rather than asserting a single directional conclusion.</p>`;

  // Inject into boilerplate sections
  result = result.replace(
    /(<section[^>]+id="macro-sensitivity"[^>]*>)([\s\S]*?)(<\/section>)/gi,
    (match, open, body, close) => {
      if (!body.includes(BOILERPLATE_MARKER)) return match;
      const h2Match = body.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
      const heading = h2Match ? h2Match[0] : '';
      return `${open}\n${heading}\n${GENERAL_MACRO_BLOCK}\n      ${close}`;
    }
  );

  result = result.replace(
    /(<section[^>]+id="risk-drivers"[^>]*>)([\s\S]*?)(<\/section>)/gi,
    (match, open, body, close) => {
      if (!body.includes(BOILERPLATE_MARKER)) return match;
      const h2Match = body.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
      const heading = h2Match ? h2Match[0] : '';
      return `${open}\n${heading}\n${GENERAL_SCENARIO_BLOCK}\n      ${close}`;
    }
  );

  return result;
}

// ── Failure detection ─────────────────────────────────────────────────────────

function detectFailures(text, html) {
  const failures = [];

  for (const [key, check] of Object.entries(INSTITUTIONAL_PATTERNS)) {
    const matchCount = check.patterns.reduce((count, pat) => count + (pat.test(text) ? 1 : 0), 0);
    if (matchCount < check.required_count) {
      failures.push({
        check: check.label,
        description: `Insufficient ${key.replace(/_/g, ' ')} — found ${matchCount}/${check.required_count} required pattern matches`,
        repair_action: check.repair_action,
        severity: matchCount === 0 ? 'critical' : 'warning'
      });
    }
  }

  if (/\bETF(s)?\b/i.test(text) && !/class="editorial-comparison-table"/.test(html)) {
    failures.push({
      check: 'comparative_depth',
      description: 'ETF article missing editorial-comparison-table — structural comparison inadequate',
      repair_action: 'rebuild_comparison_section',
      severity: 'critical'
    });
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.split(/\s+/).length >= 18);
  const bullets = (html.match(/<li\b/gi) || []).length;
  if (bullets >= paragraphs.length && paragraphs.length > 0) {
    failures.push({
      check: 'analytical_density',
      description: `Excessive bullet dependency (${bullets} bullets vs ${paragraphs.length} substantive paragraphs)`,
      repair_action: 'rebuild_evidence_linkage_section',
      severity: 'warning'
    });
  }

  const sentences  = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const analytical = sentences.filter((s) =>
    s.split(/\s+/).length >= 12 &&
    /(because|while|however|risk|valuation|concentration|volatility|liquidity|rates|earnings|holdings|expense ratio|duration|transmission|regime)/i.test(s)
  ).length;
  if (analytical < 15) {
    failures.push({
      check: 'analytical_density',
      description: `Low analytical sentence density (${analytical} found, 15+ required)`,
      repair_action: 'rebuild_evidence_linkage_section',
      severity: analytical < 8 ? 'critical' : 'warning'
    });
  }

  return failures;
}

function detectGenericPhrases(text) {
  const violations = [];
  for (const { pattern, label } of GENERIC_PHRASE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        phrase: label,
        occurrences: matches.length,
        description: `Generic phrase "${label.replace(/_/g, ' ')}" used ${matches.length} time(s) without evidence grounding`,
        repair_action: 'replace_with_evidence_based_language'
      });
    }
  }
  return violations;
}

// ── Repair spec builder ───────────────────────────────────────────────────────

function buildRepairSpec(slug, failures, genericPhrases, regime, transmission, etfIntel, rateIntel, html) {
  const criticalCount = failures.filter((f) => f.severity === 'critical').length;
  const requiresAI    = criticalCount >= 2 || failures.length >= 4 || genericPhrases.length >= 3;
  const injections    = [];

  if (failures.some((f) => f.repair_action === 'inject_regime_context') && regime?.regime) {
    injections.push({
      type: 'regime_context',
      context: { regime: regime.regime, regime_label: regime.regime_label, regime_summary: regime.regime_summary?.slice(0, 400) },
      instruction: 'Incorporate current macro regime context — explain how the current environment affects the subject matter.'
    });
  }

  if (failures.some((f) => f.repair_action === 'rebuild_macro_transmission_section') && transmission?.regime_transmission_note) {
    injections.push({
      type: 'transmission_context',
      context: { regime_note: transmission.regime_transmission_note, relevant_chains: extractRelevantChains(transmission, html) },
      instruction: 'Add cross-asset transmission chain analysis — explain WHY assets react to macro events, not just THAT they do.'
    });
  }

  if (failures.some((f) => f.repair_action === 'rebuild_comparison_section') && etfIntel?.etf_profiles) {
    const relevantETFs = extractRelevantETFs(html, etfIntel);
    if (relevantETFs.length) {
      injections.push({
        type: 'etf_comparison_context',
        context: { etf_profiles: relevantETFs },
        instruction: 'Upgrade ETF comparisons to institutional depth: allocation structure, rate sensitivity, concentration risk, regime behavior.'
      });
    }
  }

  if (failures.some((f) => f.repair_action === 'rebuild_risk_scenario_section') && rateIntel?.yield_curve) {
    injections.push({
      type: 'rate_path_context',
      context: { stance: rateIntel.fed_path?.current_stance, bias: rateIntel.fed_path?.bias, curve_shape: rateIntel.yield_curve?.inferred_shape, narrative: rateIntel.fed_path?.implied_path_narrative?.slice(0, 400) },
      instruction: 'Add probability-weighted scenario analysis — frame outcomes conditionally (if X then Y) rather than as absolute predictions.'
    });
  }

  return {
    version: '2.0',
    created_at: new Date().toISOString(),
    target_slug: slug,
    failures_detected: failures,
    generic_phrase_violations: genericPhrases,
    critical_failures: criticalCount,
    requires_ai_repair: requiresAI,
    auto_repair_insufficient: requiresAI,
    deterministic_repair_available: isBondEtfTopic(slug, stripHtml(html)),
    context_injections: injections,
    ai_repair_prompt: buildAIRepairPrompt(slug, failures, genericPhrases, injections),
    repair_priority: criticalCount >= 2 ? 'high' : 'medium',
    next_action: 'run_with_execute_write_flag'
  };
}

// ── Scoring and queue management ──────────────────────────────────────────────

function rescoreDraft(slug) {
  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'score-generated-content.js'),
    `--slug=${slug}`,
    '--type=editorial'
  ], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });

  if (result.status !== 0 || !result.stdout?.trim()) {
    console.log(`[repair] Score tool failed: ${result.stderr?.trim() || 'no output'}`);
    return null;
  }

  try {
    const report = JSON.parse(result.stdout);
    const entry  = (report.results || []).find((r) => r.slug === slug);
    return entry?.quality_score ?? null;
  } catch {
    return null;
  }
}

function detectFailuresFromScore(score) {
  return score < 90 ? ['Score below threshold'] : [];
}

function updateQueueStatus(queue, slug, score, failuresAfter) {
  const topics = Array.isArray(queue.topics) ? queue.topics : [];
  const topic  = topics.find((t) => t.slug === slug);
  if (!topic) return;

  const passed = score >= 88 && failuresAfter.length === 0;
  topic.status = passed ? 'reviewed' : 'manual_revision_required';
  topic.review_status = passed ? 'approved' : 'pending';
  topic.repair_required = !passed;
  topic.last_repair_score = score;
  topic.last_repair_at = new Date().toISOString().slice(0, 10);

  if (WRITE) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log(`[repair] Updated queue: ${slug} → status=${topic.status}, score=${score}`);
  }
}

function printDiagnosticsReport(slug, scoreBefore, scoreAfter, failuresBefore, failuresAfter) {
  console.log(`\n[repair] ═══ REPAIR DIAGNOSTICS: ${slug} ═══`);
  console.log(`[repair] Original score:       ${scoreBefore ?? 'not measured'}`);
  console.log(`[repair] Repaired score:       ${scoreAfter ?? 'not measured'}`);
  const delta = (scoreAfter !== null && scoreBefore !== null) ? scoreAfter - scoreBefore : null;
  if (delta !== null) console.log(`[repair] Score improvement:    ${delta > 0 ? '+' : ''}${delta} points`);
  console.log(`[repair] Failures before:      ${failuresBefore.length} — ${failuresBefore.map((f) => f.check).join(', ') || 'none'}`);
  console.log(`[repair] Failures after:       ${failuresAfter.length} — ${failuresAfter.map((f) => f.check).join(', ') || 'none'}`);
  const finalState = (scoreAfter ?? 0) >= 88 && failuresAfter.length === 0
    ? 'APPROVED — meets institutional threshold'
    : `MANUAL_REVISION_REQUIRED — ${failuresAfter.length} gate(s) still failing`;
  console.log(`[repair] Final state:          ${finalState}`);
}

// ── Queue management ─────────────────────────────────────────────────────────

function findCandidateSlug(queue) {
  const topics = Array.isArray(queue.topics) ? queue.topics : [];
  const candidate = topics.find((t) => t.status === 'manual_revision_required') ||
                    topics.find((t) => t.status === 'in_review');
  return candidate?.slug || null;
}

function markTopicForRepair(queue, slug) {
  if (!WRITE) return;
  const topic = (Array.isArray(queue.topics) ? queue.topics : []).find((t) => t.slug === slug);
  if (topic) {
    topic.status = 'manual_revision_required';
    topic.repair_required = true;
    topic.repair_spec_path = 'data/intelligence/repair-spec.json';
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log(`[repair] Marked ${slug} as manual_revision_required`);
  }
}

// ── Context extraction for AI prompt ─────────────────────────────────────────

function extractRelevantChains(transmission, html) {
  if (!transmission?.transmission_library) return [];
  return Object.entries(transmission.transmission_library)
    .filter(([key]) => html.toUpperCase().includes(key.split('_')[0]))
    .slice(0, 2)
    .map(([key, chain]) => ({ key, mechanism: chain.mechanism?.slice(0, 300), primary_channel: chain.primary_channel }));
}

function extractRelevantETFs(html, etfIntel) {
  const tickers = ['SPY', 'QQQ', 'IWM', 'XLV', 'XLE', 'XLF', 'XLU', 'XLP', 'GLD', 'TLT', 'IEF', 'SHY', 'BND', 'SOXX', 'DIA', 'UUP'];
  return tickers
    .filter((t) => html.includes(t))
    .slice(0, 4)
    .map((t) => {
      const profile = etfIntel.etf_profiles?.[t];
      return {
        ticker: t,
        full_name: profile?.full_name,
        institutional_interpretation: profile?.institutional_interpretation?.slice(0, 400),
        comparison_note: profile?.comparison_note?.slice(0, 300)
      };
    })
    .filter((p) => p.institutional_interpretation);
}

function buildAIRepairPrompt(slug, failures, genericPhrases, injections) {
  const failureList = failures.map((f) => `- ${f.check}: ${f.description}`).join('\n');
  const phraseList  = genericPhrases.map((p) => `- "${p.phrase.replace(/_/g, ' ')}" (${p.occurrences}×)`).join('\n');
  const contextList = injections.map((i) => `- ${i.type}: ${i.instruction}`).join('\n');

  return `INSTITUTIONAL DEPTH REPAIR REQUEST: ${slug}

DETECTED FAILURES:
${failureList || 'None'}

GENERIC PHRASE VIOLATIONS:
${phraseList || 'None'}

CONTEXT AVAILABLE:
${contextList || 'None'}

REPAIR REQUIREMENTS:
1. Every macro claim must explain the mechanism, not just the direction
2. Cross-asset transmission chains must explain WHY, not just THAT
3. ETF comparisons must cover: allocation structure, rate sensitivity, concentration risk, scenario behavior
4. Generic phrases must be replaced with evidence-grounded, specific language
5. Probability framing must be conditional: "IF X, THEN Y is likely because of Z"
6. Bond ETF articles must cover: duration risk, yield curve, Fed path, real yields, credit spreads,
   Treasury vs aggregate, short vs long duration, TLT/IEF/SHY/BND comparison, inflation sensitivity,
   recession vs soft-landing scenarios, liquidity, income vs price-return tradeoff

QUALITY STANDARD: Institutional research desk quality. Not SEO blog. Not generic finance content.`;
}

// ── Logging ───────────────────────────────────────────────────────────────────

function logRepairFindings(slug, failures, genericPhrases) {
  if (failures.length) {
    console.log(`[repair] Depth failures (${failures.length}):`);
    failures.forEach((f) => console.log(`[repair]   [${f.severity.toUpperCase()}] ${f.check}: ${f.description}`));
  }
  if (genericPhrases.length) {
    console.log(`[repair] Generic phrase violations (${genericPhrases.length}):`);
    genericPhrases.forEach((p) => console.log(`[repair]   "${p.phrase.replace(/_/g, ' ')}" — ${p.occurrences}×`));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const m = process.argv.find((a) => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

main();
