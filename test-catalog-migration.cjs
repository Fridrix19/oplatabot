const assert=require('node:assert/strict'),express=require('express');
process.env.ALLOW_TEST_PAYMENTS='1';
const entries=require('./catalog-meta.json'),{migrate,retire}=require('./catalog-migration');
const db={products:structuredClone(require('./data.json').products),orders:[],users:{'test':{favorites:{saved:{name:'Old favorite'}}}}};
const before=JSON.stringify({products:db.products,users:db.users});const existing=db.products.length;
migrate(db);assert.equal(migrate(db),0);
assert.equal(JSON.stringify({products:db.products.slice(0,existing),users:db.users}),before);
assert(db.products.slice(existing).every(p=>p.stock===100&&p.status==='available'));
{const d={products:[{id:'g1',name:'GRAND THEFT AUTO VI'},{id:'g2',name:'EA Play'},{id:'k',name:'Keep me'}],orders:[{productId:'g2'}]};
 assert.equal(retire(d),2);assert.deepEqual(d.products.map(p=>p.id),['g2','k']);assert.equal(d.products[0].status,'disabled');}
assert(!entries.some(e=>e.category==='Игры'));
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
