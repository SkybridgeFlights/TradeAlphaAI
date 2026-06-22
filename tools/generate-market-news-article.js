'use strict';

// Phase 107 — Market News Brain publisher.
//
// When (and only when) the eligibility engine surfaces a qualifying macro event,
// generates ONE long-form bilingual institutional reaction-analysis article to
// /market-news/<slug>.html + /ar/market-news/<slug>.html, drawing exclusively on
// the canonical intelligence artifacts. No fabrication: official actual/previous
// come from economic-intelligence; forecasts only when provider-sourced (proxy
// is labelled, never consensus); reactions only when observed (else "awaiting");
// regime/cross-asset from the liquidity-regime + cross-asset-state artifacts.
//
// Self-gating: if no event qualifies, exits green with NO publish. One article
// per run. Dedup + cooldown are owned by the eligibility engine's `covered`
// memory; this publisher additionally records what it published.
//
// Usage: node tools/generate-market-news-article.js [--write]

const fs = require('fs');
const path = require('path');
const narrative = require('./narrative-prose');
const { scoreArticle, QUALITY_FLOOR } = require('./editorial-quality');
const { scoreVisual, VISUAL_QUALITY_FLOOR } = require('./visual-quality');

const ROOT = path.resolve(__dirname, '..');
const ELIG = path.join(ROOT, 'data', 'intelligence', 'news-eligibility.json');
const INTEL = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');
const REACTIONS = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const CHART_INTEL = path.join(ROOT, 'data', 'visual', 'chart-intelligence.json');
const INSTITUTIONAL_CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const MAX_PANELS = 2;
const COVERAGE = path.join(ROOT, 'data', 'intelligence', 'market-news-coverage.json');
const EN_INDEX = path.join(ROOT, 'market-news', 'index.html');
const AR_INDEX = path.join(ROOT, 'ar', 'market-news', 'index.html');
const MIN_WORDS = { en: 340, ar: 280 }; // institutional long-form floors (locale-aware)

// Phase 116 — publishing surfaces. The market-news article wrapper is reused
// verbatim for the dedicated market-structure surface; only paths, labels and
// the schema section differ. Default stays market-news (zero behaviour change).
const SURFACES = {
  'market-news': {
    dir: 'market-news', enIndex: EN_INDEX, arIndex: AR_INDEX,
    labelEn: 'Market News', labelAr: 'أخبار السوق', section: 'Market News',
    discEn: 'Educational analysis of market reaction and macro context. Not investment advice or a trading recommendation.',
    discAr: 'تحليل تعليمي لتفاعل السوق وسياقه الكلي، وليس نصيحة استثمارية أو توصية تداول.',
  },
  'market-structure': {
    dir: 'market-structure', enIndex: path.join(ROOT, 'market-structure', 'index.html'), arIndex: path.join(ROOT, 'ar', 'market-structure', 'index.html'),
    labelEn: 'Market Structure', labelAr: 'بنية السوق', section: 'Market Structure',
    discEn: 'Institutional market-structure interpretation for educational context. Not technical trading analysis, signals, price targets or investment advice.',
    discAr: 'تفسير مؤسسي لبنية السوق لغرض تعليمي، وليس تحليلاً فنياً للتداول أو إشارات أو أهداف سعرية أو نصيحة استثمارية.',
  },
};

function readJson(p, f) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
function fmtNum(v, unit) { return (v === null || v === undefined) ? null : `${v}${unit ? ' ' + unit : ''}`; }

// ── Selection ─────────────────────────────────────────────────────────────────
function selectEvent() {
  const elig = readJson(ELIG, { eligible: [] });
  const eligible = (elig.eligible || []).slice().sort((a, b) => (b.significance || 0) - (a.significance || 0));
  if (!eligible.length) return null;
  const coverage = readJson(COVERAGE, { published: [] });
  const publishedIds = new Set((coverage.published || []).map((c) => c.event_id));
  // The eligibility engine already applied dedup + cooldown; we additionally
  // skip anything this publisher already produced (idempotency).
  return eligible.find((e) => !publishedIds.has(e.id)) || null;
}

function gatherContext(elig) {
  const intel = readJson(INTEL, { events: [] });
  const reactions = readJson(REACTIONS, { reactions: [] });
  const regime = readJson(REGIME, {});
  const cross = readJson(CROSS, { assets: [] });
  // Match the eligible event to an economic-intelligence event by id, else by
  // cluster/headline heuristics.
  const event = (intel.events || []).find((e) => e.id === elig.id)
    || (intel.events || []).find((e) => elig.headline && elig.headline.toLowerCase().includes(String(e.event || '').toLowerCase()))
    || null;
  const reaction = event ? (reactions.reactions || []).find((r) => r.event_id === event.id) : null;
  return { elig, event, reaction, regime, cross };
}

// Phase 114 — deterministic placement of chart-intelligence panels by section.
const PANEL_PLACEMENT = {
  cross_asset_divergence: 'confirmation', macro_confirmation_matrix: 'confirmation',
  reaction_persistence: 'confirmation', fading_reaction: 'confirmation',
  dollar_vs_gold_structure: 'cross-asset', yields_vs_equities_relationship: 'cross-asset',
  liquidity_regime_snapshot: 'regime', risk_regime_transition: 'regime', yield_pressure_structure: 'regime',
  volatility_transition: 'regime', defensive_rotation: 'regime', breadth_fragility: 'regime', catalyst_window: 'cross-asset',
};
// Priority order so a reaction article leads with its reaction evidence.
const PANEL_PRIORITY = ['cross_asset_divergence', 'macro_confirmation_matrix', 'reaction_persistence', 'fading_reaction', 'liquidity_regime_snapshot', 'risk_regime_transition'];

// Select up to MAX_PANELS justified, quality-passing chart-intelligence panels
// relevant to this article. Deterministic; no duplicate type or section.
function selectPanels(ctx, locale) {
  let manifest; try { manifest = JSON.parse(fs.readFileSync(CHART_INTEL, 'utf8')); } catch { return []; }
  const visuals = (manifest.visuals || []).filter((v) => {
    if (!v.narrative_hook || !v.narrative_hook[locale]) return false;
    if (!v.analytical_reason) return false;
    if (!v.files || !v.files[locale]) return false;
    if (!fs.existsSync(path.join(ROOT, v.files[locale]))) return false;
    if (!PANEL_PLACEMENT[v.chart_type]) return false;
    const s = scoreVisual(v);
    return s.flags.length === 0 && s.score >= VISUAL_QUALITY_FLOOR;
  });
  // Reaction panels are relevant only when this article's reaction has data.
  const reactionTypes = new Set(['cross_asset_divergence', 'macro_confirmation_matrix', 'reaction_persistence', 'fading_reaction']);
  const hasReaction = ctx.reaction && ctx.reaction.has_reaction_data;
  const eligible = visuals.filter((v) => (reactionTypes.has(v.chart_type) ? hasReaction : true));

  const picked = []; const seenType = new Set(); const seenSection = new Set();
  for (const type of PANEL_PRIORITY) {
    if (picked.length >= MAX_PANELS) break;
    const v = eligible.find((x) => x.chart_type === type);
    if (!v || seenType.has(v.chart_type)) continue;
    const section = PANEL_PLACEMENT[v.chart_type];
    if (seenSection.has(section)) continue; // one panel per section, no clutter
    picked.push({ visual: v, section });
    seenType.add(v.chart_type); seenSection.add(section);
  }
  return picked;
}

function panelFigure(visual, locale, manifest) {
  const ar = locale === 'ar';
  let svg = '';
  try { svg = fs.readFileSync(path.join(ROOT, visual.files[locale]), 'utf8'); } catch { return ''; }
  // Make the fixed-size SVG responsive: drop width/height from the <svg> tag,
  // keep the viewBox so aspect ratio is preserved and CSS controls the size.
  svg = svg.replace(/(<svg\b[^>]*?)\s+width="\d+"\s+height="\d+"/, '$1');
  const hook = visual.narrative_hook[locale];
  const reason = (visual.analytical_reason && visual.analytical_reason.question) || '';
  const asOf = (manifest.generated_at || '').slice(0, 10) || '—';
  const attribution = ar ? 'المصدر: مرجعَا نظام السيولة والتفاعل لدى TradeAlphaAI' : 'Source: TradeAlphaAI liquidity-regime + reaction artifacts';
  const asOfLabel = ar ? 'لقطة · بتاريخ' : 'Snapshot · as of';
  return `<figure class="article-evidence-panel" data-chart-type="${esc(visual.chart_type)}">
  <div class="aep-svg">${svg}</div>
  <figcaption class="aep-caption">
    <span class="aep-hook">${esc(hook)}</span>
    ${reason ? `<span class="aep-reason">${esc(reason)}</span>` : ''}
    <span class="aep-attrib">${esc(attribution)} · ${esc(asOfLabel)} ${esc(asOf)}</span>
  </figcaption>
</figure>`;
}

function injectPanels(body, ctx, locale) {
  const picked = selectPanels(ctx, locale);
  if (!picked.length) return body;
  let manifest = {}; try { manifest = JSON.parse(fs.readFileSync(CHART_INTEL, 'utf8')); } catch { /* none */ }
  let out = body;
  for (const { visual, section } of picked) {
    const fig = panelFigure(visual, locale, manifest);
    if (!fig) continue;
    // Insert the figure immediately after the target section's closing tag.
    const marker = `id="${section}"`;
    const idx = out.indexOf(marker);
    if (idx < 0) { out += `\n${fig}`; continue; }
    const close = out.indexOf('</section>', idx);
    if (close < 0) { out += `\n${fig}`; continue; }
    const insertAt = close + '</section>'.length;
    out = out.slice(0, insertAt) + `\n${fig}` + out.slice(insertAt);
  }
  return out;
}

