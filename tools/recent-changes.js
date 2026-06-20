'use strict';

// Phase 216 CP9 — Recent Changes block (entity-page integration helper).
// Renders a `recent-changes` section for an entity detail page, sourced from
// data/intelligence/change-events.json filtered to the entity (entity_type +
// entity symbol). Honest — when no events match, surfaces the change-hub
// links rather than fabricating events.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
let cached = null;

function load() {
  if (cached) return cached;
  try { cached = JSON.parse(fs.readFileSync(J('change-events.json'), 'utf8')); } catch { cached = { events: [] }; }
  return cached;
}

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function recentChangesBlock(ar, entityType, symbol, options) {
  const opts = options || {};
  const limit = opts.limit || 6;
  const data = load();
  const events = (data.events || []).filter((e) => e.entity_type === entityType && String(e.entity).toUpperCase() === String(symbol).toUpperCase());
  const t = (en, arT) => (ar ? arT : en);
  const categoryHref = (() => {
    const p = entityType === 'asset' ? 'assets' : entityType === 'sector' ? 'sectors' : entityType === 'equity' ? 'equities' : entityType === 'etf' ? 'etfs' : null;
    if (!p) return null;
    return (ar ? '/ar' : '') + '/changes/' + p + '/';
  })();
  const hubHref = (ar ? '/ar' : '') + '/changes/';
  if (events.length === 0) {
    return `      <section class="market-section" id="recent-changes"><div class="market-section-head"><span class="eyebrow">${esc(t('Recent changes', 'التغيّرات الأخيرة'))}</span><h2>${esc(t('Change intelligence', 'استخبارات التغيير'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('No determinate change events have been observed for ' + symbol + ' yet. As the snapshot ledger accumulates, events will surface here automatically.', 'لم يُرصد بعد أي حدث تغيير حاسم لـ ' + symbol + '. مع تراكم اللقطات في السجل ستظهر الأحداث هنا تلقائياً.'))}</p>
        <p class="market-copy"><a href="${esc(hubHref)}">${esc(t('Open the Changes Hub', 'افتح مركز التغيّرات'))}</a>${categoryHref ? ' · <a href="' + esc(categoryHref) + '">' + esc(t('Category change center', 'مركز تغيّرات الفئة')) + '</a>' : ''}</p></div></section>`;
  }
  const eventsLi = events.slice(0, limit).map((e) => {
    const label = ar ? (e.label_ar || e.change_type) : (e.label_en || e.change_type);
    const time = e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 10) : '';
    const evidence = (e.evidence || []).slice(0, 1).join(' · ');
    const conf = e.confidence_en ? (ar ? e.confidence_ar : e.confidence_en) : '';
    return `<li><strong>${esc(label)}</strong>${time ? ' · ' + esc(time) : ''} · ${esc(evidence)}${conf ? ' · ' + esc(t('confidence', 'الثقة')) + ': ' + esc(conf) : ''}</li>`;
  }).join('\n');
  return `      <section class="market-section" id="recent-changes"><div class="market-section-head"><span class="eyebrow">${esc(t('Recent changes', 'التغيّرات الأخيرة'))}</span><h2>${esc(t('Change events for ' + symbol, 'أحداث تغيّر ' + symbol))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Observed change events derived from existing intelligence. Educational context only.', 'أحداث تغيّر مرصودة مشتقّة من الاستخبارات القائمة. سياق تعليمي فقط.'))}</p>
        <ul class="market-copy">${eventsLi}</ul>
        <p class="market-copy"><a href="${esc(hubHref)}">${esc(t('Open the Changes Hub', 'افتح مركز التغيّرات'))}</a>${categoryHref ? ' · <a href="' + esc(categoryHref) + '">' + esc(t('All ' + entityType + ' changes', 'جميع تغيّرات ' + entityType)) + '</a>' : ''}</p></div></section>`;
}

module.exports = { recentChangesBlock };
