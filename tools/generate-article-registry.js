'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'insights', 'article-registry.json');

const entries = listHtml(path.join(ROOT, 'insights'))
  .filter((file) => path.basename(file) !== 'index.html')
  .map((file) => buildEntry(path.basename(file, '.html')))
  .filter(Boolean)
  .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || a.slug.localeCompare(b.slug));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), articles: entries }, null, 2) + '\n', 'utf8');
console.log(`Generated article registry with ${entries.length} published bilingual article pair(s).`);

function buildEntry(slug) {
  const enPath = `insights/${slug}.html`;
  const arPath = `ar/insights/${slug}.html`;
  const enAbs = path.join(ROOT, enPath);
  const arAbs = path.join(ROOT, arPath);
  if (!fs.existsSync(enAbs)) return null;
  const enHtml = fs.readFileSync(enAbs, 'utf8');
  if (!isIndexable(enHtml)) return null;
  const arHtml = fs.existsSync(arAbs) ? fs.readFileSync(arAbs, 'utf8') : '';
  const enSchema = parseJsonLd(enHtml);
  const arSchema = parseJsonLd(arHtml);
  return {
    slug,
    status: 'published',
    languages: {
      en: {
        path: enPath,
        indexable: isIndexable(enHtml),
        title: extractTitle(enHtml),
        summary: extractMeta(enHtml)
      },
      ar: {
        path: arPath,
        indexable: Boolean(arHtml && isIndexable(arHtml)),
        title: arHtml ? extractTitle(arHtml) : '',
        summary: arHtml ? extractMeta(arHtml) : ''
      }
    },
    publishedAt: firstSchemaValue(enSchema, 'datePublished') || firstSchemaValue(arSchema, 'datePublished') || '',
    updatedAt: firstSchemaValue(enSchema, 'dateModified') || firstSchemaValue(arSchema, 'dateModified') || '',
    category: extractCategory(enHtml),
    symbols: extractSymbols(enHtml)
  };
}

function isIndexable(html) {
  const robots = (html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i) || [])[1] || '';
  return /index,follow/i.test(robots) && !/noindex/i.test(robots);
}

function extractTitle(html) {
  return decodeEntities((html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '');
}

function extractMeta(html) {
  return decodeEntities((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '');
}

function extractCategory(html) {
  return decodeEntities((html.match(/<span class="insight-category-badge">([^<]+)<\/span>/i) || [])[1] || '');
}

function extractSymbols(html) {
  const matches = [...stripNonVisible(html).matchAll(/\b[A-Z]{2,5}\b/g)].map((m) => m[0]);
  const ignore = new Set(['FAQ', 'ETF', 'ETFs', 'CEO', 'GPU', 'CPU', 'AI', 'USD', 'API', 'SEO']);
  return [...new Set(matches.filter((value) => !ignore.has(value)))].slice(0, 12);
}

function parseJsonLd(html) {
  const blocks = [...String(html || '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  return blocks.map((block) => {
    try { return JSON.parse(block[1]); } catch { return null; }
  }).filter(Boolean);
}

function firstSchemaValue(schemas, key) {
  for (const schema of schemas) {
    const value = findValue(schema, key);
    if (value) return value;
  }
  return '';
}

function findValue(value, key) {
  if (!value || typeof value !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findValue(item, key);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findValue(child, key);
      if (found) return found;
    }
  }
  return '';
}

function stripNonVisible(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function listHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(dir, entry.name));
}
