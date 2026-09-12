const crypto=require('crypto');
// Add missing variants only; never replace administrator stock or customer data.
function migrate(db, entries=require('./catalog-meta.json')) {
  const norm=s=>String(s||'').normalize('NFKC').replace(/[—–]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
  const names=new Set(db.products.map(p=>norm(p.name)));
  let added=0;
  for(const entry of entries){
    if(names.has(norm(entry.name)) || (entry.shortName && names.has(norm(entry.shortName))))continue;
    db.products.push({id:'catalog_'+crypto.createHash('sha256').update(entry.name).digest('hex').slice(0,24),name:entry.name,category:entry.category,image:entry.image||'',price:entry.price||0,currency:'RUB',stock:0,status:'available',createdAt:new Date().toISOString()});
    names.add(norm(entry.name));added++;
  }
  return added;
}
module.exports={migrate};
