'use strict';
const Stripe = require('stripe');
const TIERS = new Set(['premium','institutional']);
function stripeClient(){
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key){ const e=new Error('billing_not_configured'); e.status=503; throw e; }
  return new Stripe(key,{maxNetworkRetries:2,timeout:10000});
}
function priceForTier(tier){
  if(!TIERS.has(tier)){ const e=new Error('invalid_tier'); e.status=400; throw e; }
  const key=tier==='premium'?'STRIPE_PRICE_ID_PREMIUM':'STRIPE_PRICE_ID_INSTITUTIONAL';
  const id=process.env[key];
  if(!id){ const e=new Error('billing_not_configured'); e.status=503; throw e; }
  return id;
}
function tierForPrice(priceId){
  if(priceId && priceId===process.env.STRIPE_PRICE_ID_PREMIUM) return 'premium';
  if(priceId && priceId===process.env.STRIPE_PRICE_ID_INSTITUTIONAL) return 'institutional';
  return 'free';
}
function origin(req){
  const configured=(process.env.PUBLIC_SITE_URL||'').replace(/\/$/,'');
  if(configured) return configured;
  const host=(req.headers&&req.headers.host)||'www.tradealphaai.com';
  return 'https://'+host;
}
module.exports={stripeClient,priceForTier,tierForPrice,origin};