function injectFigureAfterSection(body, sectionId, figure) {
  if (!figure) return body;
  const marker = `id="${sectionId}"`;
  const idx = body.indexOf(marker);
  if (idx < 0) return `${body}\n${figure}`;
  const close = body.indexOf('</section>', idx);
  if (close < 0) return `${body}\n${figure}`;
  const insertAt = close + '</section>'.length;
  return body.slice(0, insertAt) + `\n${figure}` + body.slice(insertAt);
}

// Phase 129 — embed a REAL sourced OHLCV institutional chart (when the manifest
// has a verified one for this surface/topic) as chart-first evidence. Never
// fabricates: if no verified chart applies, returns '' and the article stays
// text-led. The SVG is authored viewBox-only (responsive); the figure carries
// the symbol, chart type, series hash and as-of so the integrity validator can
// prove the embedded chart maps to real sourced bars.
const TACTICAL_ARTIFACT_PATH = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const LINK_LABELS = {
  en: { supportive: 'supportive structure', fragile: 'fragile continuation', narrowing: 'narrowing participation', liquidity: 'liquidity pressure', fading: 'fading pressure', mixed: 'mixed confirmation', unavailable: 'evidence unavailable' },
  ar: { supportive: 'بنية داعمة', fragile: 'استمرار هش', narrowing: 'مشاركة آخذة في التضيّق', liquidity: 'ضغط سيولة', fading: 'ضغط متلاشٍ', mixed: 'تأكيد مختلط', unavailable: 'الأدلة غير متاحة' },
};
const SUPPORT_STATE = {
  en: { supported: 'chart-supported', mixed: 'mixed', unsupported: 'not chart-supported', unavailable: 'evidence unavailable' },
  ar: { supported: 'مدعومة بالمخطط', mixed: 'مختلطة', unsupported: 'غير مدعومة بالمخطط', unavailable: 'الأدلة غير متاحة' },
};

const TOPIC_CHART_PREFERENCES = {
  'participation-breadth': ['SPY', 'IWM'],
  'breadth-volatility': ['SPY', 'IWM'],
  'structural-stability': ['SPY'],
  'volatility-structure': ['SPY', 'VIXY'],
  'cross-asset-structure': ['QQQ', 'TLT'],
  'rotation-concentration': ['QQQ', 'SPY'],
  'regime-structure': ['SPY'],
  'liquidity-conditions': ['UUP', 'SPY'],
  'cross-asset-relationships': ['QQQ', 'TLT'],
};

function selectInstitutionalCharts(surfaceKey, topicId, locale) {
  let manifest; try { manifest = JSON.parse(fs.readFileSync(INSTITUTIONAL_CHARTS, 'utf8')); } catch { return null; }
  if (!manifest || !['available', 'partial'].includes(manifest.status)) return null;
  const charts = (manifest.charts || []).filter((c) => c && c.verified === true
    && Array.isArray(c.allowed_surfaces) && c.allowed_surfaces.includes(surfaceKey)
    && c.files && c.files[locale] && fs.existsSync(path.join(ROOT, c.files[locale]))
    && Array.isArray(c.series) && c.series.length >= 35 && c.series_hash);
  if (!charts.length) return null;
  const norm = String(topicId || '').replace(/_/g, '-');
  const topicAliases = {
    'breadth-volatility': ['breadth-vs-index'],
  };
  const acceptedTopics = new Set([norm, ...(topicAliases[norm] || [])]);
  const matched = charts.map((chart) => {
    const relevanceTopic = (chart.related_topics || [])
      .map((topic) => String(topic).replace(/_/g, '-'))
      .find((topic) => acceptedTopics.has(topic));
    return relevanceTopic ? { chart, relevanceTopic } : null;
  }).filter(Boolean);
  if (!matched.length) return null;
  const preference = TOPIC_CHART_PREFERENCES[norm] || [];
  matched.sort((left, right) => {
    const leftRank = preference.indexOf(left.chart.symbol);
    const rightRank = preference.indexOf(right.chart.symbol);
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank)
      || left.chart.id.localeCompare(right.chart.id);
  });
  return {
    charts: matched.slice(0, Math.min(2, manifest.max_charts_per_article || 1)),
    manifest,
  };
}

// Deterministic, advice-free linkage between the tactical read and the sourced
// price structure: whether the structural read is chart-supported, mixed or not
// chart-supported. Uses only allowed institutional labels — never a trade call.
function tacticalChartLinkage(chart, locale) {
  const SS = SUPPORT_STATE[locale]; const LL = LINK_LABELS[locale];
  let tac; try { tac = JSON.parse(fs.readFileSync(TACTICAL_ARTIFACT_PATH, 'utf8')); } catch { tac = null; }
  if (!tac || !tac.available) return { state: SS.unavailable, label: LL.unavailable };
  const d = tac.dimensions || {};
  const st = (k) => (d[k] ? d[k].state : null);
  const structureOverlay = (chart.overlays || []).find((o) => o.type === 'structure');
  const ostate = structureOverlay ? structureOverlay.state : 'inside';
  const chartBias = ostate === 'expansion_up' ? 1 : ostate === 'expansion_down' ? -1 : 0;
  const dp = st('directional_pressure'); const cont = st('continuation');
  let tacBias = 0;
  if (dp === 'building') tacBias = 1;
  else if (dp === 'fading' || dp === 'stalling' || cont === 'fragile_continuation' || cont === 'exhaustion_risk') tacBias = -1;
  let state;
  if (chartBias === tacBias) state = SS.supported;
  else if (chartBias === 0 || tacBias === 0) state = SS.mixed;
  else state = SS.unsupported;
  let label;
  if (cont === 'fragile_continuation' || cont === 'exhaustion_risk') label = LL.fragile;
  else if (st('participation_quality') === 'narrowing' || st('participation_quality') === 'narrow') label = LL.narrowing;
  else if (st('liquidity_support') === 'draining') label = LL.liquidity;
  else if (dp === 'fading' || dp === 'stalling') label = LL.fading;
  else if (tacBias > 0 && chartBias >= 0) label = LL.supportive;
  else label = LL.mixed;
  return { state, label };
}

function institutionalChartFigures(surfaceKey, topicId, locale) {
  const picked = selectInstitutionalCharts(surfaceKey, topicId, locale);
  if (!picked) return '';
  const ar = locale === 'ar';
  return picked.charts.map(({ chart, relevanceTopic }) => {
    let svg = '';
    try { svg = fs.readFileSync(path.join(ROOT, chart.files[locale]), 'utf8'); } catch { return ''; }
    // Defensive: the SVG is authored viewBox-only, but strip any root width/height.
    svg = svg.replace(/(<svg\b[^>]*?)\s+width="\d+"\s+height="\d+"/, '$1');
    const title = ar ? chart.title_ar : chart.title_en;
    const hook = chart.narrative_hook && chart.narrative_hook[locale];
    const reason = chart.analytical_reason && chart.analytical_reason[locale];
    const provider = (chart.attribution && chart.attribution.provider) || '—';
    const srcWord = ar ? 'المصدر' : 'Source';
    const asOfWord = ar ? 'بتاريخ' : 'As of';
    const link = tacticalChartLinkage(chart, locale);
    const linkLine = ar
      ? `الارتباط التكتيكي: القراءة الهيكلية ${link.state} بهذه البنية السعرية (${link.label}).`
      : `Tactical linkage: the structural read is ${link.state} by this price structure (${link.label}).`;
    return `<figure class="institutional-chart" data-symbol="${esc(chart.symbol)}" data-chart-type="${esc(chart.chart_type || chart.visual_type)}" data-series-hash="${esc(chart.series_hash)}" data-as-of="${esc(chart.as_of)}" data-relevance-topic="${esc(relevanceTopic)}">
  <div class="ic-svg">${svg}</div>
  <figcaption class="ic-caption">
    <span class="ic-hook">${esc(hook || title)}</span>
    ${reason ? `<span class="ic-reason">${esc(reason)}</span>` : ''}
    <span class="ic-linkage" data-support="${esc(link.state)}">${esc(linkLine)}</span>
    <span class="ic-attrib">${esc(`${srcWord}: ${provider} · ${asOfWord} ${chart.as_of}`)}</span>
  </figcaption>
</figure>`;
  }).filter(Boolean).join('\n');
}

