'use strict';

// Phase 92 — Institutional SVG graphics composition engine.
// Deterministic, dependency-free: turns a verified editorial-graphics
// composition contract into an institutional SVG panel. No canvas, no browser,
// no hydration — pure string composition that renders identically every run.
//
// Design language: dark institutional surface, a single restrained gold
// hairline + accent, typography-first hierarchy, an evidence rail, calm
// spacing. No gradients-overload, no glow, no arrows, no hype. RTL-safe.
//
// Renders ONLY from fields the contract guarantees bilingual: headline_en/ar,
// narrative_context.{en,ar}, annotations[].label_en/ar, attribution. It never
// invents a number, a price, or a percentage — there are no metric primitives
// in this engine, only text the verified artifact already produced.

const TOKENS = {
  bg: '#0b0e13',
  panel: '#10151d',
  line: 'rgba(148,163,184,0.18)',
  gold: '#d8b15a',
  goldBright: '#f2d27b',
  text: '#f4f7f1',
  soft: '#cad3c7',
  muted: '#8d978f',
  faint: '#5d675f',
  divergence: '#d66e60',
  font: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",
  fontAr: "'Tajawal','Cairo','Segoe UI',Arial,sans-serif",
};

const KICKER = {
  en: {
    'cross-asset-relationship': 'Cross-Asset Relationship', 'market-structure': 'Market Structure',
    'volatility-state': 'Volatility State', 'positioning-structure': 'Positioning Structure',
    'catalyst-watch': 'Catalyst Watch', 'regime-snapshot': 'Macro Regime', 'memory-timeline': 'Market Memory',
    'structural-tension': 'Structural Tension', 'calm-monitor': 'Desk Monitor',
  },
  ar: {
    'cross-asset-relationship': 'العلاقة بين الأصول', 'market-structure': 'بنية السوق',
    'volatility-state': 'حالة التقلب', 'positioning-structure': 'بنية التمركز',
    'catalyst-watch': 'مراقبة المحفزات', 'regime-snapshot': 'النظام الكلي', 'memory-timeline': 'ذاكرة السوق',
    'structural-tension': 'التوتر الهيكلي', 'calm-monitor': 'مراقبة المكتب',
  },
};

