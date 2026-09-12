const assert=require('node:assert/strict'),express=require('express');
const entries=require('./catalog-meta.json'),{migrate}=require('./catalog-migration');
const db={products:structuredClone(require('./data.json').products),orders:[],users:{'test':{favorites:{saved:{name:'Old favorite'}}}}};
const before=JSON.stringify({products:db.products,users:db.users});const existing=db.products.length;
migrate(db);assert.equal(migrate(db),0);
assert.equal(JSON.stringify({products:db.products.slice(0,existing),users:db.users}),before);
assert(db.products.slice(existing).every(p=>p.stock===0));
// Isolated in-memory catalog: verify every variant reaches the current checkout.
for(const p of db.products){p.stock=100;p.status='available';}
const app=express();app.use(express.json());app.use((req,res,next)=>{req.telegramUser={id:'test'};next();});
require('./fulfillment').attach(app,db,async()=>{},(req,res,next)=>next());
const server=app.listen(0,async()=>{try{
 for(const [i,entry] of entries.entries()){
  const response=await fetch(`http://localhost:${server.address().port}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:entry.name,catalogName:entry.name,amount:entry.price||100,playerId:entry.fulfillmentType==='topup'?'123456':'',checkoutKey:'catalog-'+i})});
  const order=await response.json();assert.equal(response.status,201,entry.name+': '+JSON.stringify(order));assert.equal(order.fulfillmentType,entry.fulfillmentType,entry.name);
 }
 console.log(`PASS: migration preserves existing data, is repeatable, and all ${entries.length} variants reach checkout`);
}catch(e){console.error(e);process.exitCode=1;}finally{server.close();}});