// ── Bilingual article rendering ───────────────────────────────────────────────
function renderArticle(ctx, locale) {
  const ar = locale === 'ar';
  const t = (en, arr) => (ar ? arr : en);
  const ev = ctx.event || {};
  const elig = ctx.elig || {};
  const title = elig.headline || ev.event || t('Macro event reaction analysis', 'تحليل تفاعل حدث كلي');
  const eyebrow = t('Institutional Macro Reaction Analysis', 'تحليل مؤسسي لتفاعل الاقتصاد الكلي');

  const sections = [];
  const sec = (id, head, copy) => sections.push(`<section class="market-section" id="${id}"><div class="market-section-head"><span class="eyebrow">${esc(t('Desk read', 'قراءة المكتب'))}</span><h2>${esc(head)}</h2></div><div class="market-panel">${copy}</div></section>`);
  const p = (s) => `<p class="market-copy">${esc(s)}</p>`;

  // 1. Lead
  const cat = ev.category || 'macro';
  sec('lead', t('What happened and why it matters', 'ما الذي حدث ولماذا يهم'),
    p(t(`${ev.event || elig.headline || 'A macro release'} is the focus of this analysis. It belongs to the ${cat} complex, and its significance to the desk is scored ${elig.significance || '—'}/100 by the event-significance engine, which weighs the surprise, the cross-asset relevance and the cooldown discipline before a release earns coverage at all.`,
      `${ev.event || elig.headline || 'إصدار اقتصادي'} هو محور هذا التحليل، وينتمي إلى مجموعة ${cat}. وتُقدّر أهميته لدى المكتب بـ ${elig.significance || '—'}/100 وفق محرك أهمية الأحداث الذي يزن المفاجأة والصلة عبر الأصول وانضباط فترة التهدئة قبل أن يستحق أي إصدار التغطية أساساً.`))
    + p(t('This piece sets out the official figures, the observed market reaction where it exists, the prevailing liquidity and regime context, the cross-asset implications, and what the desk watches from here. It interprets the structural environment around the release; it does not forecast price and carries no trading recommendation.',
      'يعرض هذا التحليل الأرقام الرسمية، وتفاعل السوق المرصود حين يوجد، وسياق السيولة والنظام السائد، والتداعيات عبر الأصول، وما يراقبه المكتب لاحقاً. وهو يفسّر البيئة الهيكلية المحيطة بالإصدار، ولا يتنبأ بالأسعار ولا يحمل أي توصية تداول.')));

  // 2. Official data
  const actual = fmtNum(ev.actual, ev.unit ? '' : '');
  const prev = fmtNum(ev.previous);
  let fcBasis;
  if (ev.forecast_quality === 'provider_consensus' || ev.forecast_quality === 'single_provider') fcBasis = t(`a sourced provider forecast of ${ev.forecast}`, `توقع مزوّد مصدري قدره ${ev.forecast}`);
  else if (ev.proxy_used) fcBasis = t(`no provider consensus; a clearly-labelled historical proxy (prior print ${ev.proxy_value}) is used only as a low-confidence baseline, not as consensus`, `لا يوجد إجماع للمزودين؛ يُستخدم مرجع تاريخي معلن (القراءة السابقة ${ev.proxy_value}) كأساس منخفض الثقة فقط، وليس كإجماع`);
  else fcBasis = t('no sourced forecast is available, so no surprise is asserted', 'لا يتوفر توقع مصدري، لذا لا يُفترض أي مفاجأة');
  sec('official-data', t('The official data', 'البيانات الرسمية'),
    p(t(`Release state: ${ev.release_state || 'scheduled'}. Actual: ${actual ?? 'not yet released'}; previous: ${prev ?? 'not available'}. On expectations, ${fcBasis}. The figure is attributed to ${ev.source || 'the official statistics office'}, and the desk treats only that official print as the basis for any surprise calculation.`,
      `حالة الإصدار: ${ev.release_state || 'مجدول'}. الفعلي: ${actual ?? 'لم يصدر بعد'}؛ السابق: ${prev ?? 'غير متاح'}. وبشأن التوقعات، ${fcBasis}. ويُنسب الرقم إلى ${ev.source || 'الجهة الإحصائية الرسمية'}، ولا يعتمد المكتب إلا على هذه القراءة الرسمية أساساً لأي حساب للمفاجأة.`))
    + p(t('Where a provider consensus is absent the desk is explicit that no forecast exists rather than substituting a prior reading and presenting it as expectation; that discipline keeps the surprise read honest.',
      'وحين يغيب إجماع المزودين، يوضّح المكتب صراحة أنه لا يوجد توقع بدلاً من إحلال قراءة سابقة وتقديمها كأنها توقع؛ وهذا الانضباط يبقي قراءة المفاجأة نزيهة.')));

  // 3. Market reaction
  const rx = ctx.reaction;
  if (rx && rx.has_reaction_data && rx.classification !== 'awaiting_data') {
    sec('reaction', t('The market reaction', 'تفاعل السوق'),
      p(t(`Observed cross-asset moves classify as ${rx.classification.replace(/_/g, ' ')} with ${rx.conviction.replace(/_/g, ' ')} conviction. ${rx.narrative}`,
        `تصنّف الحركات المرصودة عبر الأصول كـ ${rx.classification.replace(/_/g, ' ')} بقناعة ${rx.conviction.replace(/_/g, ' ')}. ${rx.narrative ? '' : ''}`))
      + p(t('That classification is measured, not inferred: it rests on how broadly the tracked assets aligned with the expected transmission and whether the move persisted rather than fading once the initial repricing passed. Conviction reflects that breadth and persistence together, so a strong reading requires confirmation across rates, the dollar and equity volatility, not a single market.',
        'وهذا التصنيف مُقاس لا مُستنتَج: يستند إلى مدى اتساع توافق الأصول المتتبَّعة مع الأثر المتوقع، وما إذا كانت الحركة قد استمرت بدل أن تتلاشى بعد إعادة التسعير الأولى. وتعكس القناعة هذا الاتساع والاستمرارية معاً، فالقراءة القوية تتطلب تأكيداً عبر العوائد والدولار وتذبذب الأسهم، لا سوقاً واحداً.')));
  } else {
    sec('reaction', t('The market reaction', 'تفاعل السوق'),
      p(t('Observed reaction windows are not yet available for this release, so no reaction is asserted; the desk reports awaiting reaction data rather than inferring one.',
        'نوافذ التفاعل المرصودة غير متاحة بعد لهذا الإصدار، لذا لا يُفترض أي تفاعل؛ يكتفي المكتب بالإشارة إلى انتظار بيانات التفاعل دون استنتاجها.')));
  }

  // 4. Regime context
  const rg = ctx.regime || {};
  if (rg.regime && rg.regime !== 'indeterminate') {
    sec('regime', t('Liquidity and regime context', 'سياق السيولة والنظام'),
      p(t(`The research-desk intelligence rail alongside this analysis frames the environment the release lands in: a ${rg.regime.replace(/_/g, ' ')} regime with ${String(rg.liquidity_state || '').replace(/_/g, ' ')} liquidity and ${rg.stability || ''} stability, cross-asset coherence ${rg.cross_asset_coherence && rg.cross_asset_coherence.score}. ${rg.narrative || ''} That backdrop matters because the same surprise is absorbed differently depending on whether liquidity is supportive and breadth is broad or whether the tape is narrow and fragile.`,
        `يؤطّر مسار استخبارات مكتب الأبحاث المرافق لهذا التحليل البيئة التي يأتي فيها الإصدار: نظام ${rg.regime.replace(/_/g, ' ')} مع سيولة ${String(rg.liquidity_state || '').replace(/_/g, ' ')} واستقرار ${rg.stability || ''}، واتساق عبر الأصول ${rg.cross_asset_coherence && rg.cross_asset_coherence.score}. ${rg.narrative || ''} وتهمّ هذه الخلفية لأن المفاجأة نفسها تُمتص بصورة مختلفة تبعاً لما إذا كانت السيولة داعمة والاتساع واسعاً أم أن التداول ضيق وهش.`)));
  } else {
    sec('regime', t('Liquidity and regime context', 'سياق السيولة والنظام'),
      p(t('The structural regime is currently indeterminate on the observed dimensions, so the desk does not overlay a regime read on this release.',
        'النظام الهيكلي غير محدد حالياً وفق الأبعاد المرصودة، لذا لا يُسقط المكتب قراءة نظام على هذا الإصدار.')));
  }

  // 5. Cross-asset implications (from the event's expected transmission template)
  const assets = (ev.cross_asset && ev.cross_asset.directional) || {};
  const assetList = Object.keys(assets).filter((a) => assets[a] !== '0');
  sec('cross-asset', t('Cross-asset implications', 'التداعيات عبر الأصول'),
    p(assetList.length
      ? t(`The expected institutional transmission for this category runs through ${assetList.join(', ')}. This is a conditional template — confirmation requires the observed moves to align across rates, the dollar, gold and equity volatility rather than any single market in isolation.`,
          `ينتقل الأثر المؤسسي المتوقع لهذه الفئة عبر ${assetList.join('، ')}. وهذا قالب مشروط — يتطلب التأكيد توافق الحركات المرصودة عبر العوائد والدولار والذهب وتذبذب الأسهم، لا سوقاً واحداً بمعزل.`)
      : t('Cross-asset sensitivity for this event is limited or unresolved on current data.', 'حساسية هذا الحدث عبر الأصول محدودة أو غير محسومة وفق البيانات الحالية.')));

  // 6. Confirmation / divergence
  sec('confirmation', t('What confirms, what diverges', 'ما يؤكد وما يتباعد'),
    p(rx && rx.has_reaction_data
      ? t(`Confirmation is measured by breadth and persistence rather than the print itself: ${(rx.cross_asset_matrix || []).filter((m) => m.confirms === true).length} of ${(rx.cross_asset_matrix || []).filter((m) => m.confirms !== null).length} tracked assets moved with the expected transmission, and the evidence rail below sets out each one. Where an asset breaks from the others, the reaction loses the cross-asset agreement that an institutional desk treats as the real test, so it is the divergence rather than the headline that frames how much weight the move can carry.`,
          `يُقاس التأكيد بالاتساع والاستمرارية لا بالرقم ذاته: تحرّك ${(rx.cross_asset_matrix || []).filter((m) => m.confirms === true).length} من ${(rx.cross_asset_matrix || []).filter((m) => m.confirms !== null).length} أصول وفق الأثر المتوقع، ويعرض مسار الأدلة أدناه كلاً منها. وحين ينفصل أصل عن البقية يفقد التفاعل الاتساق عبر الأصول الذي يعدّه المكتب المؤسسي الاختبار الحقيقي، إذ يصبح التباعد لا العنوان هو ما يحدد وزن الحركة.`)
      : t('Until reaction windows are observed, confirmation and divergence remain open questions; the desk avoids asserting either from the headline alone.', 'حتى تُرصد نوافذ التفاعل، يبقى التأكيد والتباعد سؤالين مفتوحين؛ ويتجنب المكتب الجزم بأيهما من العنوان وحده.')));

  // Evidence rail — the narrative-visual link. It exists to isolate, asset by
  // asset, where the observed reaction matched the expected transmission and
  // where it diverged; the article's confirmation reading refers to it directly.
  if (rx && rx.has_reaction_data && (rx.cross_asset_matrix || []).some((m) => m.confirms !== null)) {
    const rows = (rx.cross_asset_matrix || []).filter((m) => m.confirms !== null).map((m) =>
      `<li class="ec-rail-row ${m.confirms ? 'ec-rail-confirm' : 'ec-rail-diverge'}"><span class="ec-rail-asset">${esc(m.asset)}</span><span class="ec-rail-state">${esc(m.confirms ? t('confirmed', 'مؤكَّد') : t('diverged', 'متباعد'))}</span></li>`).join('');
    sections.push(`<aside class="market-evidence-rail" aria-label="${esc(t('Cross-asset evidence rail', 'مسار الأدلة عبر الأصول'))}"><div class="ec-rail-head"><span class="eyebrow">${esc(t('Cross-asset evidence rail', 'مسار الأدلة عبر الأصول'))}</span></div><ul class="ec-rail-list">${rows}</ul><p class="market-copy ec-rail-note">${esc(t('The rail isolates where the move matched the expected transmission and where it broke — the divergence, not the headline, is where institutional conviction is decided.', 'يعزل المسار حيث طابقت الحركة الأثر المتوقع وحيث انكسرت — والتباعد، لا العنوان، هو حيث تُحسم القناعة المؤسسية.'))}</p></aside>`);
  }

  // 7. What the desk watches next
  sec('watch-next', t('What the desk watches next', 'ما يراقبه المكتب لاحقاً'),
    p(t('The desk watches whether the cross-asset reaction strengthens or fades through the session, whether breadth confirms the index-level move, and whether the liquidity and regime backdrop absorbs or rejects the release. Revisions and the next data in the same cluster will retest this reading.',
      'يراقب المكتب ما إذا كان التفاعل عبر الأصول يتقوّى أو يتلاشى خلال الجلسة، وما إذا كان الاتساع يؤكد حركة المؤشر، وما إذا كانت خلفية السيولة والنظام تمتص الإصدار أو ترفضه. وستعيد المراجعات والبيانات التالية في المجموعة نفسها اختبار هذه القراءة.')));

  // Phase 114: inline the justified chart-intelligence SVG panels deterministically.
  const body = injectPanels(sections.join('\n'), ctx, locale);
  const wordCount = body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { title, eyebrow, body, wordCount };
}

