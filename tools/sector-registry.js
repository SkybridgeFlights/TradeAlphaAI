'use strict';

// Phase 205 — canonical sector registry. Single source of truth for the sector
// intelligence layer (charts, structure/tactical/liquidity/participation,
// rotation, cognitive network, pages, terminal). Each sector is a real SPDR
// sector ETF; `group` drives rotation grouping; `related_assets` are the broad
// assets the sector is read against. Roles are descriptive context, not advice.

const SECTORS = [
  { symbol: 'XLK', slug: 'technology', group: 'growth', name_en: 'Technology', name_ar: 'التكنولوجيا',
    role_en: 'Technology — duration-sensitive growth leadership', role_ar: 'التكنولوجيا — قيادة النمو الحساسة للعوائد',
    macro_sensitivity_en: 'rate-sensitive (long duration)', macro_sensitivity_ar: 'حساس للفائدة (مدة طويلة)', related_assets: ['QQQ', 'SPY', 'TLT'] },
  { symbol: 'XLF', slug: 'financials', group: 'cyclical', name_en: 'Financials', name_ar: 'المالية',
    role_en: 'Financials — the cyclical and curve-sensitive complex', role_ar: 'المالية — المجموعة الدورية الحساسة لمنحنى العوائد',
    macro_sensitivity_en: 'curve / cyclical-sensitive', macro_sensitivity_ar: 'حساس للمنحنى والدورة', related_assets: ['SPY', 'TLT'] },
  { symbol: 'XLE', slug: 'energy', group: 'cyclical', name_en: 'Energy', name_ar: 'الطاقة',
    role_en: 'Energy — the inflation and commodity-cycle proxy', role_ar: 'الطاقة — مؤشر التضخم ودورة السلع',
    macro_sensitivity_en: 'inflation / dollar-sensitive', macro_sensitivity_ar: 'حساس للتضخم والدولار', related_assets: ['GLD', 'UUP'] },
  { symbol: 'XLV', slug: 'healthcare', group: 'defensive', name_en: 'Healthcare', name_ar: 'الرعاية الصحية',
    role_en: 'Healthcare — defensive large-cap stability', role_ar: 'الرعاية الصحية — استقرار دفاعي كبير رأس المال',
    macro_sensitivity_en: 'low macro sensitivity', macro_sensitivity_ar: 'حساسية كلية منخفضة', related_assets: ['SPY'] },
  { symbol: 'XLI', slug: 'industrials', group: 'cyclical', name_en: 'Industrials', name_ar: 'الصناعات',
    role_en: 'Industrials — the cyclical growth and breadth read', role_ar: 'الصناعات — قراءة النمو الدوري والاتساع',
    macro_sensitivity_en: 'cyclical / growth-sensitive', macro_sensitivity_ar: 'حساس للدورة والنمو', related_assets: ['IWM', 'SPY'] },
  { symbol: 'XLP', slug: 'consumer-staples', group: 'defensive', name_en: 'Consumer Staples', name_ar: 'السلع الاستهلاكية الأساسية',
    role_en: 'Consumer Staples — the defensive demand anchor', role_ar: 'السلع الأساسية — مرتكز الطلب الدفاعي',
    macro_sensitivity_en: 'low macro sensitivity', macro_sensitivity_ar: 'حساسية كلية منخفضة', related_assets: ['SPY'] },
  { symbol: 'XLU', slug: 'utilities', group: 'defensive', name_en: 'Utilities', name_ar: 'المرافق',
    role_en: 'Utilities — the rate-sensitive defensive / bond-proxy sector', role_ar: 'المرافق — القطاع الدفاعي الحساس للفائدة وبديل السندات',
    macro_sensitivity_en: 'rate-sensitive (bond proxy)', macro_sensitivity_ar: 'حساس للفائدة (بديل سندات)', related_assets: ['TLT'] },
  { symbol: 'XLY', slug: 'consumer-discretionary', group: 'cyclical', name_en: 'Consumer Discretionary', name_ar: 'السلع الاستهلاكية الكمالية',
    role_en: 'Consumer Discretionary — the risk-appetite and consumer-cycle read', role_ar: 'السلع الكمالية — قراءة الإقبال على المخاطر ودورة المستهلك',
    macro_sensitivity_en: 'consumer / growth-sensitive', macro_sensitivity_ar: 'حساس للمستهلك والنمو', related_assets: ['IWM', 'SPY'] },
  { symbol: 'XLB', slug: 'materials', group: 'cyclical', name_en: 'Materials', name_ar: 'المواد',
    role_en: 'Materials — the dollar and global-cycle sensitive complex', role_ar: 'المواد — المجموعة الحساسة للدولار والدورة العالمية',
    macro_sensitivity_en: 'dollar / inflation-sensitive', macro_sensitivity_ar: 'حساس للدولار والتضخم', related_assets: ['UUP', 'GLD'] },
  { symbol: 'XLRE', slug: 'real-estate', group: 'rate_sensitive', name_en: 'Real Estate', name_ar: 'العقارات',
    role_en: 'Real Estate — the most rate-sensitive equity sector', role_ar: 'العقارات — القطاع الأكثر حساسية للفائدة',
    macro_sensitivity_en: 'highly rate-sensitive', macro_sensitivity_ar: 'شديد الحساسية للفائدة', related_assets: ['TLT'] },
];

