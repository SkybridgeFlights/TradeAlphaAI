'use strict';

// ETF Intelligence Center — /etfs/data-audit/ (+ Arabic).
//
// The coverage ledger for the whole section: for every covered fund, which
// fields are verified, which are derived, which come from the project registry
// and which are awaiting a verified source. It is the site-wide counterpart to
// the per-fund provenance audit on each detail page.
//
// This page exists so the limits of the dataset are a published, checkable fact
// rather than something a reader has to infer by clicking through funds.
//
// Usage: node tools/generate-etf-audit-page.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr, stat } = shell;
const { UNIVERSE } = require('./etf-universe');
const P = require('./etf-provenance');
const { INFO_FIELDS, fieldLabel, classLabel } = require('./etf-detail-sections');

const ROOT = shell.ROOT;
const J = (name) => path.join(ROOT, 'data/intelligence', name);

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(name), 'utf8')); } catch { return fallback; }
}

function indexBySlug(artifact) {
  return new Map(((artifact && artifact.etfs) || []).map((e) => [e.slug, e]));
}

function section(id, eyebrow, title, inner, lead) {
  return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>
        ${lead ? `<p class="market-copy">${esc(lead)}</p>` : ''}
        ${inner}
      </section>`;
}

/** Coverage per field across the whole universe. */
function fieldCoverage(factsBySlug) {
  return INFO_FIELDS.map((name) => {
    const counts = { fetched: 0, derived: 0, registry: 0, declared: 0, unavailable: 0 };
    for (const entry of UNIVERSE) {
      const facts = factsBySlug.get(entry.slug);
      const record = facts && facts.fields ? facts.fields[name] : null;
      const cls = P.auditClass(name, record);
      if (counts[cls] !== undefined) counts[cls] += 1;
      else counts.unavailable += 1;
    }
    return { name, counts };
  });
}

function fieldTable(ar, coverage) {
  const t = tr(ar);
  const total = UNIVERSE.length;
  const rows = coverage.map(({ name, counts }) => {
    const covered = counts.fetched + counts.derived + counts.registry;
    const pctCovered = Math.round((covered / total) * 100);
    // A single stacked bar per field, in the validated categorical slots.
    const seg = (n, colour) => (n ? `<span class="etf-alloc-seg" style="inline-size:${(n / total) * 100}%;background:${colour}"></span>` : '');
    return `<tr>
            <th scope="row">${esc(fieldLabel(ar, name))}</th>
            <td class="num">${pctCovered}%</td>
            <td style="min-inline-size:200px">
              <div class="etf-alloc" style="block-size:14px">
                ${seg(counts.fetched, 'var(--etf-cat-3)')}${seg(counts.derived, 'var(--etf-cat-1)')}${seg(counts.registry, 'var(--market-gold)')}${seg(counts.unavailable, 'rgba(255,255,255,0.10)')}
              </div>
            </td>
            <td class="num">${counts.fetched}</td>
            <td class="num">${counts.derived}</td>
            <td class="num">${counts.registry}</td>
            <td class="num">${counts.unavailable}</td>
          </tr>`;
  }).join('\n          ');

  return `<div class="etf-table-wrap"><table class="etf-table">
          <thead><tr>
            <th scope="col">${esc(t('Field', 'الحقل'))}</th>
            <th scope="col" class="num">${esc(t('Covered', 'مغطى'))}</th>
            <th scope="col">${esc(t('Distribution', 'التوزيع'))}</th>
            <th scope="col" class="num">${esc(classLabel(ar, 'fetched'))}</th>
            <th scope="col" class="num">${esc(classLabel(ar, 'derived'))}</th>
            <th scope="col" class="num">${esc(t('Registry', 'السجل'))}</th>
            <th scope="col" class="num">${esc(t('Awaiting', 'بانتظار'))}</th>
          </tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table></div>
        <div class="etf-legend">
          <span class="etf-legend-item"><span class="etf-legend-swatch" style="background:var(--etf-cat-3)"></span>${esc(classLabel(ar, 'fetched'))}</span>
          <span class="etf-legend-item"><span class="etf-legend-swatch" style="background:var(--etf-cat-1)"></span>${esc(classLabel(ar, 'derived'))}</span>
          <span class="etf-legend-item"><span class="etf-legend-swatch" style="background:var(--market-gold)"></span>${esc(classLabel(ar, 'registry'))}</span>
          <span class="etf-legend-item"><span class="etf-legend-swatch" style="background:rgba(255,255,255,0.10)"></span>${esc(classLabel(ar, 'unavailable'))}</span>
        </div>`;
}

function fundTable(ar, factsBySlug, scoreBySlug) {
  const t = tr(ar);
  const rows = UNIVERSE.map((entry) => {
    const facts = factsBySlug.get(entry.slug);
    const counts = (facts && facts.provenance_counts) || {};
    const score = scoreBySlug.get(entry.slug);
    const name = facts && P.hasValue(facts.fields.fund_name) ? facts.fields.fund_name.value : entry.ticker;
    return `<tr>
            <td><a href="${esc(`${ar ? '/ar' : ''}/research/etfs/${entry.slug}/`)}"><strong>${esc(entry.ticker)}</strong></a><br /><span class="etf-source">${esc(name)}</span></td>
            <td class="num">${counts.fetched || 0}</td>
            <td class="num">${counts.derived || 0}</td>
            <td class="num">${counts.registry || 0}</td>
            <td class="num">${counts.unavailable || 0}</td>
            <td class="num">${score && score.overall !== null ? `${(score.model_coverage * 100).toFixed(0)}%` : `<span class="etf-awaiting">${esc(t(P.AWAITING_EN, P.AWAITING_AR))}</span>`}</td>
          </tr>`;
  }).join('\n          ');

  return `<div class="etf-table-wrap"><table class="etf-table">
          <thead><tr>
            <th scope="col">${esc(t('Fund', 'الصندوق'))}</th>
            <th scope="col" class="num">${esc(classLabel(ar, 'fetched'))}</th>
            <th scope="col" class="num">${esc(classLabel(ar, 'derived'))}</th>
            <th scope="col" class="num">${esc(t('Registry', 'السجل'))}</th>
            <th scope="col" class="num">${esc(t('Awaiting', 'بانتظار'))}</th>
            <th scope="col" class="num">${esc(t('Score coverage', 'تغطية الدرجة'))}</th>
          </tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table></div>`;
}

function body(ar, data) {
  const t = tr(ar);
  const totals = (data.facts_doc.coverage && data.facts_doc.coverage.totals) || {};
  const coverage = fieldCoverage(data.facts);

  const intro = `<div class="market-panel">
          <p class="market-copy">${esc(t(
    'This page is the coverage ledger for the ETF Intelligence Center. It states, field by field and fund by fund, what has been verified against a data provider, what TradeAlphaAI derived from verified inputs, what was inherited from the project registry, and what is still awaiting a verified source.',
    'هذه الصفحة هي سجل التغطية لمركز استخبارات الصناديق. وتبيّن، حقلا بحقل وصندوقا بصندوق، ما جرى توثيقه لدى مزود بيانات، وما اشتقته TradeAlphaAI من مدخلات موثّقة، وما وُرِث من سجل المشروع، وما لا يزال بانتظار مصدر موثّق.',
  ))}</p>
          <div class="etf-grid narrow" style="margin-block-start:16px">
            ${stat(t('Funds covered', 'الصناديق المغطاة'), String(UNIVERSE.length))}
            ${stat(classLabel(ar, 'fetched'), String(totals.fetched || 0), t('fields', 'حقلا'))}
            ${stat(classLabel(ar, 'derived'), String(totals.derived || 0), t('fields', 'حقلا'))}
            ${stat(t('Awaiting verified data', 'بانتظار بيانات موثّقة'), String(totals.unavailable || 0), t('fields', 'حقلا'))}
          </div>
        </div>`;

  const gap = `<div class="market-panel">
          <p class="market-copy">${esc(t(
    'The largest gap is deliberate. Expense ratios, ISINs, domicile, replication method, fund size and inception dates are not published by any free, checkable source. Rather than fill them from memory or approximation, they are marked awaiting verified data everywhere they would otherwise appear — including inside the score, where the cost component is currently excluded and its weight redistributed.',
    'أكبر فجوة هنا مقصودة. فنسب المصاريف وأرقام ISIN والمقر وطريقة المحاكاة وحجم الصندوق وتواريخ التأسيس لا ينشرها أي مصدر مجاني قابل للتحقق. وبدلا من ملئها من الذاكرة أو بالتقريب، تُوسم بانتظار بيانات موثّقة في كل موضع كانت ستظهر فيه — بما في ذلك داخل المؤشر، حيث يُستبعد مكوّن التكلفة حاليا ويُعاد توزيع وزنه.',
  ))}</p>
          <p class="market-copy">${esc(t(
    'Connecting a verified data source populates every one of those fields, the cost component, and the lowest-cost ranking at once. No page, generator or validator needs to change — the provenance model was built for that swap.',
    'وسيؤدي ربط مصدر بيانات موثّق إلى تعبئة كل تلك الحقول ومكوّن التكلفة وترتيب الأقل تكلفة دفعة واحدة. ولا حاجة لتغيير أي صفحة أو مولّد أو مدقق — فقد بُني نموذج المصادر لهذا الاستبدال.',
  ))}</p>
        </div>`;

  return [
    section('etf-audit-summary', t('Data audit', 'تدقيق البيانات'), t('What is verified across the section', 'ما هو موثّق عبر القسم'), intro),
    section('etf-audit-fields', t('By field', 'حسب الحقل'), t('Coverage of each fund fact', 'تغطية كل حقيقة عن الصندوق'), fieldTable(ar, coverage)),
    section('etf-audit-funds', t('By fund', 'حسب الصندوق'), t('Field counts per fund', 'عدد الحقول لكل صندوق'), fundTable(ar, data.facts, data.score)),
    section('etf-audit-gap', t('The gap', 'الفجوة'), t('Why so much is awaiting data', 'لماذا ينتظر هذا القدر بيانات'), gap),
  ].join('\n');
}

function buildPages() {
  const factsDoc = readJson('etf-facts.json');
  const data = {
    facts_doc: factsDoc,
    facts: indexBySlug(factsDoc),
    score: indexBySlug(readJson('etf-score.json')),
  };

  const pages = [];
  for (const ar of [false, true]) {
    pages.push({
      out: path.join(ROOT, ar ? 'ar/etfs/data-audit/index.html' : 'etfs/data-audit/index.html'),
      html: shell.page({
        ar,
        slugPath: 'etfs/data-audit/',
        titleEn: 'ETF Data Audit',
        titleAr: 'تدقيق بيانات صناديق المؤشرات',
        descEn: 'Field-by-field coverage ledger for the ETF Intelligence Center: what is verified from a data provider, what is derived, and what is awaiting a verified source.',
        descAr: 'سجل تغطية حقلا بحقل لمركز استخبارات الصناديق: ما هو موثّق من مزود بيانات وما هو مشتق وما ينتظر مصدرا موثّقا.',
        eyebrowEn: 'Data audit', eyebrowAr: 'تدقيق البيانات',
        trail: [[ar ? 'تدقيق البيانات' : 'Data audit', null]],
        body: body(ar, data),
      }),
    });
  }
  return pages;
}

function main() {
  shell.writePages(buildPages(), 'etf-audit-page');
}

if (require.main === module) main();

module.exports = { buildPages, fieldCoverage };