// Phase 113 — native Arabic value maps for the embedded intelligence rail.
const RI_AR = {
  regime: { healthy_risk_expansion: 'توسّع مخاطر صحي', broad_risk_support: 'دعم مخاطر واسع', narrow_leadership: 'قيادة ضيقة', crowded_growth_positioning: 'تمركز نمو مزدحم', defensive_rotation: 'تدوير دفاعي', liquidity_stress: 'ضغط سيولة', unstable_rally: 'صعود غير مستقر', volatility_transition: 'تحوّل تذبذب', yield_pressure_regime: 'ضغط العوائد', macro_fragility: 'هشاشة كلية', indeterminate: 'غير محدد' },
  liquidity: { easing: 'تيسير', tightening: 'تشديد', yield_pressure: 'ضغط العوائد', defensive_demand: 'طلب دفاعي', volatility_absorption: 'امتصاص تذبذب', volatility_rejection: 'رفض تذبذب', neutral: 'محايد', indeterminate: 'غير محدد' },
  stability: { stable: 'مستقر', fragile: 'هش', deteriorating: 'يتدهور', unstable: 'غير مستقر', strengthening: 'يتقوّى', transition_state: 'انتقالي', indeterminate: 'غير محدد' },
  reaction: { confirmed_reaction: 'مؤكَّد', partial_confirmation: 'تأكيد جزئي', delayed_confirmation: 'تأكيد متأخر', fading_reaction: 'يتلاشى', rejected_reaction: 'مرفوض', divergence: 'تباعد', cross_asset_disagreement: 'تعارض عبر الأصول', volatility_without_direction: 'تذبذب دون اتجاه' },
};
function riVal(cat, v, ar) { if (!v) return '—'; return ar ? ((RI_AR[cat] && RI_AR[cat][v]) || String(v).replace(/_/g, ' ')) : String(v).replace(/_/g, ' '); }

// Embedded "research desk" intelligence rail — a deterministic context panel
// derived from the canonical artifacts, with honest freshness and degradation.
// It is referenced in the article prose (no disconnected blocks) and never
// claims real-time "live" data — it is an "as of <date>" snapshot.
function renderIntelligenceRail(ctx, locale) {
  const ar = locale === 'ar';
  const t = (en, arT) => (ar ? arT : en);
  const rg = ctx.regime || {};
  const rx = ctx.reaction;
  const coh = rg.cross_asset_coherence ? rg.cross_asset_coherence.score : null;
  const asOf = (rg.generated_at || '').slice(0, 10) || '—';
  const ageH = rg.attribution && typeof rg.attribution.market_state_age_hours === 'number' ? rg.attribution.market_state_age_hours : null;
  const stale = typeof ageH === 'number' && ageH > 48;

  const reactionState = rx && rx.has_reaction_data && rx.classification !== 'awaiting_data'
    ? riVal('reaction', rx.classification, ar) : t('awaiting reaction data', 'بانتظار بيانات التفاعل');

  const card = (label, value) => `<div class="ri-card"><span class="ri-label">${esc(label)}</span><span class="ri-value">${esc(value)}</span></div>`;
  const cards = [
    card(t('Regime', 'النظام'), riVal('regime', rg.regime, ar) || (ar ? 'غير متاح' : 'unavailable')),
    card(t('Liquidity', 'السيولة'), riVal('liquidity', rg.liquidity_state, ar)),
    card(t('Stability', 'الاستقرار'), riVal('stability', rg.stability, ar)),
    card(t('Cross-asset coherence', 'الاتساق عبر الأصول'), coh != null ? String(coh) : '—'),
    card(t('Reaction', 'التفاعل'), reactionState),
  ].join('');

  const note = rg.regime && rg.regime !== 'indeterminate'
    ? (stale ? t(`Snapshot may be stale (market state ${ageH}h old).`, `قد تكون اللقطة قديمة (حالة السوق منذ ${ageH} ساعة).`)
            : t('This snapshot derives from the canonical liquidity-regime and reaction artifacts and updates deterministically.', 'تُشتق هذه اللقطة من مرجعَي نظام السيولة والتفاعل المعتمدين وتُحدَّث بصورة حتمية.'))
    : t('Structural regime is currently indeterminate on the observed dimensions.', 'النظام الهيكلي غير محدد حالياً وفق الأبعاد المرصودة.');

  return `<aside class="research-intel-rail" aria-label="${esc(t('Research desk intelligence', 'استخبارات مكتب الأبحاث'))}">
    <div class="ri-head"><span class="eyebrow">${esc(t('Research desk intelligence', 'استخبارات مكتب الأبحاث'))}</span><span class="ri-asof">${esc(t('Snapshot · as of', 'لقطة · بتاريخ'))} ${esc(asOf)}</span></div>
    <div class="ri-grid">${cards}</div>
    <p class="ri-note market-copy">${esc(note)}</p>
  </aside>`;
}

// ── Phase 115: Daily Research Brain (continuous publishing during quiet tape) ──
const RESEARCH_COVERAGE = path.join(ROOT, 'data', 'intelligence', 'research-coverage.json');
const RESEARCH_COOLDOWN_DAYS = 4; // do not repeat the same research topic within this window
const RESEARCH_TOPICS = [
  { id: 'regime_structure', en: 'Market structure under the prevailing regime', ar: 'بنية السوق في ظل النظام السائد' },
  { id: 'liquidity_conditions', en: 'Liquidity conditions and the risk backdrop', ar: 'أوضاع السيولة وخلفية المخاطر' },
  { id: 'cross_asset_relationships', en: 'Cross-asset relationships in the current tape', ar: 'العلاقات عبر الأصول في السوق الراهن' },
  { id: 'breadth_volatility', en: 'Breadth and volatility beneath the index', ar: 'الاتساع والتذبذب تحت سطح المؤشر' },
];

function dayOfYear(d) { const s = new Date(Date.UTC(d.getUTCFullYear(), 0, 0)); return Math.floor((d - s) / 86400000); }

// Deterministic topic rotation that respects the cooldown memory.
function selectResearchTopic() {
  const cov = readJson(RESEARCH_COVERAGE, { published: [] });
  const recent = new Map((cov.published || []).map((c) => [c.topic, c.published_at]));
  const cutoff = Date.now() - RESEARCH_COOLDOWN_DAYS * 86400000;
  const start = dayOfYear(new Date()) % RESEARCH_TOPICS.length;
  for (let i = 0; i < RESEARCH_TOPICS.length; i += 1) {
    const topic = RESEARCH_TOPICS[(start + i) % RESEARCH_TOPICS.length];
    const last = recent.get(topic.id);
    if (!last || Date.parse(last) < cutoff) return topic;
  }
  return null; // every topic covered within cooldown — skip (no spam)
}

