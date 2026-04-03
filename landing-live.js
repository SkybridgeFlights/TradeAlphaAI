(function(){
  const sources = ['/api/performance', '/performance.json'];
  const stateText = {
    ar: {
      loading: 'جاري تحميل الأداء المباشر...',
      waiting: 'بانتظار مصدر بيانات الأداء',
      empty: 'لا توجد بيانات أداء حية بعد',
      updated: 'تم تحديث الأداء المباشر',
      updatedPrefix: 'آخر تحديث: ',
      fromServer: 'تم استلام البيانات من المصدر',
      responseWait: 'جارٍ البحث عن مصدر الأداء المتاح',
      error: 'تعذر تحميل الأداء المباشر حالياً',
      errorHint: 'وفّر /api/performance أو /performance.json لعرض البيانات'
    },
    en: {
      loading: 'Loading live performance...',
      waiting: 'Waiting for a performance data source',
      empty: 'No live performance data yet',
      updated: 'Live performance updated',
      updatedPrefix: 'Last updated: ',
      fromServer: 'Performance data received',
      responseWait: 'Checking available performance source',
      error: 'Unable to load live performance right now',
      errorHint: 'Provide /api/performance or /performance.json to display data'
    },
    de: {
      loading: 'Live-Performance wird geladen...',
      waiting: 'Warten auf eine Performance-Datenquelle',
      empty: 'Noch keine Live-Performance-Daten vorhanden',
      updated: 'Live-Performance aktualisiert',
      updatedPrefix: 'Letztes Update: ',
      fromServer: 'Performance-Daten empfangen',
      responseWait: 'Verfügbare Performance-Quelle wird geprüft',
      error: 'Live-Performance konnte derzeit nicht geladen werden',
      errorHint: 'Stelle /api/performance oder /performance.json bereit'
    }
  };

  function getLang(){
    const lang = localStorage.getItem('ta_lang') || document.documentElement.lang || 'ar';
    return stateText[lang] ? lang : 'en';
  }

  function t(key){
    const lang = getLang();
    return stateText[lang][key] || stateText.en[key] || '';
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function setLoadingState(isLoading){
    document.querySelectorAll('.performance-metric-card').forEach(function(card){
      card.classList.toggle('is-loading', isLoading);
    });
  }

  function setStatus(message, mode){
    const el = document.getElementById('performance-status');
    if(!el) return;
    el.textContent = message;
    el.classList.remove('status-loading', 'status-ready', 'status-empty', 'status-error');
    if(mode) el.classList.add(mode);
  }

  function showEmptyState(show){
    const empty = document.getElementById('performance-empty');
    if(empty) empty.hidden = !show;
  }

  function formatPercent(value){
    if(value === null || value === undefined || value === '') return '--';
    return String(value).includes('%') ? String(value) : value + '%';
  }

  function formatNumber(value){
    if(value === null || value === undefined || value === '') return '--';
    return String(value);
  }

  function renderFallbackValues(totalTradesValue){
    setText('metric-profit-factor', '--');
    setText('metric-win-rate', '--');
    setText('metric-max-drawdown', '--');
    setText('metric-total-trades', totalTradesValue);
  }

  function renderData(data){
    const metrics = data && data.metrics ? data.metrics : {};
    const totalTrades = Number(metrics.total_trades || 0);
    const hasTrades = totalTrades > 0;

    if(!hasTrades){
      showEmptyState(true);
      renderFallbackValues('0');
      setStatus(t('empty'), 'status-empty');
      setText('performance-updated', t('waiting'));
      return;
    }

    showEmptyState(false);
    setText('metric-profit-factor', formatNumber(metrics.profit_factor));
    setText('metric-win-rate', formatPercent(metrics.win_rate));
    setText('metric-max-drawdown', formatPercent(metrics.max_drawdown));
    setText('metric-total-trades', formatNumber(metrics.total_trades));
    setStatus(t('updated'), 'status-ready');
    setText('performance-updated', data.last_updated ? (t('updatedPrefix') + data.last_updated) : t('fromServer'));
  }

  async function fetchFirstAvailableSource(){
    let lastError = null;

    for(const source of sources){
      try{
        const response = await fetch(source, {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });

        if(!response.ok){
          throw new Error('HTTP ' + response.status + ' for ' + source);
        }

        const data = await response.json();
        return { data, source };
      }catch(error){
        lastError = error;
      }
    }

    throw lastError || new Error('No performance source available');
  }

  async function loadPerformance(){
    setLoadingState(true);
    showEmptyState(false);
    setStatus(t('loading'), 'status-loading');
    setText('performance-updated', t('responseWait'));

    try{
      const result = await fetchFirstAvailableSource();
      renderData(result.data);
    }catch(error){
      console.warn('Could not load live performance data', error);
      showEmptyState(false);
      renderFallbackValues('--');
      setStatus(t('error'), 'status-error');
      setText('performance-updated', t('errorHint'));
    }finally{
      setLoadingState(false);
    }
  }

  document.addEventListener('DOMContentLoaded', loadPerformance);
})();
