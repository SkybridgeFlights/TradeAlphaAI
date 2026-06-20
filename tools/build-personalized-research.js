'use strict';

// Phase 223 — Personalized Research Engine.
//
// Reads personal-state-contracts (per-account watchlist symbols) +
// entity-research-graph (registry-bounded graph neighbours) and produces
// per-account research cards. With no real accounts today, the engine
// produces an EXAMPLE result using the contract's __PLACEHOLDER_account_id__
// + the existing public default watchlists from Phase 218. Empty per-account
// results stay honestly empty.
//
// Output: data/intelligence/personalized-research.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');
const MAX_NEIGHBOURS_PER_SYMBOL = 4;
const MAX_CARDS = 24;

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function neighboursFor(graph, symbol) {
  const out = [];
  for (const e of (graph && graph.edges) || []) {
    let other = null;
    if (e.from === symbol) other = e.to;
    else if (e.to === symbol) other = e.from;
    if (!other) continue;
    // Only include edges with evidence — anti-fabrication invariant from
    // entity-research-graph.
    if (!Array.isArray(e.evidence) || e.evidence.length === 0) continue;
    out.push({ symbol: other, kind: e.kind || 'related', label_en: e.label_en || other, evidence: e.evidence.slice(0, 2) });
  }
  return out.slice(0, MAX_NEIGHBOURS_PER_SYMBOL);
}

function build() {
  const stamp = new Date().toISOString();
  const personalState = readJson(J('personal-state-contracts.json'), {});
  const watchlists = readJson(J('watchlists.json'), { watchlists: [] });
  const graph = readJson(J('entity-research-graph.json'), { nodes: [], edges: [] });
  const research = readJson(J('research-hub.json'), { categories: [] });

  const exampleAccountId = (personalState.example_template && personalState.example_template.account_id) || '__PLACEHOLDER_account_id__';

  // Build the example account's "personal" symbol set from the Phase 218
  // public default watchlists (they're public; using them in the example
  // is not fabricating a per-user list).
  const exampleSymbols = [];
  for (const w of (watchlists.watchlists || []).slice(0, 2)) {
    for (const e of (w.entities || []).slice(0, 4)) {
      if (e.symbol) exampleSymbols.push(e.symbol);
    }
  }
  const uniqueSymbols = Array.from(new Set(exampleSymbols));

  const cards = [];
  for (const sym of uniqueSymbols) {
    const neighbours = neighboursFor(graph, sym);
    for (const n of neighbours) {
      if (cards.length >= MAX_CARDS) break;
      cards.push({
        from_symbol: sym,
        to_symbol: n.symbol,
        kind: n.kind,
        evidence: n.evidence,
        research_href: `/research/assets/${String(n.symbol).toLowerCase()}/`,
        source: 'entity-research-graph (evidence-backed neighbours)',
      });
    }
    if (cards.length >= MAX_CARDS) break;
  }

  // Per-account result template (the real engine will key by account_id).
  const exampleAccount = {
    account_id: exampleAccountId,
    cards_count: cards.length,
    cards,
    seed_symbols: uniqueSymbols,
    note_en: cards.length ? `Example personalization seeded from ${uniqueSymbols.length} public default watchlist symbols via entity-research-graph neighbours. Per-account results require a real account.` : 'Empty result — no evidence-backed neighbours found for the seed symbols.',
    note_ar: cards.length ? `تخصيص توضيحي مزروع من ${uniqueSymbols.length} رمزاً من قوائم المتابعة الافتراضية العامة عبر جيران entity-research-graph. تتطلب النتائج لكل حساب حساباً حقيقياً.` : 'نتيجة فارغة — لم يتم العثور على جيران مدعومين بأدلة لرموز الجذر.',
  };

  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'personalized-research',
    contracts_version: '1.0.0',
    mode: 'contract',
    engine_enabled: true,
    engine_inputs: {
      personal_state: 'data/intelligence/personal-state-contracts.json',
      entity_research_graph: 'data/intelligence/entity-research-graph.json',
      watchlists: 'data/intelligence/watchlists.json',
      research_hub: 'data/intelligence/research-hub.json',
    },
    accounts: {
      real_count: 0,
      example: exampleAccount,
    },
    governance: {
      no_signals: true,
      no_forecasts: true,
      no_price_targets: true,
      no_fabricated_edges: true,
      registry_bounded: true,
      evidence_backed_only: true,
    },
    attribution: {
      sources: ['data/intelligence/entity-research-graph.json', 'data/intelligence/watchlists.json', 'tools/build-personalized-research.js'],
      note: 'Personalized research engine. Reads per-account watchlist symbols (none today) + entity-research-graph evidence-backed neighbours and produces research cards. With no accounts, runs against the public default watchlists as a demonstration; never fabricates a per-user list.',
    },
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[personalized-research] mode=${out.mode} accounts=${out.accounts.real_count} example_cards=${out.accounts.example.cards_count}`);
  if (WRITE) {
    fs.writeFileSync(J('personalized-research.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[personalized-research] wrote personalized-research.json');
  }
}

module.exports = { build };