// Compose a deterministic institutional research note from the regime / cross-
// asset / reaction artifacts. Evidence-based, honest, bilingual. Mirrors the
// article structure so it reuses the rail, inline panels and quality gate.
function renderResearchBody(ctx, locale) {
  const ar = locale === 'ar';
  const t = (en, arT) => (ar ? arT : en);
  const rg = ctx.regime || {};
  const topic = (ctx.research && ctx.research.topic) || RESEARCH_TOPICS[0];
  const title = ar ? topic.ar : topic.en;
  const eyebrow = t('Institutional Research Note', 'مذكرة بحث مؤسسية');
  const reg = (v) => riVal('regime', v, ar);
  const liq = (v) => riVal('liquidity', v, ar);
  const stb = (v) => riVal('stability', v, ar);
  const coh = rg.cross_asset_coherence ? rg.cross_asset_coherence.score : null;
  const sub = rg.sub_states || {};

  const sections = [];
  const sec = (id, head, copy) => sections.push(`<section class="market-section" id="${id}"><div class="market-section-head"><span class="eyebrow">${esc(t('Desk read', 'قراءة المكتب'))}</span><h2>${esc(head)}</h2></div><div class="market-panel">${copy}</div></section>`);
  const p = (s) => `<p class="market-copy">${esc(s)}</p>`;

  // ── Narrative body — Bloomberg/Investing.com style ──────────────
  // Replaces the previous 5-section structural-jargon template that
  // defaulted to "indeterminate" boilerplate. The composer reads live
  // market state + pulse + economic-calendar and emits concrete
  // narrative paragraphs with real prices, percentages, and analyst
  // commentary. Each section is included only when its underlying
  // data exists — no fabricated padding.
  const narrativeBody = narrative.composeFullBody(locale, {});
  sections.push(narrativeBody);

  // Chart-first evidence stays as before.
  const researchTopicId = (topic && (topic.id || topic.slug)) || '';
  const researchChart = institutionalChartFigures('market-news', researchTopicId, locale);

  const baseBody = researchChart ? sections.join('\n') : injectPanels(sections.join('\n'), ctx, locale);
  const body = injectFigureAfterSection(baseBody, 'lead', researchChart);
  const wordCount = body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { title, eyebrow, body, wordCount };
}

function publishResearch(write) {
  const regime = readJson(REGIME, {});
  // Soften the previous "regime indeterminate ⇒ skip" gate. The new
  // narrative body composes from live equity, rates, dollar and
  // volatility readings via tools/narrative-prose.js — those work
  // even when the regime classifier hasn't yet locked a verified
  // state. Only skip when there is genuinely no live market data
  // (live-market-state.json has no SPY/VIX/yield values), which is
  // the truly empty case the gate was meant to catch.
  const live = readJson('data/live-market-state.json', {});
  const haveLiveBackbone =
    (live.sp500 && live.sp500.change_pct != null) ||
    (live.nasdaq && live.nasdaq.change_pct != null) ||
    (live.vix && live.vix.value != null) ||
    (live.us10y_yield && live.us10y_yield.value != null);
  if (!haveLiveBackbone) {
    console.log('[daily-research] no live equity/volatility/yield backbone in data/live-market-state.json — skipping (no narrative to compose).');
    return { published: false, reason: 'live_state_empty' };
  }
  const topic = selectResearchTopic();
  if (!topic) {
    console.log('[daily-research] all research topics within cooldown — exiting green with no publish (no spam).');
    return { published: false, reason: 'all_topics_cooled' };
  }
  const reactions = readJson(REACTIONS, { reactions: [] });
  const reaction = (reactions.reactions || []).find((r) => r.has_reaction_data) || null;
  const ctx = { elig: { headline: topic.en, cluster: 'research' }, event: { event: topic.en, category: 'macro' }, reaction, regime, cross: readJson(CROSS, { assets: [] }), research: { topic } };
  const slug = `research-${topic.id.replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}`;

  const en = assembleHtml(ctx, 'en', slug, renderResearchBody);
  const arDoc = assembleHtml(ctx, 'ar', slug, renderResearchBody);
  if (en.wordCount < MIN_WORDS.en || arDoc.wordCount < MIN_WORDS.ar) {
    console.log(`[daily-research] below word floor (en=${en.wordCount}/${MIN_WORDS.en}, ar=${arDoc.wordCount}/${MIN_WORDS.ar}) — not publishing.`);
    return { published: false, reason: 'below_min_words' };
  }
  const enText = renderResearchBody(ctx, 'en').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  const arText = renderResearchBody(ctx, 'ar').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  const quality = scoreArticle({ en: enText, ar: arText });
  if (quality.flags.length || quality.min_score < QUALITY_FLOOR) {
    console.log(`[daily-research] editorial-quality gate failed (min_score=${quality.min_score}, flags=${JSON.stringify(quality.flags)}) — not publishing.`);
    return { published: false, reason: 'below_quality_floor' };
  }
  console.log(`[daily-research] topic "${topic.id}" → ${slug} (en=${en.wordCount}w/${quality.en.score} ar=${arDoc.wordCount}w/${quality.ar.score})`);
  if (!write) return { published: false, reason: 'dry_run', slug };

  fs.writeFileSync(path.join(ROOT, 'market-news', `${slug}.html`), en.html, 'utf8');
  fs.mkdirSync(path.join(ROOT, 'ar', 'market-news'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'ar', 'market-news', `${slug}.html`), arDoc.html, 'utf8');
  const cov = readJson(RESEARCH_COVERAGE, { version: '1.0', published: [] });
  cov.published = (cov.published || []).concat([{ topic: topic.id, slug, published_at: new Date().toISOString() }]).slice(-120);
  cov.updated_at = new Date().toISOString();
  fs.writeFileSync(RESEARCH_COVERAGE, JSON.stringify(cov, null, 2) + '\n', 'utf8');
  console.log(`[daily-research] published /market-news/${slug}.html + /ar/market-news/${slug}.html`);
  return { published: true, slug, topic: topic.id };
}

// ── Phase 116: Institutional Technical Structure Brain ────────────────────────
// Publishes deterministic market-STRUCTURE notes (participation, volatility
// structure, cross-asset coherence, rotation, concentration, persistence,
// stability) from the structure engine artifact — institutional interpretation,
// NOT retail TA. Reuses the article wrapper, rail, inline panels and quality
// gate on the dedicated /market-structure/ surface.
const STRUCTURE_ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'market-structure.json');
const TACTICAL_ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const STRUCTURE_COVERAGE = path.join(ROOT, 'data', 'intelligence', 'structure-coverage.json');

