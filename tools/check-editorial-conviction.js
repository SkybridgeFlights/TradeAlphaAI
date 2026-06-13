'use strict';

// Phase 90 validation — institutional conviction & specificity.
// Enforces that market-outlook articles read as institutional macro
// interpretation, not cautious educational summaries. On PENDING DRAFTS this
// gates (fail); on published pages it warns only (published content is never
// retro-failed — same discipline as check-editorial-cadence / narrative-realism).
//
// Detectors (body copy only):
//   - weak-hedge density        (remains uncertain / could potentially / …)
//   - generic-filler density    (market participants are watching / various factors / …)
//   - macro-specificity floor   (named instruments, levels, spreads, regimes)
//   - contradiction/conviction framing presence (confirms / does not confirm /
//     consensus / diverge / underpricing / what would invalidate)
//   - invalidation-awareness presence (a stated condition that would prove the read wrong)
// Hard signals (gate on drafts): fabricated-certainty and advice phrasing.
//
// Bilingual: EN and AR pattern sets. Listing/index pages excluded.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

// Weak hedging — the cautious filler Phase 90 targets.
const WEAK_HEDGE_EN = /\b(remains? uncertain|could potentially|it remains to be seen|only time will tell|may or may not|market participants are (watching|closely monitoring)|investors are watching|wait and see)\b/gi;
const WEAK_HEDGE_AR = /(يبقى غير مؤكد|قد يُحتمل|الوقت وحده كفيل|يترقب المستثمرون|قد يكون أو لا يكون|في انتظار ما ستؤول)/g;
// Generic filler — non-institutional padding.
const GENERIC_FILLER_EN = /\b(various (macroeconomic )?factors|a complex landscape|navigating (the|a) (complex|dynamic)|broadly speaking|at the end of the day|dynamic market (landscape|environment)|ever-evolving)\b/gi;
// Advice / fabricated certainty — hard signals.
const ADVICE_EN = /\b(you should (buy|sell)|buy now|sell now|guaranteed returns?|will (definitely|certainly) (rise|fall|rally|crash)|is going to (rise|fall|soar|plunge))\b/gi;
const ADVICE_AR = /(اشترِ الآن|بِع الآن|عوائد مضمونة|سيرتفع حتماً|سينخفض حتماً)/g;

// Conviction / contradiction framing — at least one must be present.
const CONVICTION_FRAMING_EN = /\b(confirms?|confirming|does not confirm|not confirming|fails to confirm|consensus|diverg|underpric|overlook|what changed|would invalidate|invalidate the|is pricing|are pricing|priced for)\b/i;
const CONVICTION_FRAMING_AR = /(يؤكد|لا يؤكد|القراءة السائدة|انفصال|يتجاهل|ما الذي تغير|يُبطل|يُسعّر|التسعير)/;
// Invalidation awareness specifically.
const INVALIDATION_EN = /\b(would invalidate|invalidate the (current )?(read|view|interpretation)|the read breaks if|prove (the|this) (read|view|interpretation) wrong|what would change (the|this) read)\b/i;
const INVALIDATION_AR = /(يُبطل (هذه )?القراءة|يُثبت خطأ القراءة|تنكسر القراءة إذا)/;
// Macro specificity anchors.
const SPECIFICITY_EN = /(\bVIX\b|\bDXY\b|\bQQQ\b|\bSPY\b|\bIWM\b|\bRSP\b|\bTLT\b|\bNVDA\b|\bUS10Y\b|\b10-year\b|yield curve|front end|breadth|equal-weight|basis points|\bbps\b|spread|vol(atility)? regime|term premium|real yields?|\d+(\.\d+)?%)/i;
const SPECIFICITY_AR = /(منحنى العائد|الاتساع|نقاط الأساس|التقلب|العوائد الحقيقية|الوزن المتساوي|فارق العائد|\d+(\.\d+)?%|VIX|DXY|QQQ|SPY)/;

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Analytical body only — exclude the formal disclaimer block and FAQ schema.
function articleBody(html) {
  let h = String(html || '');
  h = h.replace(/<section[^>]*id="disclaimer-block"[\s\S]*?<\/section>/gi, ' ');
  h = h.replace(/<section[^>]*id="footer-disclaimer"[\s\S]*?<\/section>/gi, ' ');
  return stripHtml(h);
}

