'use strict';

// Responsive composition gate for article evidence panels and institutional
// charts. It catches clipping, undersized analytical charts, off-canvas labels,
// malformed figure hierarchy, and mobile/RTL regressions.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'css', 'market', 'market-portal.css');
const SURFACES = ['market-structure', 'market-news', 'articles'];
const FIGURE_RE = /<figure class="(article-evidence-panel|institutional-chart)[^"]*"[\s\S]*?<\/figure>/gi;
const MIN_CHART_WIDTH = 960;
const MIN_CHART_HEIGHT = 500;
const MIN_FONT = 11;
const AR_SAFE_RIGHT_GUTTER = 120;

function checkFigure(figure, label) {
  const issues = [];
  const isInstitutional = /class="institutional-chart/.test(figure);
  const svgMatch = figure.match(/<svg\b[^>]*>/i);
  if (!svgMatch) return [`${label}: figure has no SVG`];
  const svgTag = svgMatch[0];
  const viewBox = svgTag.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);
  if (!viewBox) issues.push(`${label}: SVG missing viewBox`);
  if (isInstitutional && viewBox && (Number(viewBox[1]) < MIN_CHART_WIDTH || Number(viewBox[2]) < MIN_CHART_HEIGHT)) {
    issues.push(`${label}: institutional chart canvas too small for readable analysis`);
  }
  if (/\bwidth="\d/i.test(svgTag) || /\bheight="\d/i.test(svgTag)) {
    issues.push(`${label}: SVG has fixed root dimensions`);
  }
  if (isInstitutional && !/preserveAspectRatio="xMidYMid meet"/i.test(svgTag)) {
    issues.push(`${label}: SVG missing mobile-safe preserveAspectRatio`);
  }
  if (/style="[^"]*(?:width\s*:\s*\d+px|overflow\s*:\s*(?:visible|scroll)|min-width\s*:)[^"]*"/i.test(figure)) {
    issues.push(`${label}: figure has unsafe fixed-width/overflow inline style`);
  }
  if (!/<figcaption\b/i.test(figure)) issues.push(`${label}: figure missing figcaption hierarchy`);
  if (!/<div class="(?:aep-svg|ic-svg)"[^>]*>\s*<svg\b/i.test(figure)) {
    issues.push(`${label}: SVG is disconnected from its figure wrapper`);
  }

  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    const svg = (figure.match(/<svg[\s\S]*?<\/svg>/i) || [''])[0];
    for (const match of svg.matchAll(/<text\b([^>]*)>/gi)) {
      const attrs = match[1];
      const x = attrs.match(/\bx="(-?[\d.]+)"/i);
      const y = attrs.match(/\by="(-?[\d.]+)"/i);
      const font = attrs.match(/font-size="([\d.]+)"/i);
      const anchor = (attrs.match(/text-anchor="([^"]+)"/i) || [])[1];
      if (x && (Number(x[1]) < 0 || Number(x[1]) > width)) issues.push(`${label}: text x=${x[1]} is off-canvas`);
      if (y && (Number(y[1]) < 0 || Number(y[1]) > height)) issues.push(`${label}: text y=${y[1]} is off-canvas`);
      if (x && Number(x[1]) === 0 && anchor === 'end') issues.push(`${label}: end-anchored text extends left of canvas`);
      if (x && Number(x[1]) === width && (!anchor || anchor === 'start')) issues.push(`${label}: start-anchored text extends right of canvas`);
      if (isInstitutional && /direction="rtl"/i.test(svg) && x && anchor === 'end' && Number(x[1]) > width - AR_SAFE_RIGHT_GUTTER) {
        issues.push(`${label}: RTL chart label too close to right canvas edge`);
      }
      if (isInstitutional && font && Number(font[1]) < MIN_FONT) {
        issues.push(`${label}: chart label font-size ${font[1]} is unreadable`);
      }
    }
  }
  return issues;
}

function listArticles(relative) {
  const directory = path.join(ROOT, relative);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith('.html') && file !== 'index.html');
}

