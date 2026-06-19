'use strict';

// Phase 212 / CP6 — shared "Related Research" section for entity pages
// (asset/sector/equity). Derives related links from the research GRAPH (graph
// neighbours of the entity's node) plus the standing research surfaces. No
// fabricated links: graph edges are evidence-backed and node hrefs resolve to
// existing intelligence pages. Section id="related-research".

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const NODE_OF = { asset: 'assets', sector: 'sectors', equity: 'equities' };

// group: 'asset' | 'sector' | 'equity'
function relatedResearchBlock(ar, group) {
  const t = (en, arT) => (ar ? arT : en);
  const graph = readJson(path.join(ROOT, 'data', 'intelligence', 'research-graph.json'), {});
  const nodeId = NODE_OF[group];
  const nodes = new Map((graph.nodes || []).map((n) => [n.id, n]));
  // Graph neighbours of this entity's node (both directions) — evidence-backed only.
  const neighbours = [];
  for (const e of (graph.edges || [])) {
    if (e.from === nodeId && nodes.has(e.to)) neighbours.push(nodes.get(e.to));
    else if (e.to === nodeId && nodes.has(e.from)) neighbours.push(nodes.get(e.from));
  }
  const seen = new Set();
  const cards = [];
  // Standing research surfaces (regime / historical / narrative research).
  cards.push(['Regime research', 'أبحاث النظام', '/research/regime/', '#2f8f76']);
  cards.push(['Research hub', 'مركز الأبحاث', '/research/', '#5a8f7a']);
  cards.push(['Historical research', 'الأبحاث التاريخية', '/market-map/history/', '#c2703c']);
  cards.push(['Market narrative', 'سردية السوق', '/market-terminal/', '#46505f']);
  // Related entities from the research graph.
  for (const n of neighbours) {
    if (seen.has(n.id)) continue; seen.add(n.id);
    cards.push([n.label_en, n.label_ar, n.href, '#2f8f76']);
  }
  const grid = cards.map(([en, arL, href, color]) => `          <article class="market-card" style="border-inline-start:4px solid ${color}"><span class="market-card-kicker">${esc(t('Related research', 'أبحاث ذات صلة'))}</span><h3><a href="${esc((ar ? '/ar' : '') + href)}">${esc(ar ? arL : en)}</a></h3></article>`).join('\n');
  return `      <section class="market-section" id="related-research">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Related research', 'أبحاث ذات صلة'))}</span><h2>${esc(t('Connected research and intelligence', 'أبحاث واستخبارات مترابطة'))}</h2></div>
        <p class="market-copy">${esc(t('These links follow the research graph from this entity to the regime, historical and narrative research it connects to. Context, not a forecast or recommendation.', 'تتبع هذه الروابط رسم الأبحاث من هذا الكيان إلى أبحاث النظام والتاريخ والسردية المرتبطة به. سياق، وليس توقعاً أو توصية.'))}</p>
        <div class="market-grid three">
${grid}
        </div>
      </section>`;
}

module.exports = { relatedResearchBlock };
