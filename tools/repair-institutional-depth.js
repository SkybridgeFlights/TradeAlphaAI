'use strict';

// Phase 62: Autonomous Repair of Weak Institutional Drafts
// Reads a failing draft, identifies specific institutional depth failures,
// applies automated repairs where possible (injecting context from intelligence data),
// and creates a targeted repair spec for AI-driven section regeneration.
//
// Deficiencies detected and automatically repaired:
//   - Missing transmission chain references → inject from cross-asset-transmission.json
//   - Missing regime context → inject from market-regime.json
//   - Missing comparative ETF table → flag for editorial-layout-renderer.js
//   - Weak macro section → inject rate-path context
//   - Shallow coverage → create repair spec for brain regeneration
//
// Usage:
//   node tools/repair-institutional-depth.js [--slug=<slug>]  → specific draft
//   node tools/repair-institutional-depth.js --write           → write repair spec

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '..');
const QUEUE_PATH     = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_DIR      = path.join(ROOT, 'drafts', 'editorial');
const REGIME_PATH    = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const ETF_PATH       = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const RATE_PATH      = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const REPAIR_SPEC_PATH = path.join(ROOT, 'data', 'intelligence', 'repair-spec.json');

const WRITE = process.argv.includes('--write');
const SLUG  = argValue('--slug') || null;

// ── Institutional depth check patterns (mirrors check-editorial-quality.js V2) ──

const INSTITUTIONAL_PATTERNS = {
  transmission_chain: {
    patterns: [/transmission/i, /rate\s+channel/i, /policy\s+(channel|pathway|mechanism)/i, /repricing/i, /cross.asset/i],
    required_count: 2,
    label: 'macro_transmission_depth',
    repair_action: 'inject_transmission_context'
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
    repair_action: 'inject_etf_context'
  },
  probability_reasoning: {
    patterns: [/probability|historically|in.*of.*\d+.*event|scenario/i, /if.*then|conditioned on|subject to/i],
    required_count: 1,
    label: 'probability_reasoning',
    repair_action: 'inject_scenario_framing'
  },
  evidence_linkage: {
    patterns: [/historical(ly)?|based on|evidence|data suggest|pattern/i, /\d+\s*(bp|basis points|%|percent)/i],
    required_count: 2,
    label: 'evidence_linkage',
    repair_action: 'strengthen_evidence_anchoring'
  }
};

// Generic phrases that must not appear without evidence support
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

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const queue  = readJson(QUEUE_PATH, { topics: [] });
  const regime = readJson(REGIME_PATH, {});
  const transmission = readJson(TRANSMISSION_PATH, {});
  const etfIntel = readJson(ETF_PATH, {});
  const rateIntel = readJson(RATE_PATH, {});

  // Find target draft
  const slug = SLUG || findCandidateSlug(queue);
  if (!slug) {
    console.log('[repair] No draft candidate found for institutional depth repair.');
    return;
  }

  const draftDir = path.join(DRAFT_DIR, slug);
  if (!fs.existsSync(draftDir)) {
    console.log(`[repair] Draft directory not found: ${slug}`);
    return;
  }

  const enFile = path.join(draftDir, 'en.html');
  if (!fs.existsSync(enFile)) {
    console.log(`[repair] EN draft not found: ${slug}/en.html`);
    return;
  }

  const html = fs.readFileSync(enFile, 'utf8');
  const text = stripHtml(html);

  console.log(`[repair] Analyzing draft: ${slug} (${html.length} chars)`);

  // Run institutional depth checks
  const failures = detectFailures(text, html);
  const genericPhrases = detectGenericPhrases(text);

  console.log(`[repair] Depth failures: ${failures.length}`);
  console.log(`[repair] Generic phrase violations: ${genericPhrases.length}`);

  if (!failures.length && !genericPhrases.length) {
    console.log(`[repair] ${slug} passes institutional depth checks — no repair needed.`);
    return;
  }

  // Build repair spec
  const repairSpec = buildRepairSpec(slug, failures, genericPhrases, regime, transmission, etfIntel, rateIntel, html);

  // Log findings
  logRepairFindings(slug, failures, genericPhrases, repairSpec);

  if (!WRITE) {
    console.log('[repair] DRY RUN — repair spec preview:');
    console.log(JSON.stringify(repairSpec, null, 2).slice(0, 2000));
    return;
  }

  fs.mkdirSync(path.dirname(REPAIR_SPEC_PATH), { recursive: true });
  fs.writeFileSync(REPAIR_SPEC_PATH, JSON.stringify(repairSpec, null, 2) + '\n', 'utf8');
  console.log(`[repair] Wrote repair spec: data/intelligence/repair-spec.json`);

  // Update topic queue status if repair spec created
  if (repairSpec.requires_ai_repair && repairSpec.auto_repair_insufficient) {
    markTopicForRepair(queue, slug);
  }
}