// Phase 128 — concise institutional tactical-context section for the structure
// note. Reads the tactical-context artifact (deterministic, conditional) and
// renders an anti-certainty, advice-free snapshot. Returns '' (omits the
// section) when the tactical read is unavailable — honest degradation. Topic
// focus is woven in so the section is not identical across notes.
function renderTacticalSection(focusName, locale) {
  const ar = locale === 'ar';
  const t = (en, arT) => (ar ? arT : en);
  let tac; try { tac = JSON.parse(fs.readFileSync(TACTICAL_ARTIFACT, 'utf8')); } catch { return ''; }
  if (!tac || !tac.available) return '';
  const d = tac.dimensions || {};
  const lab = (k) => (d[k] ? (ar ? d[k].label_ar : d[k].label_en) : (ar ? 'غير محدد' : 'indeterminate'));
  const band = ar ? tac.confidence_band_ar : tac.confidence_band_en;
  const head = t('Tactical context', 'السياق التكتيكي');
  const copy = `<p class="market-copy">${esc(t(
    `Set against this structure, the desk's tactical read is conditional, not directional. The environment reads ${lab('tactical_bias')}, with ${lab('directional_pressure')} directional pressure and ${lab('continuation')}. Beneath the index, the read is ${lab('participation_quality')} alongside ${lab('liquidity_support')} — held on ${band} confidence. This is probabilistic context for how ${focusName.toLowerCase()} may be absorbed, not a forecast or a recommendation.`,
    `في مقابل هذه البنية، تكون القراءة التكتيكية للمكتب مشروطة لا اتجاهية. تقرأ البيئة ${lab('tactical_bias')}، مع ضغط اتجاهي ${lab('directional_pressure')} و${lab('continuation')}. وتحت سطح المؤشر تظهر ${lab('participation_quality')} مع ${lab('liquidity_support')} — بثقة ${band}. وهذا سياق احتمالي لكيفية امتصاص ${focusName}، لا توقعاً ولا توصية.`,
  ))}</p>`;
  return `<section class="market-section" id="tactical-context"><div class="market-section-head"><span class="eyebrow">${esc(t('Tactical desk', 'المكتب التكتيكي'))}</span><h2>${esc(head)}</h2></div><div class="market-panel">${copy}</div></section>`;
}
const STRUCTURE_COOLDOWN_DAYS = 4;
const STRUCTURE_TOPICS = [
  { id: 'participation_breadth', focus: 'participation', en: 'Participation and breadth beneath the index', ar: 'المشاركة والاتساع تحت سطح المؤشر' },
  { id: 'volatility_structure', focus: 'volatility_structure', en: 'Volatility structure and the absorption of stress', ar: 'بنية التذبذب وامتصاص الضغوط' },
  { id: 'cross_asset_structure', focus: 'cross_asset', en: 'Cross-asset structure and coherence', ar: 'البنية عبر الأصول والاتساق' },
  { id: 'rotation_concentration', focus: 'rotation', en: 'Leadership rotation and concentration structure', ar: 'تدوير القيادة وبنية التركّز' },
  { id: 'structural_stability', focus: 'stability', en: 'Structural stability and liquidity participation', ar: 'الاستقرار الهيكلي ومشاركة السيولة' },
];
// Hard-blocked retail / signal vocabulary the structure desk must never emit.
const STRUCTURE_FORBIDDEN = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bentry\b/i, /\bstop loss\b/i, /\btake profit\b/i,
  /\bto the moon\b/i, /\bmoon\b/i, /\bbreakout trade\b/i, /\boversold\b/i, /\boverbought\b/i,
  /\bbullish signal\b/i, /\bbearish signal\b/i, /\balpha call\b/i, /\bsniper\b/i,
  /\btarget price\b/i, /\bprice target\b/i, /\bnext move guaranteed\b/i, /\bguaranteed\b/i,
  /\bRSI\b/, /\bMACD\b/, /\bbuy signal\b/i, /\bsell signal\b/i,
];

function selectStructureTopic() {
  const cov = readJson(STRUCTURE_COVERAGE, { published: [] });
  const recent = new Map((cov.published || []).map((c) => [c.topic, c.published_at]));
  const cutoff = Date.now() - STRUCTURE_COOLDOWN_DAYS * 86400000;
  const start = dayOfYear(new Date()) % STRUCTURE_TOPICS.length;
  for (let i = 0; i < STRUCTURE_TOPICS.length; i += 1) {
    const topic = STRUCTURE_TOPICS[(start + i) % STRUCTURE_TOPICS.length];
    const last = recent.get(topic.id);
    if (!last || Date.parse(last) < cutoff) return topic;
  }
  return null; // all cooled — skip (no spam)
}

// Native-Arabic-aware label for a structure dimension state from the artifact.
function sLabel(structure, dim, ar) {
  const d = structure.dimensions && structure.dimensions[dim];
  if (!d) return ar ? 'غير محدد' : 'indeterminate';
  return ar ? d.label_ar : d.label_en;
}

// Each topic leads with a DISTINCT deep treatment of its focus dimension and a
// topic-specific set of supporting reads, so two topics produce substantially
// different prose (the duplicate-narrative validator enforces this). The deep
// paragraph per focus is unique; supports and the watch close vary by topic.
function structureFocusDeep(focus, L, t) {
  const D = {
    participation: () => t(`Participation is the structural core of this note, and it reads ${L('participation')}. Breadth answers whether index strength is shared across the market or carried by a narrow set of leaders — the same level can sit on broad participation or on a handful of names, and the two behave very differently when stress arrives. The desk reads this through index-level leadership, the regime breadth sub-state and the multi-session breadth memory rather than any oscillator, because the question is the quality of the advance, not its label. A market making highs on narrowing participation is structurally weaker than one grinding sideways with broad participation, even when the headline level says the opposite.`,
      `المشاركة هي اللب الهيكلي لهذه المذكرة، وتقرأ ${L('participation')}. ويجيب الاتساع عمّا إذا كانت قوة المؤشر موزّعة عبر السوق أم محمولة على مجموعة ضيقة من القادة — فالمستوى نفسه قد يستند إلى مشاركة واسعة أو إلى حفنة من الأسماء، وتتصرف الحالتان تصرفاً مختلفاً تماماً عند وصول الضغط. ويقرأ المكتب ذلك عبر قيادة مستوى المؤشر وحالة اتساع النظام والذاكرة متعددة الجلسات بدل أي مذبذب، لأن السؤال هو جودة الصعود لا تسميته. فالسوق الذي يسجّل قمماً على مشاركة آخذة في التضيّق أضعف هيكلياً من سوق يتحرك جانبياً بمشاركة واسعة، حتى لو قال المستوى المعلن عكس ذلك.`),
    volatility_structure: () => t(`Volatility structure is the focus here, and it reads ${L('volatility_structure')}. Compression is not the same as stability: a quiet tape can reflect genuine balance, or a temporary absence of force ahead of a catalyst, and the two carry opposite risk. The desk reads volatility as the market's pricing of how much it expects to move, then asks whether that pricing is consistent with participation and cross-asset coherence. Compression that coincides with narrowing breadth is a more fragile structure than compression on broad participation, because the cushion is thinner if the tape is forced to reprice. Calm is a starting condition to interrogate, not a conclusion to rest on.`,
      `بنية التذبذب هي محور التركيز هنا، وتقرأ ${L('volatility_structure')}. والانضغاط ليس كالاستقرار: فالسوق الهادئ قد يعكس توازناً حقيقياً، أو غياباً مؤقتاً للقوة قبل محفز، وتحمل الحالتان مخاطرة متعاكسة. ويقرأ المكتب التذبذب بوصفه تسعير السوق لمقدار ما يتوقع أن يتحرك، ثم يسأل ما إذا كان ذلك التسعير متسقاً مع المشاركة والاتساق عبر الأصول. فالانضغاط المتزامن مع اتساع آخذ في التضيّق بنية أهش من الانضغاط على مشاركة واسعة، لأن الوسادة أرقّ إذا اضطر السوق لإعادة التسعير. فالهدوء حالة بداية تُستجوب لا خلاصة يُستراح إليها.`),
    cross_asset: () => t(`Cross-asset coherence is the subject of this note, and it reads ${L('cross_asset')}. Coherence is the degree to which rates, the dollar, equities and gold are telling the same story — a coherent tape transmits a shock cleanly, while a divergent one fragments it, and divergences are often where structure changes first. The desk reads the coherence score and direction from the cross-asset state and the structural-tension layer, not from any single pair. When equities and the dollar disagree, or yields move against risk, the structure is carrying an unresolved tension even if the index level looks calm — and that tension is the structural signal worth tracking, well before it resolves into a regime change.`,
      `الاتساق عبر الأصول هو موضوع هذه المذكرة، ويقرأ ${L('cross_asset')}. والاتساق هو درجة رواية العوائد والدولار والأسهم والذهب القصة نفسها — فالسوق المتسق ينقل الصدمة بوضوح، بينما يُجزّئها السوق المتباعد، وكثيراً ما تكون التباعدات حيث تتغير البنية أولاً. ويقرأ المكتب درجة الاتساق واتجاهه من حالة الأصول المتقاطعة وطبقة التوتر الهيكلي، لا من أي زوج منفرد. وحين تختلف الأسهم والدولار، أو تتحرك العوائد ضد المخاطر، تحمل البنية توتراً غير محلول حتى لو بدا مستوى المؤشر هادئاً — وذلك التوتر هو الإشارة الهيكلية الجديرة بالتتبع، قبل وقت طويل من تبلوره في تغيّر للنظام.`),
    rotation: () => t(`Leadership rotation is the focus of this note, and it reads ${L('rotation')}. Rotation tells the desk whether defensive or cyclical leadership dominates, and it is one of the cleaner reads on what participants are actually positioning for beneath the index level. Defensive leadership — utilities, staples, healthcare carrying the tape — is a different structure from cyclical leadership even at the same index level, because it signals where conviction is concentrated. The desk reads rotation from the regime defensive sub-state and the observed sector leadership composition, and treats defensive rotation under otherwise broad participation as a genuinely mixed structure rather than collapsing it into a single directional call.`,
      `تدوير القيادة هو محور هذه المذكرة، ويقرأ ${L('rotation')}. ويخبر التدوير المكتب بما إذا كانت القيادة دفاعية أم دورية، وهو من أوضح القراءات لما يتمركز له المشاركون فعلاً تحت مستوى المؤشر. فالقيادة الدفاعية — المرافق والسلع الأساسية والرعاية الصحية تحمل السوق — بنية مختلفة عن القيادة الدورية حتى عند المستوى نفسه، لأنها تشير إلى حيث تتركز القناعة. ويقرأ المكتب التدوير من حالة الدفاع في النظام وتركيب قيادة القطاعات المرصودة، ويعدّ التدوير الدفاعي في ظل مشاركة واسعة بقية الأبعاد بنية مختلطة فعلاً بدل دمجها في حكم اتجاهي واحد.`),
    stability: () => t(`Structural stability is the focus here, and it reads ${L('stability')}. Stability frames how much stress the structure can absorb before it changes character — a stable structure can take a surprise and hold its shape, while a fragile one re-rates on a smaller shock. The desk reads stability from the regime stability state, the structural-tension level and the multi-session fragility memory, and crucially weights persistence: a structure that has held across several verified sessions earns more confidence than a single-session snapshot. Stability is not the absence of movement; it is the capacity to absorb movement without the underlying participation, coherence and rotation breaking down together.`,
      `الاستقرار الهيكلي هو محور التركيز هنا، ويقرأ ${L('stability')}. ويؤطّر الاستقرار مقدار الضغط الذي تمتصه البنية قبل أن تتغير طبيعتها — فالبنية المستقرة تتحمّل مفاجأة وتحافظ على شكلها، بينما تعيد الهشة التسعير على صدمة أصغر. ويقرأ المكتب الاستقرار من حالة استقرار النظام ومستوى التوتر الهيكلي وذاكرة الهشاشة متعددة الجلسات، ويرجّح الاستمرارية بصورة حاسمة: فالبنية التي صمدت عبر عدة جلسات موثّقة تكتسب ثقة أكبر من لقطة جلسة واحدة. والاستقرار ليس غياب الحركة؛ بل القدرة على امتصاص الحركة دون أن تنهار المشاركة والاتساق والتدوير معاً.`),
  };
  return (D[focus] || D.participation)();
}

