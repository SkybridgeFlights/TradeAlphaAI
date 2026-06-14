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

const ROOT = path.resolve(__dirname, '..');
const ELIG = path.join(ROOT, 'data', 'intelligence', 'news-eligibility.json');
const INTEL = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');
const REACTIONS = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
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
      p(t(`The release lands in a ${rg.regime.replace(/_/g, ' ')} regime with ${String(rg.liquidity_state || '').replace(/_/g, ' ')} liquidity and ${rg.stability || ''} stability (cross-asset coherence ${rg.cross_asset_coherence && rg.cross_asset_coherence.score}). ${rg.narrative || ''}`,
        `يأتي الإصدار ضمن نظام ${rg.regime.replace(/_/g, ' ')} مع سيولة ${String(rg.liquidity_state || '').replace(/_/g, ' ')} واستقرار ${rg.stability || ''} (اتساق عبر الأصول ${rg.cross_asset_coherence && rg.cross_asset_coherence.score}).`)));
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

  const body = sections.join('\n');
  const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { title, eyebrow, body, wordCount };
}

function assembleHtml(ctx, locale, slug) {
  const ar = locale === 'ar';
  const indexPath = ar ? AR_INDEX : EN_INDEX;
  const tmpl = fs.readFileSync(indexPath, 'utf8');
  const hs = tmpl.indexOf('<!-- GLOBAL_HEADER_START -->');
  const he = tmpl.indexOf('<!-- GLOBAL_HEADER_END -->') + '<!-- GLOBAL_HEADER_END -->'.length;
  const headerBlock = tmpl.slice(hs, he);
  const footer = tmpl.slice(tmpl.indexOf('</main>') + '</main>'.length);
  const { title, eyebrow, body, wordCount } = renderArticle(ctx, locale);

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
  const enText = renderArticle(ctx, 'en').body.replace(/<[^>]+>/g, ' ');
  const arText = renderArticle(ctx, 'ar').body.replace(/<[^>]+>/g, ' ');
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

module.exports = { selectEvent, gatherContext, renderArticle, assembleHtml, publish, MIN_WORDS };
