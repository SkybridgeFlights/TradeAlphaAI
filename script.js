// Year: set into both #year (old) and #y (new) if present
(function setYear(){
  const y = new Date().getFullYear();
  const el1 = document.getElementById('year');
  const el2 = document.getElementById('y');
  if(el1) el1.textContent = y;
  if(el2) el2.textContent = y;
})();

// Configuration from environment
const CONFIG = {
  ga4ID: window.GA4_ID || 'G-XXXXXXX',
  contactEmail: 'TradeAlphaai6@gmail.com', // Public contact email
  telegramChannel: 'https://t.me/TradeAlphaAI'
};

// Translations (English default & Arabic provided in request)
const translations = {
  en: {
    'intro.title': 'Trade Smarter, Not Harder — AI-Powered Excellence',
    'intro.p1': "Experience the revolution in algorithmic trading. TradeAlpha AI combines cutting-edge machine learning with precision risk management to give you a competitive edge in every market condition.",
    'intro.p2': 'Emotions cost money. Our intelligent system trades with pure logic, removing the human error from your trading decisions.',
    'intro.p3': 'Join hundreds of traders who have transformed their portfolios with TradeAlpha AI. Your success story starts here.',
  'intro.cta': 'Join Telegram Channel',

  // Brand / tagline
  'brand.tagline':'🤖 Your smart trading partner',

  // Navigation
  'nav.articles': 'Articles',
  'nav.trading': 'Trading',

    'why.title':'Why TradeAlpha AI? Markets Demand Smarter Solutions.',
    'why.p1':'Markets never sleep—and neither does volatility. Traditional systems fail when conditions change. We adapt in real-time.',
    'why.p2':'TradeAlpha AI uses advanced self-calibration algorithms that continuously learn from market behavior, adjusting strategies dynamically without manual intervention.',
    'why.p3':'Consistency beats luck every single time. We focus on sustainable, repeatable profits—not chasing quick gains.',

    'lab.title':'The Power Under the Hood — Version 4.02',
    'lab.intro':'What makes TradeAlpha AI different:',
    'lab.b1':'🎯 ATR-Based Risk Control — Smart position sizing that adapts to volatility',
    'lab.b2':'📈 Dynamic BreakEven & Trailing — Lock in profits while minimizing losses',
    'lab.b3':'🔄 Self-Calibration Engine — Evolves every cycle to match market conditions',
    'lab.end':'Each update brings us closer to fully autonomous, intelligent trading. Version 5 is coming soon.',

    'pf.title':'Why Profit Factor (PF) Matters',
    'pf.p1':'Profit Factor is the ultimate measure of trading efficiency. It reveals how much you earn for every unit of capital at risk.',
    'pf.formula':'The Formula: PF = Total Gross Profit ÷ Total Gross Loss',
    'pf.formulaText':'PF = Total Gross Profit ÷ Total Gross Loss',
    'pf.note':'A PF above 1.5 indicates a robust system. TradeAlpha AI consistently maintains PF > 2.0 across all market conditions.',

    'vision.title':'Building the Future of Algorithmic Trading',
    'vision.p1':'Our mission: democratize elite trading technology. Every trader deserves access to institutional-grade algorithms.',
    'vision.p2':'From Forex to Gold, Crypto to Indices—TradeAlpha AI adapts to every asset class with precision and confidence.',
    'vision.p3':'This isn\'t about speed. It\'s about engineering sustainability, discipline, and long-term wealth creation.',
    'banner.head':'Ready to elevate your trading?',
    'banner.sub':'Start with TradeAlpha AI — choose weekly, monthly, or annual plans.',
    'banner.cta':'Subscribe Now',

    // Features Section
    'feature.1.title':'99.2% Uptime',
    'feature.1.desc':'Enterprise infrastructure ensures your strategies work uninterrupted.',
    'feature.2.title':'Real-Time Signals',
    'feature.2.desc':'Instant alerts across all asset classes — never miss a market opportunity.',
    'feature.3.title':'Bank-Level Security',
    'feature.3.desc':'Advanced encryption protects your data and API keys 24/7.',
    'feature.4.title':'Global Markets',
    'feature.4.desc':'Trade Forex, Crypto, Commodities, and Indices on one unified platform.',
    'feature.5.title':'Mobile Ready',
    'feature.5.desc':'Track your trades anywhere with our responsive app.',
    'feature.6.title':'Expert Support',
    'feature.6.desc':'24/7 multi-language support team — Arabic, English, and more.',

    // Subscription Section
    'subscribe.title':'🚀 Choose Your Path to Success',
    'subscribe.subtitle':'Select the plan that fits your trading goals. Start with a free 7-day trial — no credit card needed.',
    'subscribe.weekly':'📅 Weekly Pass',
    'subscribe.monthly':'📆 Monthly Pro',
    'subscribe.yearly':'📊 Yearly Elite',
    'subscribe.badge':'⭐ Most Popular',
    'subscribe.savings':'Save 30%',
    'subscribe.btn.weekly':'Subscribe Weekly',
    'subscribe.btn.monthly':'Subscribe Monthly',
    'subscribe.btn.yearly':'Subscribe Yearly',
    'subscribe.contact':'Contact us to set price',

    // Weekly features
    'subscribe.weekly.f1':'✓ Full access for 7 days',
    'subscribe.weekly.f2':'✓ All signals',
    'subscribe.weekly.f3':'✓ Email support',
    'subscribe.weekly.f4':'✓ Basic analytics',

    // Monthly features
    'subscribe.monthly.f1':'✓ Full access for 30 days',
    'subscribe.monthly.f2':'✓ Advanced signals',
    'subscribe.monthly.f3':'✓ Priority support',
    'subscribe.monthly.f4':'✓ Advanced analytics',
    'subscribe.monthly.f5':'✓ Custom alerts',

    // Yearly features
    'subscribe.yearly.f1':'✓ Full access for 365 days',
    'subscribe.yearly.f2':'✓ Elite signals with smart analytics',
    'subscribe.yearly.f3':'✓ VIP 24/7 support',
    'subscribe.yearly.f4':'✓ Premium analytics',
    'subscribe.yearly.f5':'✓ Access to private trading room',
    
    // Footer
    'footer.copyright':'All rights reserved.',
    // Site development warning (clearer)
    'site.devWarning':'This website is under active development. Some features may be incomplete or change without notice. Use with caution.',
    'site.devLearn':'Learn more',
    
    // Tadawul page
    'nav.home': 'Home',
    'tadawul.title': 'Trading — Trade | TradeAlpha AI',
    'tadawul.heading': 'Trading — Start with TradeAlpha AI',
    'tadawul.subtitle': 'Start trading with confidence — real-time signals, smart risk management, and a practical guide to turning signals into profits.',
    'tadawul.why.title': 'Why Trade with TradeAlpha AI?',
    'tadawul.why.p1': 'Trading requires a clear system, accurate data, and disciplined execution. This is where TradeAlpha AI comes in: an intelligent trading system that combines real-time signals, probabilistic analysis models, and automated risk management mechanisms. We provide traders with tools that help reduce losses and improve profitability through performance monitoring and periodic parameter recalibration.',
    'tadawul.why.p2': 'Whether you are a beginner looking for practical guidance to start trading, or a professional trader who wants intelligent mechanisms to enhance your strategies, our system supports different paths. Here we explain working principles, how to connect accounts, and best practices for using signals with risk management tools.',
    'tadawul.features.title': 'Key Features',
    'tadawul.features.f1': 'Real-time and predictive signals customizable to your needs.',
    'tadawul.features.f2': 'Dynamic risk management that reacts to market volatility.',
    'tadawul.features.f3': 'Detailed performance reports and recommendations for strategy improvement.',
    'tadawul.features.f4': 'Support for multiple assets: Forex, Crypto, Commodities, and Indices.',
    'tadawul.getting-started.title': 'How to Start Trading with Us',
    'tadawul.getting-started.steps': '1) Register for a free demo account.\n2) Try the weekly plan to understand signals and how to manage them.\n3) Practice tracking signals and executing them manually before upgrading to automated execution if desired.',
    'tadawul.tips.title': 'Tips for Trading Success',
    'tadawul.tips.content': '- Don\'t follow signals randomly: use a clear risk plan and define your risk per trade.\n- Make sure to test signals in a demo environment first.\n- Monitor returns over weeks and judge signal quality based on Profit Factor (PF) and performance records.',
    'tadawul.conclusion': 'Ultimately, the word "Trading" is not just a term; it is a goal that requires a good plan, appropriate tools, and disciplined execution. With TradeAlpha AI we provide you all three elements in one platform.',
    'tadawul.cta.subscribe': 'Subscribe Now — 7-Day Trial',
    'tadawul.cta.contact': 'Contact Us',
    
    // Articles page
    'articles.title': 'Articles — Best Trading Articles',
    'articles.heading': 'Featured Articles on Trading',
    'articles.subtitle': 'Selected from our in-depth articles to help you trade wisely and comfortably.',
    'articles.link1': 'Best Forex Trading Strategy: A Practical Guide',
    'articles.desc1': 'A comprehensive guide to implementing a strong and proven strategy with effective risk management techniques.',
    'articles.link2': 'Capital Management: The Foundation of Trading Success',
    'articles.desc2': 'Learn how to protect your capital and build sustainability in profitability.',
    'articles.link3': 'Bagaimana Menggunakan Sinyal TradeAlpha AI Secara Efektif',
    'articles.desc3': 'Petunjuk praktis untuk mengubah sinyal menjadi hasil yang berguna di akun Anda.',
    
    // Best Forex Strategy article
    'bestforex.title': 'Best Forex Trading Strategy: A Practical and Comprehensive Guide',
    'bestforex.subtitle': 'Setup and practices to help you transform a plan into consistent results.',
    'bestforex.intro': 'In the world of Forex, which moves with dynamic fluctuations, strategies that combine simplicity of execution with robust risk management are preferred. Through our experience in designing advanced trading signal engines, we recommend that traders focus on a hybrid strategy that combines trend-following analysis with multi-scale position management (position scaling).',
    'bestforex.components.title': 'Strategy Components',
    'bestforex.components.text': 'First: identify the trend on a larger timeframe (4 hours or daily). Second: enter on a smaller timeframe when a confluence signal appears (for example, 15 minutes or 1 hour). Third: use ATR levels for contract size and set smart stop-loss points.',
    'bestforex.rules.title': 'Entry and Trade Maintenance Rules',
    'bestforex.rules.text': '- Trend identification is the primary factor: trading with the trend increases odds in your favor.\n- Use dual-confirmation signals: momentum indicator + breakout of support/resistance zone.\n- Set an initial stop-loss based on 1–1.5×ATR, then move to break-even when reaching a specified profit ratio.',
    'bestforex.capital.title': 'Capital Management',
    'bestforex.capital.text': 'Risk per trade should not exceed 1–2% of available capital. When scaling in positions, reduce risk on each addition so total risk stays within acceptable range.',
    'bestforex.testing.title': 'Strategy Testing',
    'bestforex.testing.text': 'Before applying to a live account, run tests on historical data and demo account for at least 6 months of live trading or 500 trades — whichever is shorter. Monitor Profit Factor (PF), average gain/loss, and win rate.',
    'bestforex.conclusion.title': 'Conclusion',
    'bestforex.conclusion.text': 'The combination of simplicity in entry rules and disciplined risk management is what makes a strategy sustainable. TradeAlpha AI provides calibration tools and signals that help execute this approach with precision and graduated automation, making it easier for traders to maintain discipline and increase performance stability.',
    'bestforex.de.subtitle': 'Setup und Praktiken, um Ihren Plan in konsistente Ergebnisse umzuwandeln.',
    'bestforex.de.intro': 'In der Welt des Forex-Handels, der sich mit dynamischen Schwankungen bewegt, sind Strategien bevorzugt, die Einfachheit der Ausführung mit robustem Risikomanagement verbinden. Aufgrund unserer Erfahrung bei der Entwicklung fortschrittlicher Handelssignalmaschinen empfehlen wir Händlern, sich auf eine Hybrid-Strategie zu konzentrieren, die Trend-Folge-Analyse mit Multi-Scale-Positionsverwaltung (Position Scaling) kombiniert.',
    'bestforex.de.components.title': 'Strategiekomponenten',
    'bestforex.de.components.text': 'Erste: Identifizieren Sie den Trend in einem größeren Zeitrahmen (4 Stunden oder täglich). Zweite: Betreten Sie einen kleineren Zeitrahmen, wenn ein Confluence-Signal erscheint (z.B. 15 Minuten oder 1 Stunde). Dritte: Verwenden Sie ATR-Level für die Kontraktgröße und setzen Sie intelligente Stop-Loss-Punkte.',
    'bestforex.de.rules.title': 'Ein- und Handels-Erhaltungsregeln',
    'bestforex.de.rules.text': '- Trendidentifizierung ist der Primärfaktor: Mit dem Trend zu handeln erhöht die Chancen in Ihrem Sinne.\n- Verwenden Sie Doppelbestätigungssignale: Momentum-Indikator + Ausbruch aus Support-/Widerstandszone.\n- Setzen Sie einen ersten Stop-Loss basierend auf 1–1,5×ATR, dann verschieben Sie auf Breakeven, wenn Sie ein bestimmtes Gewinnniveau erreichen.',
    'bestforex.de.capital.title': 'Kapitalverwaltung',
    'bestforex.de.capital.text': 'Das Risiko pro Trade sollte 1–2% des verfügbaren Kapitals nicht überschreiten. Wenn Sie Positionen erhöhen, reduzieren Sie das Risiko für jede Addition, damit das Gesamtrisiko im akzeptablen Bereich bleibt.',
    'bestforex.de.testing.title': 'Strategie-Tests',
    'bestforex.de.testing.text': 'Vor der Anwendung auf ein Live-Konto führen Sie Tests auf historischen Daten und Demo-Konto für mindestens 6 Monate Live-Handel oder 500 Trades durch – je nachdem, was kürzer ist. Überwachen Sie Profit Factor (PF), Durchschnittsgewinn/-verlust und Gewinnrate.',
    'bestforex.de.conclusion.title': 'Fazit',
    'bestforex.de.conclusion.text': 'Die Kombination aus Einfachheit in den Einstiegsregeln und diszipliniertem Risikomanagement macht eine Strategie nachhaltig. TradeAlpha AI bietet Kalibrierungstools und Signale, die bei der Umsetzung dieses Ansatzes mit Präzision und abgestufter Automatisierung helfen, damit es für Händler einfacher ist, Disziplin zu bewahren und die Leistungsstabilität zu erhöhen.',
    
    // Capital Management article
    'capital.title': 'Capital Management: The Foundation of Trading Success',
    'capital.subtitle': 'Protecting capital is the difference between a good trader and a sustainable one.',
    'capital.intro': 'Capital management is not just numbers; it is a philosophy that transforms market fluctuations into graduated opportunities. The trader who understands how to limit losses and protect capital has the ability to continue and learn from mistakes without losing everything in a single trade.',
    'capital.rules.title': 'Simple but Impactful Rules',
    'capital.rules.text': '- Define a risk ratio per trade (1% or 2%) and do not exceed it.\n- Use fixed position sizes or flexible ratios built on ATR to match trade size with market volatility.\n- Diversify your positions and avoid high exposure to a single pair or asset.',
    'capital.strategies.title': 'Strategies to Reduce Risk',
    'capital.strategies.text': 'One effective method is using logical drawdown recovery rules: when losses exceed a certain percentage of balance, temporarily reduce risk until performance returns to target levels.',
    'capital.calculation.title': 'Risk and Profit Calculation',
    'capital.calculation.text': 'Don\'t rely on win rate alone; calculate expected profit via average gain, maximum loss, and win rate. These indicators let you assess strategy viability over medium and long term.',
    'capital.tips.title': 'Practical Tips',
    'capital.tips.text': 'Write a clear trading plan, stick to it, and use tools like TradeAlpha AI to monitor performance and alert you when risk limits are exceeded. Automation helps reduce human errors and apply rules with precision.',
    
    // Use Signals article
    'signals.title': 'How to Use TradeAlpha AI Signals Effectively',
    'signals.subtitle': 'From signal to decision: practical steps to transform alerts into safe results.',
    'signals.intro': 'Signals are just the beginning of the journey, but they are not a substitute for a clear plan. Use our signals as a helper tool: evaluate them, test them, then decide whether to execute manually or through automated execution.',
    'signals.steps.title': 'Suggested Steps',
    'signals.steps.text': '1. Filter signals: define confluence criteria (e.g., overall trend, liquidity level, or important economic event timing).\n2. Calculate appropriate position size for each signal via defined risk ratio or ATR-based sizing.\n3. Record each signal and track performance monthly to improve filter rules.',
    'signals.automation.title': 'Controlled Automation',
    'signals.automation.text': 'When moving to automation, set strict rules to pause automation during drawdown or market condition changes. Automation should reduce human errors, not multiply them.',
    'signals.conclusion.title': 'Summary',
    'signals.conclusion.text': 'Strong signals need context: a plan, risk management, and monitoring. When you apply these elements together, signal chances increase to transform into a profitable and sustainable strategy.',
    
    // Article CTAs
    'articles.cta.try': 'Try Our Signals — 7-Day Trial',
    'articles.cta.free': 'Start Free Trial',
    'articles.cta.test': 'Test Our Signals Now'
  },
  ar: {
    // Arabic text - Professional Marketing Focused
    'intro.title':'التداول الذكي مع الذكاء الاصطناعي — احترافية بلا منازع',
    'intro.p1':'استشعر ثورة التداول الخوارزمي. يجمع TradeAlpha AI بين تقنيات التعلم الآلي والإدارة الذكية للمخاطر لمنحك ميزة تنافسية في كل ظروف السوق.',
    'intro.p2':'العواطف تُكلف المال. نظامنا الذكي يتداول بحتمية منطقية نقية، محررًا قراراتك من الأخطاء البشرية.',
    'intro.p3':'انضم إلى مئات المتداولين الذين غيّروا محافظهم مع TradeAlpha AI. قصة نجاحك تبدأ هنا.',
  'intro.cta':'انضم إلى قناة تيليجرام',

    'why.title':'لماذا TradeAlpha AI؟ الأسواق تطلب حلولاً أذكى.',
    'why.p1':'الأسواق لا تنام—والتذبذب أيضاً. الأنظمة التقليدية تفشل عندما تتغير الظروف. نحن نتكيف في الوقت الفعلي.',
    'why.p2':'يستخدم TradeAlpha AI خوارزميات معايرة ذاتية متقدمة تتعلم بشكل مستمر من سلوك السوق، معدلة الاستراتيجيات بديناميكية دون تدخل يدوي.',
    'why.p3':'الاستقرار يتفوق على الحظ في كل مرة. نركز على الأرباح المستدامة والقابلة للتكرار، لا على المكاسب السريعة.',

    'lab.title':'القوة تحت الغطاء — الإصدار 4.02',
    'lab.intro':'ما يميز TradeAlpha AI:',
    'lab.b1':'🎯 التحكم في المخاطر بناءً على ATR — تحجيم ذكي للمراكز يتكيف مع التذبذب',
    'lab.b2':'📈 نقطة التعادل الديناميكية والتتبع — أقفل الأرباح مع تقليل الخسائر',
    'lab.b3':'🔄 محرك المعايرة الذاتية — يتطور كل دورة لمطابقة ظروف السوق',
    'lab.end':'كل تحديث يقربنا من التداول الذكي المستقل تماماً. الإصدار 5 قريباً جداً.',

    'pf.title':'لماذا معامل الربحية مهم؟',
    'pf.p1':'معامل الربحية هو المقياس النهائي لكفاءة التداول. يكشف كم تكسب مقابل كل وحدة رأس مال معرض للخطر.',
    'pf.formula':'الصيغة: معامل الربحية = إجمالي الربح ÷ إجمالي الخسارة',
    'pf.formulaText':'معامل الربحية = إجمالي الربح ÷ إجمالي الخسارة',
    'pf.note':'معامل الربحية فوق 1.5 يشير إلى نظام قوي. TradeAlpha AI يحافظ باستمرار على معامل > 2.0 في جميع ظروف السوق.',

    'vision.title':'بناء مستقبل التداول الخوارزمي',
    'vision.p1':'رسالتنا: ديمقراطية تكنولوجيا التداول النخبوية. كل متداول يستحق الوصول إلى خوارزميات من الدرجة المؤسسية.',
    'vision.p2':'من الفوركس إلى الذهب، من العملات الرقمية إلى الرموز—TradeAlpha AI يتكيف مع كل فئة أصول بدقة وثقة.',
    'vision.p3':'الأمر ليس عن السرعة. إنه عن هندسة الاستدامة والانضباط وخلق الثروة على المدى الطويل.',
    'banner.head':'هل أنت جاهز للارتقاء بتداولك؟',
    'banner.sub':'ابدأ مع TradeAlpha AI — اختر الباقة الأسبوعية أو الشهرية أو السنوية.',
    'banner.cta':'اشترك الآن',

    // العلامة التجارية / العبارة التعريفية
    'brand.tagline':'🤖 شريكك الذكي في التداول',

    // Navigation
    'nav.articles': 'مقالات',
    'nav.trading': 'تداول',

    // قسم الميزات
    'feature.1.title':'وقت تشغيل 99.2%',
    'feature.1.desc':'بنية تحتية مؤسسية تضمن أن استراتيجياتك تعمل دون انقطاع.',
    'feature.2.title':'إشارات فورية',
    'feature.2.desc':'تنبيهات آنية عبر جميع فئات الأصول — لا تفوت أي فرصة في السوق.',
    'feature.3.title':'أمن بمستوى بنكي',
    'feature.3.desc':'تشفير متقدم يحمي بياناتك ومفاتيح الـ API على مدار الساعة.',
    'feature.4.title':'أسواق عالمية',
    'feature.4.desc':'تداول الفوركس، العملات الرقمية، السلع والمؤشرات في منصة واحدة موحدة.',
    'feature.5.title':'جاهز للجوال',
    'feature.5.desc':'تابع صفقاتك من أي مكان عبر تطبيقنا المتجاوب.',
    'feature.6.title':'دعم خبير',
    'feature.6.desc':'فريق دعم متعدد اللغات 24/7 — بالعربية والإنجليزية والمزيد.',

    // قسم الاشتراك
    'subscribe.title':'🚀 اختر مسار اشتراكك نحو النجاح',
    'subscribe.subtitle':'اختر الخطة التي تناسب أهداف تداولك. ابدأ بتجربة مجانية لمدة 7 أيام — بدون بطاقة ائتمان.',
    'subscribe.weekly':'📅 باقة أسبوعية',
    'subscribe.monthly':'📆 باقة شهرية',
    'subscribe.yearly':'📊 باقة سنوية (Elite)',
    'subscribe.badge':'⭐ الأكثر شيوعاً',
    'subscribe.savings':'وفر 30%',
    'subscribe.btn.weekly':'اشترك أسبوعياً',
    'subscribe.btn.monthly':'اشترك شهرياً',
    'subscribe.btn.yearly':'اشترك سنوياً',
    'subscribe.contact':'تواصل معنا لتحديد السعر',

    // ميزات الباقة الأسبوعية
    'subscribe.weekly.f1':'✓ وصول كامل لمدة 7 أيام',
    'subscribe.weekly.f2':'✓ جميع الإشارات',
    'subscribe.weekly.f3':'✓ دعم عبر البريد الإلكتروني',
    'subscribe.weekly.f4':'✓ تحليلات أساسية',

    // ميزات الباقة الشهرية
    'subscribe.monthly.f1':'✓ وصول كامل لمدة 30 يوم',
    'subscribe.monthly.f2':'✓ إشارات متقدمة',
    'subscribe.monthly.f3':'✓ دعم أولوية',
    'subscribe.monthly.f4':'✓ تحليلات متقدمة',
    'subscribe.monthly.f5':'✓ تنبيهات مخصصة',

    // ميزات الباقة السنوية
    'subscribe.yearly.f1':'✓ وصول كامل لمدة 365 يوم',
    'subscribe.yearly.f2':'✓ إشارات النخبة مع تحليلات ذكية',
    'subscribe.yearly.f3':'✓ دعم VIP 24/7',
    'subscribe.yearly.f4':'✓ تحليلات متميزة',
    'subscribe.yearly.f5':'✓ دخول غرفة تداول خاصة',
    
    // Footer
    'footer.copyright':'جميع الحقوق محفوظة.',
    // تحذير التطوير: نص أوضح
    'site.devWarning':'الموقع قيد التطوير حالياً. بعض الميزات قد تكون غير مكتملة أو قد تتغير بدون إشعار. يُرجى الاستخدام بحذر.',
    'site.devLearn':'المزيد من التفاصيل',
    
    // صفحة التداول
    'nav.home': 'الرئيسية',
    'tadawul.title': 'تداول — Trade | TradeAlpha AI',
    'tadawul.heading': 'تداول — ابدأ مع TradeAlpha AI',
    'tadawul.subtitle': 'ابدأ تداولك بثقة مع TradeAlpha AI — إشارات آنية، إدارة مخاطرة ذكية، ودليل عملي لتحويل الإشارات إلى أرباح.',
    'tadawul.why.title': 'لماذا تداول مع TradeAlpha AI؟',
    'tadawul.why.p1': 'التداول يحتاج إلى نظام واضح، بيانات دقيقة، وانضباط تنفيذ. هنا يأتي دور TradeAlpha AI: نظام تداول ذكي يجمع بين إشارات آنية، نماذج تحليل احتمالي، وآليات إدارة مخاطرة آلية. نقدم للمتداولين أدوات تساعد في تقليل الخسائر وتحسين نسبة الربحية عبر مراقبة الأداء وإعادة معايرة الإعدادات بشكل دوري.',
    'tadawul.why.p2': 'سواء كنت مبتدئاً تبحث عن دليل عملي للبدء في التداول، أو متداول محترف يريد آليات ذكية لتعزيز استراتيجياته، نظامنا يدعم مسارات مختلفة. نشرح هنا مبادئ العمل، وكيفية ربط الحسابات، وأفضل الممارسات لاستخدام الإشارات مع أدوات إدارة المخاطر.',
    'tadawul.features.title': 'مميزات رئيسية',
    'tadawul.features.f1': 'إشارات فورية وتنبؤية قابلة للتخصيص.',
    'tadawul.features.f2': 'إدارة مخاطرة ديناميكية تتفاعل مع تقلبات السوق.',
    'tadawul.features.f3': 'تقارير أداء مفصّلة وتوصيات لتحسين الاستراتيجية.',
    'tadawul.features.f4': 'دعم للأصول المتعددة: فوركس، كريبتو، سلع ومؤشرات.',
    'tadawul.getting-started.title': 'كيفية البدء في التداول معنا',
    'tadawul.getting-started.steps': '1) سجّل للحصول على حساب تجريبي مجاناً.\n2) جرّب الباقة الأسبوعية لمعرفة طريقة الإشارات وإدارتها.\n3) تدرّب على تتبّع الإشارات وتنفيذها يدوياً قبل الترقية للتنفيذ الآلي إن رغبت.',
    'tadawul.tips.title': 'نصائح لنجاح تداولك',
    'tadawul.tips.content': '- لا تتبع الإشارات بصورة عشوائية: استخدم خطة مخاطرة واضحة وحدد نسبة المخاطرة لكل صفقة.\n- احرص على اختبار الإشارات في بيئة تجريبية أولاً.\n- راقب العوائد على مدار أسابيع واحكم على جودة الإشارات بناءً على معامل الربحية (PF) وسجل الأداء.',
    'tadawul.conclusion': 'في النهاية، كلمة تداول ليست مجرد مصطلح؛ إنها هدف يتطلب خطة جيدة، أدوات ملائمة، وانضباط تنفيذي. مع TradeAlpha AI نوفر لك العناصر الثلاثة في منصة واحدة.',
    'tadawul.cta.subscribe': 'اشترك الآن — تجربة 7 أيام',
    'tadawul.cta.contact': 'تواصل معنا',
    
    // صفحة المقالات
    'articles.title': 'مقالات — أفضل مقالات التداول',
    'articles.heading': 'مقالات مميّزة في التداول',
    'articles.subtitle': 'مختار من مقالاتنا المتعمقة لمساعدتك على التداول بذكاء ورفاهية.',
    'articles.link1': 'أفضل استراتيجية تداول الفوركس: دليل عملي',
    'articles.desc1': 'دليل متكامل لتطبيق استراتيجية قوية ومُثبتة بأساليب إدارة مخاطرة فعّالة.',
    'articles.link2': 'إدارة رأس المال: أساس النجاح في التداول',
    'articles.desc2': 'تعلم كيف تحمي رأس المال وتبني استمرارية في الربحية.',
    'articles.link3': 'كيفية استخدام إشارات TradeAlpha AI بفعالية',
    'articles.desc3': 'إرشادات عملية لتحويل الإشارات إلى نتائج مفيدة على حسابك.',
    
    // Article CTAs - Arabic
    'articles.cta.try': 'جرّب إشاراتنا — تجربة 7 أيام',
    'articles.cta.free': 'ابدأ التجربة المجانية',
    'articles.cta.test': 'اختبر إشاراتنا الآن',
    
    // Best Forex Strategy article - Arabic
    'bestforex.title': 'أفضل استراتيجية تداول الفوركس: دليل عملي وشامل',
    'bestforex.subtitle': 'إعداد وممارسات تساعدك على تحويل خطة إلى نتائج مستمرة.',
    'bestforex.intro': 'في عالم الفوركس، الذي يتحرك بتقلبات ديناميكية، تُفضّل الاستراتيجيات التي تجمع بين بساطة التنفيذ وصلابة إدارة المخاطرة. من خلال خبرتنا في تصميم محركات إشارات Trading المتقدمة، نصِحنا بتركيز المتداولين على استراتيجية هجينة تجمع بين تحليل الاتجاه (trend-following) وإدارة مراكز متعددة الحجم (position scaling).',
    'bestforex.components.title': 'مقومات الاستراتيجية',
    'bestforex.components.text': 'أولاً: تحديد الاتجاه على إطار زمني أكبر (4 ساعات أو يومي). ثانياً: الدخول في إطار زمني أصغر عند تبيان إشارة توافق (مثلاً 15 دقيقة أو ساعة). ثالثاً: استخدام مستويات ATR لحجم العقد وتحديد نقاط وقف الخسارة الذكية.',
    'bestforex.rules.title': 'قواعد دخول وصيانة الصفقة',
    'bestforex.rules.text': '- تحديد الاتجاه هو العامل الأساسي: التداول مع الاتجاه يزيد الاحتمالات لصالحك.\n- استخدم إشارات ذات تأكيد مزدوج: مؤشر زخم + اختراق منطقة دعم/مقاومة.\n- ضع وقف خسارة أولي بناءً على 1–1.5×ATR، ثم حرّك وقف الخسارة لعدم خسارة الربح (break-even) عند الوصول إلى نسبة ربح محددة.',
    'bestforex.capital.title': 'إدارة رأس المال',
    'bestforex.capital.text': 'حجم المخاطرة لكل صفقة لا يجب أن يتجاوز 1–2% من رأس المال المتاح. عند التدرج في حجم المراكز (scaling in)، خفّض المخاطرة على كل تراكب بحيث تبقى المخاطرة الإجمالية ضمن النطاق المقبول.',
    'bestforex.testing.title': 'اختبار الاستراتيجية',
    'bestforex.testing.text': 'قبل تطبيقها على الحساب الحقيقي، نفّذ اختبارات على بيانات تاريخية وفي حساب تجريبي لفترة لا تقل عن 6 أشهر من التداولات الحية أو 500 صفقة — أيهما أقصر. راقب معامل الربحية (PF) ومتوسط الربح/الخسارة ونسبة الفوز.',
    'bestforex.conclusion.title': 'خاتمة',
    'bestforex.conclusion.text': 'الجمع بين البساطة في قواعد الدخول وهندسة محكمة لإدارة المخاطرة هو ما يجعل الاستراتيجية قابلة للبقاء. TradeAlpha AI يوفر أدوات معايرة وإشارات تساعد في تنفيذ هذه المقاربة بدقة وبأتمتة متدرجة، ما يسهّل على المتداولين الحفاظ على انضباطهم وزيادة ثبات الأداء.',
    
    // Capital Management article - Arabic
    'capital.title': 'إدارة رأس المال: أساس النجاح في التداول',
    'capital.subtitle': 'حماية رأس المال هي الفارق بين المتداول الجيد والمتداول المستمر.',
    'capital.intro': 'إدارة رأس المال ليست مجرد أرقام؛ إنها فلسفة تُحوّل تقلبات السوق إلى فرص متدرجة. المتداول الذي يفهم كيف يقيّد خسائره ويحافظ على رأس المال يمتلك القدرة على الاستمرار والتعلم من الأخطاء دون أن يُفقد كل شيء في صفقة واحدة.',
    'capital.rules.title': 'قواعد بسيطة لكنها مؤثرة',
    'capital.rules.text': '- حدِّد نسبة مخاطرة لكل صفقة (1% أو 2%) ولا تتجاوزها.\n- استخدم أحجام مراكز ثابتة أو نسبة مرنة مبنية على ATR لملاءمة حجم الصفقة مع تقلب السوق.\n- اعمل على تنويع مراكزك وتجنب التعرض العالي لزوج أو أصل واحد.',
    'capital.strategies.title': 'استراتيجيات لتقليل المخاطر',
    'capital.strategies.text': 'إحدى الطرق الفعالة هي استخدام قواعد تعويض خسارة (drawdown recovery) المنطقية: عند سلسلة خسائر تتجاوز نسبة معينة من الرصيد، خفّض المخاطرة مؤقتاً حتى يعود الأداء إلى المستويات المستهدفة.',
    'capital.calculation.title': 'حساب المخاطرة والربح',
    'capital.calculation.text': 'لا تعتمد على نسبة الفوز وحدها؛ حسِب الربح المتوقع عبر متوسط الربح والحد الأقصى للخسارة ومعدل الفوز. هذه المؤشرات تتيح لك تقييم قابلية الاستراتيجية للنجاح على المدى المتوسط والطويل.',
    'capital.tips.title': 'نصائح عملية',
    'capital.tips.text': 'دوّن خطة تداول واضحة، التزم بها، واستخدم أدوات مثل TradeAlpha AI لمراقبة الأداء وتنبيهك عند تجاوز حدود المخاطرة. الأتمتة تساعد على الحد من الأخطاء البشرية وتطبيق القواعد بخطوات مُحكمة.'
  },
  de: {
    // German - Professionelle Handelsplattform
    'intro.title':'Intelligenter Handel mit KI — Professionelle Exzellenz',
    'intro.p1':'Erleben Sie die Revolution im algorithmischen Handel. TradeAlpha AI kombiniert hochmoderne Machine Learning mit präzisem Risikomanagement, um Ihnen in jeder Marktlage einen Vorteil zu verschaffen.',
    'intro.p2':'Emotionen kosten Geld. Unser intelligentes System handelt mit reiner Logik und befreit Ihre Entscheidungen von menschlichen Fehlern.',
    'intro.p3':'Schließen Sie sich Hunderten von Händlern an, die ihr Portfolio mit TradeAlpha AI transformiert haben. Ihre Erfolgsgeschichte beginnt hier.',
    'intro.cta':'Dem Telegram-Kanal beitreten',

    'why.title':'Warum TradeAlpha AI? Märkte brauchen intelligentere Lösungen.',
    'why.p1':'Märkte schlafen nie – Volatilität auch nicht. Traditionelle Systeme versagen bei Marktveränderungen. Wir passen uns in Echtzeit an.',
    'why.p2':'TradeAlpha AI nutzt fortgeschrittene Selbstkalibrierungsalgorithmen, die kontinuierlich vom Marktverhalten lernen und Strategien dynamisch anpassen – ohne manuelle Intervention.',
    'why.p3':'Konsistenz schlägt Glück immer. Wir konzentrieren uns auf nachhaltige, wiederholbare Gewinne – nicht auf schnelle Gewinne.',

    'lab.title':'Die Kraft unter der Motorhaube — Version 4.02',
    'lab.intro':'Was TradeAlpha AI unterscheidet:',
    'lab.b1':'🎯 ATR-basierte Risikokontrolle — Intelligente Positionsgröße, die sich an Volatilität anpasst',
    'lab.b2':'📈 Dynamisches Breakeven & Trailing — Sperren Sie Gewinne, während Sie Verluste minimieren',
    'lab.b3':'🔄 Selbstkalibrierungs-Engine — Entwickelt sich jede Zyklusperiode, um Marktbedingungen anzupassen',
    'lab.end':'Jedes Update bringt uns näher an vollständig autonomen, intelligenten Handel. Version 5 kommt bald.',

    'pf.title':'Warum ist die Gewinnquote (PF) wichtig?',
    'pf.p1':'Die Gewinnquote ist das ultimative Maß für Handelseffizienz. Sie zeigt, wie viel Sie pro Risikoeinheit verdienen.',
    'pf.formula':'Die Formel: GQ = Gesamtgewinn ÷ Gesamtverlust',
    'pf.formulaText':'GQ = Gesamtgewinn ÷ Gesamtverlust',
    'pf.note':'Eine GQ über 1,5 zeigt ein robustes System an. TradeAlpha AI hält konsistent eine GQ > 2,0 unter allen Marktbedingungen.',

    'vision.title':'Die Zukunft des algorithmischen Handels aufbauen',
    'vision.p1':'Unsere Mission: Demokratisierung von Elite-Handelstechnologie. Jeder Trader verdient Zugang zu institutionellen Algorithmen.',
    'vision.p2':'Von Forex bis Gold, Kryptowährungen bis Indizes – TradeAlpha AI passt sich jeder Assetklasse mit Präzision und Vertrauen an.',
    'vision.p3':'Es geht nicht um Geschwindigkeit. Es geht darum, Nachhaltigkeit, Disziplin und langfristige Vermögensaufbau zu entwickeln.',
    'banner.head':'Sind Sie bereit, Ihren Handel zu verbessern?',
    'banner.sub':'Beginnen Sie mit TradeAlpha AI — wählen Sie wöchentliche, monatliche oder jährliche Pläne.',
    'banner.cta':'Jetzt abonnieren',

    // Marke / Slogan
    'brand.tagline':'🤖 Ihr intelligenter Trading-Partner',

    // Navigation
    'nav.articles': 'Artikel',
    'nav.trading': 'Handel',

    // Funktionen-Abschnitt
    'feature.1.title':'99,2% Uptime',
    'feature.1.desc':'Unternehmensinfrastruktur stellt sicher, dass Ihre Strategien ununterbrochen funktionieren.',
    'feature.2.title':'Echtzeit-Signale',
    'feature.2.desc':'Sofortige Benachrichtigungen über alle Assetklassen — verpassen Sie nie eine Marktchance.',
    'feature.3.title':'Bankensicherheit',
    'feature.3.desc':'Erweiterte Verschlüsselung schützt Ihre Daten und API-Schlüssel rund um die Uhr.',
    'feature.4.title':'Globale Märkte',
    'feature.4.desc':'Handeln Sie Forex, Kryptowährungen, Rohstoffe und Indizes auf einer einheitlichen Plattform.',
    'feature.5.title':'Mobile-Ready',
    'feature.5.desc':'Verfolgen Sie Ihre Trades überall mit unserer reaktionsschnellen App.',
    'feature.6.title':'Expertensupport',
    'feature.6.desc':'24/7 mehrsprachiges Support-Team — Deutsch, Englisch, Arabisch und mehr.',

    // Abonnement-Abschnitt
    'subscribe.title':'🚀 Wählen Sie Ihren Weg zum Erfolg',
    'subscribe.subtitle':'Wählen Sie den Plan, der zu Ihren Handelszielen passt. Beginnen Sie mit einer kostenlosen 7-Tage-Testversion — keine Kreditkarte erforderlich.',
    'subscribe.weekly':'📅 Wöchentliches Paket',
    'subscribe.monthly':'📆 Monatliches Pro',
    'subscribe.yearly':'📊 Jährliches Elite',
    'subscribe.badge':'⭐ Am beliebtesten',
    'subscribe.savings':'Sparen Sie 30%',
    'subscribe.btn.weekly':'Wöchentlich abonnieren',
    'subscribe.btn.monthly':'Monatlich abonnieren',
    'subscribe.btn.yearly':'Jährlich abonnieren',
    'subscribe.contact':'Kontaktieren Sie uns für Preisgestaltung',

    // Wöchentliche Funktionen
    'subscribe.weekly.f1':'✓ Vollzugriff für 7 Tage',
    'subscribe.weekly.f2':'✓ Alle Signale',
    'subscribe.weekly.f3':'✓ E-Mail-Unterstützung',
    'subscribe.weekly.f4':'✓ Grundlegende Analytik',

    // Monatliche Funktionen
    'subscribe.monthly.f1':'✓ Vollzugriff für 30 Tage',
    'subscribe.monthly.f2':'✓ Fortgeschrittene Signale',
    'subscribe.monthly.f3':'✓ Prioritäts-Support',
    'subscribe.monthly.f4':'✓ Erweiterte Analytik',
    'subscribe.monthly.f5':'✓ Benutzerdefinierte Benachrichtigungen',

    // Jährliche Funktionen
    'subscribe.yearly.f1':'✓ Vollzugriff für 365 Tage',
    'subscribe.yearly.f2':'✓ Elite-Signale mit intelligenter Analytik',
    'subscribe.yearly.f3':'✓ VIP 24/7 Support',
    'subscribe.yearly.f4':'✓ Premium-Analytik',
    'subscribe.yearly.f5':'✓ Zugang zu privatem Handelszimmer',
    
    // Footer
    'footer.copyright':'Alle Rechte vorbehalten.',
    // Entwicklungs-Warnung
    'site.devWarning':'Diese Website befindet sich in aktiver Entwicklung. Einige Funktionen sind möglicherweise unvollständig oder können sich ohne Vorankündigung ändern. Vorsichtig verwenden.',
    'site.devLearn':'Mehr erfahren',
    
    // Tadawul page
    'nav.home': 'Startseite',
    'tadawul.title': 'Handel — Trade | TradeAlpha AI',
    'tadawul.heading': 'Handel — Beginnen Sie mit TradeAlpha AI',
    'tadawul.subtitle': 'Starten Sie mit Vertrauen ins Trading — Echtzeit-Signale, intelligentes Risikomanagement und ein praktischer Leitfaden, um Signale in Gewinne zu verwandeln.',
    'tadawul.why.title': 'Warum mit TradeAlpha AI handeln?',
    'tadawul.why.p1': 'Der Handel erfordert ein klares System, genaue Daten und disziplinierten Ausführung. Hier kommt TradeAlpha AI ins Spiel: ein intelligentes Handelssystem, das Echtzeitsignale, probabilistische Analysemodelle und automatische Risikomanagementmechanismen kombiniert. Wir bieten Händlern Tools, die dabei helfen, Verluste zu reduzieren und die Rentabilität durch Leistungsüberwachung und periodische Parameteranpassung zu verbessern.',
    'tadawul.why.p2': 'Egal ob Sie ein Anfänger sind, der praktische Anleitung zum Handelseinstieg sucht, oder ein professioneller Trader, der intelligente Mechanismen zur Verbesserung seiner Strategien benötigt - unser System unterstützt verschiedene Pfade. Hier erklären wir Arbeitsprinzipien, wie man Konten verbindet, und Best Practices für die Verwendung von Signalen mit Risikomanagement-Tools.',
    'tadawul.features.title': 'Hauptmerkmale',
    'tadawul.features.f1': 'Echtzeit- und Vorhersagesignale, die an Ihre Anforderungen anpassbar sind.',
    'tadawul.features.f2': 'Dynamisches Risikomanagement, das auf Marktvolatilität reagiert.',
    'tadawul.features.f3': 'Detaillierte Leistungsberichte und Empfehlungen zur Strategieverbesserung.',
    'tadawul.features.f4': 'Unterstützung für mehrere Assets: Forex, Kryptowährungen, Rohstoffe und Indizes.',
    'tadawul.getting-started.title': 'Wie Sie mit uns handeln beginnen',
    'tadawul.getting-started.steps': '1) Registrieren Sie sich für ein kostenloses Demo-Konto.\n2) Testen Sie den Wochenplan, um Signale und deren Verwaltung zu verstehen.\n3) Üben Sie das Tracking und die manuelle Ausführung von Signalen, bevor Sie bei Bedarf zur automatisierten Ausführung upgraden.',
    'tadawul.tips.title': 'Tipps für Handelserfolg',
    'tadawul.tips.content': '- Folgen Sie Signalen nicht zufällig: Verwenden Sie einen klaren Risikoplan und definieren Sie Ihr Risiko pro Trade.\n- Stellen Sie sicher, dass Sie Signale zunächst in einer Demo-Umgebung testen.\n- Überwachen Sie die Renditen über Wochen und beurteilen Sie die Signalqualität anhand des Gewinnfaktors (PF) und der Leistungsunterlagen.',
    'tadawul.conclusion': 'Letztendlich ist das Wort "Handel" nicht nur ein Begriff; es ist ein Ziel, das einen guten Plan, angemessene Tools und disziplinierte Ausführung erfordert. Mit TradeAlpha AI bieten wir Ihnen alle drei Elemente auf einer Plattform.',
    'tadawul.cta.subscribe': 'Jetzt abonnieren — 7-Tage-Testversion',
    'tadawul.cta.contact': 'Kontaktieren Sie uns',
    
    // Artikelseite
    'articles.title': 'Artikel — Beste Handelsartikel',
    'articles.heading': 'Ausgewählte Artikel zum Handel',
    'articles.subtitle': 'Ausgewählte aus unseren ausführlichen Artikeln, um Ihnen beim intelligenten und komfortablen Handel zu helfen.',
    'articles.link1': 'Beste Forex-Handelsstrategie: Ein praktischer Leitfaden',
    'articles.desc1': 'Ein umfassender Leitfaden zur Implementierung einer starken und bewährten Strategie mit effektiven Risikomanagementtechniken.',
    'articles.link2': 'Kapitalverwaltung: Die Grundlage des Handelserfolgs',
    'articles.desc2': 'Erfahren Sie, wie Sie Ihr Kapital schützen und Nachhaltigkeit bei der Rentabilität aufbauen.',
    'articles.link3': 'Wie man TradeAlpha AI-Signale effektiv nutzt',
    'articles.desc3': 'Praktische Anweisungen zur Umwandlung von Signalen in nützliche Ergebnisse auf Ihrem Konto.',
    
    // Best Forex Strategy article - German
    'bestforex.title': 'Beste Forex-Handelsstrategie: Ein praktischer und umfassender Leitfaden',
    'bestforex.subtitle': 'Setup und Praktiken, um Ihren Plan in konsistente Ergebnisse umzuwandeln.',
    'bestforex.intro': 'In der Welt des Forex-Handels, der sich mit dynamischen Schwankungen bewegt, sind Strategien bevorzugt, die Einfachheit der Ausführung mit robustem Risikomanagement verbinden. Aufgrund unserer Erfahrung bei der Entwicklung fortschrittlicher Handelssignalmaschinen empfehlen wir Händlern, sich auf eine Hybrid-Strategie zu konzentrieren, die Trend-Folge-Analyse mit Multi-Scale-Positionsverwaltung (Position Scaling) kombiniert.',
    'bestforex.components.title': 'Strategiekomponenten',
    'bestforex.components.text': 'Erste: Identifizieren Sie den Trend in einem größeren Zeitrahmen (4 Stunden oder täglich). Zweite: Betreten Sie einen kleineren Zeitrahmen, wenn ein Confluence-Signal erscheint (z.B. 15 Minuten oder 1 Stunde). Dritte: Verwenden Sie ATR-Level für die Kontraktgröße und setzen Sie intelligente Stop-Loss-Punkte.',
    'bestforex.rules.title': 'Ein- und Handels-Erhaltungsregeln',
    'bestforex.rules.text': '- Trendidentifizierung ist der Primärfaktor: Mit dem Trend zu handeln erhöht die Chancen in Ihrem Sinne.\n- Verwenden Sie Doppelbestätigungssignale: Momentum-Indikator + Ausbruch aus Support-/Widerstandszone.\n- Setzen Sie einen ersten Stop-Loss basierend auf 1–1,5×ATR, dann verschieben Sie auf Breakeven, wenn Sie ein bestimmtes Gewinnniveau erreichen.',
    'bestforex.capital.title': 'Kapitalverwaltung',
    'bestforex.capital.text': 'Das Risiko pro Trade sollte 1–2% des verfügbaren Kapitals nicht überschreiten. Wenn Sie Positionen erhöhen, reduzieren Sie das Risiko für jede Addition, damit das Gesamtrisiko im akzeptablen Bereich bleibt.',
    'bestforex.testing.title': 'Strategie-Tests',
    'bestforex.testing.text': 'Vor der Anwendung auf ein Live-Konto führen Sie Tests auf historischen Daten und Demo-Konto für mindestens 6 Monate Live-Handel oder 500 Trades durch – je nachdem, was kürzer ist. Überwachen Sie Profit Factor (PF), Durchschnittsgewinn/-verlust und Gewinnrate.',
    'bestforex.conclusion.title': 'Fazit',
    'bestforex.conclusion.text': 'Die Kombination aus Einfachheit in den Einstiegsregeln und diszipliniertem Risikomanagement macht eine Strategie nachhaltig. TradeAlpha AI bietet Kalibrierungstools und Signale, die bei der Umsetzung dieses Ansatzes mit Präzision und abgestufter Automatisierung helfen, damit es für Händler einfacher ist, Disziplin zu bewahren und die Leistungsstabilität zu erhöhen.',
    
    // Article CTAs - German
    'articles.cta.try': 'Testen Sie unsere Signale — 7-Tage-Testversion',
    'articles.cta.free': 'Kostenlose Testversion starten',
    'articles.cta.test': 'Testen Sie unsere Signale jetzt',
    
    // Capital Management article - German
    'capital.title': 'Kapitalverwaltung: Die Grundlage des Handelserfolgs',
    'capital.subtitle': 'Kapitalschutz ist der Unterschied zwischen einem guten Trader und einem nachhaltigen.',
    'capital.intro': 'Kapitalverwaltung ist nicht nur Zahlen; es ist eine Philosophie, die Marktfluktuationen in abgestufte Chancen umwandelt. Der Trader, der versteht, wie man Verluste begrenzt und Kapital schützt, hat die Fähigkeit, weiterzumachen und aus Fehlern zu lernen, ohne alles in einem Handel zu verlieren.',
    'capital.rules.title': 'Einfache, aber wirkungsvolle Regeln',
    'capital.rules.text': '- Definieren Sie ein Risikoveerhältnis pro Trade (1% oder 2%) und überschreiten Sie es nicht.\n- Verwenden Sie feste Positonsgrößen oder flexible Verhältnisse basierend auf ATR, um die Handelsgröße mit der Marktvolatilität zu entsprechen.\n- Diversifizieren Sie Ihre Positionen und vermeiden Sie starke Exposition gegenüber einem einzelnen Paar oder Vermögenswert.',
    'capital.strategies.title': 'Strategien zur Risikominderung',
    'capital.strategies.text': 'Eine wirksame Methode ist die Verwendung logischer Drawdown-Recovery-Regeln: Wenn Verluste einen bestimmten Prozentsatz des Kontostands übersteigen, reduzieren Sie das Risiko vorübergehend, bis die Leistung wieder zu den Zielwerten zurückkehrt.',
    'capital.calculation.title': 'Risiko- und Gewinnberechnung',
    'capital.calculation.text': 'Verlassen Sie sich nicht nur auf die Gewinnrate; berechnen Sie den erwarteten Gewinn über durchschnittlichen Gewinn, maximalen Verlust und Gewinnrate. Diese Indikatoren ermöglichen es Ihnen, die Rentabilität der Strategie mittelfristig und langfristig zu bewerten.',
    'capital.tips.title': 'Praktische Tipps',
    'capital.tips.text': 'Schreiben Sie einen klaren Handelsplan, halten Sie sich daran, und verwenden Sie Tools wie TradeAlpha AI, um die Leistung zu überwachen und Sie zu warnen, wenn Risikogrenzen überschritten werden. Automatisierung hilft, menschliche Fehler zu reduzieren und Regeln mit Präzision anzuwenden.'
  }
};

