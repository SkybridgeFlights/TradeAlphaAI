'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),J=n=>path.join(ROOT,'data','intelligence',n),WRITE=process.argv.includes('--write');
const ALLOWED_TIERS=['free','monthly','yearly'];
const ALLOWED_BILLING_PROVIDERS=['telegram_litecoin'];
const BOT_USERNAME='TradeAlphaSupport_bot';
const BOT_URL='https://t.me/'+BOT_USERNAME;
function build(){
 const stamp=new Date().toISOString();
 const checkout={type:'telegram_bot',bot_username:BOT_USERNAME,url:BOT_URL,payment_method:'litecoin',monthly_usd:44,yearly_usd:484,proof_required:true,txid_required:true,admin_confirmation:true,license_activation:true};
 const tiers={free:{label_en:'Free',label_ar:'مجاني',monthly_usd:0},monthly:{label_en:'Monthly',label_ar:'شهري',monthly_usd:44},yearly:{label_en:'Yearly',label_ar:'سنوي',yearly_usd:484}};
 return {schema_version:'1.2',generated_at:stamp,source_layer:'billing-contracts',contracts_version:'1.2.0',mode:'live',enabled:true,allowed_providers:ALLOWED_BILLING_PROVIDERS,allowed_tiers:ALLOWED_TIERS,primary_provider:'telegram_litecoin',providers:[{id:'telegram_litecoin',label_en:'Telegram + Litecoin',label_ar:'تيليغرام + لايتكوين',env_vars:[]}],tiers,checkout,governance:{litecoin_only:true,website_collects_payment:false,telegram_checkout:true,no_private_keys_in_repo:true,no_seed_phrases_in_repo:true,no_card_data:true,no_dark_patterns:true},pages:['/account/billing/','/account/subscription/'],pages_ar:['/ar/account/billing/','/ar/account/subscription/'],attribution:{sources:['tools/build-billing-contracts.js'],note:'Checkout, payment proof, TXID collection, admin confirmation, and license activation are handled by the official TradeAlpha customer Telegram bot.'}};
}
if(require.main===module){const out=build();console.log('[billing-contracts] mode='+out.mode+' provider='+out.primary_provider+' bot='+out.checkout.bot_username);if(WRITE){fs.writeFileSync(J('billing-contracts.json'),JSON.stringify(out,null,2)+'\n','utf8');console.log('[billing-contracts] wrote billing-contracts.json');}}
module.exports={build,ALLOWED_TIERS,ALLOWED_BILLING_PROVIDERS,BOT_USERNAME,BOT_URL};
