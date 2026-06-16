'use strict';

// Phase 201 — canonical institutional asset registry. Single source of truth for
// the per-asset intelligence layer (cognitive network, asset scoring, asset
// pages, terminal). Each asset maps to its institutional-charts SPEC id and its
// cross-asset-state key (some are ETF proxies for an underlying the cross-asset
// layer tracks: UUP→DXY dollar, VIXY→VIX volatility, GLD→GOLD). Roles are
// descriptive institutional context, NOT recommendations.

const ASSETS = [
  {
    symbol: 'SPY', slug: 'spy', chart_id: 'spy-market-structure', cross_key: 'SPY',
    role_en: 'US large-cap equity beta — the broad-market reference tape',
    role_ar: 'بيتا الأسهم الأمريكية كبيرة رأس المال — التابع المرجعي للسوق العريض',
    related: ['QQQ', 'IWM', 'TLT', 'VIXY'],
  },
  {
    symbol: 'QQQ', slug: 'qqq', chart_id: 'qqq-duration-structure', cross_key: 'QQQ',
    role_en: 'Large-cap growth — duration-sensitive equity leadership',
    role_ar: 'النمو كبير رأس المال — قيادة الأسهم الحساسة للعوائد',
    related: ['SPY', 'TLT'],
  },
  {
    symbol: 'IWM', slug: 'iwm', chart_id: 'iwm-participation-structure', cross_key: 'IWM',
    role_en: 'Small-cap participation — the breadth read beneath the index',
    role_ar: 'مشاركة الأسهم صغيرة رأس المال — قراءة الاتساع تحت المؤشر',
    related: ['SPY'],
  },
  {
    symbol: 'GLD', slug: 'gld', chart_id: 'gld-real-yield-context', cross_key: 'GOLD',
    role_en: 'Gold — the real-yield and haven barometer',
    role_ar: 'الذهب — مقياس العوائد الحقيقية والملاذ الآمن',
    related: ['UUP', 'TLT'],
  },
  {
    symbol: 'TLT', slug: 'tlt', chart_id: 'tlt-yield-pressure', cross_key: 'TLT',
    role_en: 'Long-duration Treasuries — the rates and duration anchor',
    role_ar: 'سندات الخزانة طويلة الأجل — مرتكز الفائدة والمدة',
    related: ['QQQ', 'GLD'],
  },
  {
    symbol: 'UUP', slug: 'uup', chart_id: 'uup-dollar-liquidity', cross_key: 'DXY',
    role_en: 'US dollar proxy — the global liquidity tide',
    role_ar: 'مؤشر بديل للدولار الأمريكي — مدّ السيولة العالمية',
    related: ['GLD'],
  },
  {
    symbol: 'VIXY', slug: 'vixy', chart_id: 'vixy-volatility-proxy', cross_key: 'VIX',
    role_en: 'Volatility-futures proxy — the risk-stress gauge',
    role_ar: 'مؤشر بديل لعقود التقلب — مقياس ضغط المخاطر',
    related: ['SPY'],
  },
];

// Cross-asset relationships the cognitive network reasons over. `mode`:
//   risk_inverse  → the two legs normally move OPPOSITE in clean risk transmission
//                   (equity vs bonds, equity vs volatility).
//   risk_same     → the two legs normally move TOGETHER (large vs small-cap breadth,
//                   growth vs broad equity).
//   macro_inverse → gold vs dollar (normally opposite).
const RELATIONSHIPS = [
  { id: 'spy_vs_tlt', a: 'SPY', b: 'TLT', mode: 'risk_inverse', en: 'Equities vs Treasuries', ar: 'الأسهم مقابل سندات الخزانة' },
  { id: 'qqq_vs_tlt', a: 'QQQ', b: 'TLT', mode: 'risk_inverse', en: 'Growth vs duration', ar: 'النمو مقابل المدة' },
  { id: 'spy_vs_iwm', a: 'SPY', b: 'IWM', mode: 'risk_same', en: 'Large-cap vs small-cap breadth', ar: 'كبيرة مقابل صغيرة رأس المال (الاتساع)' },
  { id: 'gld_vs_uup', a: 'GLD', b: 'UUP', mode: 'macro_inverse', en: 'Gold vs the dollar', ar: 'الذهب مقابل الدولار' },
  { id: 'vixy_vs_spy', a: 'VIXY', b: 'SPY', mode: 'risk_inverse', en: 'Volatility vs equities', ar: 'التقلب مقابل الأسهم' },
];

const BY_SYMBOL = new Map(ASSETS.map((a) => [a.symbol, a]));
const SLUGS = ASSETS.map((a) => a.slug);

module.exports = { ASSETS, RELATIONSHIPS, BY_SYMBOL, SLUGS };
