// Year: set into both #year (old) and #y (new) if present
(function setYear(){
  const y = new Date().getFullYear();
  const el1 = document.getElementById('year');
  const el2 = document.getElementById('y');
  if(el1) el1.textContent = y;
  if(el2) el2.textContent = y;
})();

// Translations (English default & Arabic provided in request)
const translations = {
  en: {
    'intro.title': 'Trade Smarter, Not Harder — AI-Powered Excellence',
    'intro.p1': "Experience the revolution in algorithmic trading. TradeAlpha AI combines cutting-edge machine learning with precision risk management to give you a competitive edge in every market condition.",
    'intro.p2': 'Emotions cost money. Our intelligent system trades with pure logic, removing the human error from your trading decisions.',
    'intro.p3': 'Join hundreds of traders who have transformed their portfolios with TradeAlpha AI. Your success story starts here.',
  'intro.cta': 'Join Telegram Channel',

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
    'footer.copyright':'All rights reserved.'
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
    'footer.copyright':'جميع الحقوق محفوظة.'
  },
  de: {
    // German - Professionelle Handelsplattform
    'intro.title':'Intelligenter Handel mit KI — Professionelle Exzellenz',
    'intro.p1':'Erleben Sie die Revolution im algorithmischen Handel. TradeAlpha AI kombiniert hochmoderne Machine Learning mit präzisem Risikomanagement, um Ihnen in jeder Marktlage einen Vorteil zu verschaffen.',
    'intro.p2':'Emotionen kosten Geld. Unser intelligentes System handelt mit reiner Logik und befreit Ihre Entscheidungen von menschlichen Fehlern.',
    'intro.p3':'Schließen Sie sich Hunderten von Händlern an, die ihr Portfolio mit TradeAlpha AI transformiert haben. Ihre Erfolgsgeschichte beginnt hier.',
  'intro.cta':'Tritt dem Telegram‑Kanal bei',

    'why.title':'Warum TradeAlpha AI? Märkte brauchen intelligentere Lösungen.',
    'why.p1':'Märkte schlafen nie – Volatilität auch nicht. Traditionelle Systeme versagen bei Marktveränderungen. Wir passen sich in Echtzeit an.',
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
    'footer.copyright':'Alle Rechte vorbehalten.'
  }
};

// Utility: set language
const elements = document.querySelectorAll('[data-i18n]');
const listItems = document.querySelectorAll('[data-i18n-block]');
const langSwitch = document.getElementById('langSwitch');
const cta = document.getElementById('cta-telegram');

function applyLanguage(lang){
  const map = translations[lang] || translations.en;
  // Update each keyed element
  elements.forEach(el=>{
    const key = el.getAttribute('data-i18n');
    const text = map[key];
    if(!text) return;
    // If the element contains HTML (like <strong> in formula), keep simple replacement
    el.innerText = text;
  });

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
  cta.innerText = map['intro.cta'] || translations.en['intro.cta'];

  // direction & lang attr
  if(lang === 'ar'){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  } else {
    // Both English and German are LTR
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
  }

  // small UI cue on button - show next language option
  const langMap = {
    'ar': 'EN',
    'en': 'DE',
    'de': 'AR'
  };
  langSwitch.querySelector('.pill').textContent = langMap[lang] || 'EN';

  // Smooth fade when switching (light UX)
  document.body.style.opacity = '0.98';
  setTimeout(()=>{document.body.style.opacity='1'},200);
}

// Persist preference in localStorage
function setLang(lang){
  localStorage.setItem('ta_lang', lang);
  applyLanguage(lang);
}

// Toggle handler
langSwitch.addEventListener('click', ()=>{
  const current = document.documentElement.lang || 'ar';
  let next;
  
  // Cycle: AR → EN → DE → AR
  if(current === 'ar') {
    next = 'en';
  } else if(current === 'en') {
    next = 'de';
  } else {
    next = 'ar';
  }
  
  setLang(next);
});

// Initialize (default to Arabic)
const saved = localStorage.getItem('ta_lang') || 'ar';
setLang(saved);

// Reveal on scroll
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
    }
  });
},{threshold:0.12});

document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

// Accessibility: allow Enter key on lang switch
langSwitch.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') langSwitch.click(); });

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

// CTA Banner: smooth scroll and dismiss (persisted)
(function banner(){
  const banner = document.getElementById('ctaBanner');
  const close = document.getElementById('bannerClose');
  const cta = document.getElementById('bannerCta');
  if(!banner) return;

  // If user dismissed previously, hide
  if(localStorage.getItem('ta_banner_dismissed') === '1'){
    banner.style.display = 'none';
    return;
  }

  // Smooth scroll to subscription
  if(cta){
    cta.addEventListener('click', (e)=>{
      e.preventDefault();
      const target = document.querySelector(cta.getAttribute('href'));
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  if(close){
    close.addEventListener('click', ()=>{
      banner.style.display = 'none';
      localStorage.setItem('ta_banner_dismissed','1');
    });
  }
})();