// Development banner as centered modal overlay: show once per session
(function devBanner(){
  const overlay = document.getElementById('devOverlay');
  const banner = document.getElementById('devWarning');
  const close = document.getElementById('devClose');
  const learn = document.querySelector('.dev-learn');
  if(!banner || !overlay) return;

  // For testing you can hide it by adding `?hideDev=1` to the URL.
  const params = new URLSearchParams(window.location.search);
  const hideForTesting = params.get('hideDev') === '1';
  if(hideForTesting){
    overlay.style.display = 'none';
    return;
  }

  // If the user dismissed the dev overlay during this session, don't show it again.
  // sessionStorage is cleared when the tab/window is closed, so reopening a new tab
  // will show the banner again (desired behavior).
  try{
    if(sessionStorage.getItem('devOverlayDismissed') === '1'){
      overlay.style.display = 'none';
      return;
    }
  }catch(_){ /* ignore sessionStorage access errors */ }

  // Show overlay and banner
  overlay.style.display = 'flex';

  // Populate the three-language message (Arabic, English, German)
  try{
    const a = document.getElementById('devMsgAr');
    const e = document.getElementById('devMsgEn');
    const d = document.getElementById('devMsgDe');
    if(a) a.innerText = (translations.ar && translations.ar['site.devWarning']) || translations.en['site.devWarning'];
    if(e) e.innerText = (translations.en && translations.en['site.devWarning']) || translations.ar['site.devWarning'];
    if(d) d.innerText = (translations.de && translations.de['site.devWarning']) || translations.en['site.devWarning'];
  }catch(err){ console.warn('Could not populate multilingual dev messages', err); }

  // Load GA4 ID from config if available
  if(CONFIG.ga4ID && CONFIG.ga4ID !== 'G-XXXXXXX'){
    try{
      gtag('config', CONFIG.ga4ID);
    }catch(e){ console.warn('GA4 not yet initialized', e); }
  }

  // Focus the close button for accessibility
  if(close){
    try{ close.focus(); }catch(e){}
    close.addEventListener('click', ()=>{
      // Persist dismissal for this session only
      try{ sessionStorage.setItem('devOverlayDismissed','1'); }catch(_){ }
      overlay.style.display = 'none';
    });
  }

  // Clicking on backdrop (outside banner) dismisses as well and persists for session
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay){
      try{ sessionStorage.setItem('devOverlayDismissed','1'); }catch(_){ }
      overlay.style.display = 'none';
    }
  });

  // Prevent clicks inside the banner from closing
  banner.addEventListener('click', (e)=>{ e.stopPropagation(); });

  // Learn more: show localized message for now
  if(learn){
    learn.addEventListener('click', (e)=>{
      e.preventDefault();
      const msg = (translations[document.documentElement.lang]||translations.en)['site.devWarning'];
      alert(msg);
    });
  }
})();

