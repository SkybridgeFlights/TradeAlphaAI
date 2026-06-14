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
const { scoreArticle, QUALITY_FLOOR } = require('./editorial-quality');
const { scoreVisual, VISUAL_QUALITY_FLOOR } = require('./visual-quality');

const ROOT = path.resolve(__dirname, '..');
const ELIG = path.join(ROOT, 'data', 'intelligence', 'news-eligibility.json');
const INTEL = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');
const REACTIONS = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const CHART_INTEL = path.join(ROOT, 'data', 'visual', 'chart-intelligence.json');
const MAX_PANELS = 2;
const COVERAGE = path.join(ROOT, 'data', 'intelligence', 'market-news-coverage.json');
const EN_INDEX = path.join(ROOT, 'market-news', 'index.html');
const AR_INDEX = path.join(ROOT, 'ar', 'market-news', 'index.html');
const MIN_WORDS = { en: 340, ar: 280 }; // institutional long-form floors (locale-aware)

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

  // 1. Lead — the structural reading the note exists to make (no event needed).
  sec('lead', t('The structural reading', 'القراءة الهيكلية'),
    p(t(`This research note steps back from any single release to read the structure of the tape itself. The prevailing regime is ${reg(rg.regime)}, with liquidity reading ${liq(rg.liquidity_state)} and stability ${stb(rg.stability)}. The research-desk intelligence rail alongside this note carries the same snapshot, and the analysis below works through what that structure means rather than forecasting where prices go next.`,
      `تتراجع هذه المذكرة خطوة إلى الوراء بعيداً عن أي إصدار منفرد لتقرأ بنية السوق نفسها. النظام السائد هو ${reg(rg.regime)}، مع سيولة ${liq(rg.liquidity_state)} واستقرار ${stb(rg.stability)}. ويحمل مسار استخبارات مكتب الأبحاث المرافق اللقطة ذاتها، ويعمل التحليل أدناه على ما تعنيه هذه البنية بدلاً من التنبؤ بوجهة الأسعار.`))
    + p(t('It is a deterministic reading drawn from the canonical liquidity-regime and cross-asset artifacts; where a dimension is unavailable it is stated plainly rather than inferred, so the note degrades honestly on a quiet tape instead of manufacturing a narrative.',
      'وهي قراءة حتمية مستمدة من مرجعَي نظام السيولة والأصول المتقاطعة المعتمدين؛ وحين يغيب بُعد ما يُذكر ذلك صراحة بدل استنتاجه، لتتراجع المذكرة بأمانة في الأسواق الهادئة بدلاً من تصنيع سردية.')));

  // 2. Regime / liquidity structure.
  sec('regime', t('Regime and liquidity structure', 'بنية النظام والسيولة'),
    p(rg.regime && rg.regime !== 'indeterminate'
      ? t(`A ${reg(rg.regime)} regime with ${liq(rg.liquidity_state)} liquidity frames how any incoming surprise will be absorbed. ${rg.narrative || ''} Cross-asset coherence reads ${coh != null ? coh : 'n/a'}, which matters because a coherent tape transmits a shock cleanly while an incoherent one fragments it across rates, the dollar and equities.`,
          `نظام ${reg(rg.regime)} مع سيولة ${liq(rg.liquidity_state)} يؤطّر كيفية امتصاص أي مفاجأة قادمة. ${rg.narrative || ''} ويقرأ الاتساق عبر الأصول ${coh != null ? coh : 'غير متاح'}، وهو ما يهمّ لأن السوق المتسق ينقل الصدمة بوضوح بينما يُجزّئها السوق غير المتسق عبر العوائد والدولار والأسهم.`)
      : t('The structural regime is currently indeterminate on the observed dimensions, so the desk withholds a regime overlay rather than asserting one.', 'النظام الهيكلي غير محدد حالياً وفق الأبعاد المرصودة، لذا يمتنع المكتب عن إسقاط نظام بدل افتراضه.')));

  // 3. Cross-asset structure.
  sec('cross-asset', t('Cross-asset structure', 'البنية عبر الأصول'),
    p(t(`Beneath the index, the desk reads participation through breadth (${riVal('', sub.breadth, ar)}), the dollar and yield posture, and whether defensive or cyclical leadership dominates (${riVal('', sub.defensive, ar)}). These dimensions decide whether strength is broad and absorbable or narrow and fragile — the same surface level can sit on very different structures.`,
      `تحت سطح المؤشر، يقرأ المكتب المشاركة عبر الاتساع (${riVal('', sub.breadth, ar)})، ووضع الدولار والعوائد، وما إذا كانت القيادة دفاعية أم دورية (${riVal('', sub.defensive, ar)}). وتحدد هذه الأبعاد ما إذا كانت القوة واسعة وقابلة للامتصاص أم ضيقة وهشة — فالمستوى السطحي ذاته قد يستند إلى بنى مختلفة تماماً.`)));

  // 4. Volatility / fragility.
  sec('volatility', t('Volatility and fragility', 'التذبذب والهشاشة'),
    p(t(`Volatility structure is reading ${riVal('', sub.volatility, ar)}. Compression is not the same as stability: a quiet tape can reflect genuine balance or a temporary absence of force ahead of a catalyst. The desk treats the difference as the central question rather than reading calm as safety.`,
      `تقرأ بنية التذبذب ${riVal('', sub.volatility, ar)}. والانضغاط ليس كالاستقرار: فالسوق الهادئ قد يعكس توازناً حقيقياً أو غياباً مؤقتاً للقوة قبل محفز. ويعدّ المكتب هذا الفرق السؤال المركزي بدل قراءة الهدوء على أنه أمان.`)));

  // 5. What the desk watches.
  sec('watch-next', t('What the desk watches', 'ما يراقبه المكتب'),
    p(t('The desk watches whether breadth confirms or undercuts the index, whether the dollar and yields move with or against risk, and whether the regime strengthens, holds or transitions as the next catalysts arrive. Continuity matters: this note is one reading in a sequence, and the value is in how the structure evolves, not in any single snapshot.',
      'يراقب المكتب ما إذا كان الاتساع يؤكد المؤشر أم يقوّضه، وما إذا كان الدولار والعوائد يتحركان مع المخاطر أم ضدها، وما إذا كان النظام يتقوّى أو يثبت أو ينتقل مع وصول المحفزات التالية. وتهمّ الاستمرارية: فهذه المذكرة قراءة ضمن سلسلة، والقيمة في كيفية تطوّر البنية لا في أي لقطة منفردة.')));

  const body = injectPanels(sections.join('\n'), ctx, locale);
  const wordCount = body.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { title, eyebrow, body, wordCount };
}

