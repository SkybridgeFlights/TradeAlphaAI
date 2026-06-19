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
const KIND_KICKER = { asset: ['Related asset', 'أصل ذو صلة'], sector: ['Related sector', 'قطاع ذو صلة'], equity: ['Related equity', 'سهم ذو صلة'] };

// CP9 — entity-graph-driven related assets/sectors/equities for one symbol.
function entityNeighbourCards(ar, symbol) {
  const g = readJson(path.join(ROOT, 'data', 'intelligence', 'entity-research-graph.json'), {});
  const nodes = new Map((g.nodes || []).map((n) => [n.id, n]));
  const seen = new Set();
  const cards = [];
  for (const e of (g.edges || [])) {
    let other = null;
    if (e.from === symbol) other = e.to; else if (e.to === symbol) other = e.from; else continue;
    if (seen.has(other) || !nodes.has(other)) continue; seen.add(other);
    const n = nodes.get(other);
    const kk = KIND_KICKER[n.group] || ['Related research', 'أبحاث ذات صلة'];
    cards.push([ar ? kk[1] : kk[0], n.label_en, n.label_ar, n.href]);
  }
  return cards;
}

// group: 'asset' | 'sector' | 'equity'. symbol (optional) adds entity-graph neighbours.
function relatedResearchBlock(ar, group, symbol) {
  const t = (en, arT) => (ar ? arT : en);
  const graph = readJson(path.join(ROOT, 'data', 'intelligence', 'research-graph.json'), {});
  const nodeId = NODE_OF[group];
  const nodes = new Map((graph.nodes || []).map((n) => [n.id, n]));
  const neighbours = [];
  for (const e of (graph.edges || [])) {
    if (e.from === nodeId && nodes.has(e.to)) neighbours.push(nodes.get(e.to));
    else if (e.to === nodeId && nodes.has(e.from)) neighbours.push(nodes.get(e.from));
  }
  const seen = new Set();
  const cards = [];
  cards.push([t('Regime research', 'أبحاث النظام'), 'Regime research', 'أبحاث النظام', '/research/regime/']);
  cards.push([t('Research hub', 'مركز الأبحاث'), 'Research hub', 'مركز الأبحاث', '/research/']);
  cards.push([t('Historical research', 'الأبحاث التاريخية'), 'Historical research', 'الأبحاث التاريخية', '/market-map/history/']);
  for (const n of neighbours) { if (seen.has(n.id)) continue; seen.add(n.id); cards.push([t('Category research', 'أبحاث الفئة'), n.label_en, n.label_ar, n.href]); }
  // CP9 — graph-driven related assets/sectors/equities for this entity.
  if (symbol) for (const c of entityNeighbourCards(ar, symbol)) cards.push(c);
  const grid = cards.map(([kicker, en, arL, href]) => `          <article class="market-card" style="border-inline-start:4px solid #2f8f76"><span class="market-card-kicker">${esc(kicker)}</span><h3><a href="${esc((ar ? '/ar' : '') + href)}">${esc(ar ? arL : en)}</a></h3></article>`).join('\n');
  return `      <section class="market-section" id="related-research">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Related research', 'أبحاث ذات صلة'))}</span><h2>${esc(t('Connected research and intelligence', 'أبحاث واستخبارات مترابطة'))}</h2></div>
        <p class="market-copy">${esc(t('These links follow the research graph to the regime, historical and narrative research, and to the related assets, sectors and equities this entity connects to. Context, not a forecast or recommendation.', 'تتبع هذه الروابط رسم الأبحاث إلى أبحاث النظام والتاريخ والسردية، وإلى الأصول والقطاعات والأسهم ذات الصلة بهذا الكيان. سياق، وليس توقعاً أو توصية.'))}</p>
        <div class="market-grid three">
${grid}
        </div>
      </section>`;
}

module.exports = { relatedResearchBlock, entityNeighbourCards };