// Utility: set language
const elements = document.querySelectorAll('[data-i18n]');
const listItems = document.querySelectorAll('[data-i18n-block]');
// There are multiple per-page language buttons (langSwitch2, langSwitch3, etc.)
// `langSwitch` remains the global id used by the centralized menu (if present).
const langSwitch = document.getElementById('langSwitch');
// But update all visible pill elements when language changes
const allLangSwitches = document.querySelectorAll('.lang-switch');
const cta = document.getElementById('cta-telegram');

function applyLanguage(lang){
  const map = translations[lang] || translations.en;
  // Re-query elements in case DOM changed since script loaded
  const currentElements = document.querySelectorAll('[data-i18n]');
  let applied = 0, missing = 0;
  currentElements.forEach(el=>{
    const key = el.getAttribute('data-i18n');
    // Prefer the selected language, fallback to English if missing
    const text = (map && map[key]) || translations.en[key];
    if(!text){ missing++; return; }
    try{ el.innerText = text; applied++; }catch(e){ console.warn('i18n apply failed for', key, e); }
  });
  // Debug: log summary for easier troubleshooting
  try{ console.debug('applyLanguage', lang, 'applied', applied, 'missing', missing); }catch(e){}

  // For list items in lab that should remain separate
  ['lab.b1','lab.b2','lab.b3'].forEach((k,i)=>{
    const li = document.querySelector('[data-i18n="'+k+'"]');
    if(li) li.innerText = map[k] || translations.en[k];
  });

  // Special: formula field which has <strong> element in parent
  const pfFormula = document.querySelector('[data-i18n="pf.formulaText"]');
  if(pfFormula){
    pfFormula.innerText = map['pf.formulaText'] || translations.en['pf.formulaText'];
  }

  // CTA
  if(cta) cta.innerText = map['intro.cta'] || translations.en['intro.cta'];

  // direction & lang attr
  if(lang === 'ar'){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.body.style.textAlign = 'right';
  } else {
    // Both English and German are LTR
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
    document.body.style.textAlign = 'left';
  }

  // Show current language label in every language pill (localized name)
  const pillCurrent = { 'ar': 'العربية', 'en': 'English', 'de': 'Deutsch' };
  try{
    // Re-query the DOM so we always have current buttons (static NodeLists can be stale)
    const switches = document.querySelectorAll('.lang-switch');
    switches.forEach(btn => {
      try{
        const pill = btn.querySelector('.pill');
        if(pill) pill.textContent = pillCurrent[lang] || lang.toUpperCase();
      }catch(_){}
    });
  }catch(e){}

  // Smooth fade when switching (light UX)
  document.body.style.opacity = '0.98';
  setTimeout(()=>{document.body.style.opacity='1'},150);
}

