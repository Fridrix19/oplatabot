const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'platas-test-')),file=path.join(dir,'store.json'),token='test-token';
const initial={products:[{id:'card',name:'Карта PS Store',category:'PlayStation',price:499,stock:100,status:'available'},{id:'pubg',name:'PUBG Mobile — 60 UC',category:'PUBG Mobile',price:140,stock:100,status:'available'}],orders:[],codes:[],users:{},stockInitialized:true};
fs.writeFileSync(file,JSON.stringify(initial));
function init(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Тест'})});const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');p.set('hash',crypto.createHmac('sha256',crypto.createHmac('sha256','WebAppData').update(token).digest()).update(data).digest('hex'));return p.toString();}
let child;
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,DATABASE_URL:'',DATA_FILE:file,PORT:'3098',BOT_TOKEN:token,ADMIN_TOKEN:'test-admin',PUBLIC_URL:'',DISABLE_WORKERS:'1'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('API ready')){clearTimeout(timeout);resolve();}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error('server exited '+code));});});}
async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
async function api(url,method='GET',body,id=1,admin=false){const r=await fetch('http://localhost:3098'+url,{method,headers:{'Content-Type':'application/json','X-Telegram-Init-Data':init(id),Authorization:admin?'Bearer test-admin':''},body:body?JSON.stringify(body):undefined});const d=await r.json();return {status:r.status,data:d};}
(async()=>{try{
  await start();
  assert.equal((await fetch('http://localhost:3098/api/me')).status,401);
  await api('/api/me/favorites/giftcard:psstore:TR:0','PUT',{name:'Карта',price:'499 ₽'});
  assert.equal(Object.keys((await api('/api/me')).data.favorites).length,1);
  assert.equal(Object.keys((await api('/api/me','GET',null,2)).data.favorites).length,0);
  const card=(await api('/api/orders','POST',{name:'Карта PS Store',amount:499,checkoutKey:'a'})).data;
  assert.equal((await api('/api/orders','POST',{name:'Карта PS Store',amount:499,checkoutKey:'a'})).data.id,card.id);
  assert.equal((await api('/api/admin/orders/'+card.id,'PATCH',{action:'deliver',code:'secret'},1,true)).status,409);
  const pay='/api/payments/'+card.id+'/demo?token='+card.paymentToken;
  assert.equal((await api(pay,'POST',{})).data.status,'paid');
  assert.equal((await api(pay,'POST',{})).data.status,'paid');
  assert.equal((await api('/api/products')).data[0].available,99);
  let own=(await api('/api/me/orders')).data;assert.equal(own[0].code,null);
  assert.equal((await api('/api/me/orders','GET',null,2)).data.length,0);
  assert.equal((await api('/api/admin/orders/'+card.id,'PATCH',{action:'deliver',code:'TEST-CODE'},1,true)).data.status,'delivered');
  assert.equal((await api('/api/admin/orders/'+card.id,'PATCH',{action:'deliver',code:'SECOND'},1,true)).status,409);
  const top=(await api('/api/orders','POST',{name:'PUBG Mobile — 60 UC',amount:140,playerId:'123456',zoneId:'12',gameServer:'Asia',checkoutKey:'b'})).data;
  await api('/api/payments/'+top.id+'/demo?token='+top.paymentToken,'POST',{});
  assert.equal((await api('/api/admin/orders/'+top.id,'PATCH',{action:'deliver'},1,true)).data.fulfillmentType,'topup');
  await stop();
  const disk=JSON.parse(fs.readFileSync(file));disk.orders.push({...card,id:'ORD-expired',status:'awaiting_payment',expiresAt:new Date(Date.now()-1000).toISOString()});fs.writeFileSync(file,JSON.stringify(disk));
  await start();
  assert.equal((await api('/api/me')).data.favorites['giftcard:psstore:TR:0'].name,'Карта');
  own=(await api('/api/me/orders')).data;assert.equal(own.find(o=>o.id===card.id).code,'TEST-CODE');assert.equal(own.find(o=>o.id===top.id).playerId,'123456');
  assert.equal((await api('/api/payments/ORD-expired/demo?token='+card.paymentToken,'POST',{})).status,409);
  console.log('PASS: ownership, favorites, restart persistence, manual code, manual topup, duplicate payment/delivery, expiration');
}finally{if(child?.exitCode===null)await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
