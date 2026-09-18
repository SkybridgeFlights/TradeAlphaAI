'use strict';
const {getSql}=require('../../db/client');
const {requireAccount,sendError}=require('../../db/auth');
const {ensureAccountSchema}=require('../../db/schema');
const {stripeClient,priceForTier,origin}=require('../../db/billing');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.statusCode=405;res.end();return;}
  try{
    const {accountId}=await requireAccount(req); const sql=getSql(); await ensureAccountSchema(sql);
    let body=req.body; if(typeof body==='string') try{body=JSON.parse(body)}catch{body={}}; body=body||{};
    const tier=String(body.tier||''); const price=priceForTier(tier); const stripe=stripeClient();
    const existing=await sql`SELECT stripe_customer_id,status FROM billing_subscriptions WHERE account_id=${accountId} LIMIT 1`;
    if(existing[0] && ['active','trialing'].includes(existing[0].status)){const e=new Error('active_subscription_use_billing_portal');e.status=409;throw e;}
    const params={mode:'subscription',line_items:[{price,quantity:1}],success_url:origin(req)+'/account/billing/?checkout=success',cancel_url:origin(req)+'/account/subscription/?checkout=cancelled',client_reference_id:accountId,metadata:{account_id:accountId,tier},subscription_data:{metadata:{account_id:accountId,tier}}};
    if(existing[0]?.stripe_customer_id) params.customer=existing[0].stripe_customer_id;
    const session=await stripe.checkout.sessions.create(params,{idempotencyKey:'checkout:'+accountId+':'+tier+':'+Math.floor(Date.now()/300000)});
    res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:session.url}));
  }catch(e){sendError(res,e);}
};
