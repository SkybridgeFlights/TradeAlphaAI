'use strict';

// Phase 117 — Homepage Intelligence Feed (surgical module, NOT a redesign).
//
// Fills a marker-delimited section (generated:intelligence-feed) on index.html
// (EN) and ar/index.html (AR) with a restrained institutional feed that shows
// the platform is alive: the current regime / liquidity / market-structure
// state, the latest published research / structure / news / outlook / brief, a
// catalyst watch, and links to the intelligence surfaces. It derives ONLY from
// generated artifacts and published pages — never fabricates "latest" content,
// degrades honestly (hides empty blocks, labels indeterminate state plainly),
// and carries honest as-of timestamps. It reuses existing homepage classes so
// it needs no new CSS and inherits the responsive + RTL behaviour. If the
// markers are absent it inserts them once after the intelligence-widget block.
//
// Usage: node tools/render-intelligence-feed.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I = (f) => path.join(ROOT, 'data', 'intelligence', f);
const STALE_HOURS = 72;

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ageHours(iso) { try { return (Date.now() - new Date(iso).getTime()) / 3600000; } catch { return Infinity; } }

// Deterministic native-Arabic maps for the regime/liquidity/stability values
// (the structure artifact already carries bilingual labels; regime does not).
const AR = {
  regime: { healthy_risk_expansion: 'توسّع مخاطر صحي', broad_risk_support: 'دعم مخاطر واسع', narrow_leadership: 'قيادة ضيقة', crowded_growth_positioning: 'تمركز نمو مزدحم', defensive_rotation: 'تدوير دفاعي', liquidity_stress: 'ضغط سيولة', unstable_rally: 'صعود غير مستقر', volatility_transition: 'تحوّل تذبذب', yield_pressure_regime: 'ضغط العوائد', macro_fragility: 'هشاشة كلية', indeterminate: 'غير محدد' },
  liquidity: { easing: 'تيسير', tightening: 'تشديد', yield_pressure: 'ضغط العوائد', defensive_demand: 'طلب دفاعي', volatility_absorption: 'امتصاص تذبذب', volatility_rejection: 'رفض تذبذب', neutral: 'محايد', indeterminate: 'غير محدد' },
  stability: { stable: 'مستقر', fragile: 'هش', deteriorating: 'يتدهور', unstable: 'غير مستقر', strengthening: 'يتقوّى', transition_state: 'انتقالي', indeterminate: 'غير محدد' },
};
function clean(s) { return String(s || 'indeterminate').replace(/_/g, ' '); }
function arVal(cat, v) { return (AR[cat] && AR[cat][v]) || clean(v); }

// Latest published page in a directory matching a prefix filter.
function latest(dirRel, filter) {
  const dir = path.join(ROOT, dirRel);
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html' && filter(f)); } catch { return null; }
  if (!files.length) return null;
  files.sort((a, b) => b.localeCompare(a)); // dated slugs sort newest-first
  const f = files[0];
  let title = f.replace(/\.html$/, '');
  try {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = html.match(/<h1>([\s\S]*?)<\/h1>/i);
    if (m) title = m[1].replace(/<[^>]+>/g, '').trim();
  } catch { /* keep slug */ }
  return { href: `/${dirRel}/${f}`, title, file: f };
}

// Catalyst watch: the next upcoming dated macro event, honestly labelled.
function nextCatalyst(ar) {
  const g = readJson(I('global-macro-events.json'), null);
  const events = g && Array.isArray(g.events) ? g.events : [];
  const now = Date.now();
  const upcoming = events
    .map((e) => ({ name: e.event_name || e.event, when: e.release_time || e.date, country: e.country, estimated: e.estimated_date }))
    .filter((e) => e.name && e.when && Date.parse(e.when) >= now)
    .sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  if (!upcoming.length) return null;
  const e = upcoming[0];
  const d = (e.when || '').slice(0, 10);
  return { name: e.name, date: d, estimated: !!e.estimated, country: e.country };
}

