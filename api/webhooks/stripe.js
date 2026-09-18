'use strict';
const {getSql}=require('../../db/client');
const {ensureAccountSchema}=require('../../db/schema');
const {stripeClient,tierForPrice}=require('../../db/billing');
async function raw(req){const chunks=[];for await(const x of req)chunks.push(Buffer.from(x));return Buffer.concat(chunks);}
async function sync(sql,sub){
 const accountId=sub.metadata&&sub.metadata.account_id;if(!accountId)return;
 const priceId=sub.items?.data?.[0]?.price?.id||null,tier=tierForPrice(priceId);
 const effective=['active','trialing'].includes(sub.status)?tier:'free';
 const end=sub.current_period_end?new Date(sub.current_period_end*1000):null;
 await sql`INSERT INTO billing_subscriptions(account_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,tier,current_period_end,cancel_at_period_end,updated_at) VALUES(${accountId},${String(sub.customer||'')},${sub.id},${priceId},${sub.status},${effective},${end},${!!sub.cancel_at_period_end},NOW()) ON CONFLICT(account_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id,stripe_subscription_id=EXCLUDED.stripe_subscription_id,stripe_price_id=EXCLUDED.stripe_price_id,status=EXCLUDED.status,tier=EXCLUDED.tier,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=NOW()`;
 await sql`UPDATE accounts SET tier=${effective} WHERE account_id=${accountId}`;
}
module.exports=async function handler(req,res){
 if(req.method!=='POST'){res.statusCode=405;res.end();return;}try{
  const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret)throw new Error('STRIPE_WEBHOOK_SECRET missing');
  const payload=await raw(req),sig=req.headers['stripe-signature'];
  const event=stripeClient().webhooks.constructEvent(payload,sig,secret),sql=getSql();await ensureAccountSchema(sql);
  const seen=await sql`SELECT event_id FROM stripe_webhook_events WHERE event_id=${event.id}`;if(seen.length){res.statusCode=200;res.end('ok');return;}
  if(event.type.startsWith('customer.subscription.'))await sync(sql,event.data.object);
  await sql`INSERT INTO stripe_webhook_events(event_id,event_type) VALUES(${event.id},${event.type}) ON CONFLICT DO NOTHING`;
  res.statusCode=200;res.end('ok');
 }catch(e){console.error('[stripe-webhook]',e.message);res.statusCode=400;res.end('invalid webhook');}
};
module.exports.config={api:{bodyParser:false}};
