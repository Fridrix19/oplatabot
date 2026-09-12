// Extract local catalog literals, never execute storefront DOM code.
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('script.js','utf8');
function literal(name){const start=src.indexOf('const '+name+' = ');const end=src.indexOf('\n};',start)+3;if(start<0||end<3)throw new Error(name);return vm.runInNewContext(src.slice(start,end)+';'+name,{}, {timeout:1000});}
const cards=literal('giftCatalogs'),services=literal('donateServices'),games=literal('games');const entries=[];
for(const [key,c] of Object.entries(cards))for(const group of c.countries||[{items:c.items}])for(const p of group.items||[])entries.push({name:p.name,category:c.title||key,image:p.img||c.img||'',price:p.price,fulfillmentType:key==='tgstars'?'topup':'code'});
for(const [key,s] of Object.entries(services)){
  const packages=[...(s.packages||[]),...(s.variants||[]).flatMap(v=>v.packages||[])];
  for(const p of packages)entries.push({name:s.name+' — '+p.name,shortName:p.name,category:s.name,image:p.img||s.img||'',price:p.price,fulfillmentType:s.idLabel?'topup':'code'});
  for(const p of s.codesCatalog?.items||[])entries.push({name:p.name,category:s.name,image:p.img||s.img||'',price:p.price,fulfillmentType:s.idLabel?'topup':'code'});
  if(s.customAmount)entries.push({name:s.name,category:s.name,image:s.img||'',fulfillmentType:'topup',customAmount:true});
}
for(const list of Object.values(games))for(const p of list)entries.push({name:p.name,category:'Игры',image:p.img||'',fulfillmentType:'code'});
fs.writeFileSync('catalog-meta.json',JSON.stringify(entries,null,2));console.log('Metadata:',entries.length);
