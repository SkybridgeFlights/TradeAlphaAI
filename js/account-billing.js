(function(){'use strict';
const ar=document.documentElement.lang==='ar';
const main=document.querySelector('main[data-account-surface]');if(!main)return;
const surface=main.getAttribute('data-account-surface')||'';if(!/account\/(billing|subscription)\/$/.test(surface))return;
const section=document.createElement('section');section.className='market-section';section.id='live-billing';
section.innerHTML='<div class="market-section-head"><span class="eyebrow">'+(ar?'الاشتراك':'Subscription')+'</span><h2>'+(ar?'إدارة الخطة':'Manage your plan')+'</h2></div><div class="market-panel billing-live-panel"><p data-billing-status>'+(ar?'جارٍ تحميل حالة الاشتراك…':'Loading subscription status…')+'</p><div class="billing-live-actions"><button type="button" data-tier="premium">Premium</button><button type="button" data-tier="institutional">Institutional</button><button type="button" data-portal>'+(ar?'إدارة الفوترة':'Manage billing')+'</button></div></div>';
const hero=main.querySelector('.market-hero');if(hero)hero.insertAdjacentElement('afterend',section);else main.prepend(section);
const status=section.querySelector('[data-billing-status]'),buttons=[...section.querySelectorAll('button')];
function set(msg,busy){status.textContent=msg;buttons.forEach(x=>x.disabled=!!busy);}
async function token(){for(let i=0;i<50;i++){if(window.Clerk&&window.Clerk.session)return window.Clerk.session.getToken();await new Promise(r=>setTimeout(r,100));}return null;}
async function call(path,body){const t=await token();if(!t)throw new Error(ar?'سجّل الدخول أولاً.':'Sign in first.');const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'request_failed');return j;}
async function load(){try{const j=await call('/api/account/billing');const s=j.subscription;set((ar?'الخطة الحالية: ':'Current plan: ')+(j.tier||'free')+(s&&s.status?' · '+s.status:''),false);section.dataset.configured=j.configured?'true':'false';if(!j.configured)set(ar?'الدفع غير مفعّل بعد. اربط Stripe لإكمال التفعيل.':'Payments are not activated yet. Connect Stripe to finish setup.',false);}catch(e){set(e.message,false);}}
section.addEventListener('click',async e=>{const tier=e.target.getAttribute('data-tier');const portal=e.target.hasAttribute('data-portal');if(!tier&&!portal)return;try{set(ar?'جارٍ فتح Stripe…':'Opening Stripe…',true);const j=await call('/api/account/billing',portal?{action:'portal'}:{action:'checkout',tier});if(j.url)location.assign(j.url);else throw new Error('missing_redirect');}catch(err){set(err.message,false);}});
load();
})();
