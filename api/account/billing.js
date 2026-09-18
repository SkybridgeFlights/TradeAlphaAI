'use strict';
const {getSql}=require('../../db/client');
const {requireAccount,sendError}=require('../../db/auth');
const {ensureAccountSchema}=require('../../db/schema');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.statusCode=405;res.end();return;}
  try{
    const {accountId}=await requireAccount(req); const sql=getSql(); await ensureAccountSchema(sql);
    const rows=await sql`SELECT tier FROM accounts WHERE account_id=${accountId} LIMIT 1`;
    const subs=await sql`SELECT status,tier,current_period_end,cancel_at_period_end,updated_at FROM billing_subscriptions WHERE account_id=${accountId} LIMIT 1`;
    res.statusCode=200; res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({configured:!!(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID_PREMIUM),tier:rows[0]?.tier||'free',subscription:subs[0]||null}));
  }catch(e){sendError(res,e);}
};