function publishResearch(write) {
  const regime = readJson(REGIME, {});
  // Honest gate: do not manufacture a note when the structural read is empty.
  if (!regime.regime || regime.regime === 'indeterminate') {
    console.log('[daily-research] regime indeterminate / unavailable — no honest research note to publish, exiting green.');
    return { published: false, reason: 'regime_unavailable' };
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

function assembleHtml(ctx, locale, slug, bodyFn = renderArticle) {
  const ar = locale === 'ar';
  const indexPath = ar ? AR_INDEX : EN_INDEX;
  const tmpl = fs.readFileSync(indexPath, 'utf8');
  const hs = tmpl.indexOf('<!-- GLOBAL_HEADER_START -->');
  const he = tmpl.indexOf('<!-- GLOBAL_HEADER_END -->') + '<!-- GLOBAL_HEADER_END -->'.length;
  const headerBlock = tmpl.slice(hs, he);
  const footer = tmpl.slice(tmpl.indexOf('</main>') + '</main>'.length);
  const { title, eyebrow, body, wordCount } = bodyFn(ctx, locale);

  const base = ar ? '/ar/market-news/' : '/market-news/';
  const altEn = `https://www.tradealphaai.com/market-news/${slug}.html`;
  const altAr = `https://www.tradealphaai.com/ar/market-news/${slug}.html`;
  const canonical = ar ? altAr : altEn;
  const disc = ar ? 'تحليل تعليمي لتفاعل السوق وسياقه الكلي، وليس نصيحة استثمارية أو توصية تداول.' : 'Educational analysis of market reaction and macro context. Not investment advice or a trading recommendation.';
  const home = ar ? '/ar/' : '/';
  const newsLabel = ar ? 'أخبار السوق' : 'Market News';
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
  <meta property="article:section" content="Market News" />
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

module.exports = { selectEvent, gatherContext, renderArticle, assembleHtml, publish, MIN_WORDS, publishResearch, renderResearchBody, selectResearchTopic, RESEARCH_TOPICS, RESEARCH_COOLDOWN_DAYS, RESEARCH_COVERAGE };