function run() {
  const failures = [];
  let css = '';
  try {
    css = fs.readFileSync(CSS, 'utf8');
  } catch {
    failures.push('market-portal.css not found');
  }
  if (!/Phase 126: inline visual composition stabilization/.test(css)) {
    failures.push('CSS visual-composition stabilization block missing');
  }
  if (!/figure\.institutional-chart[\s\S]*?max-width:\s*100%/.test(css)) {
    failures.push('CSS missing institutional-chart max-width:100% guard');
  }
  if (!/figure\.institutional-chart[\s\S]*?width:\s*100%/.test(css)) {
    failures.push('CSS missing full-width institutional-chart contract');
  }
  if (!/figure\.institutional-chart svg[\s\S]*?height:\s*auto/.test(css)) {
    failures.push('CSS missing responsive institutional-chart SVG height:auto guard');
  }
  if (!/@media\s*\([^)]*max-width[^)]*\)[\s\S]*?institutional-chart/.test(css)) {
    failures.push('CSS missing mobile institutional-chart contract');
  }

  let scanned = 0;
  for (const surface of SURFACES) {
    for (const file of listArticles(surface)) {
      const enHtml = fs.readFileSync(path.join(ROOT, surface, file), 'utf8');
      const enFigures = enHtml.match(FIGURE_RE) || [];
      const arPath = path.join(ROOT, 'ar', surface, file);
      const arHtml = fs.existsSync(arPath) ? fs.readFileSync(arPath, 'utf8') : '';
      const arFigures = arHtml.match(FIGURE_RE) || [];
      if (!enFigures.length && !arFigures.length) continue;
      if (enFigures.some((figure) => /class="institutional-chart/.test(figure)) && /class="article-evidence-panel"/i.test(enHtml)) {
        failures.push(`${surface}/${file}: legacy evidence panel rendered alongside institutional chart`);
      }
      if (arFigures.some((figure) => /class="institutional-chart/.test(figure)) && /class="article-evidence-panel"/i.test(arHtml)) {
        failures.push(`ar/${surface}/${file}: legacy evidence panel rendered alongside institutional chart`);
      }
      scanned += enFigures.length;
      if (enFigures.length !== arFigures.length) failures.push(`${surface}/${file}: EN/AR figure count mismatch`);
      if (arFigures.length && !/<html[^>]+dir="rtl"/i.test(arHtml)) failures.push(`ar/${surface}/${file}: AR article not RTL`);
      enFigures.forEach((figure, index) => checkFigure(figure, `${surface}/${file}#${index + 1}`).forEach((issue) => failures.push(issue)));
      arFigures.forEach((figure, index) => checkFigure(figure, `ar/${surface}/${file}#${index + 1}`).forEach((issue) => failures.push(issue)));
    }
  }
  return { failures, scanned };
}

function runSelfTest() {
  const good = '<figure class="institutional-chart"><div class="ic-svg"><svg viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid meet"><text x="80" y="40" font-size="14">Label</text></svg></div><figcaption>Caption</figcaption></figure>';
  const legacy = '<figure class="article-evidence-panel"><div class="aep-svg"><svg viewBox="0 0 1280 720"><text x="80" y="40">Evidence</text></svg></div><figcaption>Caption</figcaption></figure>';
  const cases = [
    ['small canvas', good.replace('1200 620', '600 300')],
    ['fixed root dimensions', good.replace('viewBox=', 'width="1200" height="620" viewBox=')],
    ['missing mobile aspect ratio', good.replace(' preserveAspectRatio="xMidYMid meet"', '')],
    ['off-canvas x', good.replace('x="80"', 'x="1300"')],
    ['off-canvas y', good.replace('y="40"', 'y="700"')],
    ['unsafe text anchor', good.replace('x="80"', 'x="0" text-anchor="end"')],
    ['RTL right-edge anchor', good.replace('<svg ', '<svg direction="rtl" ').replace('x="80"', 'x="1120" text-anchor="end"')],
    ['microscopic chart label', good.replace('font-size="14"', 'font-size="7"')],
    ['unsafe inline width', good.replace('<figure class="institutional-chart"', '<figure class="institutional-chart" style="min-width:1200px"')],
    ['missing caption', good.replace('<figcaption>Caption</figcaption>', '')],
    ['broken wrapper hierarchy', good.replace('<div class="ic-svg">', '<div class="other">')],
  ];
  let passed = 0;
  for (const [name, candidate] of cases) {
    if (checkFigure(candidate, name).length) passed += 1;
    else console.error(`SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (!checkFigure(good, 'clean').length) passed += 1;
  else console.error('SELF-TEST FAIL: clean figure rejected', checkFigure(good, 'clean'));
  if (!checkFigure(legacy, 'legacy').length) passed += 1;
  else console.error('SELF-TEST FAIL: responsive legacy panel rejected', checkFigure(legacy, 'legacy'));
  const total = cases.length + 2;
  console.log(`[visual-composition] self-test: ${passed}/${total} passed`);
  return passed === total;
}

if (require.main === module && process.argv.includes('--self-test')) {
  process.exit(runSelfTest() ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned } = run();
  if (failures.length) {
    failures.forEach((message) => console.error(`[visual-composition] FAIL: ${message}`));
    process.exit(1);
  }
  console.log(`[visual-composition] check:visual-composition passed (${scanned} figure(s); readable, responsive, captioned, bilingual, RTL-safe).`);
}

module.exports = { checkFigure, run, runSelfTest };
