'use strict';

// Phase 109 — check:editorial-quality-articles. Editorial-quality gate for any
// PUBLISHED long-form article (market-news/*.html + ar/, excluding index).
// HARD-FAILS if a published piece: carries a banned filler/cliché, retail TA,
// an unsupported prediction, repetition above threshold, or a null/undefined
// leak — or scores below the institutional quality floor in either language.
// When nothing is published, passes (the publisher self-gates on the same
// scorer, so a published article has already cleared the floor).

const fs = require('fs');
const path = require('path');
const { scoreText, QUALITY_FLOOR } = require('./editorial-quality');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  { dir: path.join(ROOT, 'market-news'), lang: 'en' },
  { dir: path.join(ROOT, 'ar', 'market-news'), lang: 'ar' },
  { dir: path.join(ROOT, 'articles'), lang: 'en', educationalOnly: true },
  { dir: path.join(ROOT, 'ar', 'articles'), lang: 'ar', educationalOnly: true },
];

const failures = [];
const fail = (m) => failures.push(m);

function articles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}
function bodyText(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  let body = m ? m[0] : html;
  // Visual evidence (chart figures + SVGs) is NOT editorial prose — strip whole
  // figure/svg blocks so chart captions, axis labels and price numbers do not
  // inflate repetition/evidence-number metrics (esp. with multiple charts).
  body = body
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ');
  return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

let scored = 0;
for (const { dir, lang, educationalOnly } of TARGETS) {
  for (const f of articles(dir)) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    if (educationalOnly && !html.includes('data-educational-article=')) continue;
    const rel = educationalOnly
      ? `${lang === 'ar' ? 'ar/' : ''}articles/${f}`
      : `${lang === 'ar' ? 'ar/' : ''}market-news/${f}`;
    const text = bodyText(html);
    const s = scoreText(text, { lang });
    scored += 1;
    if (s.flags.length) fail(`${rel}: quality flags ${JSON.stringify(s.flags)}`);
    if (s.score < QUALITY_FLOOR) fail(`${rel}: editorial-quality score ${s.score} < ${QUALITY_FLOOR} (metrics ${JSON.stringify(s.metrics)})`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-quality] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[editorial-quality] check:editorial-quality-articles passed (${scored} published article-body(ies) scored ≥ ${QUALITY_FLOOR}, flag-free).`);
