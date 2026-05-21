'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/research-assets/index.json'), 'utf8'));
const assets = [...(data.stocks || []), ...(data.etfs || [])];

const items = assets.map((asset) => {
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

fs.writeFileSync(path.join(ROOT, 'data/search-index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), items }, null, 2) + '\n', 'utf8');
console.log(`Generated search index with ${items.length} assets.`);
