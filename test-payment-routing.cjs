const assert=require('node:assert/strict');
const express=require('express');
const {attach}=require('./fulfillment');
process.env.HELEKET_MERCHANT_ID='test-merchant';
process.env.HELEKET_API_KEY='test-key';
process.env.SUPERBANKING_API_TOKEN='sb-token';
process.env.SUPERBANKING_CABINET_ID='cabinet-1';
process.env.SUPERBANKING_PROJECT_ID='project-card';
process.env.SUPERBANKING_PROJECT_ID_SBP='project-sbp';
process.env.ALLOW_TEST_PAYMENTS='1';
process.env.PUBLIC_URL='https://example.test';
process.env.BOT_TOKEN='test-bot';
process.env.BOT_USERNAME='@platas_bot';
const realFetch=global.fetch;
let invoices=0,links=0;
const createdLinks=[];let payStatus=0,payAmount=100;
global.fetch=async(url,options)=>{
  if(url==='https://api.heleket.com/v1/payment'){
    invoices++;
    return {ok:true,json:async()=>({state:0,result:{url:'https://pay.example.test/invoice'}})};
  }
  if(String(url).startsWith('https://api.superbanking.ru/cabinet/payment/createLink')){
    links++;
    const body=JSON.parse(options.body);
    assert.equal(options.headers['x-token-user-api'],'sb-token');
    createdLinks.push(body);
    return {ok:true,json:async()=>({result:true,data:{payment:{paymentUrl:'https://securepayment.superbanking.ru/'+links,linkId:'link-'+links,orderNumber:'N'+links,amount:body.items[0].price}}})};
  }
  if(String(url).startsWith('https://api.superbanking.ru/cabinet/payment/statusPay')){
    return {ok:true,json:async()=>({result:true,data:{payment:{status:payStatus,amount:payAmount,typeRequisite:1}}})};
  }
  return realFetch(url,options);
};
const db={products:[{id:'p',name:'Routing test',price:100,stock:10,status:'available'}],orders:[]};
const app=express();app.use(express.json());app.use((req,res,next)=>{req.telegramUser={id:1};next();});
const messages=[];
const workers=attach(app,db,async()=>{},(req,res,next)=>next(),async(method,args)=>{messages.push(args);return {message_id:messages.length};});
const server=app.listen(0,async()=>{
  const api=async(path,body)=>{
    const r=await fetch(`http://localhost:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:r.status,data:await r.json()};
  };
  const order=(method,key=method,extra={})=>api('/api/orders',{name:'Routing test',amount:100,paymentMethod:method,checkoutKey:key,...extra});
  const find=id=>db.orders.find(o=>o.id===id);
  try{
    // Super Banking: СБП и карта идут в свои проекты, ссылка приходит от провайдера.
    const sbp=await order('sbp',undefined,{email:'buyer@example.test'});
    assert.equal(sbp.status,201);
    assert.match(sbp.data.id,/^ORD-[A-Z2-9]{6}$/); // короткий номер заказаassert.equal(sbp.data.paymentUrl,'https://securepayment.superbanking.ru/1');
    assert.equal(createdLinks[0].projectId,'project-sbp');assert.equal(createdLinks[0].email,'buyer@example.test');
    assert.equal(createdLinks[0].items[0].price,100);assert.equal(createdLinks[0].items[0].count,1);
    // После оплаты покупатель возвращается в чат с ботом, а не на страницу магазина.
    assert.equal(createdLinks[0].successUrl,'https://t.me/platas_bot');assert.equal(createdLinks[0].failUrl,'https://t.me/platas_bot');
    const card=await order('card');
    assert.equal(createdLinks[1].projectId,'project-card');assert.equal(card.data.paymentUrl,'https://securepayment.superbanking.ru/2');
    assert.equal((await order('card')).data.id,card.data.id);assert.equal(links,2); // повтор не создаёт вторую ссылку
    // Webhook без подписи подтверждается запросом статуса: пока не оплачено — статус не меняется.
    assert.equal((await api('/api/payments/superbanking/webhook',{linkId:'unknown',status:'COMPLETE'})).status,404);
    assert.equal((await api('/api/payments/superbanking/webhook',{linkId:'link-1',status:'COMPLETE'})).status,200);
    assert.equal(find(sbp.data.id).status,'awaiting_payment');
    payStatus=1;
    const stockBefore=db.products[0].stock;
    assert.equal((await api('/api/payments/superbanking/webhook',{linkId:'link-1',status:'COMPLETE'})).status,200);
    assert.equal(find(sbp.data.id).status,'paid');assert.equal(db.products[0].stock,stockBefore-1);
    assert.equal((await api('/api/payments/superbanking/webhook',{linkId:'link-1',status:'COMPLETE'})).status,200);
    assert.equal(db.products[0].stock,stockBefore-1); // повторный webhook не списывает остаток дважды
    // Оплата меньше суммы заказа не засчитывается.
    payAmount=50;
    assert.equal((await api('/api/payments/superbanking/webhook',{linkId:'link-2',status:'COMPLETE'})).status,200);
    assert.equal(find(card.data.id).status,'awaiting_payment');
    payAmount=100;
    // Опрос статуса подхватывает оплату, даже если webhook не дошёл и заказ уже отменён по таймеру.
    const lateSb=await order('sbp','late-sbp');const lateSbOrder=find(lateSb.data.id);
    lateSbOrder.status='cancelled';lateSbOrder.superbankingCheckedAt=0;
    await workers.tick();
    assert.equal(lateSbOrder.status,'paid');assert.equal(lateSbOrder.paidAfterExpiry,true);
    // Тестовая оплата доступна только при ALLOW_TEST_PAYMENTS=1.
    const test=await order('test');assert.match(test.data.paymentUrl,/^\/api\/payments\//);
    assert.equal((await api(`/api/payments/${test.data.id}/demo?token=${test.data.paymentToken}`,{})).data.status,'paid');
    assert.equal(invoices,0);
    const crypto=await order('crypto');assert.equal(crypto.status,201);assert.equal(invoices,1);
    assert.equal(crypto.data.paymentUrl,'https://pay.example.test/invoice');
    assert.equal((await order('crypto')).data.id,crypto.data.id);assert.equal(invoices,1);
    assert.equal((await order('card','crypto')).status,409);
    assert.equal((await api(`/api/payments/${crypto.data.id}/demo?token=${crypto.data.paymentToken}`,{})).status,409);
    await workers.tick();assert.equal(messages.at(-1).reply_markup.inline_keyboard[0][0].url,crypto.data.paymentUrl);
    // Heleket webhook: sign is in the body, JSON is PHP-encoded (escaped slashes).
    const sign=data=>require('crypto').createHash('md5').update(Buffer.from(JSON.stringify(data).replace(/\//g,'\\/')).toString('base64')+'test-key').digest('hex');
    const hook={type:'payment',order_id:crypto.data.id,status:'paid',amount:'100.00',url:'https://pay.example.test/x'};
    assert.equal((await api('/api/payments/heleket/webhook',{...hook,sign:'0'.repeat(32)})).status,401);
    assert.equal((await api('/api/payments/heleket/webhook',hook)).status,401);
    const cryptoStock=db.products[0].stock;
    assert.equal((await api('/api/payments/heleket/webhook',{...hook,sign:sign(hook)})).status,200);
    assert.equal(find(crypto.data.id).status,'paid');assert.equal(db.products[0].stock,cryptoStock-1);
    assert.equal((await api('/api/payments/heleket/webhook',{...hook,sign:sign(hook)})).status,200);assert.equal(db.products[0].stock,cryptoStock-1);
    const late=await order('crypto','late');const lateOrder=find(late.data.id);lateOrder.status='cancelled';
    const lateHook={...hook,order_id:late.data.id,status:'paid_over'};
    assert.equal((await api('/api/payments/heleket/webhook',{...lateHook,sign:sign(lateHook)})).status,200);
    assert.equal(lateOrder.status,'paid');assert.equal(lateOrder.paidAfterExpiry,true);
    // Без ключей способ оплаты недоступен, а не подменяется тестовой оплатой.
    delete process.env.HELEKET_API_KEY;
    delete process.env.SUPERBANKING_API_TOKEN;
    assert.equal((await order('crypto','no-config')).status,503);
    assert.equal((await order('card','no-config-card')).status,503);
    assert.equal((await order('sbp','no-config-sbp')).status,503);
    assert.equal((await order('unknown')).status,400);
    process.env.SUPERBANKING_API_TOKEN='sb-token';
    process.env.ALLOW_TEST_PAYMENTS='0';
    assert.equal((await order('test','no-test')).status,400);
    console.log('PASS: Super Banking SBP/card links, webhook + status confirmation, late payment, Heleket crypto, disabled test payments, retries, Telegram URL');
  }catch(e){console.error(e);process.exitCode=1;}
  finally{global.fetch=realFetch;server.close();}
});
