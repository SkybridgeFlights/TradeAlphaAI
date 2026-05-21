const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files.push(...getFiles(full));
    else if (f.endsWith('.html')) files.push(full);
  }
  return files;
}

const arFiles = getFiles('ar');
const issues = [];

const patterns = [
  'Related ETFs', 'Related stocks', 'Market Cycles', 'Score Model',
  'Data Centers', 'Research Summary', 'Risk layer', 'Valuation Context',
  'business model', 'Bear case', 'Bull case',
  'Company Overview', 'ETF Methodology', 'Research Context',
  'TradeAlpha Research Desk', 'Research score',
  'Most followed', 'Market candidates', 'Featured Article',
  'product cycle execution', 'pricing power', 'operating margin',
  'free cash flow', 'peer-relative', 'not as a buy or sell',
  'within public equity', 'is tracked as an',
  'interest-rate', 'semiconductor-cycle', 'ai-infrastructure'
];

for (const file of arFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  for (const p of patterns) {
    const re = new RegExp(p, 'i');
    if (re.test(visible)) {
      const ctx = visible.match(new RegExp('.{0,40}' + p + '.{0,40}', 'i'));
      issues.push({ file: file.replace(/^ar[\\\/]/, 'ar/'), pattern: p, context: ctx ? ctx[0].trim() : '' });
    }
  }
}

// Group by pattern
const byPattern = {};
for (const i of issues) {
  if (!byPattern[i.pattern]) byPattern[i.pattern] = [];
  byPattern[i.pattern].push(i.file);
}
for (const [p, files] of Object.entries(byPattern)) {
  console.log(p + ': ' + files.length + ' files — e.g. ' + files[0]);
}
console.log('\nTotal issues:', issues.length);
