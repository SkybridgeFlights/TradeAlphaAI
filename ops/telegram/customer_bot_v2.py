import json, logging, os
from datetime import datetime
import httpx
from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, ApplicationBuilder, CallbackQueryHandler, CommandHandler, ConversationHandler, ContextTypes, MessageHandler, filters

TOKEN=os.environ["CUSTOMER_BOT_TOKEN"]
ADMIN_BOT_TOKEN=os.environ["ADMIN_BOT_TOKEN"]
ADMIN_CHAT_ID=int(os.environ["ADMIN_CHAT_ID"])
API=os.getenv("TRADEALPHA_API","https://htouyyxctxetobxendlw.supabase.co/functions/v1/tradealpha-ea")
PAYPAL_EMAIL="wajdshaaban8@gmail.com"
LANGUAGE,MENU,MT5,PLAN,NAME,WHATSAPP,PROOF,STATUS=range(8)
logging.basicConfig(level=logging.INFO)
log=logging.getLogger("customer_bot")

TXT={
"ar":{"menu":"📋 القائمة الرئيسية","sub":"📋 الاشتراك","status":"📊 حالة الترخيص","support":"📞 الدعم","mt5":"📊 أرسل رقم حساب MT5:","plan":"📦 اختر الخطة:","name":"👤 أرسل اسمك الكامل:","wa":"📱 أرسل رقم واتساب مع رمز الدولة:","proof":"📷 بعد الدفع أرسل لقطة شاشة لإثبات التحويل هنا.","received":"✅ تم استلام إثبات الدفع وإرساله للإدارة للمراجعة. سيتم إشعارك بعد التأكيد والتفعيل.","badproof":"❌ يرجى إرسال صورة أو لقطة شاشة لإثبات الدفع.","back":"🔙 رجوع"},
"en":{"menu":"📋 Main Menu","sub":"📋 Subscribe","status":"📊 License Status","support":"📞 Support","mt5":"📊 Send your MT5 account number:","plan":"📦 Choose a plan:","name":"👤 Send your full name:","wa":"📱 Send your WhatsApp number with country code:","proof":"📷 After payment, send a screenshot of the payment confirmation here.","received":"✅ Your payment proof was sent to the administrator for review. You will be notified after confirmation and activation.","badproof":"❌ Please send a photo or screenshot of the payment confirmation.","back":"🔙 Back"},
"de":{"menu":"📋 Hauptmenü","sub":"📋 Abonnieren","status":"📊 Lizenzstatus","support":"📞 Support","mt5":"📊 Senden Sie Ihre MT5-Kontonummer:","plan":"📦 Wählen Sie einen Tarif:","name":"👤 Senden Sie Ihren vollständigen Namen:","wa":"📱 Senden Sie Ihre WhatsApp-Nummer mit Ländervorwahl:","proof":"📷 Senden Sie nach der Zahlung einen Screenshot der Zahlungsbestätigung hier.","received":"✅ Ihr Zahlungsnachweis wurde zur Prüfung an den Administrator gesendet. Nach Bestätigung und Aktivierung werden Sie benachrichtigt.","badproof":"❌ Bitte senden Sie ein Foto oder einen Screenshot der Zahlungsbestätigung.","back":"🔙 Zurück"}}

def L(c): return c.user_data.get("lang","en")
def T(c,k): return TXT[L(c)][k]
def back(c): return InlineKeyboardMarkup([[InlineKeyboardButton(T(c,"back"),callback_data="back")]])
def menu(c): return InlineKeyboardMarkup([[InlineKeyboardButton(T(c,"sub"),callback_data="sub")],[InlineKeyboardButton(T(c,"status"),callback_data="status")],[InlineKeyboardButton(T(c,"support"),callback_data="support")]])
def plans(c): return InlineKeyboardMarkup([[InlineKeyboardButton("📅 Monthly — $49",callback_data="p:m")],[InlineKeyboardButton("📆 Yearly — $499",callback_data="p:y")],[InlineKeyboardButton(T(c,"back"),callback_data="back")]])

async def tg(method,payload):
 async with httpx.AsyncClient() as x:
  r=await x.post(f"https://api.telegram.org/bot{ADMIN_BOT_TOKEN}/{method}",json=payload,timeout=15)
  r.raise_for_status(); return r.json()

async def api_license(account):
 async with httpx.AsyncClient() as x:
  # Status lookup intentionally does not expose license keys; invalid without key is expected.
  r=await x.post(API+"/v1/ea/license/validate",json={"mt5_account":account,"license":"STATUS_ONLY"},timeout=12)
  return r.json()

