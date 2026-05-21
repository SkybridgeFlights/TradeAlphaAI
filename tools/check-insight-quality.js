'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const selectedSlug = argValue('--slug');
const selectedFile = argValue('--file');
const files = selectedFile ? [path.join(ROOT, selectedFile)] : selectedSlug ? [path.join(ROOT, 'insights', selectedSlug + '.html')] : listFiles(path.join(ROOT, 'insights'), ['.html']).filter((file) => !file.endsWith(`${path.sep}index.html`));
const failures = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    failures.push(`${relative(file)}: file does not exist`);
    continue;
  }
  checkFile(file);
  checkArabicCounterpart(file);
}

if (failures.length) {
  console.error('Insight quality check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Insight quality check passed for ${files.length} file(s).`);

function checkFile(file) {
  const rel = relative(file);
  const html = fs.readFileSync(file, 'utf8');
  const plain = stripHtml(html);
  const words = plain.split(/\s+/).filter(Boolean);

  if (words.length < 900) failures.push(`${rel}: article is too short (${words.length} words)`);
  if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
  if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing FAQ schema`);
  if (!/<script type="application\/ld\+json">[\s\S]*"BreadcrumbList"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Breadcrumb schema`);
  if (!/educational and informational purposes only/i.test(plain)) failures.push(`${rel}: missing educational disclaimer`);
  if (!/does not (?:constitute|provide) (?:investment or financial advice|investment advice)/i.test(plain)) failures.push(`${rel}: missing no-advice disclaimer`);
  if ((html.match(/<details>/g) || []).length < 3) failures.push(`${rel}: missing sufficient FAQ entries`);

  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const meta = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  if (!title.trim()) failures.push(`${rel}: missing title`);
  if (!meta.trim()) failures.push(`${rel}: missing meta description`);
  if (title && meta && normalize(title) === normalize(meta)) failures.push(`${rel}: title and meta description are duplicates`);

  const hrefs = [...html.matchAll(/\shref="([^"#?]+)(?:#[^"]*)?"/g)].map((m) => m[1]).filter(isInternalLink);
  const stockLinks = hrefs.filter((href) => href.includes('../stocks/') || href.includes('/stocks/'));
  const etfLinks = hrefs.filter((href) => href.includes('../etfs/') || href.includes('/etfs/'));
  const hubLinks = hrefs.filter((href) => /(?:\.\.\/)?(?:ai-stocks|semiconductor-stocks|growth-stocks|dividend-etfs)\.html/.test(href));
  const insightLinks = hrefs.filter((href) => href.includes('.html') && !href.includes('../stocks/') && !href.includes('../etfs/') && !href.includes('../index.html') && !href.includes('index.html'));
  const methodologyLinks = hrefs.filter((href) => href.includes('methodology.html') || href.includes('market-data-status.html'));

  if (hrefs.length < 6) failures.push(`${rel}: missing internal links (${hrefs.length})`);
  if (stockLinks.length < 2) failures.push(`${rel}: needs at least 2 stock links`);
  if (etfLinks.length < 1) failures.push(`${rel}: needs at least 1 ETF link`);
  if (hubLinks.length < 1) failures.push(`${rel}: needs at least 1 hub link`);
  if (insightLinks.length < 2) failures.push(`${rel}: needs at least 2 related insight links`);
  if (methodologyLinks.length < 1 && /methodology|data|score|provider|market data/i.test(plain)) failures.push(`${rel}: relevant methodology/data-status link missing`);

  for (const phrase of ['buy now', 'guaranteed profit', 'sure signal', 'best stock to buy', 'risk-free']) {
    if (new RegExp(phrase, 'i').test(plain)) failures.push(`${rel}: forbidden wording found: ${phrase}`);
  }
  const adviceMatches = plain.match(/financial advice/gi) || [];
  const allowedAdviceMatches = plain.match(/(?:does not constitute|not financial advice|does not provide)[^.]{0,80}financial advice/gi) || [];
  if (adviceMatches.length > allowedAdviceMatches.length) failures.push(`${rel}: forbidden standalone financial advice wording found`);

  const repeated = repeatedPhrases(words, 4, 9);
  if (repeated.length) failures.push(`${rel}: too many repeated phrases (${repeated.slice(0, 3).join(', ')})`);
}

function checkArabicCounterpart(file) {
  const rel = relative(file);
  if (!rel.startsWith('insights/') || rel.endsWith('/index.html')) return;
  const slug = path.basename(file, '.html');
  const arContent = path.join(ROOT, 'data', 'localization', 'ar-insight-content', slug + '.json');
  const arFile = path.join(ROOT, 'ar', 'insights', slug + '.html');
  if (!fs.existsSync(arContent)) failures.push(`${rel}: missing Arabic editorial content JSON`);
  if (!fs.existsSync(arFile)) {
    failures.push(`${rel}: missing Arabic localized article`);
    return;
  }
  const enHtml = fs.readFileSync(file, 'utf8');
  const arHtml = fs.readFileSync(arFile, 'utf8');
  const arPlain = stripHtml(arHtml).replace(/\bEnglish\b/g, '');
  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(arHtml)) failures.push(`${relative(arFile)}: missing Arabic RTL html markers`);
  if ((enHtml.match(/<section\b/g) || []).length !== (arHtml.match(/<section\b/g) || []).length) failures.push(`${relative(arFile)}: section count does not match English article`);
  if ((enHtml.match(/<details>/g) || []).length !== (arHtml.match(/<details>/g) || []).length) failures.push(`${relative(arFile)}: FAQ count does not match English article`);
  if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(arHtml)) failures.push(`${relative(arFile)}: missing Arabic Article schema`);
  if (!/تعليمي|تعليمية/.test(arPlain)) failures.push(`${relative(arFile)}: missing Arabic educational language`);
  if (/\b(This article|Read article|Related Research|Market Context|Executive Summary|security recommendations|price targets|investment advice)\b/i.test(arPlain)) failures.push(`${relative(arFile)}: Arabic article contains untranslated English boilerplate`);
}

function repeatedPhrases(words, phraseLength, maxCount) {
  const counts = new Map();
  for (let i = 0; i <= words.length - phraseLength; i += 1) {
    const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
    if (phrase.length < 18) continue;
    counts.set(phrase, (counts.get(phrase) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > maxCount).map(([phrase]) => phrase);
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isInternalLink(href) {
  return !/^(?:https?:|mailto:|tel:|\/\/|#)/.test(href) && href.endsWith('.html');
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function listFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, extensions));
    else if (extensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}