function structureBrief(dim, L, t) {
  const B = {
    participation: () => t(`Participation alongside this reads ${L('participation')} — the breadth context that tells the desk whether the focus structure is supported by the broad market or leaning on a narrow set of leaders.`,
      `المشاركة إلى جانب ذلك تقرأ ${L('participation')} — سياق الاتساع الذي يخبر المكتب ما إذا كانت بنية التركيز مدعومة بالسوق العريض أم متّكئة على مجموعة ضيقة من القادة.`),
    volatility_structure: () => t(`Volatility structure reads ${L('volatility_structure')} — the desk reads this as the market's pricing of expected movement, and asks whether calm reflects balance or a thin cushion ahead of a catalyst.`,
      `بنية التذبذب تقرأ ${L('volatility_structure')} — ويقرأ المكتب ذلك بوصفه تسعير السوق للحركة المتوقعة، ويسأل ما إذا كان الهدوء يعكس توازناً أم وسادة رقيقة قبل محفز.`),
    cross_asset: () => t(`Cross-asset coherence reads ${L('cross_asset')} — whether rates, the dollar and equities are telling the same story, which decides whether a shock would transmit cleanly or fragment across the tape.`,
      `الاتساق عبر الأصول يقرأ ${L('cross_asset')} — ما إذا كانت العوائد والدولار والأسهم تروي القصة نفسها، وهو ما يقرر ما إذا كانت الصدمة ستنتقل بوضوح أم تتجزّأ عبر السوق.`),
    rotation: () => t(`Leadership rotation reads ${L('rotation')} — defensive versus cyclical leadership is the desk's read on where conviction is concentrated beneath the headline level.`,
      `تدوير القيادة يقرأ ${L('rotation')} — والقيادة الدفاعية مقابل الدورية هي قراءة المكتب لحيث تتركز القناعة تحت المستوى المعلن.`),
    concentration: () => t(`Concentration reads ${L('concentration')} — how much of the move depends on a small set of names, which is the difference between a durable advance and one exposed to a single leadership group.`,
      `التركّز يقرأ ${L('concentration')} — مقدار اعتماد الحركة على مجموعة صغيرة من الأسماء، وهو الفرق بين صعود متين وآخر مكشوف لمجموعة قيادة واحدة.`),
    momentum: () => t(`The momentum structure reads ${L('momentum')} — whether leadership is broadening or narrowing, which the desk treats as the early tell on whether the structure is strengthening or quietly deteriorating.`,
      `بنية الزخم تقرأ ${L('momentum')} — ما إذا كانت القيادة تتسع أم تضيق، وهو ما يعدّه المكتب المؤشر المبكر على ما إذا كانت البنية تتقوّى أم تتدهور بهدوء.`),
    liquidity_participation: () => t(`Liquidity participation reads ${L('liquidity_participation')} — whether real flow is behind the move or whether it is thinning, which is the difference between an absorbable advance and an exhausted one.`,
      `مشاركة السيولة تقرأ ${L('liquidity_participation')} — ما إذا كان تدفق حقيقي خلف الحركة أم أنها تترقّق، وهو الفرق بين صعود قابل للامتصاص وآخر مستنزَف.`),
    persistence: () => t(`Persistence reads ${L('persistence')} — the honest record of how many verified sessions actually support the read, so a structure that has held earns more weight than a single snapshot.`,
      `الاستمرارية تقرأ ${L('persistence')} — السجل الأمين لعدد الجلسات الموثّقة التي تدعم القراءة فعلاً، فتكتسب البنية التي صمدت وزناً أكبر من لقطة منفردة.`),
    stability: () => t(`Structural stability reads ${L('stability')} — how much stress the structure can absorb before it changes character, the frame the desk holds every other dimension against.`,
      `الاستقرار الهيكلي يقرأ ${L('stability')} — مقدار الضغط الذي تمتصه البنية قبل أن تتغير طبيعتها، وهو الإطار الذي يقيس المكتب عليه كل بُعد آخر.`),
  };
  return (B[dim] || B.participation)();
}

const STRUCTURE_PLAN = {
  participation_breadth: { focus: 'participation', supports: ['concentration', 'momentum'] },
  volatility_structure: { focus: 'volatility_structure', supports: ['cross_asset', 'liquidity_participation'] },
  cross_asset_structure: { focus: 'cross_asset', supports: ['volatility_structure', 'rotation'] },
  rotation_concentration: { focus: 'rotation', supports: ['concentration', 'participation'] },
  structural_stability: { focus: 'stability', supports: ['liquidity_participation', 'persistence'] },
};

const STRUCTURE_HEADS = {
  participation: ['Participation and breadth', 'المشاركة والاتساع'],
  volatility_structure: ['Volatility structure', 'بنية التذبذب'],
  cross_asset: ['Cross-asset coherence', 'الاتساق عبر الأصول'],
  rotation: ['Leadership rotation', 'تدوير القيادة'],
  stability: ['Structural stability', 'الاستقرار الهيكلي'],
  concentration: ['Concentration', 'التركّز'],
  momentum: ['Momentum structure', 'بنية الزخم'],
  liquidity_participation: ['Liquidity participation', 'مشاركة السيولة'],
  persistence: ['Persistence', 'الاستمرارية'],
};

function renderStructureBody(ctx, locale) {
  const ar = locale === 'ar';
  const t = (en, arT) => (ar ? arT : en);
  const s = ctx.structure || {};
  const topic = (ctx.structure_topic) || STRUCTURE_TOPICS[0];
  const plan = STRUCTURE_PLAN[topic.id] || STRUCTURE_PLAN.participation_breadth;
  const title = ar ? topic.ar : topic.en;
  const eyebrow = t('Institutional Market Structure', 'بنية السوق المؤسسية');
  const conf = s.structural_confidence != null ? s.structural_confidence : null;
  const dom = s.dominant ? sLabel(s, s.dominant.dimension, ar) : null;
  const L = (dim) => sLabel(s, dim, ar);
  const focusName = ar ? STRUCTURE_HEADS[plan.focus][1] : STRUCTURE_HEADS[plan.focus][0];

  const sections = [];
  const sec = (id, head, copy) => sections.push(`<section class="market-section" id="${id}"><div class="market-section-head"><span class="eyebrow">${esc(t('Structure desk', 'مكتب البنية'))}</span><h2>${esc(head)}</h2></div><div class="market-panel">${copy}</div></section>`);
  const p = (str) => `<p class="market-copy">${esc(str)}</p>`;

  // 1) Lead — topic-specific opening (focus + dominant) + shared honesty clause.
  sec('lead', ar ? topic.ar : topic.en,
    p(t(`This note reads the market through one structural lens — ${focusName.toLowerCase()} — set within the desk's wider structure read, where the most salient feature across all dimensions is ${dom || 'an indeterminate structure'} and the composite carries a structural confidence of ${conf != null ? conf : 'n/a'}/100. Structure is the question of what the surface level is built on, not where it goes next, so the focus below is the quality of ${focusName.toLowerCase()} rather than any forecast of price.`,
      `تقرأ هذه المذكرة السوق عبر عدسة هيكلية واحدة — ${focusName} — ضمن قراءة البنية الأوسع لدى المكتب، حيث أبرز ملمح عبر جميع الأبعاد هو ${dom || 'بنية غير محددة'} وتحمل القراءة المركبة ثقة هيكلية تبلغ ${conf != null ? conf : 'غير متاح'}/100. والبنية مسألة ما يستند إليه المستوى السطحي لا وجهته التالية، لذا فإن التركيز أدناه على جودة ${focusName} بدل أي تنبؤ بالسعر.`))
    + p(t('It is a deterministic composition of verified upstream signals — the liquidity-regime engine, the cross-asset coherence read, the structural-tension layer and multi-session memory. The research-desk intelligence rail alongside this note carries the regime snapshot the structure read is measured against, and where a dimension lacks sufficient evidence it is reported as indeterminate rather than inferred.',
      'وهي تركيب حتمي لإشارات منبع موثّقة — محرك نظام السيولة، وقراءة الاتساق عبر الأصول، وطبقة التوتر الهيكلي، والذاكرة متعددة الجلسات. ويحمل مسار استخبارات مكتب الأبحاث المرافق لهذه المذكرة لقطة النظام التي تُقاس عليها قراءة البنية، وحين يفتقر بُعد إلى أدلة كافية يُذكر بوصفه غير محدد بدل استنتاجه.')));

  // 2) Focus — the deep, topic-distinct treatment of the lead dimension.
  sec(plan.focus === 'stability' ? 'regime' : plan.focus, focusName, p(structureFocusDeep(plan.focus, L, t)));

  // 2b) Real sourced OHLCV chart as chart-first structural evidence (when a
  // verified institutional chart applies to this surface/topic). Omitted cleanly
  // when no real chart is available — never a placeholder.
  const chartFig = institutionalChartFigures('market-structure', topic.id, locale);

  // 3) Supporting reads — topic-specific selection of other dimensions.
  for (const dim of plan.supports) {
    sec(`support-${dim}`, ar ? STRUCTURE_HEADS[dim][1] : STRUCTURE_HEADS[dim][0], p(structureBrief(dim, L, t)));
  }

  // 3b) Tactical context — conditional, advice-free institutional snapshot.
  const tacticalSection = renderTacticalSection(focusName, locale);
  if (tacticalSection) sections.push(tacticalSection);

  // 4) Watch — closes on the focus dimension specifically.
  sec('watch-next', t('What the desk watches', 'ما يراقبه المكتب'),
    p(t(`From here the desk watches ${focusName.toLowerCase()} specifically — whether it strengthens, holds or breaks down as catalysts arrive — and how it interacts with the rest of the structure. Structure analysis is continuous: this note is one reading of ${focusName.toLowerCase()} in a sequence, and the value is in how it evolves across verified sessions rather than in any single snapshot.`,
      `ومن هنا يراقب المكتب ${focusName} تحديداً — ما إذا كانت تتقوّى أو تثبت أو تنهار مع وصول المحفزات — وكيف تتفاعل مع بقية البنية. وتحليل البنية مستمر: فهذه المذكرة قراءة لـ${focusName} ضمن سلسلة، والقيمة في كيفية تطوّرها عبر الجلسات الموثّقة لا في أي لقطة منفردة.`)));

  const focusSectionId = plan.focus === 'stability' ? 'regime' : plan.focus;
  const baseBody = chartFig ? sections.join('\n') : injectPanels(sections.join('\n'), ctx, locale);
  const body = injectFigureAfterSection(baseBody, focusSectionId, chartFig);
  const wordCount = body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { title, eyebrow, body, wordCount };
}

