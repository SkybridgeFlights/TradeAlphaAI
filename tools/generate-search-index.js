'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/research-assets/index.json'), 'utf8'));
const assets = [...(data.stocks || []), ...(data.etfs || [])];
const registryPath = path.join(ROOT, 'data/insights/article-registry.json');
const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { articles: [] };

const assetItems = assets.map((asset) => {
  const isEtf = asset.type === 'etf';
  const pathName = `${isEtf ? 'etfs' : 'stocks'}/${asset.symbol.toLowerCase()}.html`;
  return {
    symbol: asset.symbol,
    name: asset.name,
    type: asset.type,
    sector: asset.sector || asset.category,
    category: asset.category || asset.sector,
    themes: asset.themes || [],
    href: `/${pathName}`,
    arHref: `/ar/${pathName}`,
    label: `${asset.symbol} - ${asset.name}`,
    arLabel: `${asset.symbol} - ${asset.name}`,
    keywords: [asset.symbol, asset.name, asset.sector, asset.category, ...(asset.themes || [])].filter(Boolean).join(' '),
    arKeywords: [asset.symbol, asset.name, asset.ar?.sector, asset.ar?.category, ...(asset.ar?.themes || [])].filter(Boolean).join(' ')
  };
});

const articleItems = (registry.articles || []).filter((entry) => entry.status === 'published').map((entry) => ({
  symbol: entry.slug,
  name: entry.languages.en.title,
  type: 'insight',
  sector: entry.category || 'Articles',
  category: 'Articles',
  themes: entry.symbols || [],
  href: `/${entry.languages.en.path}`,
  arHref: `/${entry.languages.ar.path}`,
  label: entry.languages.en.title,
  arLabel: entry.languages.ar.title,
  keywords: [entry.slug, entry.languages.en.title, entry.languages.en.summary, entry.category, ...(entry.symbols || [])].filter(Boolean).join(' '),
  arKeywords: [entry.slug, entry.languages.ar.title, entry.languages.ar.summary, entry.category, ...(entry.symbols || [])].filter(Boolean).join(' ')
}));

const items = [...assetItems, ...articleItems];

fs.writeFileSync(path.join(ROOT, 'data/search-index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), items }, null, 2) + '\n', 'utf8');
console.log(`Generated search index with ${items.length} assets.`);

