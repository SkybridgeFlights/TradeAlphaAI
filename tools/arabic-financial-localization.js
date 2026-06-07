'use strict';

const FINANCIAL_TERMS = [
  [/\bCapital Expenditure\b/gi, 'الإنفاق الرأسمالي'],
  [/\bQuarter[- ]over[- ]Quarter\b/gi, 'على أساس ربع سنوي'],
  [/\bYear[- ]over[- ]Year\b/gi, 'على أساس سنوي'],
  [/\bMonth[- ]over[- ]Month\b/gi, 'على أساس شهري'],
  [/\bQoQ\b/g, 'ربع سنوي'],
  [/\bYoY\b/g, 'سنوي'],
  [/\bMoM\b/g, 'شهري'],
  [/\bSAAR\b/g, 'المعدل السنوي المعدل موسميا'],
  [/\bPreliminary\b/gi, 'أولي'],
  [/\bConsensus\b/gi, 'إجماع التوقعات'],
  [/\bEstimate\b/gi, 'تقديري'],
  [/\bEstimated\b/gi, 'تقديري'],
  [/\bRevised\b/gi, 'معدل'],
  [/\bRevision\b/gi, 'مراجعة'],
  [/\bHeadline\b/gi, 'رئيسي'],
  [/\bCore\b/gi, 'أساسي'],
  [/\bFinal\b/gi, 'نهائي'],
  [/\bActual\b/gi, 'الفعلي'],
  [/\bForecast\b/gi, 'المتوقع'],
  [/\bPrevious\b/gi, 'السابق'],
  [/\bSeasonally Adjusted\b/gi, 'معدل موسميا'],
  [/\bAnnualized\b/gi, 'محسوب سنويا'],
];

const ALLOWED_TOKENS = [
  'TradeAlphaAI', 'TradeAlpha', 'AI', 'ETF', 'ETFs', 'GDP', 'CPI', 'PCE',
  'NFP', 'FOMC', 'VIX', 'DXY', 'USD', 'GPU', 'NASDAQ', 'English',
];

function normalizeArabicFinancialText(value) {
  let output = String(value || '');
  for (const [pattern, replacement] of FINANCIAL_TERMS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function normalizeArabicFinancialHtml(html) {
  const parts = String(html || '').split(/(<[^>]+>)/g);
  let ignoredElement = '';

  return parts.map((part) => {
    if (part.startsWith('<')) {
      const open = part.match(/^<(script|style)\b/i);
      const close = part.match(/^<\/(script|style)\b/i);
      if (open) ignoredElement = open[1].toLowerCase();
      if (close && close[1].toLowerCase() === ignoredElement) ignoredElement = '';
      return part;
    }
    return ignoredElement ? part : normalizeArabicFinancialText(part);
  }).join('');
}

function visibleBody(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findArabicEnglishRun(html) {
  let text = visibleBody(html);
  for (const token of ALLOWED_TOKENS) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi'), ' ');
  }
  text = text
    .replace(/\b[A-Z]{1,6}\b/g, ' ')
    .replace(/[\d.,:%]+/g, ' ')
    .replace(/\s+/g, ' ');
  return text.match(/\b[A-Za-z]{2,}(?:[\s:–—-]+[A-Za-z]{2,}){3,}\b/);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  findArabicEnglishRun,
  normalizeArabicFinancialHtml,
  normalizeArabicFinancialText,
};
