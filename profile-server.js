const crypto = require('crypto');
function verify(raw, token, now = Date.now()) {
  if (!raw || !token) throw new Error('Откройте магазин внутри Telegram');
  const params = new URLSearchParams(raw);
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new Error('Некорректные данные Telegram');
  const hash = params.get('hash');
  params.delete('hash');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const data = [...params].sort(([a],[b]) => a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  if (!/^[a-f0-9]{64}$/i.test(hash || '') || !crypto.timingSafeEqual(expected, Buffer.from(hash,'hex'))) throw new Error('Подпись Telegram не подтверждена');
  const age = now / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age < -30 || age > 86400) throw new Error('Откройте Mini App заново');
  const user = JSON.parse(params.get('user'));
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw new Error('Нет пользователя Telegram');
  return {id:String(user.id), first_name:String(user.first_name || ''), last_name:String(user.last_name || ''), username:String(user.username || '')};
}
function attach(app, db, save) {
  db.users ||= {};
  function auth(req,res,next) {
    try { req.telegramUser=verify(req.get('X-Telegram-Init-Data'),process.env.BOT_TOKEN); next(); }
    catch(e) {res.status(401).json({error:e.message});}
  }
  const ensure = req => {
    const u=req.telegramUser;
    if(!db.users[u.id]) db.users[u.id]={...u,favorites:{},createdAt:new Date().toISOString()};
    Object.assign(db.users[u.id],u);
    return db.users[u.id];
  };
  app.use('/api/orders',auth);
  app.use('/api/me',auth);
  app.get('/api/me',(req,res)=>{const u=ensure(req);save();res.json(u);});
  app.get('/api/me/orders',(req,res)=>res.json(db.orders.filter(o=>String(o.userId)===req.telegramUser.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(o=>{
    const product=db.products.find(p=>p.id===o.productId);
    return {id:o.id,productName:o.productName||product?.name||'Товар',amount:o.amount,status:o.status,createdAt:o.createdAt,code:o.status==='delivered'?o.code:null};
  })));
  app.put('/api/me/favorites/:id',(req,res)=>{
    const id=req.params.id, data=req.body;
    if(!/^(game|donate|giftcard|topuppkg):[\w:.-]{1,180}$/.test(id)) return res.status(400).json({error:'Некорректный товар'});
    const favorite={};
    for(const key of ['name','price','old','img','grad','sub']) if(typeof data[key]==='string') favorite[key]=data[key].slice(0,500);
    if(Object.keys(ensure(req).favorites).length>=500&&!ensure(req).favorites[id])return res.status(400).json({error:'Лимит избранного — 500'});
    ensure(req).favorites[id]=favorite;save();res.json({ok:true});
  });
  app.delete('/api/me/favorites/:id',(req,res)=>{delete ensure(req).favorites[req.params.id];save();res.json({ok:true});});
}
module.exports={attach,verify};