const DISCLAIMER = {
  en: 'Educational market intelligence — not investment advice',
  ar: 'استخبارات سوق تعليمية — ليست نصيحة استثمارية',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Deterministic greedy word-wrap. charWidth is an em-fraction estimate so the
// engine never measures fonts at runtime; conservative values prevent overflow.
function wrap(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}

// Render one institutional SVG panel.
// graphic: editorial-graphics graphic object; opts: { width, height, locale }.
function renderGraphicSVG(graphic, opts = {}) {
  const width = Number(opts.width) || 1280;
  const height = Number(opts.height) || 720;
  const ar = opts.locale === 'ar';
  const pad = Math.round(Math.min(width, height) * 0.07);
  const innerW = width - pad * 2;
  const rtl = ar ? ' direction="rtl"' : '';
  const anchor = ar ? 'end' : 'start';
  const x0 = ar ? width - pad : pad;
  const font = ar ? TOKENS.fontAr : TOKENS.font;

  const headline = ar ? graphic.headline_ar : graphic.headline_en;
  const narrative = graphic.narrative_context && typeof graphic.narrative_context === 'object'
    ? (ar ? graphic.narrative_context.ar : graphic.narrative_context.en)
    : '';
  const kicker = (KICKER[ar ? 'ar' : 'en'][graphic.visual_type]) || (ar ? 'استخبارات السوق' : 'Market Intelligence');
  const annotations = Array.isArray(graphic.annotations) ? graphic.annotations.slice(0, 3) : [];

  // Type scale relative to width.
  const hSize = Math.round(width * 0.045);
  const nSize = Math.round(width * 0.024);
  const sSize = Math.round(width * 0.0165);
  const kSize = Math.round(width * 0.0145);

  const headLines = wrap(headline, Math.floor(innerW / (hSize * 0.56)), 3);
  const narrLines = wrap(narrative, Math.floor(innerW / (nSize * 0.54)), 2);

  let y = pad + kSize + 6;
  const parts = [];

  // Background + restrained gold top hairline + framing.
  parts.push(`<rect width="${width}" height="${height}" fill="${TOKENS.bg}"/>`);
  parts.push(`<rect x="0" y="0" width="${width}" height="3" fill="${TOKENS.gold}" opacity="0.85"/>`);

  // Wordmark (always LTR brand) + kicker.
  parts.push(`<text x="${pad}" y="${pad}" font-family="${TOKENS.font}" font-size="${kSize}" font-weight="800" letter-spacing="1.5" fill="${TOKENS.muted}" text-anchor="start">TradeAlphaAI</text>`);
  parts.push(`<text x="${x0}" y="${pad}" font-family="${font}" font-size="${kSize}" font-weight="700" letter-spacing="${ar ? 0 : 1.2}" fill="${TOKENS.goldBright}" text-anchor="${anchor}"${rtl}>${esc(kicker)}</text>`);

  // Headline.
  y = pad + Math.round(height * 0.18);
  for (const line of headLines) {
    parts.push(`<text x="${x0}" y="${y}" font-family="${font}" font-size="${hSize}" font-weight="800" fill="${TOKENS.text}" text-anchor="${anchor}"${rtl}>${esc(line)}</text>`);
    y += Math.round(hSize * 1.18);
  }

  // Narrative sub-line.
  y += Math.round(nSize * 0.4);
  for (const line of narrLines) {
    parts.push(`<text x="${x0}" y="${y}" font-family="${font}" font-size="${nSize}" font-weight="500" fill="${TOKENS.soft}" text-anchor="${anchor}"${rtl}>${esc(line)}</text>`);
    y += Math.round(nSize * 1.4);
  }

  // Evidence rail — annotations as restrained gold-marked lines.
  y += Math.round(sSize * 1.2);
  for (const a of annotations) {
    const label = ar ? a.label_ar : a.label_en;
    if (!label) continue;
    const markerColor = a.type === 'divergence-highlight' ? TOKENS.divergence : TOKENS.gold;
    const markerX = ar ? width - pad : pad;
    parts.push(`<rect x="${ar ? markerX - 6 : markerX}" y="${y - sSize}" width="6" height="${Math.round(sSize * 1.15)}" fill="${markerColor}" opacity="0.85"/>`);
    const textX = ar ? width - pad - 16 : pad + 16;
    parts.push(`<text x="${textX}" y="${y}" font-family="${font}" font-size="${sSize}" font-weight="600" fill="${TOKENS.soft}" text-anchor="${anchor}"${rtl}>${esc(label)}</text>`);
    y += Math.round(sSize * 1.7);
  }

  // Footer: bottom hairline, attribution, bilingual disclaimer.
  const footY = height - pad;
  parts.push(`<rect x="${pad}" y="${footY - sSize * 1.8}" width="${innerW}" height="1" fill="${TOKENS.line}"/>`);
  parts.push(`<text x="${x0}" y="${footY - Math.round(sSize * 0.5)}" font-family="${font}" font-size="${Math.round(sSize * 0.82)}" fill="${TOKENS.faint}" text-anchor="${anchor}"${rtl}>${esc(graphic.attribution || '')}</text>`);
  parts.push(`<text x="${x0}" y="${footY + Math.round(sSize * 0.6)}" font-family="${font}" font-size="${Math.round(sSize * 0.78)}" fill="${TOKENS.muted}" text-anchor="${anchor}"${rtl}>${esc(DISCLAIMER[ar ? 'ar' : 'en'])}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(headline)}">
${parts.join('\n')}
</svg>
`;
}

module.exports = { renderGraphicSVG, TOKENS, KICKER, DISCLAIMER, wrap };