function analyze(html, label, isArabic, gate) {
  const text = articleBody(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 150) return; // too short to assess
  const per1k = (n) => n / (words / 1000);

  const hedge = (text.match(isArabic ? WEAK_HEDGE_AR : WEAK_HEDGE_EN) || []).length;
  const filler = isArabic ? 0 : (text.match(GENERIC_FILLER_EN) || []).length;
  const advice = (text.match(isArabic ? ADVICE_AR : ADVICE_EN) || []).length;
  const hasConviction = (isArabic ? CONVICTION_FRAMING_AR : CONVICTION_FRAMING_EN).test(text);
  const hasInvalidation = (isArabic ? INVALIDATION_AR : INVALIDATION_EN).test(text);
  const hasSpecificity = (isArabic ? SPECIFICITY_AR : SPECIFICITY_EN).test(text);

  // Hard signal — advice/fabricated certainty fails even published (warns published, fails drafts).
  if (advice > 0) gate(`${label}: ${advice} advice/fabricated-certainty phrase(s) — institutional research carries no trade calls`);

  // Weak hedging overuse.
  if (hedge >= 3 || per1k(hedge) > 4) gate(`${label}: weak-hedge density ${hedge} (${per1k(hedge).toFixed(1)}/1k words) — replace caution with concrete conditionals`);
  // Generic filler.
  if (!isArabic && (filler >= 2 || per1k(filler) > 3)) gate(`${label}: generic-filler density ${filler} — institutional specificity required`);

  // Specificity floor.
  if (!hasSpecificity) gate(`${label}: no macro specificity anchor (instrument/level/spread/regime) — reads as generic`);
  // Conviction / contradiction framing.
  if (!hasConviction) gate(`${label}: no conviction/contradiction framing (pricing / confirms / diverges / underpricing / invalidation)`);
  // Invalidation awareness (warn — strong signal but the conviction framing test already covers the floor).
  if (!hasInvalidation) warnings.push(`${label}: no explicit invalidation condition stated`);
}

function scanDir(dir, isPublished) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return 0;
  let scanned = 0;
  const gate = isPublished ? (m) => warnings.push(m) : (m) => failures.push(m);
  for (const entry of fs.readdirSync(full)) {
    const p = path.join(full, entry);
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(p, f), 'utf8');
        const isArabic = /lang="ar"|dir="rtl"/.test(html.slice(0, 600)) || f.includes('-ar') || f === 'ar.html';
        analyze(html, `${dir}/${entry}/${f}`, isArabic, gate);
        scanned += 1;
      }
    } else if (entry.endsWith('.html') && entry !== 'index.html') {
      const html = fs.readFileSync(p, 'utf8');
      const isArabic = /lang="ar"|dir="rtl"/.test(html.slice(0, 600));
      analyze(html, `${dir}/${entry}`, isArabic, gate);
      scanned += 1;
    }
  }
  return scanned;
}

const draftCount = scanDir('drafts/market-outlook', false) + scanDir('drafts/educational', false);
const publishedCount = scanDir('market-outlook', true) + scanDir('articles', true) + scanDir('ar/articles', true);

console.log(`[editorial-conviction] scanned drafts=${draftCount} published=${publishedCount} warnings=${warnings.length} failures=${failures.length}`);
warnings.slice(0, 12).forEach((w) => console.warn(`[editorial-conviction] WARN: ${w}`));

if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-conviction] FAIL: ${f}`));
  process.exit(1);
}
console.log('[editorial-conviction] check:editorial-conviction passed.');
