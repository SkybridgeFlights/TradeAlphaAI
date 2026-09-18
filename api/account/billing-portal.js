'use strict';
const {getSql}=require('../../db/client');
const {requireAccount,sendError}=require('../../db/auth');
const {ensureAccountSchema}=require('../../db/schema');
const {stripeClient,origin}=require('../../db/billing');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store'); if(req.method!=='POST'){res.statusCode=405;res.end();return;}
 try{
  const {accountId}=await requireAccount(req); const sql=getSql(); await ensureAccountSchema(sql);
  const rows=await sql`SELECT stripe_customer_id FROM billing_subscriptions WHERE account_id=${accountId} LIMIT 1`;
  if(!rows[0]?.stripe_customer_id){const e=new Error('no_billing_customer');e.status=404;throw e;}
  const session=await stripeClient().billingPortal.sessions.create({customer:rows[0].stripe_customer_id,return_url:origin(req)+'/account/billing/'});
  res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:session.url}));
 }catch(e){sendError(res,e);}
};