function buildSection(ar) {
  const t = (en, arT) => (ar ? arT : en);
  const regime = readJson(I('liquidity-regime.json'), {});
  const structure = readJson(I('market-structure.json'), {});
  const regimeFresh = regime.generated_at && ageHours(regime.generated_at) <= STALE_HOURS;
  const structFresh = structure.generated_at && ageHours(structure.generated_at) <= STALE_HOURS;

  // State cards (honest: indeterminate / unavailable when not fresh).
  const stateCard = (label, value, sub) => `            <div class="intel-widget-card"><span class="intel-widget-label">${esc(label)}</span><strong class="intel-widget-value">${esc(value)}</strong>${sub ? `<span class="intel-widget-sub">${esc(sub)}</span>` : ''}</div>`;
  const lbl = (cat, v) => (ar ? arVal(cat, v) : clean(v)); // locale-aware value
  const stateCards = [];
  stateCards.push(stateCard(t('Regime', 'النظام'), regimeFresh && regime.regime ? lbl('regime', regime.regime) : t('unavailable', 'غير متاح')));
  stateCards.push(stateCard(t('Liquidity', 'السيولة'), regimeFresh && regime.liquidity_state ? lbl('liquidity', regime.liquidity_state) : t('unavailable', 'غير متاح')));
  if (structFresh && structure.available && structure.dimensions) {
    const part = structure.dimensions.participation;
    stateCards.push(stateCard(t('Market structure', 'بنية السوق'), ar ? (part && part.label_ar) : (part && part.label_en), t(`structural confidence ${structure.structural_confidence}/100`, `ثقة هيكلية ${structure.structural_confidence}/100`)));
  } else {
    stateCards.push(stateCard(t('Market structure', 'بنية السوق'), t('indeterminate', 'غير محدد')));
  }

  // Latest published intelligence (only show categories that have content).
  const items = [];
  const research = latest('market-news', (f) => f.startsWith('research-'));
  const structureNote = latest('market-structure', (f) => f.startsWith('structure-'));
  const news = latest('market-news', (f) => !f.startsWith('research-'));
  const outlook = latest('market-outlook', () => true);
  if (research) items.push([t('Latest research note', 'أحدث مذكرة بحث'), research]);
  if (structureNote) items.push([t('Latest structure analysis', 'أحدث تحليل بنية'), structureNote]);
  if (news) items.push([t('Latest market news', 'أحدث أخبار السوق'), news]);
  if (outlook) items.push([t('Latest market outlook', 'أحدث توقعات السوق'), outlook]);
  // Latest brief from the verified brief artifact.
  const brief = readJson(I('daily-intelligence-brief.json'), null);
  if (brief && brief.updated_at && ageHours(brief.updated_at) <= STALE_HOURS) {
    items.push([t('Latest brief', 'أحدث موجز'), { href: ar ? '/ar/briefs/' : '/briefs/', title: t('Daily intelligence brief', 'الموجز الاستخباري اليومي') }]);
  }
  const latestCards = items.map(([label, it]) => `            <article class="intel-widget-card intel-feed-item"><span class="intel-widget-label">${esc(label)}</span><h3 class="intel-feed-title"><a href="${esc(ar && !it.href.startsWith('/ar/') ? '/ar' + it.href : it.href)}">${esc(it.title)}</a></h3></article>`).join('\n');

  // Catalyst watch (honest about estimated dates).
  const cat = nextCatalyst(ar);
  const catalystLine = cat
    ? t(`Next catalyst: ${cat.name} · ${cat.date}${cat.estimated ? ' (scheduled date)' : ''}`, `المحفّز التالي: ${cat.name} · ${cat.date}${cat.estimated ? ' (موعد مجدول)' : ''}`)
    : t('No dated catalyst is currently on the desk calendar.', 'لا يوجد محفّز مؤرّخ حالياً على تقويم المكتب.');

  // Surface links.
  const base = ar ? '/ar' : '';
  const links = [
    [`${base}/market-structure/`, t('Market structure', 'بنية السوق')],
    [`${base}/market-news/`, t('Market news', 'أخبار السوق')],
    [`${base}/economic-calendar/`, t('Economic calendar', 'التقويم الاقتصادي')],
  ].map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join(' · ');

  const asOf = (structFresh && structure.generated_at) || (regimeFresh && regime.generated_at) || null;
  const asOfLine = asOf ? `${t('Snapshot · as of', 'لقطة · بتاريخ')} ${esc(String(asOf).slice(0, 10))}` : t('Awaiting a fresh intelligence snapshot.', 'بانتظار لقطة استخبارية حديثة.');

  return `      <section class="section section-tight" id="intelligence-feed"${ar ? ' dir="rtl"' : ''}>
        <div class="section-panel">
          <div class="section-head">
            <span class="eyebrow">${esc(t('Live intelligence', 'استخبارات حيّة'))}</span>
            <h2>${esc(t('Intelligence feed', 'موجز الاستخبارات'))}</h2>
            <p class="market-copy">${esc(t('The current market structure and the desk’s latest published research, derived deterministically from the intelligence artifacts. Educational context, not investment advice.', 'بنية السوق الحالية وأحدث أبحاث المكتب المنشورة، مستمدة بصورة حتمية من مراجع الاستخبارات. سياق تعليمي وليس نصيحة استثمارية.'))}</p>
          </div>
          <div class="intel-widget-grid">
${stateCards.join('\n')}
          </div>
${latestCards ? `          <div class="intel-widget-grid intel-feed-list">\n${latestCards}\n          </div>` : `          <p class="market-copy">${esc(t('No published intelligence is available yet — the desk publishes only when it has something substantive to say.', 'لا توجد استخبارات منشورة بعد — ينشر المكتب فقط حين يكون لديه ما يستحق القول.'))}</p>`}
          <p class="market-copy intel-feed-catalyst">${esc(catalystLine)}</p>
          <p class="market-copy intel-feed-links">${links}</p>
          <p class="market-copy intel-feed-asof">${esc(asOfLine)}</p>
        </div>
      </section>`;
}

const START = '<!-- generated:intelligence-feed:start -->';
const END = '<!-- generated:intelligence-feed:end -->';

function applyToFile(rel, ar) {
  const file = path.join(ROOT, rel);
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { console.log(`[intel-feed] ${rel} not found — skipping`); return false; }
  const block = `${START}\n${buildSection(ar)}\n${END}`;
  let next;
  if (html.includes(START) && html.includes(END)) {
    next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    // Insert once after the intelligence-widget section (honest surgical add).
    const anchor = '<!-- generated:intelligence-widget:end -->';
    if (!html.includes(anchor)) { console.log(`[intel-feed] ${rel} has no intelligence-widget anchor — skipping insert`); return false; }
    next = html.replace(anchor, `${anchor}\n\n${block}`);
  }
  if (next === html) { console.log(`[intel-feed] ${rel} unchanged`); return false; }
  if (WRITE) { fs.writeFileSync(file, next, 'utf8'); console.log(`[intel-feed] wrote ${rel}`); }
  else console.log(`[intel-feed] dry-run ${rel} (${block.length} chars)`);
  return true;
}

const WRITE = process.argv.includes('--write');
if (require.main === module) {
  applyToFile('index.html', false);
  applyToFile('ar/index.html', true);
  process.exit(0);
}

module.exports = { buildSection, START, END };