// Persist preference in localStorage
function setLang(lang){
  localStorage.setItem('ta_lang', lang);
  applyLanguage(lang);
}

// Language menu handling: show a menu so user can pick any language
const langMenu = document.getElementById('langMenu');
if(langMenu){
  const openMenu = ()=>{
    // Ensure menu is visually opened and positioned inside viewport
    langMenu.setAttribute('aria-hidden','false');
    langMenu.classList.add('open');
    langSwitch.setAttribute('aria-expanded','true');

    // Positioning: calculate ideal left/top anchored to button but keep inside viewport
    try{
      const wrap = langSwitch.parentElement; // .lang-wrap (position:relative)
      const btnRect = langSwitch.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      // Reset inline positioning to allow measuring
      langMenu.style.left = '';
      langMenu.style.right = '';
      langMenu.style.top = '';

      // Default place below the button, aligned to button's left relative to wrap
      const menuWidth = Math.min(langMenu.offsetWidth || 160, window.innerWidth - 24);
      const desiredLeft = btnRect.left - wrapRect.left;
      let left = desiredLeft;

      // If the menu would overflow to the right of viewport, shift left
      const absLeft = wrapRect.left + left;
      if(absLeft + menuWidth > window.innerWidth - 12){
        left = Math.max(8 - wrapRect.left, window.innerWidth - menuWidth - wrapRect.left - 12);
      }

      // If the menu would overflow to the left of viewport, clamp to 8px
      if(wrapRect.left + left < 8){
        left = 8 - wrapRect.left;
      }

      langMenu.style.left = left + 'px';
      langMenu.style.top = (btnRect.bottom - wrapRect.top + 8) + 'px';

      // move focus into first menu item
      const first = langMenu.querySelector('[data-lang]');
      if(first) first.focus();
    }catch(posErr){
      // fallback: just focus first
      const first = langMenu.querySelector('[data-lang]');
      if(first) first.focus();
    }
  };
  const closeMenu = ()=>{
    langMenu.setAttribute('aria-hidden','true');
    langMenu.classList.remove('open');
    langSwitch.setAttribute('aria-expanded','false');
    try{ langSwitch.focus(); }catch(e){}
  };

  // Toggle on button click
  langSwitch.addEventListener('click', (e)=>{
    e.stopPropagation();
    const hidden = langMenu.getAttribute('aria-hidden') === 'true';
    if(hidden) openMenu(); else closeMenu();
  });

  // Menu item selection
  langMenu.querySelectorAll('[data-lang]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const lang = btn.getAttribute('data-lang');
      setLang(lang);
      closeMenu();
    });
    // allow keyboard selection (Enter / Space)
    btn.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      if(e.key === 'Escape') { closeMenu(); }
      if(e.key === 'ArrowDown') { e.preventDefault(); const next = btn.nextElementSibling || langMenu.querySelector('[data-lang]'); if(next) next.focus(); }
      if(e.key === 'ArrowUp') { e.preventDefault(); const prev = btn.previousElementSibling || langMenu.querySelector('[data-lang]:last-child'); if(prev) prev.focus(); }
    });
  });

  // Close on outside click or Escape
  document.addEventListener('click', (e)=>{ if(!langMenu.contains(e.target) && e.target !== langSwitch) closeMenu(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeMenu(); });
} else {
  // Fallback: cycle behavior if menu is not present
  if(langSwitch){
    langSwitch.addEventListener('click', ()=>{
      const current = document.documentElement.lang || 'ar';
      let next;
      if(current === 'ar') next = 'en'; else if(current === 'en') next = 'de'; else next = 'ar';
      setLang(next);
    });
  }
}

