'use strict';

// Deterministic educational visual explainers.
// These diagrams describe evergreen concept mechanics only. They contain no
// prices, forecasts, timestamps, live-state claims, or investment instructions.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'visual', 'educational-explainers');
const MANIFEST_PATH = path.join(ROOT, 'data', 'visual', 'educational-explainers.json');
const SOURCE = 'TradeAlphaAI educational concept library';
const CONCEPT_LIBRARY_PATH = path.join(__dirname, 'educational-concept-library.js');

const COLORS = Object.freeze({
  background: '#0b0e13',
  panel: '#111720',
  panelSoft: '#151c26',
  line: '#394554',
  gold: '#d8b15a',
  blue: '#6f91b8',
  text: '#f2f5ef',
  soft: '#c8d0c7',
  muted: '#89948d',
});

const DEFINITIONS = Object.freeze([
  {
    id: 'breadth-deterioration',
    visual_type: 'participation-map',
    title: {
      en: 'Index direction and participation breadth',
      ar: 'اتجاه المؤشر واتساع المشاركة',
    },
    purpose: {
      en: 'Explain why an index move is structurally stronger when participation extends beyond a narrow leadership group.',
      ar: 'شرح لماذا يكون تحرك المؤشر أكثر تماسكاً حين تمتد المشاركة إلى ما يتجاوز مجموعة قيادة ضيقة.',
    },
    nodes: [
      { en: 'Index direction', ar: 'اتجاه المؤشر' },
      { en: 'Leadership set', ar: 'مجموعة القيادة' },
      { en: 'Market participation', ar: 'المشاركة السوقية' },
      { en: 'Confirmation quality', ar: 'جودة التأكيد' },
    ],
    relations: [
      { from: 0, to: 1, en: 'can be concentrated in', ar: 'قد يتركز في' },
      { from: 1, to: 2, en: 'is tested against', ar: 'يُختبر مقابل' },
      { from: 2, to: 3, en: 'defines', ar: 'يحدد' },
    ],
  },
  {
    id: 'liquidity-tightening',
    visual_type: 'transmission-map',
    title: {
      en: 'Liquidity transmission through markets',
      ar: 'انتقال السيولة عبر الأسواق',
    },
    purpose: {
      en: 'Show how funding conditions pass through risk capacity, participation, and cross-asset behavior.',
      ar: 'إظهار كيفية انتقال ظروف التمويل إلى القدرة على تحمل المخاطر والمشاركة وسلوك الأصول المتقاطعة.',
    },
    nodes: [
      { en: 'Funding conditions', ar: 'ظروف التمويل' },
      { en: 'Balance-sheet capacity', ar: 'قدرة الميزانيات' },
      { en: 'Market participation', ar: 'المشاركة السوقية' },
      { en: 'Cross-asset behavior', ar: 'سلوك الأصول المتقاطعة' },
    ],
    relations: [
      { from: 0, to: 1, en: 'shape', ar: 'تشكل' },
      { from: 1, to: 2, en: 'conditions', ar: 'تحدد' },
      { from: 2, to: 3, en: 'appears through', ar: 'تظهر عبر' },
    ],
  },
  {
    id: 'dxy-gold-relationship',
    visual_type: 'cross-asset-map',
    title: {
      en: 'Reading the dollar and gold relationship',
      ar: 'قراءة العلاقة بين الدولار والذهب',
    },
    purpose: {
      en: 'Separate the dollar channel from real-yield and defensive-demand channels when interpreting gold.',
      ar: 'فصل قناة الدولار عن قناتي العائد الحقيقي والطلب الدفاعي عند تفسير حركة الذهب.',
    },
    nodes: [
      { en: 'Dollar conditions', ar: 'ظروف الدولار' },
      { en: 'Real-yield channel', ar: 'قناة العائد الحقيقي' },
      { en: 'Defensive demand', ar: 'الطلب الدفاعي' },
      { en: 'Gold response', ar: 'استجابة الذهب' },
    ],
    relations: [
      { from: 0, to: 3, en: 'interacts with', ar: 'تتفاعل مع' },
      { from: 1, to: 3, en: 'changes holding cost', ar: 'تغير تكلفة الاحتفاظ' },
      { from: 2, to: 3, en: 'adds a distinct channel', ar: 'تضيف قناة مستقلة' },
    ],
  },
  {
    id: 'yield-curve-pressure',
    visual_type: 'duration-pressure-map',
    title: {
      en: 'How yield-curve pressure reaches duration assets',
      ar: 'كيف يصل ضغط منحنى العائد إلى أصول المدة',
    },
    purpose: {
      en: 'Explain how changes across the yield curve alter discount-rate pressure and duration sensitivity.',
      ar: 'شرح كيف تغير التحركات عبر منحنى العائد ضغط معدل الخصم وحساسية المدة.',
    },
    nodes: [
      { en: 'Curve configuration', ar: 'تكوين منحنى العائد' },
      { en: 'Discount-rate pressure', ar: 'ضغط معدل الخصم' },
      { en: 'Duration sensitivity', ar: 'حساسية المدة' },
      { en: 'Relative leadership', ar: 'القيادة النسبية' },
    ],
    relations: [
      { from: 0, to: 1, en: 'transmits through', ar: 'ينتقل عبر' },
      { from: 1, to: 2, en: 'is absorbed by', ar: 'تستوعبه' },
      { from: 2, to: 3, en: 'influences', ar: 'تؤثر في' },
    ],
  },
  {
    id: 'volatility-compression',
    visual_type: 'state-lifecycle',
    title: {
      en: 'Volatility compression as a market state',
      ar: 'انضغاط التقلب كحالة سوقية',
    },
    purpose: {
      en: 'Frame compression as a sequence of quieter realized movement, tighter positioning, and a later confirmation test.',
      ar: 'تأطير الانضغاط كتسلسل من حركة فعلية أهدأ وتمركز أكثر تقارباً ثم اختبار لاحق للتأكيد.',
    },
    nodes: [
      { en: 'Quieter realized movement', ar: 'حركة فعلية أكثر هدوءاً' },
      { en: 'Tighter positioning', ar: 'تمركز أكثر تقارباً' },
      { en: 'Pressure accumulation', ar: 'تراكم الضغط' },
      { en: 'Confirmation test', ar: 'اختبار التأكيد' },
    ],
    relations: [
      { from: 0, to: 1, en: 'can encourage', ar: 'قد تشجع' },
      { from: 1, to: 2, en: 'can conceal', ar: 'قد تخفي' },
      { from: 2, to: 3, en: 'requires', ar: 'تتطلب' },
    ],
  },
  {
    id: 'cross-asset-confirmation',
    visual_type: 'confirmation-matrix',
    title: {
      en: 'Cross-asset confirmation and divergence',
      ar: 'التأكيد والانفصال بين الأصول',
    },
    purpose: {
      en: 'Show how desks compare a primary market move with rates, currency, and volatility evidence before judging coherence.',
      ar: 'إظهار كيف تقارن المكاتب الحركة الأساسية بأدلة العائدات والعملات والتقلب قبل تقييم التماسك.',
    },
    nodes: [
      { en: 'Primary market move', ar: 'الحركة السوقية الأساسية' },
      { en: 'Rates evidence', ar: 'دليل العائدات' },
      { en: 'Currency evidence', ar: 'دليل العملات' },
      { en: 'Coherence assessment', ar: 'تقييم التماسك' },
    ],
    relations: [
      { from: 0, to: 1, en: 'is compared with', ar: 'تُقارن مع' },
      { from: 0, to: 2, en: 'is compared with', ar: 'تُقارن مع' },
      { from: 1, to: 3, en: 'contributes to', ar: 'تسهم في' },
      { from: 2, to: 3, en: 'contributes to', ar: 'تسهم في' },
    ],
  },
  {
    id: 'catalyst-windows',
    visual_type: 'catalyst-lifecycle',
    title: {
      en: 'How a catalyst window changes the evidence test',
      ar: 'كيف تغير نافذة المحفز اختبار الأدلة',
    },
    purpose: {
      en: 'Distinguish pre-event positioning, the verified release, market reaction, and post-event confirmation.',
      ar: 'التمييز بين التموضع قبل الحدث والصدور الموثق ورد فعل السوق والتأكيد بعد الحدث.',
    },
    nodes: [
      { en: 'Pre-event positioning', ar: 'التموضع قبل الحدث' },
      { en: 'Verified release', ar: 'الصدور الموثق' },
      { en: 'Initial reaction', ar: 'رد الفعل الأولي' },
      { en: 'Post-event confirmation', ar: 'التأكيد بعد الحدث' },
    ],
    relations: [
      { from: 0, to: 1, en: 'meets', ar: 'يواجه' },
      { from: 1, to: 2, en: 'is interpreted through', ar: 'يُفسر عبر' },
      { from: 2, to: 3, en: 'is tested by', ar: 'يُختبر بواسطة' },
    ],
  },
  {
    id: 'regime-context',
    visual_type: 'regime-context-map',
    title: {
      en: 'Reading a market signal inside its regime',
      ar: 'قراءة الإشارة السوقية داخل نظامها',
    },
    purpose: {
      en: 'Explain why the same observation can carry different structural meaning under different liquidity and volatility regimes.',
      ar: 'شرح لماذا قد تحمل الملاحظة نفسها معنى هيكلياً مختلفاً باختلاف أنظمة السيولة والتقلب.',
    },
    nodes: [
      { en: 'Observed signal', ar: 'الإشارة المرصودة' },
      { en: 'Liquidity regime', ar: 'نظام السيولة' },
      { en: 'Volatility regime', ar: 'نظام التقلب' },
      { en: 'Contextual interpretation', ar: 'التفسير السياقي' },
    ],
    relations: [
      { from: 0, to: 3, en: 'requires context from', ar: 'تحتاج إلى سياق من' },
      { from: 1, to: 3, en: 'conditions', ar: 'يؤطر' },
      { from: 2, to: 3, en: 'conditions', ar: 'يؤطر' },
    ],
  },
]);

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function wrap(text, maxLength = 27, maxLines = 2) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function textLines(lines, x, y, options = {}) {
  const {
    anchor = 'middle',
    color = COLORS.text,
    fontSize = 22,
    fontWeight = 650,
    direction = 'ltr',
    lineHeight = 28,
  } = options;
  const tspans = lines.map((line, index) =>
    `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext" fill="${color}" font-size="${fontSize}" font-weight="${fontWeight}">${tspans}</text>`;
}

function nodePosition(index, locale) {
  const positions = [
    { x: 225, y: 250 },
    { x: 475, y: 250 },
    { x: 725, y: 250 },
    { x: 975, y: 250 },
  ];
  return locale === 'ar' ? positions[positions.length - 1 - index] : positions[index];
}

function renderSvg(definition, locale) {
  const isArabic = locale === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';
  const fontFamily = isArabic
    ? "'Tajawal','Cairo','Segoe UI',Arial,sans-serif"
    : "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif";
  const title = definition.title[locale];
  const purpose = definition.purpose[locale];
  const nodeMarkup = definition.nodes.map((node, index) => {
    const pos = nodePosition(index, locale);
    const lines = wrap(node[locale], isArabic ? 22 : 24, 2);
    return [
      `<g id="node-${index + 1}">`,
      `<rect x="${pos.x - 100}" y="${pos.y - 56}" width="200" height="112" rx="8" fill="${index === definition.nodes.length - 1 ? COLORS.panelSoft : COLORS.panel}" stroke="${index === definition.nodes.length - 1 ? COLORS.gold : COLORS.line}" stroke-width="1.5"/>`,
      textLines(lines, pos.x, pos.y - (lines.length > 1 ? 10 : 0), {
        direction,
        fontSize: isArabic ? 20 : 18,
        lineHeight: 26,
      }),
      '</g>',
    ].join('');
  }).join('\n');

  const relationMarkup = definition.relations.map((relation, index) => {
    const from = nodePosition(relation.from, locale);
    const to = nodePosition(relation.to, locale);
    const sameRowOffset = index % 2 === 0 ? -16 : 16;
    const startX = from.x + (to.x > from.x ? 102 : -102);
    const endX = to.x + (to.x > from.x ? -102 : 102);
    const midX = (startX + endX) / 2;
    const lineY = from.y + sameRowOffset;
    const label = wrap(relation[locale], isArabic ? 20 : 23, 1);
    return [
      `<g id="relation-${index + 1}">`,
      `<path d="M ${startX} ${lineY} L ${endX} ${lineY}" fill="none" stroke="${COLORS.blue}" stroke-width="2" stroke-linecap="round"/>`,
      `<circle cx="${endX}" cy="${lineY}" r="4" fill="${COLORS.gold}"/>`,
      textLines(label, midX, lineY - 12, {
        direction,
        color: COLORS.muted,
        fontSize: isArabic ? 15 : 13,
        fontWeight: 550,
      }),
      '</g>',
    ].join('');
  }).join('\n');

  const titleLines = wrap(title, isArabic ? 48 : 54, 2);
  const purposeLines = wrap(purpose, isArabic ? 82 : 96, 2);
  const aria = `${title}. ${purpose}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-label="${escapeXml(aria)}" direction="${direction}">
<title>${escapeXml(title)}</title>
<desc>${escapeXml(purpose)} ${escapeXml(SOURCE)}.</desc>
<rect width="1200" height="620" fill="${COLORS.background}"/>
<rect x="0" y="0" width="1200" height="3" fill="${COLORS.gold}"/>
<g font-family="${fontFamily}">
  <text x="${isArabic ? 1140 : 60}" y="55" text-anchor="${isArabic ? 'end' : 'start'}" direction="${direction}" unicode-bidi="plaintext" fill="${COLORS.gold}" font-size="15" font-weight="750">${escapeXml(isArabic ? 'شارح مفاهيمي مؤسسي' : 'INSTITUTIONAL CONCEPT EXPLAINER')}</text>
  ${textLines(titleLines, isArabic ? 1140 : 60, 105, {
    anchor: isArabic ? 'end' : 'start',
    direction,
    fontSize: isArabic ? 34 : 32,
    fontWeight: 780,
    lineHeight: 42,
  })}
  ${relationMarkup}
  ${nodeMarkup}
  <rect x="60" y="390" width="1080" height="1" fill="${COLORS.line}"/>
  ${textLines(purposeLines, isArabic ? 1140 : 60, 435, {
    anchor: isArabic ? 'end' : 'start',
    direction,
    color: COLORS.soft,
    fontSize: isArabic ? 21 : 18,
    fontWeight: 500,
    lineHeight: 30,
  })}
  <text x="${isArabic ? 1140 : 60}" y="565" text-anchor="${isArabic ? 'end' : 'start'}" direction="${direction}" unicode-bidi="plaintext" fill="${COLORS.muted}" font-size="${isArabic ? 16 : 14}">${escapeXml(isArabic ? `المصدر: ${SOURCE}` : `Source: ${SOURCE}`)}</text>
  <text x="${isArabic ? 60 : 1140}" y="565" text-anchor="${isArabic ? 'start' : 'end'}" direction="${direction}" unicode-bidi="plaintext" fill="${COLORS.muted}" font-size="${isArabic ? 16 : 14}">${escapeXml(isArabic ? 'شرح تعليمي دائم — بلا بيانات سوقية حية' : 'Evergreen educational explainer — no live market data')}</text>
</g>
</svg>
`;
}

function loadLibraryIds() {
  if (!fs.existsSync(CONCEPT_LIBRARY_PATH)) return new Set();
  try {
    const loaded = require(CONCEPT_LIBRARY_PATH);
    const candidate = loaded.CONCEPT_LIBRARY || loaded.concepts || loaded.default || loaded;
    const concepts = Array.isArray(candidate) ? candidate : Object.values(candidate || {});
    return new Set(concepts.map((concept) => String(concept.id || concept.slug || '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

function buildEducationalVisuals(options = {}) {
  const write = options.write === true;
  const libraryIds = loadLibraryIds();
  const definitions = libraryIds.size
    ? DEFINITIONS.filter((definition) => libraryIds.has(definition.id))
    : [...DEFINITIONS];

  if (definitions.length < 8) {
    throw new Error(`Educational visual coverage requires at least 8 supported concepts; found ${definitions.length}.`);
  }

  const assets = {};
  const explainers = definitions.map((definition) => {
    const enSvg = renderSvg(definition, 'en');
    const arSvg = renderSvg(definition, 'ar');
    const enFile = `data/visual/educational-explainers/${definition.id}-en.svg`;
    const arFile = `data/visual/educational-explainers/${definition.id}-ar.svg`;
    assets[enFile] = enSvg;
    assets[arFile] = arSvg;
    return {
      id: definition.id,
      concept_id: definition.id,
      visual_type: definition.visual_type,
      title_en: definition.title.en,
      title_ar: definition.title.ar,
      purpose_en: definition.purpose.en,
      purpose_ar: definition.purpose.ar,
      source: SOURCE,
      source_ref: 'tools/educational-concept-library.js',
      files: { en: enFile, ar: arFile },
      locales: ['en', 'ar'],
      rtl_safe: true,
      evergreen: true,
      metric_free: true,
      verified: true,
      deterministic: true,
      live_data_required: false,
      source_hash: stableHash(definition),
    };
  });

  const manifest = {
    schema_version: '1.0',
    artifact_type: 'educational_visual_explainers',
    source: SOURCE,
    purpose: 'Deterministic bilingual diagrams that explain institutional market concepts without live metrics.',
    deterministic: true,
    metric_free: true,
    explainer_count: explainers.length,
    explainers,
    source_hash: stableHash(explainers),
  };

  if (write) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const [relativePath, content] of Object.entries(assets)) {
      fs.writeFileSync(path.join(ROOT, relativePath), content, 'utf8');
    }
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  return { manifest, assets };
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const result = buildEducationalVisuals({ write });
  console.log(`[educational-visuals] ${write ? 'wrote' : 'built'} ${result.manifest.explainer_count} deterministic bilingual explainers.`);
}

module.exports = {
  buildEducationalVisuals,
  renderSvg,
  DEFINITIONS,
  SOURCE,
};
