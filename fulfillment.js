const crypto=require('crypto');
const html=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function attach(app,db,save,admin,transport){
  const base=()=>process.env.PUBLIC_URL||'';
  const reviews=process.env.REVIEWS_URL||'https://t.me/plataotz1/3';
  const owned=(req,o)=>o&&String(o.userId)===String(req.telegramUser.id);
  const pending=o=>['pending','awaiting_payment'].includes(o.status);
  const expired=o=>pending(o)&&Date.parse(o.expiresAt)<=Date.now();
  const purchases=()=>`${base()}/?page=purchases`;
  function text(o){
    const details=`${html(o.category||'Товар')} — ${html(o.productName)}\nЗаказ: ${html(o.id)}${o.playerId?'\nID: '+html(o.playerId):''}${o.zoneId?'\nЗона: '+html(o.zoneId):''}${o.gameServer?'\nСервер: '+html(o.gameServer):''}\nСумма: ${html(o.amount)} ₽`;
    if(o.status==='paid')return details+'\n\n'+(o.fulfillmentType==='topup'?'Валюта будет выдана в течение 5–10 минут.':'Код придёт сюда в чат и в раздел «Мои покупки» в течение 5 минут.');
    if(o.status==='delivered')return details+'\n\n'+(o.fulfillmentType==='topup'?'✅ УСПЕШНО ПОПОЛНЕНО':`Ваш код: <tg-spoiler>${html(o.code)}</tg-spoiler>`)+'\nУдачной игры!';
    if(o.status==='cancelled'||o.status==='expired')return details+'\n\nЗаказ отменён: время оплаты истекло.';
    return details+'\n\nОплатите заказ в течение 10 минут.';
  }
  function keyboard(o){
    if(pending(o)&&!expired(o)){const sec=Math.max(0,Math.ceil((Date.parse(o.expiresAt)-Date.now())/1000));return {inline_keyboard:[[{text:`Перейти к оплате · ${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`,url:new URL(o.paymentUrl,base()).href}]]};}
    if(o.status==='delivered')return {inline_keyboard:[[{text:'Оставить отзыв',url:reviews}]]};
    return {inline_keyboard:[[{text:'Мои покупки',web_app:{url:purchases()}}]]};
  }
  async function telegram(method,args){
    if(transport)return transport(method,args);
    if(!process.env.BOT_TOKEN)return null;
    const r=await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const data=await r.json();if(!data.ok){if(data.description?.includes('message is not modified'))return null;throw new Error(`Telegram ${data.error_code}: ${data.description}`);}return data.result;
  }
  async function heleketInvoice(o){
    const merchant=(process.env.HELEKET_MERCHANT_ID||'').trim(), key=(process.env.HELEKET_API_KEY||'').trim();
    if(!merchant||!key)return null;
    const body={amount:String(o.amount),currency:process.env.HELEKET_CURRENCY||'RUB',order_id:o.id,url_callback:(process.env.HELEKET_CALLBACK_URL||`${base()}/api/payments/heleket/webhook`),url_return:base()+'/?page=purchases',url_success:base()+'/?page=purchases',lifetime:600};
    const sign=crypto.createHash('md5').update(Buffer.from(JSON.stringify(body)).toString('base64')+key).digest('hex');
    const r=await fetch('https://api.heleket.com/v1/payment',{method:'POST',headers:{merchant,sign,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||d.state===false)throw new Error(d.message||'Heleket: не удалось создать счёт');return d.result?.url||d.url;
  }
  // ---------- Super Banking (СБП и карта) ----------
  const sbToken=()=>(process.env.SUPERBANKING_API_TOKEN||'').trim();
  const sbCabinet=()=>(process.env.SUPERBANKING_CABINET_ID||'').trim();
  const sbProject=method=>((method==='sbp'&&(process.env.SUPERBANKING_PROJECT_ID_SBP||'').trim())||(process.env.SUPERBANKING_PROJECT_ID||'').trim());
  const sbReady=method=>Boolean(sbToken()&&sbCabinet()&&sbProject(method));
  const sbPaidStatuses=()=>String(process.env.SUPERBANKING_PAID_STATUSES||'1').split(',').map(v=>v.trim()).filter(Boolean);
  async function superbankingApi(method,body){
    const r=await fetch(`https://api.superbanking.ru/cabinet/payment/${method}?v=1.0.1`,{method:'POST',headers:{'x-token-user-api':sbToken(),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data?.result)throw new Error(`Super Banking: ${data?.error||data?.message||'ошибка '+r.status}`);
    return data.data;
  }
  // Ссылка на оплату создаётся вместе с заказом: покупатель выбирает СБП или карту на странице Super Banking.
  async function superbankingLink(o){
    const data=await superbankingApi('createLink',{
      cabinetId:sbCabinet(),projectId:sbProject(o.paymentMethod),
      successUrl:purchases(),failUrl:purchases(),
      ...(o.email?{email:o.email}:{}),
      items:[{title:String(o.productName||'Товар').slice(0,255),price:Number(o.amount),count:1,
        type:Number(process.env.SUPERBANKING_ITEM_TYPE||1),vat:Number(process.env.SUPERBANKING_VAT||0),
        vendorCode:String(o.productId||o.id).slice(0,64)}]
    });
    const payment=data?.payment;
    if(!payment?.paymentUrl||!payment?.linkId)throw new Error('Super Banking: ссылка оплаты не получена');
    return payment;
  }
  const superbankingStatus=linkId=>superbankingApi('statusPay',{linkId});
  // Деньги получены: засчитываем оплату, даже если таймер заказа успел истечь.
  function markPaid(o,info){
    const waiting=pending(o)||['cancelled','expired'].includes(o.status);
    if(!waiting)return false;
    if(!pending(o))o.paidAfterExpiry=true;
    const product=db.products.find(x=>x.id===o.productId);
    if(product&&Number.isFinite(product.stock))product.stock=Math.max(0,product.stock-1);
    Object.assign(o,{status:'paid',paidAt:new Date().toISOString()},info||{});
    return true;
  }
  const locks=new Set();
  async function notify(o){
    if(locks.has(o.id)||!process.env.BOT_TOKEN||!/^https:\/\//.test(base()))return;
    locks.add(o.id);
    try{
      const state=o.status;
      const payload={chat_id:o.userId,text:text(o),parse_mode:'HTML',reply_markup:keyboard(o)};
      if(o.telegramMessageId)await telegram('editMessageText',{...payload,message_id:o.telegramMessageId});
      else {const m=await telegram('sendMessage',payload);if(m)o.telegramMessageId=m.message_id;}
      o.notifiedStatus=state;await save();
    }catch(e){console.error('Order notification failed:',e.message);}finally{locks.delete(o.id);}
  }
  function expire(o){if(expired(o)){o.status='cancelled';o.cancelledAt=new Date().toISOString();return true;}return false;}
  app.post('/api/orders',async(req,res,next)=>{try{
    const name=String(req.body.name||'').slice(0,500),catalogName=String(req.body.catalogName||name);
    const norm=s=>String(s).normalize('NFKC').replace(/[—–]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
    const metadata=require('./catalog-meta.json').find(p=>norm(p.name)===norm(catalogName));
    let p=db.products.find(p=>p.id===req.body.productId)||db.products.find(p=>norm(p.name)===norm(catalogName));
    if(!p&&metadata?.shortName)p=db.products.find(p=>norm(p.name)===norm(metadata.shortName));
    if(!p&&name.includes(' — ')){const short=name.split(' — ').slice(1).join(' — ');const matches=db.products.filter(p=>norm(p.name)===norm(short));if(matches.length===1)p=matches[0];}
    if(!p||require('./catalog-visibility')(p))return res.status(404).json({error:'Вариант товара не найден в каталоге'});
    if(p.stock<=0||p.status!=='available')return res.status(409).json({error:'Нет в наличии'});
    const playerId=String(req.body.playerId||'').trim().slice(0,120),zoneId=String(req.body.zoneId||'').trim().slice(0,120),gameServer=String(req.body.gameServer||'').trim().slice(0,120);
    const fulfillmentType=metadata?.fulfillmentType||(playerId?'topup':'code');
    if(fulfillmentType==='topup'&&!playerId)return res.status(400).json({error:'Укажите ID или логин получателя'});
    const testPayments=process.env.ALLOW_TEST_PAYMENTS==='1';
    const paymentMethod=req.body.paymentMethod||(testPayments?'test':'sbp');
    if(!['crypto','sbp','card'].concat(testPayments?['test']:[]).includes(paymentMethod))return res.status(400).json({error:'Неизвестный способ оплаты'});
    if(paymentMethod==='crypto'&&(!(process.env.HELEKET_API_KEY||'').trim()||!(process.env.HELEKET_MERCHANT_ID||'').trim()))return res.status(503).json({error:'Криптооплата временно недоступна'});
    if(['sbp','card'].includes(paymentMethod)&&!sbReady(paymentMethod))return res.status(503).json({error:paymentMethod==='sbp'?'Оплата по СБП временно недоступна':'Оплата картой временно недоступна'});
    const email=String(req.body.email||'').trim().slice(0,254);
    const key=String(req.body.checkoutKey||'');
    const previous=key&&db.orders.find(o=>o.userId===req.telegramUser.id&&o.checkoutKey===key);
    const result=o=>({...o,botUrl:process.env.BOT_USERNAME?`https://t.me/${process.env.BOT_USERNAME.replace(/^@/,'')}?start=pay_${o.id}`:null});
    if(previous){
      if((previous.paymentMethod||'test')!==paymentMethod)return res.status(409).json({error:'Способ оплаты изменился. Создайте новый заказ.'});
      return res.json(result(previous));
    }
    const amount=Number(req.body.amount); // Existing demo catalog has incomplete variant prices.
    if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Некорректная сумма'});
    const id='ORD-'+crypto.randomUUID();
    const o={id,userId:req.telegramUser.id,productId:p.id,productName:name||p.name,category:metadata?.category||p.category,amount,status:'awaiting_payment',fulfillmentType,playerId,zoneId,gameServer,checkoutKey:key,email:email||null,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),paymentToken:crypto.randomBytes(24).toString('hex')};
    o.paymentMethod=paymentMethod;
    o.paymentUrl='/api/payments/'+id+'?token='+o.paymentToken;db.orders.push(o);await save();
    if(paymentMethod!=='test'){
      try{
        if(paymentMethod==='crypto'){
          o.heleketUrl=await heleketInvoice(o);
          if(!o.heleketUrl)throw new Error('Heleket: ссылка оплаты не получена');
          o.paymentUrl=o.heleketUrl;
        } else {
          const link=await superbankingLink(o);
          o.superbankingLinkId=link.linkId;o.superbankingOrderNumber=link.orderNumber||null;o.paymentUrl=link.paymentUrl;
        }
        await save();
      }catch(e){db.orders=db.orders.filter(x=>x!==o);await save();return res.status(502).json({error:e.message});}
    }
    res.status(201).json(result(o));
  }catch(e){next(e);}});
  function payment(req,res,next){const o=db.orders.find(o=>o.id===req.params.id);if(!o||!o.paymentToken||req.query.token!==o.paymentToken)return res.status(404).json({error:'Ссылка оплаты недействительна'});req.order=o;next();}
  app.get('/api/payments/:id',payment,async(req,res)=>{if(expire(req.order)){await save();}res.sendFile(require('path').join(__dirname,'payment.html'));});
  app.get('/api/payments/:id/status',payment,(req,res)=>res.json({status:req.order.status,expiresAt:req.order.expiresAt}));
  // Тестовое подтверждение оплаты: только для локальных проверок (ALLOW_TEST_PAYMENTS=1).
  app.post('/api/payments/:id/demo',payment,async(req,res,next)=>{try{
    if(process.env.ALLOW_TEST_PAYMENTS!=='1')return res.status(404).json({error:'Тестовая оплата отключена'});
    if(req.order.paymentMethod!=='test')return res.status(409).json({error:'Этот заказ оплачивается через платёжную систему'});
    const o=req.order;if(expire(o)){await save();}
    if(['paid','delivered'].includes(o.status))return res.json({status:o.status});
    if(!pending(o))return res.status(409).json({error:'Заказ отменён'});
    const product=db.products.find(p=>p.id===o.productId);if(!product||product.stock<=0)return res.status(409).json({error:'Нет в наличии'});
    product.stock--;o.status='paid';o.paidAt=new Date().toISOString();await save();res.json({status:o.status});
  }catch(e){next(e);}});
  // Heleket передаёт подпись полем sign в теле: md5(base64(json без sign) + API key).
  // PHP json_encode экранирует "/", поэтому делаем так же.
  function heleketSignature(data,key){return crypto.createHash('md5').update(Buffer.from(JSON.stringify(data).replace(/\//g,'\\/')).toString('base64')+key).digest('hex');}
  function validHeleketSignature(data,sign,key){
    if(!key||typeof sign!=='string'||!/^[a-f0-9]{32}$/i.test(sign))return false;
    return crypto.timingSafeEqual(Buffer.from(heleketSignature(data,key)),Buffer.from(sign.toLowerCase()));
  }
  app.post('/api/payments/heleket/webhook',async(req,res)=>{try{
    const key=(process.env.HELEKET_API_KEY||'').trim();
    const {sign,...data}=req.body||{};
    if(!validHeleketSignature(data,sign,key))return res.status(401).json({error:'Invalid signature'});
    const o=db.orders.find(x=>x.id===data.order_id);
    if(!o)return res.status(404).json({error:'Order not found'});
    o.heleketStatus=data.status;
    if(['paid','paid_over'].includes(data.status))markPaid(o);
    await save();res.json({ok:true});
  }catch(e){console.error('Heleket webhook:',e.message);res.status(500).json({error:'Webhook failed'});}});
  // Super Banking шлёт {linkId, status:'COMPLETE'} без подписи, поэтому оплату
  // подтверждаем отдельным запросом статуса по этому linkId.
  async function checkSuperbanking(o){
    const data=await superbankingStatus(o.superbankingLinkId);
    const payment=data?.payment||{};
    o.superbankingStatus=String(payment.status??'');
    o.superbankingCheckedAt=Date.now();
    const paid=sbPaidStatuses().includes(String(payment.status));
    const amount=Number(payment.amount);
    if(paid&&Number.isFinite(amount)&&Math.round(amount*100)<Math.round(Number(o.amount)*100)){
      console.error('Super Banking: сумма платежа меньше заказа',o.id,amount,o.amount);
      return false;
    }
    return paid?markPaid(o,{paymentRequisite:payment.typeRequisite??null}):false;
  }
  app.post('/api/payments/superbanking/webhook',async(req,res)=>{try{
    const linkId=String(req.body?.linkId||'');
    const o=linkId&&db.orders.find(x=>x.superbankingLinkId===linkId);
    if(!o)return res.status(404).json({error:'Order not found'});
    await checkSuperbanking(o);
    await save();res.json({ok:true});
  }catch(e){console.error('Super Banking webhook:',e.message);res.status(500).json({error:'Webhook failed'});}});
  app.post('/api/payments/:id/webhook',(req,res)=>res.status(404).json({error:'Настоящая платёжная система пока не подключена'}));
  app.patch('/api/admin/orders/:id',admin,async(req,res,next)=>{try{
    if(req.body.action!=='deliver')return res.status(400).json({error:'Выберите выдачу'});
    const o=db.orders.find(o=>o.id===req.params.id);
    try {require('./order-delivery').deliver(db,o,req.body.code,'admin');}
    catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}
    const receipt=String(req.body.receiptText||'').trim().slice(0,4000); if(receipt)o.receiptText=receipt;
    await save();res.json(o);
  }catch(e){next(e);}});
  let ticking=false;
  async function tick(){if(ticking)return;ticking=true;try{
    for(const o of db.orders){
      // Подстраховка на случай, если webhook Super Banking не дошёл.
      const sbWaiting=o.superbankingLinkId&&sbReady(o.paymentMethod)&&(pending(o)||['cancelled','expired'].includes(o.status))&&Date.now()-Date.parse(o.createdAt)<86400000;
      // Оплаченный вовремя заказ проверяем часто, уже отменённый по таймеру — раз в 5 минут.
      if(sbWaiting&&Date.now()-(o.superbankingCheckedAt||0)>(pending(o)?20000:300000)){
        try{if(await checkSuperbanking(o))await save();}catch(e){console.error('Super Banking status:',e.message);}
      }
      if(expire(o))await save();
      if((o.telegramMessageId&&pending(o))||o.notifiedStatus!==o.status)await notify(o);
    }
  }finally{ticking=false;}}
  let polling=false;
  async function poll(){if(polling||!process.env.BOT_TOKEN)return;polling=true;try{
    const updates=await telegram('getUpdates',{offset:db.telegramOffset||0,timeout:0});
    for(const u of updates||[]){const m=u.message;const match=m?.text?.match(/^\/start(?:@\w+)?(?:\s+pay_(ORD-[\w-]+))?$/);
      if(match&&m.chat.type==='private'){
        const o=db.orders.find(o=>o.id===match[1]&&String(o.userId)===String(m.from.id));
        if(o){if(expire(o))await save();await notify(o);}
        else await telegram('sendMessage',{chat_id:m.chat.id,text:'Откройте магазин или свои покупки.',reply_markup:{inline_keyboard:[[{text:'Открыть магазин',web_app:{url:base()}},{text:'Мои покупки',web_app:{url:purchases()}}]]}});
      }
      db.telegramOffset=u.update_id+1;await save();
    }
  }catch(e){console.error('Telegram updates:',e.message);}finally{polling=false;}}
  const operator=require('./operator-bot').attach(db,save);
  return Object.assign((run=fn=>fn())=>{const schedule=(fn,ms)=>{const loop=()=>run(fn).catch(e=>console.error('Order worker:',e.message)).finally(()=>setTimeout(loop,ms));setTimeout(loop,ms);};schedule(tick,10000);schedule(poll,7000);schedule(operator.tick,10000);schedule(operator.poll,7000);},{tick,poll});
}
module.exports={attach};
