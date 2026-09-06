const express=require('express');const fs=require('fs');const path=require('path');
const app=express();app.use(express.json());app.use(express.static(__dirname));
const file=path.join(__dirname,'data.json');let db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {products:[],codes:[],orders:[],promocodes:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(db,null,2));
function user(req){return req.headers['x-telegram-id']||'demo';}
function admin(req,res,next){if(process.env.ADMIN_TOKEN&&req.headers.authorization!==`Bearer ${process.env.ADMIN_TOKEN}`)return res.status(401).json({error:'Unauthorized'});next();}
app.get('/api/products',(req,res)=>{let q=(req.query.q||'').toLowerCase();res.json(db.products.filter(p=>(!q||p.name.toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q))).map(p=>({...p,available:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length})));});
app.get('/api/products/:id',(req,res)=>{let p=db.products.find(x=>x.id===req.params.id);if(!p)return res.sendStatus(404);res.json({...p,available:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length});});
app.post('/api/orders',(req,res)=>{let p=db.products.find(x=>x.id===req.body.productId);if(!p)return res.status(400).json({error:'Товар не найден'});let id='ORD-'+Date.now();let o={id,userId:user(req),productId:p.id,amount:p.price,status:'pending',createdAt:new Date().toISOString(),paymentUrl:'/api/payments/'+id};db.orders.push(o);save();res.status(201).json(o);});
app.post('/api/payments/:id/webhook',(req,res)=>{let o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.sendStatus(404);if(o.status==='delivered')return res.json(o);let c=db.codes.find(x=>x.productId===o.productId&&x.status==='free');o.status=c?'delivered':'error';if(c){c.status='used';c.orderId=o.id;o.code=c.code;o.paidAt=new Date().toISOString();}save();res.json(o);});
app.get('/api/orders',(req,res)=>res.json(db.orders.filter(o=>o.userId===user(req))));
app.get('/api/admin/products',admin,(req,res)=>res.json(db.products.map(p=>({...p,available:db.codes.filter(c=>c.productId===p.id&&c.status==='free').length}))));
app.post('/api/admin/products',admin,(req,res)=>{let p={id:req.body.id||'p_'+Date.now(),name:req.body.name,description:req.body.description||'',category:req.body.category||'',price:Number(req.body.price)||0,currency:req.body.currency||'RUB',status:req.body.status||'available',image:req.body.image||'',createdAt:new Date().toISOString()};db.products.push(p);save();res.status(201).json(p);});
app.post('/api/admin/codes',admin,(req,res)=>{let items=Array.isArray(req.body.codes)?req.body.codes:[];let added=0;for(const code of items){if(!code||db.codes.some(c=>c.code===code))continue;db.codes.push({id:'c_'+Date.now()+'_'+added,productId:req.body.productId,code,status:'free',createdAt:new Date().toISOString()});added++;}save();res.json({added});});
app.listen(process.env.PORT||3000,()=>console.log('Platas API ready'));
