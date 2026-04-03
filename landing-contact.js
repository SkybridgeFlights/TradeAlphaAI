(function(){
  const SALES = {
    email: 'TradeAlphaai6@gmail.com',
    telegram: 'TradeAlphaAI',
    whatsappNumber: ''
  };

  const messages = {
    ar: {
      monthly: 'مرحباً، أريد الاشتراك في الخطة الشهرية $40 مع TradeAlpha AI. الرجاء التواصل معي لإتمام التفعيل اليدوي.',
      yearly: 'مرحباً، أريد الاشتراك في الخطة السنوية $400 مع TradeAlpha AI. الرجاء التواصل معي لإتمام التفعيل اليدوي.'
    },
    en: {
      monthly: 'Hello, I want to subscribe to the Monthly plan ($40) with TradeAlpha AI. Please contact me to complete manual activation.',
      yearly: 'Hello, I want to subscribe to the Yearly plan ($400) with TradeAlpha AI. Please contact me to complete manual activation.'
    },
    de: {
      monthly: 'Hallo, ich möchte den Monatsplan ($40) von TradeAlpha AI abonnieren. Bitte kontaktiert mich für die manuelle Aktivierung.',
      yearly: 'Hallo, ich möchte den Jahresplan ($400) von TradeAlpha AI abonnieren. Bitte kontaktiert mich für die manuelle Aktivierung.'
    }
  };

  function getLang(){
    const lang = localStorage.getItem('ta_lang') || document.documentElement.lang || 'ar';
    return messages[lang] ? lang : 'en';
  }

  function buildWhatsAppLink(text){
    const encoded = encodeURIComponent(text);
    if(SALES.whatsappNumber){
      return 'https://wa.me/' + SALES.whatsappNumber + '?text=' + encoded;
    }
    return 'https://wa.me/?text=' + encoded;
  }

  function buildPlanLink(plan){
    const lang = getLang();
    const messageMap = messages[lang] || messages.en;
    return buildWhatsAppLink(messageMap[plan] || messageMap.monthly);
  }

  function applyPlanLinks(){
    document.querySelectorAll('.manual-plan-link').forEach(function(link){
      const plan = link.getAttribute('data-plan') || 'monthly';
      link.setAttribute('href', buildPlanLink(plan));
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  document.addEventListener('DOMContentLoaded', applyPlanLinks);
  window.addEventListener('storage', function(e){
    if(e.key === 'ta_lang') applyPlanLinks();
  });
  window.addEventListener('ta:language-changed', applyPlanLinks);
})();