// Initialize (default to Arabic)
const saved = localStorage.getItem('ta_lang') || 'ar';
setLang(saved);

// Expose setLang/applyLanguage for inline scripts and debugging (defensive)
try{ window.setLang = setLang; window.applyLanguage = applyLanguage; }catch(e){}

// Reveal on scroll
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
    }
  });
},{threshold:0.12});

document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

// Accessibility: open menu on Enter or Space (guarded in case global langSwitch is absent)
if(langSwitch){
  langSwitch.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      langSwitch.click();
    }
    if(e.key === 'ArrowDown'){
      // open menu and focus first
      const m = document.getElementById('langMenu');
      if(m){ m.setAttribute('aria-hidden','false'); m.classList.add('open'); const first = m.querySelector('[data-lang]'); if(first) first.focus(); }
    }
  });
}

// Enhanced image loading with multiple fallback strategies
function fixLocalImages(){
  try{
    const imgs = document.querySelectorAll('.illustration img');
    console.log('Found', imgs.length, 'images to load');
    
    imgs.forEach((img, idx) => {
      const originalSrc = img.getAttribute('src');
      const name = originalSrc.split('/').pop();
      
      // Strategy 1: Try current path with ./ prefix
      const retryLoad = (newSrc, strategyName) => {
        console.log(`[Image ${idx}] Strategy: ${strategyName}, trying:`, newSrc);
        img.src = newSrc;
        
        img.addEventListener('error', () => {
          console.warn(`[Image ${idx}] Failed with ${strategyName}:`, newSrc);
          // Try next strategy
          nextStrategy();
        }, { once: true });
      };
      
      let strategyIndex = 0;
      const nextStrategy = () => {
        if(strategyIndex === 0) {
          // Strategy 1: Simple relative path
          retryLoad('./Image/' + name, 'Relative ./Image/');
          strategyIndex++;
        } else if(strategyIndex === 1) {
          // Strategy 2: Without ./
          retryLoad('Image/' + name, 'Simple Image/');
          strategyIndex++;
        } else if(strategyIndex === 2 && window.location.protocol === 'file:') {
          // Strategy 3: Full file:// URL
          const pathname = window.location.pathname;
          const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
          // Convert forward slashes to backslashes for Windows
          const winPath = basePath.replace(/\//g, '\\').replace(/^\\/, '');
          const fileUrl = 'file:///' + winPath + '\\Image\\' + name;
          retryLoad(fileUrl, 'File URL');
          strategyIndex++;
        }
      };
      
      // Start with first strategy
      nextStrategy();
      
      // Also add error handler to original src
      img.addEventListener('error', () => {
        console.warn(`[Image ${idx}] All strategies failed for`, name);
        img.style.backgroundColor = 'rgba(255,100,100,0.2)';
      });
    });
  } catch(e) {
    console.error('fixLocalImages failed:', e);
  }
}

// Run after DOM is ready
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    fixLocalImages();
  });
} else {
  fixLocalImages();
}

// Also run on window load to catch late-loading scenarios
window.addEventListener('load', () => {
  setTimeout(fixLocalImages, 500);
});

// CTA Banner: smooth scroll and dismiss (show only once per session)
(function banner(){
  const banner = document.getElementById('ctaBanner');
  const close = document.getElementById('bannerClose');
  const cta = document.getElementById('bannerCta');
  if(!banner) return;

  // URL param to hide banner temporarily for testing
  const params = new URLSearchParams(window.location.search);
  if(params.get('hideBanner') === '1'){
    banner.style.display = 'none';
    return;
  }

  // Show banner only once per session (using sessionStorage)
  if(sessionStorage.getItem('bannerShown') === '1'){
    banner.style.display = 'none';
    return;
  }

  // Show the CTA banner only once per session
  banner.style.display = 'flex';
  sessionStorage.setItem('bannerShown', '1');

  // Smooth scroll to subscription
  if(cta){
    cta.addEventListener('click', (e)=>{
      e.preventDefault();
      const target = document.querySelector(cta.getAttribute('href'));
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  // Close hides only for current load (do not persist)
  if(close){
    close.addEventListener('click', ()=>{
      banner.style.display = 'none';
    });
  }
})();