// Sector ↔ broad-asset relationships for the sector cognitive network.
//   confirm  → sector normally tracks the asset (same direction expected)
//   inverse  → sector normally moves opposite the asset
//   leadership → relative-strength read between two cohorts
const SECTOR_RELATIONSHIPS = [
  { id: 'xlk_qqq', sector: 'XLK', asset: 'QQQ', mode: 'confirm', kind: 'leadership', en: 'Technology vs Nasdaq growth', ar: 'التكنولوجيا مقابل نمو ناسداك' },
  { id: 'xlf_spy', sector: 'XLF', asset: 'SPY', mode: 'confirm', kind: 'cyclical', en: 'Financials vs the broad market', ar: 'المالية مقابل السوق العريض' },
  { id: 'xle_gld', sector: 'XLE', asset: 'GLD', mode: 'confirm', kind: 'macro', en: 'Energy vs gold (inflation)', ar: 'الطاقة مقابل الذهب (التضخم)' },
  { id: 'xle_uup', sector: 'XLE', asset: 'UUP', mode: 'inverse', kind: 'macro', en: 'Energy vs the dollar', ar: 'الطاقة مقابل الدولار' },
  { id: 'xlu_tlt', sector: 'XLU', asset: 'TLT', mode: 'confirm', kind: 'defensive', en: 'Utilities vs Treasuries (rates)', ar: 'المرافق مقابل سندات الخزانة (الفائدة)' },
  { id: 'xlre_tlt', sector: 'XLRE', asset: 'TLT', mode: 'confirm', kind: 'defensive', en: 'Real estate vs Treasuries (rates)', ar: 'العقارات مقابل سندات الخزانة (الفائدة)' },
  { id: 'xly_iwm', sector: 'XLY', asset: 'IWM', mode: 'confirm', kind: 'cyclical', en: 'Discretionary vs small-caps (risk appetite)', ar: 'السلع الكمالية مقابل صغيرة رأس المال (الإقبال على المخاطر)' },
  { id: 'xlv_spy', sector: 'XLV', asset: 'SPY', mode: 'confirm', kind: 'defensive', en: 'Healthcare vs the broad market', ar: 'الرعاية الصحية مقابل السوق العريض' },
  { id: 'xli_iwm', sector: 'XLI', asset: 'IWM', mode: 'confirm', kind: 'cyclical', en: 'Industrials vs small-caps', ar: 'الصناعات مقابل صغيرة رأس المال' },
  { id: 'xlb_uup', sector: 'XLB', asset: 'UUP', mode: 'inverse', kind: 'macro', en: 'Materials vs the dollar', ar: 'المواد مقابل الدولار' },
];

const BY_SYMBOL = new Map(SECTORS.map((s) => [s.symbol, s]));
const SLUGS = SECTORS.map((s) => s.slug);
const chartId = (symbol) => `${symbol.toLowerCase()}-sector`;

module.exports = { SECTORS, SECTOR_RELATIONSHIPS, BY_SYMBOL, SLUGS, chartId };
