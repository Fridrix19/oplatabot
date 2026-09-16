const assert=require('node:assert/strict');
const {deliver}=require('./order-delivery');
process.env.ORDERS_BOT_TOKEN='operator-test';process.env.BOT_TOKEN='customer-test';process.env.ADMIN_TELEGRAM_ID='42';
const db={orders:[{id:'pending',status:'awaiting_payment'},{id:'code',status:'paid',productName:'Card',userId:'8'},{id:'top',status:'paid',fulfillmentType:'topup',playerId:'123'},{id:'old',status:'delivered'}]};
const calls=[];let updates=[],id=100;
const customer=[];
const worker=require('./operator-bot').attach(db,async()=>{},async(method,args)=>{calls.push({method,args});return method==='getUpdates'?updates:{message_id:++id};},async(method,args)=>{customer.push({method,args});return {message_id:1};});
const reply=(from,order,text,update_id,extra={},to=order.operatorMessageId)=>({update_id,message:{from:{id:from},chat:{id:from,type:'private'},text,...extra,reply_to_message:{message_id:to}}});
const lastAdmin=()=>calls.filter(c=>c.method==='sendMessage').at(-1).args.text;
(async()=>{
 await worker.tick();assert.equal(calls.filter(c=>c.method==='sendMessage').length,2);
 await worker.tick();assert.equal(calls.filter(c=>c.method==='sendMessage').length,2);
 const code=db.orders[1],top=db.orders[2];
 updates=[reply(99,code,'STOLEN',1)];await worker.poll();assert.equal(code.status,'paid');
 updates=[reply(42,code,'VALID-CODE',2)];await worker.poll();assert.equal(code.code,'VALID-CODE');assert.equal(code.status,'delivered');
 assert.equal(lastAdmin(),'Код сохранён.');
 await worker.tick();assert(code.receiptPromptMessageId,'receipt prompt sent after delivery');
 // Text reply to a delivered order is a receipt, not a new code.
 updates=[reply(42,code,'Чек №1',3,{},code.receiptPromptMessageId)];await worker.poll();assert.equal(code.code,'VALID-CODE');
 assert.equal(customer.at(-1).method,'sendMessage');assert.equal(customer.at(-1).args.chat_id,'8');assert.match(customer.at(-1).args.text,/Чек №1/);
 assert.equal(lastAdmin(),'Чек отправлен покупателю.');
 updates=[reply(42,code,undefined,31,{photo:[{file_id:'small'},{file_id:'big'}]},code.receiptPromptMessageId)];await worker.poll();
 assert.equal(lastAdmin(),'Чек по этому заказу уже отправлен покупателю');
 // Photo receipt attached to a paid order is sent after delivery.
 const pre={id:'pre',status:'paid',productName:'Card',userId:'9'};db.orders.push(pre);await worker.tick();
 updates=[reply(42,pre,undefined,32,{photo:[{file_id:'small'},{file_id:'big'}]})];await worker.poll();
 assert.equal(pre.receiptFileId,'big');assert.equal(customer.length,1);assert.match(lastAdmin(),/после выдачи/);
 updates=[reply(42,pre,'PRE-CODE',33)];await worker.poll();assert.equal(pre.status,'delivered');
 await worker.tick();assert.equal(customer.length,1,'waits for customer notification');
 pre.notifiedStatus='delivered';await worker.tick();assert.equal(customer.at(-1).method,'sendPhoto');assert(pre.receiptSentAt);
 // Unknown failures are reported and do not block the update queue.
 updates=[reply(42,{operatorMessageId:999999},'x',34)];await worker.poll();assert.equal(lastAdmin(),'Ответьте на сообщение нужного заказа');
 assert.throws(()=>deliver(db,code,'ADMIN-SECOND','admin'),/уже выполнен/);
 updates=[{update_id:40,callback_query:{id:'cb',from:{id:42},data:'done:top',message:{message_id:top.operatorMessageId,chat:{id:42,type:'private'}}}}];await worker.poll();assert.equal(top.status,'delivered');assert.equal(top.code,null);
 await worker.tick();assert.equal(calls.filter(c=>c.method==='editMessageText').length,3);
 assert.equal(db.operatorOffset,41);
 console.log('PASS: receipts (text/photo, before/after delivery), paid-only operator queue, access control, reply delivery, duplicate protection, topup and message updates');
})().catch(e=>{console.error(e);process.exitCode=1;});
