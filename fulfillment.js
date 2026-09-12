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
    if(pending(o)&&!expired(o)){const sec=Math.max(0,Math.ceil((Date.parse(o.expiresAt)-Date.now())/1000));return {inline_keyboard:[[{text:`Перейти к оплате · ${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`,url:base()+o.paymentUrl}]]};}
    if(o.status==='delivered')return {inline_keyboard:[[{text:'Оставить отзыв',url:reviews}]]};
    return {inline_keyboard:[[{text:'Мои покупки',web_app:{url:purchases()}}]]};
  }
  async function telegram(method,args){
    if(transport)return transport(method,args);
    if(!process.env.BOT_TOKEN)return null;
    const r=await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const data=await r.json();if(!data.ok){if(data.description?.includes('message is not modified'))return null;throw new Error(`Telegram ${data.error_code}: ${data.description}`);}return data.result;
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
    if(!p)return res.status(404).json({error:'Вариант товара не найден в каталоге'});
    if(p.stock<=0||p.status!=='available')return res.status(409).json({error:'Нет в наличии'});
    const playerId=String(req.body.playerId||'').trim().slice(0,120),zoneId=String(req.body.zoneId||'').trim().slice(0,120),gameServer=String(req.body.gameServer||'').trim().slice(0,120);
    const fulfillmentType=metadata?.fulfillmentType||(playerId?'topup':'code');
    if(fulfillmentType==='topup'&&!playerId)return res.status(400).json({error:'Укажите ID или логин получателя'});
    const key=String(req.body.checkoutKey||'');
    const previous=key&&db.orders.find(o=>o.userId===req.telegramUser.id&&o.checkoutKey===key);
    const result=o=>({...o,botUrl:process.env.BOT_USERNAME?`https://t.me/${process.env.BOT_USERNAME.replace(/^@/,'')}?start=pay_${o.id}`:null});
    if(previous)return res.json(result(previous));
    const amount=Number(req.body.amount); // Existing demo catalog has incomplete variant prices.
    if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Некорректная сумма'});
    const id='ORD-'+crypto.randomUUID();
    const o={id,userId:req.telegramUser.id,productId:p.id,productName:name||p.name,category:metadata?.category||p.category,amount,status:'awaiting_payment',fulfillmentType,playerId,zoneId,gameServer,checkoutKey:key,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),paymentToken:crypto.randomBytes(24).toString('hex')};
    o.paymentUrl='/api/payments/'+id+'?token='+o.paymentToken;db.orders.push(o);await save();res.status(201).json(result(o));
  }catch(e){next(e);}});
  function payment(req,res,next){const o=db.orders.find(o=>o.id===req.params.id);if(!o||!o.paymentToken||req.query.token!==o.paymentToken)return res.status(404).json({error:'Ссылка оплаты недействительна'});req.order=o;next();}
  app.get('/api/payments/:id',payment,async(req,res)=>{if(expire(req.order)){await save();}res.sendFile(require('path').join(__dirname,'payment.html'));});
  app.get('/api/payments/:id/status',payment,(req,res)=>res.json({status:req.order.status,expiresAt:req.order.expiresAt}));
  app.post('/api/payments/:id/demo',payment,async(req,res,next)=>{try{
    const o=req.order;if(expire(o)){await save();}
    if(['paid','delivered'].includes(o.status))return res.json({status:o.status});
    if(!pending(o))return res.status(409).json({error:'Заказ отменён'});
    const product=db.products.find(p=>p.id===o.productId);if(!product||product.stock<=0)return res.status(409).json({error:'Нет в наличии'});
    product.stock--;o.status='paid';o.paidAt=new Date().toISOString();await save();res.json({status:o.status});
  }catch(e){next(e);}});
  app.post('/api/payments/:id/webhook',(req,res)=>res.status(404).json({error:'Настоящая платёжная система пока не подключена'}));
  app.patch('/api/admin/orders/:id',admin,async(req,res,next)=>{try{
    const o=db.orders.find(o=>o.id===req.params.id);if(!o)return res.sendStatus(404);
    if(o.status==='delivered')return res.status(409).json({error:'Заказ уже выполнен'});
    if(o.status!=='paid')return res.status(409).json({error:'Выдача возможна только после оплаты'});
    const code=String(req.body.code||'').trim();
    if(req.body.action!=='deliver')return res.status(400).json({error:'Выберите выдачу'});
    if(o.fulfillmentType!=='topup'&&(!code||code.length>2000))return res.status(400).json({error:'Введите код'});
    if(code&&db.orders.some(other=>other.id!==o.id&&other.code===code&&other.status==='delivered'))return res.status(409).json({error:'Этот код уже выдан другому заказу'});
    o.code=o.fulfillmentType==='topup'?null:code;o.status='delivered';o.deliveredAt=new Date().toISOString();await save();res.json(o);
  }catch(e){next(e);}});
  let ticking=false;
  async function tick(){if(ticking)return;ticking=true;try{
    for(const o of db.orders){if(expire(o))await save();if((o.telegramMessageId&&pending(o))||o.notifiedStatus!==o.status)await notify(o);}
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
  return Object.assign((run=fn=>fn())=>{const schedule=(fn,ms)=>{const loop=()=>run(fn).catch(e=>console.error('Order worker:',e.message)).finally(()=>setTimeout(loop,ms));setTimeout(loop,ms);};schedule(tick,10000);schedule(poll,7000);},{tick,poll});
}
module.exports={attach};
