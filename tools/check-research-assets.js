'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'data', 'research-assets');
const failures = [];

const requiredStocks = ['NVDA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN', 'AAPL', 'AVGO', 'SMCI', 'TSM', 'PLTR', 'CRM', 'ORCL', 'TSLA', 'NFLX', 'ASML', 'INTC', 'MU', 'ARM', 'NOW', 'ADBE', 'PANW', 'CRWD', 'QCOM', 'TXN'];
const requiredEtfs = ['SPY', 'QQQ', 'VOO', 'VTI', 'SOXX', 'SMH', 'XLK', 'SCHD', 'VIG', 'DGRO', 'DIA', 'IWM', 'TLT', 'GLD', 'VUG', 'VTV', 'XLF', 'XLE', 'XLV', 'XLY'];

checkUniverse('stocks', requiredStocks);
checkUniverse('etfs', requiredEtfs);

if (failures.length) {
  console.error('Research asset check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Research asset check passed for ${requiredStocks.length} stocks and ${requiredEtfs.length} ETFs.`);

function checkUniverse(kind, symbols) {
  for (const symbol of symbols) {
    const file = path.join(BASE, kind, symbol.toLowerCase() + '.json');
    if (!fs.existsSync(file)) {
      failures.push(`${kind}/${symbol}: missing JSON file`);
      continue;
    }
    let asset;
    try {
      asset = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      failures.push(`${kind}/${symbol}: invalid JSON (${error.message})`);
      continue;
    }
    checkAsset(kind, symbol, asset);
  }
}

function checkAsset(kind, symbol, asset) {
  const common = ['symbol', 'name', 'type', 'themes', 'overview', 'whyInvestorsFollow', 'bullCase', 'bearCase', 'riskFactors', 'valuationContext', 'relatedStocks', 'relatedETFs', 'relatedInsights', 'ar', 'seo', 'faq', 'arFaq'];
  const specific = kind === 'stocks' ? ['sector', 'businessModel'] : ['category', 'etfMethodology'];
  for (const key of [...common, ...specific]) {
    if (asset[key] === undefined || asset[key] === null || asset[key] === '' || (Array.isArray(asset[key]) && !asset[key].length)) {
      failures.push(`${kind}/${symbol}: missing required field ${key}`);
    }
  }
  if (asset.symbol !== symbol) failures.push(`${kind}/${symbol}: symbol mismatch`);
  if (asset.type !== (kind === 'stocks' ? 'stock' : 'etf')) failures.push(`${kind}/${symbol}: type mismatch`);
  for (const key of kind === 'stocks'
    ? ['sector', 'themes', 'overview', 'businessModel', 'whyInvestorsFollow', 'bullCase', 'bearCase', 'riskFactors', 'valuationContext']
    : ['category', 'themes', 'overview', 'etfMethodology', 'whyInvestorsFollow', 'bullCase', 'bearCase', 'riskFactors', 'valuationContext']) {
    if (!asset.ar || asset.ar[key] === undefined || asset.ar[key] === null || asset.ar[key] === '' || (Array.isArray(asset.ar[key]) && !asset.ar[key].length)) {
      failures.push(`${kind}/${symbol}: missing Arabic field ar.${key}`);
    }
  }
  for (const key of ['title', 'description', 'arTitle', 'arDescription']) {
    if (!asset.seo?.[key]) failures.push(`${kind}/${symbol}: missing SEO field ${key}`);
  }
  if ((asset.faq || []).length < 2 || (asset.arFaq || []).length < 2) failures.push(`${kind}/${symbol}: FAQ pairs incomplete`);
  const text = JSON.stringify(asset);
  if (/guaranteed profit|sure signal|risk-free|best stock to buy|buy now/i.test(text)) failures.push(`${kind}/${symbol}: forbidden advice wording`);
}
