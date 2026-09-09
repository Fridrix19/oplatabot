const express=require('express'),assert=require('node:assert/strict');
const {attach}=require('./fulfillment');
process.env.BOT_TOKEN='test';process.env.PUBLIC_URL='https://example.test';process.env.BOT_USERNAME='example_bot';
const app=express();app.use(express.json());app.use((req,res,next)=>{req.telegramUser={id:'1'};next();});
const db={products:[{id:'p',name:'Карта',category:'Карты',stock:10,status:'available'}],orders:[]};const calls=[];let updates=[];
const workers=attach(app,db,async()=>{},(req,res,next)=>next(),async(method,args)=>{calls.push({method,args});return method==='getUpdates'?updates:{message_id:123};});
const server=app.listen(0,async()=>{const api=async(url,body,method='POST')=>{const r=await fetch(`http://localhost:${server.address().port}`+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();};try{
  const order=await api('/api/orders',{name:'Карта',amount:100,checkoutKey:'first'});
  await workers.tick();assert.equal(calls[0].method,'sendMessage');assert.match(calls[0].args.text,/Карты — Карта/);assert.match(calls[0].args.reply_markup.inline_keyboard[0][0].text,/Перейти к оплате/);
  updates=[{update_id:1,message:{text:'/start pay_'+order.id,chat:{id:1,type:'private'},from:{id:1}}}];await workers.poll();assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
  await api('/api/payments/'+order.id+'/demo?token='+order.paymentToken,{});
  await workers.tick();let last=calls.at(-1);assert.equal(last.method,'editMessageText');assert.match(last.args.text,/в течение 5 минут/);assert.equal(last.args.reply_markup.inline_keyboard[0][0].text,'Мои покупки');
  await api('/api/admin/orders/'+order.id,{action:'deliver',code:'A<&B'},'PATCH');await workers.tick();last=calls.at(-1);assert.match(last.args.text,/<tg-spoiler>A&lt;&amp;B<\/tg-spoiler>/);assert.equal(last.args.reply_markup.inline_keyboard[0][0].url,'https://t.me/plataotz1/3');
  const top=await api('/api/orders',{name:'Карта',amount:100,playerId:'123',checkoutKey:'top'});await api('/api/payments/'+top.id+'/demo?token='+top.paymentToken,{});await workers.tick();assert.match(calls.at(-1).args.text,/5–10 минут/);await api('/api/admin/orders/'+top.id,{action:'deliver'},'PATCH');await workers.tick();assert.match(calls.at(-1).args.text,/УСПЕШНО ПОПОЛНЕНО/);assert.match(calls.at(-1).args.text,/ID: 123/);
  console.log('PASS: Telegram message lifecycle, duplicate start, spoiler, reviews, topup ID');
}catch(e){console.error(e);process.exitCode=1;}finally{server.close();}});