async def start(u:Update,c:ContextTypes.DEFAULT_TYPE):
 c.user_data.clear()
 await u.message.reply_text("🌐 TradeAlpha AI\nChoose language / اختر اللغة / Sprache wählen:",reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🇸🇦 العربية",callback_data="l:ar"),InlineKeyboardButton("🇬🇧 English",callback_data="l:en"),InlineKeyboardButton("🇩🇪 Deutsch",callback_data="l:de")]])); return LANGUAGE

async def language(u,c):
 q=u.callback_query; await q.answer(); c.user_data["lang"]=q.data[2:]; await q.edit_message_text(T(c,"menu"),reply_markup=menu(c)); return MENU

async def go_menu(u,c):
 q=u.callback_query
 if q: await q.answer(); await q.edit_message_text(T(c,"menu"),reply_markup=menu(c))
 else: await u.message.reply_text(T(c,"menu"),reply_markup=menu(c))
 return MENU

async def menu_action(u,c):
 q=u.callback_query; await q.answer()
 if q.data=="sub": await q.edit_message_text(T(c,"mt5"),reply_markup=back(c)); return MT5
 if q.data=="status": await q.edit_message_text(T(c,"mt5"),reply_markup=back(c)); return STATUS
 await q.edit_message_text("Telegram: @TradeAlphaSupport",reply_markup=back(c)); return MENU

async def mt5(u,c):
 x=u.message.text.strip()
 if not x.isdigit(): await u.message.reply_text(T(c,"mt5")); return MT5
 c.user_data["mt5"]=x; await u.message.reply_text(T(c,"plan"),reply_markup=plans(c)); return PLAN

async def plan(u,c):
 q=u.callback_query; await q.answer()
 if q.data=="back": return await go_menu(u,c)
 c.user_data["plan"]="monthly" if q.data=="p:m" else "yearly"; c.user_data["amount"]="$49" if q.data=="p:m" else "$499"
 await q.edit_message_text(T(c,"name"),reply_markup=back(c)); return NAME

async def name(u,c):
 c.user_data["name"]=u.message.text.strip(); await u.message.reply_text(T(c,"wa"),reply_markup=back(c)); return WHATSAPP

async def whatsapp(u,c):
 d=c.user_data; d["whatsapp"]=u.message.text.strip(); user=u.effective_user; tid=user.id
 kb={"inline_keyboard":[[{"text":"💳 إرسال تفاصيل الدفع | Send payment details","callback_data":f"pay:{d['mt5']}:{tid}:{'m' if d['plan']=='monthly' else 'y'}"}]]}
 text=f"🆕 Subscription request\nMT5: {d['mt5']}\nPlan: {d['plan']}\nName: {d['name']}\nWhatsApp: {d['whatsapp']}\nTelegram ID: {tid}\nPayment: PENDING"
 await tg("sendMessage",{"chat_id":ADMIN_CHAT_ID,"text":text,"reply_markup":json.dumps(kb)})
 pay={"ar":f"💳 PayPal\nأرسل {d['amount']} إلى:\n{PAYPAL_EMAIL}\n\n{T(c,'proof')}",
 "en":f"💳 PayPal\nSend {d['amount']} to:\n{PAYPAL_EMAIL}\n\n{T(c,'proof')}",
 "de":f"💳 PayPal\nSenden Sie {d['amount']} an:\n{PAYPAL_EMAIL}\n\n{T(c,'proof')}"}
 await u.message.reply_text(pay[L(c)],reply_markup=back(c)); return PROOF

async def proof(u,c):
 if not u.message.photo: await u.message.reply_text(T(c,"badproof")); return PROOF
 d=c.user_data; ph=u.message.photo[-1].file_id; tid=u.effective_user.id
 cap=f"💳 PAYPAL PAYMENT PROOF\nMT5: {d.get('mt5')}\nPlan: {d.get('plan')}\nName: {d.get('name')}\nTelegram ID: {tid}\n\nReview proof, then confirm payment in the request."
 await tg("sendPhoto",{"chat_id":ADMIN_CHAT_ID,"photo":ph,"caption":cap})
 await u.message.reply_text(T(c,"received"),reply_markup=menu(c)); return MENU

async def status(u,c):
 x=u.message.text.strip()
 if not x.isdigit(): await u.message.reply_text(T(c,"mt5")); return STATUS
 # No license key is disclosed or guessed. Customer receives authoritative key only after activation.
 msg={"ar":"ℹ️ حالة الترخيص التفصيلية تُرسل تلقائياً بعد التفعيل. إذا كنت قد دفعت، انتظر مراجعة الإدارة.","en":"ℹ️ Detailed license status is sent automatically after activation. If you have paid, please wait for administrator review.","de":"ℹ️ Der detaillierte Lizenzstatus wird nach der Aktivierung automatisch gesendet. Wenn Sie bezahlt haben, warten Sie bitte auf die Prüfung."}[L(c)]
 await u.message.reply_text(msg,reply_markup=menu(c)); return MENU

async def post(app:Application):
 await app.bot.set_my_commands([BotCommand("start","Start"),BotCommand("status","License status"),BotCommand("help","Support")])

conv=ConversationHandler(entry_points=[CommandHandler("start",start)],states={
LANGUAGE:[CallbackQueryHandler(language,pattern=r"^l:")],
MENU:[CallbackQueryHandler(menu_action,pattern=r"^(sub|status|support)$")],
MT5:[MessageHandler(filters.TEXT&~filters.COMMAND,mt5),CallbackQueryHandler(go_menu,pattern="^back$")],
PLAN:[CallbackQueryHandler(plan,pattern=r"^(p:m|p:y|back)$")],
NAME:[MessageHandler(filters.TEXT&~filters.COMMAND,name),CallbackQueryHandler(go_menu,pattern="^back$")],
WHATSAPP:[MessageHandler(filters.TEXT&~filters.COMMAND,whatsapp),CallbackQueryHandler(go_menu,pattern="^back$")],
PROOF:[MessageHandler(filters.PHOTO,proof),MessageHandler(filters.TEXT&~filters.COMMAND,proof),CallbackQueryHandler(go_menu,pattern="^back$")],
STATUS:[MessageHandler(filters.TEXT&~filters.COMMAND,status),CallbackQueryHandler(go_menu,pattern="^back$")]},fallbacks=[CommandHandler("start",start)],per_chat=True,per_user=True)
app=ApplicationBuilder().token(TOKEN).post_init(post).build(); app.add_handler(conv); log.info("Customer bot v2 starting"); app.run_polling()
