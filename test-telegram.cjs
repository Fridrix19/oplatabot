const express=require('express'),assert=require('node:assert/strict');
process.env.ALLOW_TEST_PAYMENTS='1';
const {attach}=require('./fulfillment');
process.env.BOT_TOKEN='test';process.env.PUBLIC_URL='https://example.test';process.env.BOT_USERNAME='example_bot';
const app=express();app.use(express.json());app.use((req,res,next)=>{req.telegramUser={id:'1'};next();});
const db={products:[{id:'p',name:'Карта',category:'Карты',stock:10,status:'available'},{id:'d',name:'Discord Nitro — Nitro Basic',category:'Discord Nitro',stock:10,status:'available'}],orders:[]};const calls=[];let updates=[];
const workers=attach(app,db,async()=>{},(req,res,next)=>next(),async(method,args)=>{calls.push({method,args});if(method==='getUpdates'&&updates==='conflict')throw new Error("Telegram 409: Conflict: can't use getUpdates method while webhook is active");return method==='getUpdates'?updates:{message_id:123};});
const server=app.listen(0,async()=>{const api=async(url,body,method='POST')=>{const r=await fetch(`http://localhost:${server.address().port}`+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();};try{
  const order=await api('/api/orders',{name:'Карта',amount:100,checkoutKey:'first'});
  await workers.tick();assert.equal(calls[0].method,'sendMessage');assert.match(calls[0].args.text,/Карты — Карта/);
assert.match(calls[0].args.reply_markup.inline_keyboard[0][0].text,/Перейти к оплате/);
  updates=[{update_id:1,message:{text:'/start pay_'+order.id,chat:{id:1,type:'private'},from:{id:1}}}];await workers.poll();assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
  await api('/api/payments/'+order.id+'/demo?token='+order.paymentToken,{});
  await workers.tick();let last=calls.at(-1);assert.equal(last.method,'editMessageText');assert.match(last.args.text,/в течение 5 минут/);assert.equal(last.args.reply_markup.inline_keyboard[0][0].text,'Мои покупки');
  await api('/api/admin/orders/'+order.id,{action:'deliver',code:'A<&B'},'PATCH');await workers.tick();last=calls.at(-1);assert.match(last.args.text,/<tg-spoiler>A&lt;&amp;B<\/tg-spoiler>/);assert.equal(last.args.reply_markup.inline_keyboard[0][0].url,'https://t.me/plataotz1/3');
  const top=await api('/api/orders',{name:'Карта',amount:100,playerId:'123',checkoutKey:'top'});await api('/api/payments/'+top.id+'/demo?token='+top.paymentToken,{});await workers.tick();assert.match(calls.at(-1).args.text,/5–10 минут/);await api('/api/admin/orders/'+top.id,{action:'deliver'},'PATCH');await workers.tick();assert.match(calls.at(-1).args.text,/УСПЕШНО ПОПОЛНЕНО/);assert.match(calls.at(-1).args.text,/ID: 123/);
  // Название с категорией в начале не должно повторяться дважды.
  await api('/api/orders',{name:'Discord Nitro — Nitro Basic',amount:100,checkoutKey:'nitro'});
  await workers.tick();
  const nitro=calls.filter(c=>c.method==='sendMessage'&&/Nitro Basic/.test(c.args.text||'')).at(-1).args.text;
  assert.equal(nitro.split('Discord Nitro').length-1,1,nitro);
  // Обычный /start: приветствие и кнопки магазина, отзывов, канала и поддержки.
  process.env.SUPPORT_URL='https://t.me/support_test';updates=[{update_id:2,message:{text:'/start',chat:{id:7,type:'private'},from:{id:7}}}];await workers.poll();
  const hello=calls.filter(c=>c.method==='sendMessage'&&c.args.chat_id===7).at(-1).args;
  assert.match(hello.text,/удачных покупок/);
  assert.deepEqual(hello.reply_markup.inline_keyboard.map(r=>r.map(b=>b.text)),[['🛒 Открыть магазин'],['👀 Отзывы'],['✌️ Наш канал','✔️ Поддержка']]);
  assert.equal(hello.reply_markup.inline_keyboard[0][0].web_app.url,'https://example.test');
  assert.equal(hello.reply_markup.inline_keyboard[2][0].url,'https://t.me/metrapayru');assert.equal(hello.reply_markup.inline_keyboard[2][1].url,'https://t.me/support_test');
  // Смена бота: сбрасываем счётчик апдейтов и отправляем свежие сообщения вместо правки старых.
  db.telegramOffset=500;process.env.BOT_TOKEN='999:new';updates=[];await workers.poll();
  assert.equal(db.telegramOffset,0);assert.equal(db.telegramBotId,'999');
  assert(db.orders.every(o=>!o.telegramMessageId));
  // Бот на конструкторе (webhook): приём апдейтов на паузе, отправка сообщений работает.
  updates='conflict';await workers.poll();
  const pollsBefore=calls.filter(c=>c.method==='getUpdates').length;await workers.poll();
  assert.equal(calls.filter(c=>c.method==='getUpdates').length,pollsBefore,'polling paused after 409');
  const later=await api('/api/orders',{name:'Карта',amount:100,checkoutKey:'after-conflict'});
  await workers.tick();assert.equal(calls.at(-1).method,'sendMessage');assert.match(calls.at(-1).args.text,new RegExp(later.id));
  console.log('PASS: Telegram message lifecycle, duplicate start, spoiler, reviews, topup ID, name is not doubled, start buttons, bot switch, constructor webhook');
}catch(e){console.error(e);process.exitCode=1;}finally{server.close();}});
