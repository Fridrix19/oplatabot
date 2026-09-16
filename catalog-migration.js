const crypto=require('crypto');
// Add missing variants only; never replace administrator stock or customer data.
function migrate(db, entries=require('./catalog-meta.json')) {
  const norm=s=>String(s||'').normalize('NFKC').replace(/[—–]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
  const names=new Set(db.products.map(p=>norm(p.name)));
  let added=0;
  for(const entry of entries){
    if(names.has(norm(entry.name)) || (entry.shortName && names.has(norm(entry.shortName))))continue;
    db.products.push({id:'catalog_'+crypto.createHash('sha256').update(entry.name).digest('hex').slice(0,24),name:entry.name,category:entry.category,image:entry.image||'',price:entry.price||0,currency:'RUB',stock:100,status:'available',createdAt:new Date().toISOString()});
    names.add(norm(entry.name));added++;
  }
  return added;
}
// Games and PS Plus subscriptions were removed from the storefront.
const RETIRED=['GRAND THEFT AUTO VI','EA FC 26','Steelbound Trilogy','Crimson Order: Origins','Ironclad Frontier','Requiem: Blackout','Solace Drift Racing','Colony Two',"Reaper's Call: Black Ice",'Skyline Drift','ESSENTIAL','EXTRA','DELUXE','EA Play'];
function retire(db){
  const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
  const retired=new Set(RETIRED.map(norm));
  const isRetired=p=>retired.has(norm(p.name))||p.category==='Игры';
  const used=new Set((db.orders||[]).map(o=>o.productId));
  let changed=0;
  db.products=db.products.filter(p=>{
    if(!isRetired(p))return true;
    changed++;
    if(!used.has(p.id))return false;
    p.status='disabled';// keep purchase history readable
    return true;
  });
  return changed;
}
module.exports={migrate,retire};