// ── Failure detection ─────────────────────────────────────────────────────────

function detectFailures(text, html) {
  const failures = [];

  for (const [key, check] of Object.entries(INSTITUTIONAL_PATTERNS)) {
    const matchCount = check.patterns.reduce((count, pat) => {
      return count + (pat.test(text) ? 1 : 0);
    }, 0);

    if (matchCount < check.required_count) {
      failures.push({
        check: check.label,
        description: `Insufficient ${key.replace(/_/g, ' ')} — found ${matchCount}/${check.required_count} required pattern matches`,
        repair_action: check.repair_action,
        severity: matchCount === 0 ? 'critical' : 'warning'
      });
    }
  }

  // Additional structural checks
  if (/\bETF(s)?\b/i.test(text) && !/class="editorial-comparison-table"/.test(html)) {
    failures.push({
      check: 'comparative_depth',
      description: 'ETF topic article missing editorial-comparison-table — structural comparison inadequate',
      repair_action: 'inject_comparison_table_prompt',
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
      description: `Excessive bullet dependency (${bullets} bullets vs ${paragraphs.length} substantive paragraphs) — insufficient analytical prose`,
      repair_action: 'convert_bullets_to_analysis',
      severity: 'warning'
    });
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const analytical = sentences.filter((s) =>
    s.split(/\s+/).length >= 12 &&
    /(because|while|however|risk|valuation|concentration|volatility|liquidity|rates|earnings|holdings|expense ratio|duration|transmission|regime)/i.test(s)
  ).length;

  if (analytical < 15) {
    failures.push({
      check: 'analytical_density',
      description: `Low analytical sentence density (${analytical} analytical sentences found, 15+ required)`,
      repair_action: 'increase_analytical_depth',
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
  const autoRepairInsufficient = requiresAI;

  const injections = [];

  // Build context injections for AI repair prompt
  if (failures.some((f) => f.repair_action === 'inject_regime_context') && regime?.regime) {
    injections.push({
      type: 'regime_context',
      context: {
        regime: regime.regime,
        regime_label: regime.regime_label,
        regime_summary: regime.regime_summary?.slice(0, 400),
        implications: regime.implications
      },
      instruction: 'Incorporate current macro regime context into the analytical framework — explain how the current environment affects the subject matter.'
    });
  }

  if (failures.some((f) => f.repair_action === 'inject_transmission_context') && transmission?.regime_transmission_note) {
    injections.push({
      type: 'transmission_context',
      context: {
        regime_note: transmission.regime_transmission_note,
        relevant_chains: extractRelevantChains(transmission, html)
      },
      instruction: 'Add cross-asset transmission chain analysis — explain WHY assets react to macro events, not just THAT they do.'
    });
  }

  if (failures.some((f) => f.repair_action === 'inject_etf_context') && etfIntel?.etf_profiles) {
    const relevantETFs = extractRelevantETFs(html, etfIntel);
    if (relevantETFs.length) {
      injections.push({
        type: 'etf_comparison_context',
        context: { etf_profiles: relevantETFs },
        instruction: 'Upgrade ETF comparisons to institutional depth: include allocation implications, rate sensitivity, concentration risk, and sector rotation behavior for each compared ETF.'
      });
    }
  }

  if (failures.some((f) => f.repair_action === 'inject_scenario_framing') && rateIntel?.yield_curve) {
    injections.push({
      type: 'rate_path_context',
      context: {
        stance: rateIntel.fed_path?.current_stance,
        bias: rateIntel.fed_path?.bias,
        curve_shape: rateIntel.yield_curve?.inferred_shape,
        narrative: rateIntel.fed_path?.implied_path_narrative?.slice(0, 400)
      },
      instruction: 'Add probability-weighted scenario analysis — frame outcomes conditionally (if X then Y) rather than as absolute predictions.'
    });
  }

  const aiRepairPrompt = buildAIRepairPrompt(slug, failures, genericPhrases, injections);

  return {
    version: '1.0',
    created_at: new Date().toISOString(),
    target_slug: slug,
    failures_detected: failures,
    generic_phrase_violations: genericPhrases,
    critical_failures: criticalCount,
    requires_ai_repair: requiresAI,
    auto_repair_insufficient: autoRepairInsufficient,
    context_injections: injections,
    ai_repair_prompt: aiRepairPrompt,
    repair_priority: criticalCount >= 2 ? 'high' : 'medium',
    next_action: requiresAI
      ? 'mark_for_brain_targeted_repair'
      : 'manual_review_recommended'
  };
}

function extractRelevantChains(transmission, html) {
  if (!transmission?.transmission_library) return [];
  const text = html.toUpperCase();
  return Object.entries(transmission.transmission_library)
    .filter(([key]) => {
      const keyword = key.split('_')[0];
      return text.includes(keyword);
    })
    .slice(0, 2)
    .map(([key, chain]) => ({
      key,
      mechanism: chain.mechanism?.slice(0, 300),
      primary_channel: chain.primary_channel
    }));
}

function extractRelevantETFs(html, etfIntel) {
  const tickers = ['SPY', 'QQQ', 'IWM', 'XLV', 'XLE', 'XLF', 'XLU', 'XLP', 'GLD', 'TLT', 'SOXX', 'DIA', 'UUP'];
  const found = tickers.filter((t) => html.includes(t));
  return found.slice(0, 4).map((t) => {
    const profile = etfIntel.etf_profiles?.[t];
    return {
      ticker: t,
      full_name: profile?.full_name,
      institutional_interpretation: profile?.institutional_interpretation?.slice(0, 400),
      comparison_note: profile?.comparison_note?.slice(0, 300)
    };
  }).filter((p) => p.institutional_interpretation);
}

function buildAIRepairPrompt(slug, failures, genericPhrases, injections) {
  const failureList = failures.map((f) => `- ${f.check}: ${f.description}`).join('\n');
  const phraseList  = genericPhrases.map((p) => `- "${p.phrase.replace(/_/g, ' ')}" (${p.occurrences} occurrences)`).join('\n');
  const contextList = injections.map((i) => `- ${i.type}: ${i.instruction}`).join('\n');

  return `INSTITUTIONAL DEPTH REPAIR REQUEST FOR: ${slug}

DETECTED FAILURES:
${failureList || 'None'}

GENERIC PHRASE VIOLATIONS (replace with evidence-grounded language):
${phraseList || 'None'}

CONTEXT AVAILABLE FOR REPAIR:
${contextList || 'No context injections required'}

REPAIR REQUIREMENTS:
1. Every macro claim must be grounded in a mechanism, not just a direction
2. Cross-asset transmission chains must explain WHY, not just THAT
3. ETF comparisons must address: allocation structure, rate sensitivity, concentration risk, sector rotation
4. Generic phrases ("markets are watching", "uncertainty remains") must be replaced with specific, evidence-based language
5. Probability language must be conditional: "IF X, THEN Y is likely because of Z"
6. Analytical sentences (12+ words with causal language) must exceed bullet points in the article

QUALITY STANDARD: Institutional research desk quality. Not SEO blog. Not generic finance content.`;
}

// ── Queue management ─────────────────────────────────────────────────────────

function findCandidateSlug(queue) {
  const topics = Array.isArray(queue.topics) ? queue.topics : [];
  const inReview = topics.find((t) => t.status === 'in_review' || t.status === 'manual_revision_required');
  return inReview?.slug || null;
}

function markTopicForRepair(queue, slug) {
  if (!WRITE) return;
  const topics = Array.isArray(queue.topics) ? queue.topics : [];
  const topic = topics.find((t) => t.slug === slug);
  if (topic) {
    topic.status = 'manual_revision_required';
    topic.repair_required = true;
    topic.repair_spec_path = 'data/intelligence/repair-spec.json';
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log(`[repair] Marked ${slug} as manual_revision_required in queue`);
  }
}

function logRepairFindings(slug, failures, genericPhrases, spec) {
  console.log(`\n[repair] ═══ REPAIR ANALYSIS: ${slug} ═══`);
  if (failures.length) {
    console.log(`[repair] Depth failures (${failures.length}):`);
    failures.forEach((f) => console.log(`[repair]   [${f.severity.toUpperCase()}] ${f.check}: ${f.description}`));
  }
  if (genericPhrases.length) {
    console.log(`[repair] Generic phrase violations (${genericPhrases.length}):`);
    genericPhrases.forEach((p) => console.log(`[repair]   "${p.phrase.replace(/_/g, ' ')}" — ${p.occurrences} occurrence(s)`));
  }
  console.log(`[repair] Requires AI repair: ${spec.requires_ai_repair}`);
  console.log(`[repair] Priority: ${spec.repair_priority}`);
  console.log(`[repair] Next action: ${spec.next_action}`);
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
