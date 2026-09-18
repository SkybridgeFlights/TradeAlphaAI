'use strict';

// Litecoin-only billing contract. Payments are made directly to the configured
// public LTC address; no private keys or seed phrases are stored by the site.
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),J=n=>path.join(ROOT,'data','intelligence',n),WRITE=process.argv.includes('--write');
const ALLOWED_TIERS=['free','premium','institutional'];
const ALLOWED_BILLING_PROVIDERS=['litecoin'];
const LTC_ADDRESS='ltc1qzq97jf6dk9v3tuetc0zlwtz7wuasrc5s4zt6qu';
function build(){
 const stamp=new Date().toISOString();
 const primary={id:'litecoin',label_en:'Litecoin (LTC)',label_ar:'لايتكوين (LTC)',network:'Litecoin mainnet',address:LTC_ADDRESS,uri:'litecoin:'+LTC_ADDRESS,env_vars:[],flow_description_en:'Send the exact LTC amount for the selected plan to the displayed Litecoin address. Keep the transaction ID for payment verification.',flow_description_ar:'أرسل مبلغ LTC المحدد للخطة إلى عنوان لايتكوين الظاهر واحتفظ بمعرّف المعاملة للتحقق من الدفع.'};
 const tiers={free:{label_en:'Free',label_ar:'مجاني',monthly_usd:0,capabilities:{personal_watchlists_max:3,watchlist_entities_max_per_list:12,alert_classes:['regime_change','change_event'],alert_channels:['in_app'],alert_cadence:'standard',copilot_queries_per_day:0},public_content:'all public surfaces accessible'},premium:{label_en:'Premium',label_ar:'بريميوم',monthly_usd:null,capabilities:{personal_watchlists_max:25,watchlist_entities_max_per_list:50,alert_classes:['regime_change','ranking_change','leadership_change','narrative_change','watchlist_change','research_change','change_event'],alert_channels:['in_app','email','telegram'],alert_cadence:'faster',copilot_queries_per_day:50},public_content:'all public surfaces accessible'},institutional:{label_en:'Institutional',label_ar:'مؤسسات',monthly_usd:null,capabilities:{personal_watchlists_max:100,watchlist_entities_max_per_list:200,alert_classes:['regime_change','ranking_change','leadership_change','narrative_change','watchlist_change','research_change','change_event'],alert_channels:['in_app','email','telegram'],alert_cadence:'priority',copilot_queries_per_day:500,custom_research_briefs:true,export_csv:true},public_content:'all public surfaces accessible'}};
 return {schema_version:'1.1',generated_at:stamp,source_layer:'billing-contracts',contracts_version:'1.1.0',mode:'live',enabled:true,allowed_providers:ALLOWED_BILLING_PROVIDERS,allowed_tiers:ALLOWED_TIERS,primary_provider:'litecoin',providers:[primary],tiers,governance:{litecoin_only:true,no_private_keys_in_repo:true,no_seed_phrases_in_repo:true,no_card_data:true,no_public_content_gates:true,no_dark_patterns:true},pages:['/account/billing/','/account/subscription/'],pages_ar:['/ar/account/billing/','/ar/account/subscription/'],attribution:{sources:['tools/build-billing-contracts.js'],note:'Litecoin-only payment surface. Public LTC receive address only; no wallet secrets are stored.'}};
}
if(require.main===module){const out=build();console.log('[billing-contracts] mode='+out.mode+' enabled='+out.enabled+' provider='+out.primary_provider+' tiers='+Object.keys(out.tiers).length);if(WRITE){fs.writeFileSync(J('billing-contracts.json'),JSON.stringify(out,null,2)+'\n','utf8');console.log('[billing-contracts] wrote billing-contracts.json');}}
module.exports={build,ALLOWED_TIERS,ALLOWED_BILLING_PROVIDERS,LTC_ADDRESS};