function publishStructure(write) {
  const structure = readJson(STRUCTURE_ARTIFACT, {});
  if (!structure.available) {
    console.log('[market-structure] structure read unavailable / indeterminate — no honest structure note to publish, exiting green.');
    return { published: false, reason: 'structure_unavailable' };
  }
  const topic = selectStructureTopic();
  if (!topic) {
    console.log('[market-structure] all structure topics within cooldown — exiting green with no publish (no spam).');
    return { published: false, reason: 'all_topics_cooled' };
  }
  const regime = readJson(REGIME, {});
  const reactions = readJson(REACTIONS, { reactions: [] });
  const reaction = (reactions.reactions || []).find((r) => r.has_reaction_data) || null;
  const ctx = { structure, structure_topic: topic, regime, cross: readJson(CROSS, { assets: [] }), reaction };
  const slug = `structure-${topic.id.replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}`;

  const en = assembleHtml(ctx, 'en', slug, renderStructureBody, 'market-structure');
  const arDoc = assembleHtml(ctx, 'ar', slug, renderStructureBody, 'market-structure');
  if (en.wordCount < MIN_WORDS.en || arDoc.wordCount < MIN_WORDS.ar) {
    console.log(`[market-structure] below word floor (en=${en.wordCount}/${MIN_WORDS.en}, ar=${arDoc.wordCount}/${MIN_WORDS.ar}) — not publishing.`);
    return { published: false, reason: 'below_min_words' };
  }
  const enText = renderStructureBody(ctx, 'en').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  const arText = renderStructureBody(ctx, 'ar').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  // Hard guard: never publish retail/signal vocabulary (the validator enforces
  // the same list on disk; this prevents an un-green publish in the first place).
  for (const re of STRUCTURE_FORBIDDEN) {
    if (re.test(enText) || re.test(arText)) {
      console.log(`[market-structure] forbidden retail/signal language ${re} — not publishing.`);
      return { published: false, reason: 'forbidden_language' };
    }
  }
  const quality = scoreArticle({ en: enText, ar: arText });
  if (quality.flags.length || quality.min_score < QUALITY_FLOOR) {
    console.log(`[market-structure] editorial-quality gate failed (min_score=${quality.min_score}, flags=${JSON.stringify(quality.flags)}) — not publishing.`);
    return { published: false, reason: 'below_quality_floor' };
  }
  console.log(`[market-structure] topic "${topic.id}" → ${slug} (en=${en.wordCount}w/${quality.en.score} ar=${arDoc.wordCount}w/${quality.ar.score})`);
  if (!write) return { published: false, reason: 'dry_run', slug };

  fs.mkdirSync(path.join(ROOT, 'market-structure'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'ar', 'market-structure'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'market-structure', `${slug}.html`), en.html, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'ar', 'market-structure', `${slug}.html`), arDoc.html, 'utf8');
  const cov = readJson(STRUCTURE_COVERAGE, { version: '1.0', published: [] });
  cov.published = (cov.published || []).concat([{ topic: topic.id, slug, published_at: new Date().toISOString() }]).slice(-120);
  cov.updated_at = new Date().toISOString();
  fs.writeFileSync(STRUCTURE_COVERAGE, JSON.stringify(cov, null, 2) + '\n', 'utf8');
  console.log(`[market-structure] published /market-structure/${slug}.html + /ar/market-structure/${slug}.html`);
  return { published: true, slug, topic: topic.id };
}

function assembleHtml(ctx, locale, slug, bodyFn = renderArticle, surfaceKey = 'market-news') {
  const ar = locale === 'ar';
  const surface = SURFACES[surfaceKey] || SURFACES['market-news'];
  const indexPath = ar ? surface.arIndex : surface.enIndex;
  const tmpl = fs.readFileSync(indexPath, 'utf8');
  const hs = tmpl.indexOf('<!-- GLOBAL_HEADER_START -->');
  const he = tmpl.indexOf('<!-- GLOBAL_HEADER_END -->') + '<!-- GLOBAL_HEADER_END -->'.length;
  const headerBlock = tmpl.slice(hs, he);
  const footer = tmpl.slice(tmpl.indexOf('</main>') + '</main>'.length);
  const { title, eyebrow, body, wordCount } = bodyFn(ctx, locale);

  const base = ar ? `/ar/${surface.dir}/` : `/${surface.dir}/`;
  const altEn = `https://www.tradealphaai.com/${surface.dir}/${slug}.html`;
  const altAr = `https://www.tradealphaai.com/ar/${surface.dir}/${slug}.html`;
  const canonical = ar ? altAr : altEn;
  const disc = ar ? surface.discAr : surface.discEn;
  const home = ar ? '/ar/' : '/';
  const newsLabel = ar ? surface.labelAr : surface.labelEn;
  const homeLabel = ar ? 'الرئيسية' : 'Home';
  const dateISO = new Date().toISOString().slice(0, 10);

  const head = `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}"${ar ? ' dir="rtl"' : ''}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(title)} — ${esc(disc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${altEn}" />
  <link rel="alternate" hreflang="ar" href="${altAr}" />
  <link rel="alternate" hreflang="x-default" href="${altEn}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="article:published_time" content="${dateISO}" />
  <meta property="article:section" content="${esc(surface.section)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: title, description: disc, datePublished: dateISO, dateModified: dateISO, inLanguage: ar ? 'ar' : 'en', author: { '@type': 'Organization', name: 'TradeAlphaAI Markets Desk' }, publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' }, mainEntityOfPage: canonical })}</script>
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
</head>
<body class="market-page" data-market-news-article="v1" data-editorial-intelligence="v2">`;

  const main = `<main class="market-shell"><div class="wrap">
  <nav class="breadcrumb"><a href="${home}">${esc(homeLabel)}</a><span>/</span><a href="${base}">${esc(newsLabel)}</a><span>/</span><span>${esc(title)}</span></nav>
  <header class="market-hero"><div class="market-hero-panel">
    <span class="eyebrow">${esc(eyebrow)}</span>
    <h1>${esc(title)}</h1>
    <p class="market-copy"><time datetime="${dateISO}">${dateISO}</time> · TradeAlphaAI Markets Desk</p>
  </div></header>
${renderIntelligenceRail(ctx, locale)}
${body}
  <section class="market-section" id="news-disclaimer"><div class="market-panel"><h2>${esc(ar ? 'إخلاء المسؤولية التعليمي' : 'Educational disclaimer')}</h2><p class="market-copy">${esc(disc)}</p></div></section>
</div></main>`;

  return { html: `${head}\n${headerBlock}\n${main}\n${footer}`, wordCount };
}

function publish(write) {
  const elig = selectEvent();
  if (!elig) {
    console.log('[market-news-article] no eligible event qualifies — exiting green with NO publish.');
    return { published: false, reason: 'no_eligible_event' };
  }
  const ctx = gatherContext(elig);
  const slug = `${slugify(elig.headline || (ctx.event && ctx.event.event) || 'macro-event')}-${new Date().toISOString().slice(0, 10)}`;

  const en = assembleHtml(ctx, 'en', slug);
  const arDoc = assembleHtml(ctx, 'ar', slug);
  // Arabic institutional prose is naturally more compact than English for the
  // same content, so the floor is locale-aware (both are substantial long-form).
  if (en.wordCount < MIN_WORDS.en || arDoc.wordCount < MIN_WORDS.ar) {
    console.log(`[market-news-article] quality gate: article too short (en=${en.wordCount}/${MIN_WORDS.en}, ar=${arDoc.wordCount}/${MIN_WORDS.ar}) — NOT publishing.`);
    return { published: false, reason: 'below_min_words' };
  }

  // Phase 109: editorial-quality gate. Score the rendered bodies for flow,
  // repetition, filler/cliché, retail TA, predictions and null leaks. A piece
  // must be flag-free and clear the quality floor in BOTH languages to publish.
  const enText = renderArticle(ctx, 'en').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  const arText = renderArticle(ctx, 'ar').body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  const quality = scoreArticle({ en: enText, ar: arText });
  if (quality.flags.length || quality.min_score < QUALITY_FLOOR) {
    console.log(`[market-news-article] editorial-quality gate failed (min_score=${quality.min_score}/${QUALITY_FLOOR}, flags=${JSON.stringify(quality.flags)}) — NOT publishing.`);
    return { published: false, reason: 'below_quality_floor', quality };
  }
  console.log(`[market-news-article] editorial quality: en=${quality.en.score} ar=${quality.ar.score} (floor ${QUALITY_FLOOR}, flag-free)`);

  console.log(`[market-news-article] selected "${elig.headline}" (significance ${elig.significance}) → slug ${slug} (en=${en.wordCount}w, ar=${arDoc.wordCount}w)`);
  if (!write) { console.log('[market-news-article] dry-run — not writing.'); return { published: false, reason: 'dry_run', slug, ctx }; }

  fs.writeFileSync(path.join(ROOT, 'market-news', `${slug}.html`), en.html, 'utf8');
  fs.mkdirSync(path.join(ROOT, 'ar', 'market-news'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'ar', 'market-news', `${slug}.html`), arDoc.html, 'utf8');

  const coverage = readJson(COVERAGE, { version: '1.0', published: [] });
  coverage.published = (coverage.published || []).concat([{ event_id: elig.id, cluster: elig.cluster, slug, headline: elig.headline, significance: elig.significance, published_at: new Date().toISOString() }]).slice(-200);
  coverage.updated_at = new Date().toISOString();
  fs.writeFileSync(COVERAGE, JSON.stringify(coverage, null, 2) + '\n', 'utf8');

  console.log(`[market-news-article] published /market-news/${slug}.html + /ar/market-news/${slug}.html`);
  return { published: true, slug, event_id: elig.id };
}

if (require.main === module) {
  const r = publish(process.argv.includes('--write'));
  process.exit(0);
}

module.exports = { selectEvent, gatherContext, renderArticle, assembleHtml, publish, MIN_WORDS, publishResearch, renderResearchBody, selectResearchTopic, RESEARCH_TOPICS, RESEARCH_COOLDOWN_DAYS, RESEARCH_COVERAGE, publishStructure, renderStructureBody, selectStructureTopic, STRUCTURE_TOPICS, STRUCTURE_COOLDOWN_DAYS, STRUCTURE_COVERAGE, STRUCTURE_FORBIDDEN, STRUCTURE_ARTIFACT };
