try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
const express=require('express');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.path.startsWith('/api/'))return next();if(req.path.startsWith('/images/')||['/','/index.html','/admin.html','/payment.html','/script.js','/styles.css','/stock-sync.js','/profile-client.js','/admin-orders.js','/checkout.js'].includes(req.path))return express.static(__dirname)(req,res,next);res.sendStatus(404);});
const file=process.env.DATA_FILE||path.join(__dirname,'data.json');
const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'data.json'),'utf8'));
let db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{products:seed.products,codes:[],orders:[],promocodes:[],users:{},stockInitialized:true};
let store;let writes=Promise.resolve();
const save=()=>{const raw=JSON.stringify(db);writes=writes.then(()=>store.write(raw));writes.catch(()=>{});return writes;};
const transaction=task=>store.run(async()=>{writes=Promise.resolve();const result=await task();await writes;return result;});
// Commit before acknowledging; row locks also protect overlapping deployments.
app.use('/api',(req,res,next)=>{const end=res.end.bind(res);let result;
  transaction(()=>new Promise(resolve=>{res.end=(...args)=>{result=args;resolve();};next();})).then(()=>end(...result)).catch(e=>{console.error('Storage request:',e.message);res.statusCode=503;res.removeHeader('Content-Length');res.removeHeader('ETag');end(JSON.stringify({error:'Ошибка сохранения. Повторите запрос позже.'}));});
});
require('./profile-server').attach(app,db,save);
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
function user(req){return req.telegramUser.id;}
const ADMIN_PASSWORD=process.env.ADMIN_TOKEN||'55555';
function admin(req,res,next){if(req.headers.authorization!==`Bearer ${ADMIN_PASSWORD}`)return res.status(401).json({error:'Неверный пароль администратора'});next();}
const startWorkers=require('./fulfillment').attach(app,db,save,admin);
app.get('/api/products',(req,res)=>{let q=(req.query.q||'').toLowerCase();res.json(db.products.filter(p=>(!q||p.name.toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q))).map(p=>({...p,available:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length),soldOut:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length)<=0||p.status==='disabled'})));});
app.get('/api/products/:id',(req,res)=>{let p=db.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);res.json({...p,available:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length),soldOut:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length)<=0||p.status==='disabled'});});
app.get('/api/orders',(req,res)=>res.json(db.orders.filter(o=>o.userId===user(req))));
app.get('/api/admin/products',admin,(req,res)=>res.json(db.products.map(p=>({...p,available:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length),soldOut:(Number.isFinite(p.stock)?p.stock:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length)<=0||p.status==='disabled'}))));
app.get('/api/admin/orders',admin,(req,res)=>res.json(db.orders));
app.patch('/api/admin/products/:id',admin,(req,res)=>{let p=db.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);if(req.body.stock!==undefined){if(!Number.isSafeInteger(req.body.stock)||req.body.stock<0)return res.status(400).json({error:'Остаток должен быть целым числом от 0'});p.stock=req.body.stock;}if(req.body.status!==undefined){if(!['available','disabled','hidden','sold_out'].includes(req.body.status))return res.status(400).json({error:'Некорректный статус'});p.status=req.body.status;}save();res.json(p);});
app.get('/api/admin/codes',admin,(req,res)=>res.json(db.codes.map(c=>({...c,code: c.code}))));
app.post('/api/admin/products',admin,(req,res)=>{let p={id:req.body.id||'p_'+Date.now(),name:req.body.name,description:req.body.description||'',category:req.body.category||'',price:Number(req.body.price)||0,currency:req.body.currency||'RUB',status:req.body.status||'available',image:req.body.image||'',createdAt:new Date().toISOString()};db.products.push(p);save();res.status(201).json(p);});
app.post('/api/admin/codes',admin,(req,res)=>{let items=Array.isArray(req.body.codes)?req.body.codes:[];let added=0;for(const code of items){if(!code||db.codes.some(c=>c.code===code))continue;db.codes.push({id:'c_'+Date.now()+'_'+added,productId:req.body.productId,code,status:'free',createdAt:new Date().toISOString()});added++;}save();res.json({added});});
app.post('/api/admin/stock',admin,(req,res)=>{let n=Math.max(0,Number(req.body.quantity)||0),added=0;for(let i=0;i<n;i++){let code='PLT-'+crypto.randomBytes(8).toString('hex').toUpperCase();db.codes.push({id:'c_'+Date.now()+'_'+i,productId:req.body.productId,code,status:'free',createdAt:new Date().toISOString()});added++;}save();res.json({added});});


app.use((err,req,res,next)=>{console.error('Request failed:',err.message);if(!res.headersSent)res.status(500).json({error:'Не удалось выполнить действие'});});
require('./storage').openStorage(db,file).then(storage=>{store=storage;app.listen(process.env.PORT||3000,()=>{console.log('Platas API ready');if(process.env.DISABLE_WORKERS!=='1')startWorkers(transaction);});}).catch(e=>{console.error('Storage startup failed:',e.message);process.exit(1);});
