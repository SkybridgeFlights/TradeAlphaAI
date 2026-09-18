'use strict';
const {getSql}=require('../../db/client');
const {requireAccount,sendError}=require('../../db/auth');
const {ensureAccountSchema}=require('../../db/schema');
const {stripeClient,priceForTier,origin}=require('../../db/billing');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method)){res.statusCode=405;res.end();return;}
 try{
  const {accountId}=await requireAccount(req),sql=getSql();await ensureAccountSchema(sql);
  if(req.method==='GET'){
   const rows=await sql`SELECT tier FROM accounts WHERE account_id=${accountId} LIMIT 1`;
   const subs=await sql`SELECT status,tier,current_period_end,cancel_at_period_end,updated_at FROM billing_subscriptions WHERE account_id=${accountId} LIMIT 1`;
   res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({configured:!!(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID_PREMIUM),tier:rows[0]?.tier||'free',subscription:subs[0]||null}));return;
  }
  let body=req.body;if(typeof body==='string')try{body=JSON.parse(body)}catch{body={}};body=body||{};const action=String(body.action||'');
  const existing=await sql`SELECT stripe_customer_id,status FROM billing_subscriptions WHERE account_id=${accountId} LIMIT 1`,stripe=stripeClient();
  if(action==='portal'){
   if(!existing[0]?.stripe_customer_id){const e=new Error('no_billing_customer');e.status=404;throw e;}
   const s=await stripe.billingPortal.sessions.create({customer:existing[0].stripe_customer_id,return_url:origin(req)+'/account/billing/'});return json(res,{url:s.url});
  }
  if(action!=='checkout'){const e=new Error('invalid_billing_action');e.status=400;throw e;}
  if(existing[0]&&['active','trialing'].includes(existing[0].status)){const e=new Error('active_subscription_use_billing_portal');e.status=409;throw e;}
  const tier=String(body.tier||''),price=priceForTier(tier),params={mode:'subscription',line_items:[{price,quantity:1}],success_url:origin(req)+'/account/billing/?checkout=success',cancel_url:origin(req)+'/account/subscription/?checkout=cancelled',client_reference_id:accountId,metadata:{account_id:accountId,tier},subscription_data:{metadata:{account_id:accountId,tier}}};
  if(existing[0]?.stripe_customer_id)params.customer=existing[0].stripe_customer_id;
  const s=await stripe.checkout.sessions.create(params,{idempotencyKey:'checkout:'+accountId+':'+tier+':'+Math.floor(Date.now()/300000)});return json(res,{url:s.url});
 }catch(e){sendError(res,e);}
};
function json(res,value){res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}
