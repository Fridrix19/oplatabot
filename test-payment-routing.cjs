const assert=require('node:assert/strict');
const express=require('express');
const {attach}=require('./fulfillment');
process.env.HELEKET_MERCHANT_ID='test-merchant';
process.env.HELEKET_API_KEY='test-key';
process.env.PUBLIC_URL='https://example.test';
process.env.BOT_TOKEN='test-bot';
const realFetch=global.fetch;
let invoices=0;
global.fetch=async(url,options)=>{
  if(url==='https://api.heleket.com/v1/payment'){
    invoices++;
    return {ok:true,json:async()=>({state:0,result:{url:'https://pay.example.test/invoice'}})};
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
  const order=(method,key=method)=>api('/api/orders',{name:'Routing test',amount:100,paymentMethod:method,checkoutKey:key});
  try{
    for(const method of ['sbp','card','test']){
      const r=await order(method);assert.equal(r.status,201);assert.equal(r.data.paymentMethod,method);
      assert.match(r.data.paymentUrl,/^\/api\/payments\//);assert.equal(invoices,0);
      assert.equal((await api(`/api/payments/${r.data.id}/demo?token=${r.data.paymentToken}`,{})).data.status,'paid');
    }
    const crypto=await order('crypto');assert.equal(crypto.status,201);assert.equal(invoices,1);
    assert.equal(crypto.data.paymentUrl,'https://pay.example.test/invoice');
    assert.equal((await order('crypto')).data.id,crypto.data.id);assert.equal(invoices,1);
    assert.equal((await order('card','crypto')).status,409);
    assert.equal((await api(`/api/payments/${crypto.data.id}/demo?token=${crypto.data.paymentToken}`,{})).status,409);
    await workers.tick();assert.equal(messages.at(-1).reply_markup.inline_keyboard[0][0].url,crypto.data.paymentUrl);
    delete process.env.HELEKET_API_KEY;
    assert.equal((await order('crypto','no-config')).status,503);
    assert.equal((await order('card','no-config-card')).status,201);
    assert.equal((await order('unknown')).status,400);
    console.log('PASS: crypto-only Heleket, test SBP/card, retries, missing config, Telegram URL, demo isolation');
  }catch(e){console.error(e);process.exitCode=1;}
  finally{global.fetch=realFetch;server.close();}
});
