const assert=require('node:assert/strict');
const {newDb}=require('pg-mem');
const memory=newDb({noAstCoverageCheck:true});memory.public.registerFunction({name:'pg_try_advisory_lock',args:['integer'],returns:'bool',implementation:()=>true});
const pg=require('pg');pg.Client=memory.adapters.createPg().Client;
process.env.DATABASE_URL='postgresql://test';
const {openStorage}=require('./storage');
(async()=>{const first={products:[{id:'p',stock:100}],orders:[],users:{}};const store=await openStorage(first,'unused');await store.run(async()=>{first.users['1']={favorites:{test:true}};first.orders.push({id:'order1',userId:'1',status:'paid'});await store.write(JSON.stringify(first));});const second={products:[],orders:[],users:{}};await openStorage(second,'unused');assert.equal(second.orders[0].id,'order1');assert.equal(second.users['1'].favorites.test,true);assert.equal(second.products[0].stock,100);console.log('PASS: SQL transaction, initialization, write, reload without reseeding (pg-mem)');})().catch(e=>{console.error(e);process.exitCode=1;});
