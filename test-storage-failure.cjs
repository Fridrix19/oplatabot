const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStorage}=require('./storage');
process.env.DATABASE_URL='';
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'store-failure-'));
  try{
    const file=path.join(dir,'db.json'),db={products:[{stock:100}],orders:[],users:{}};
    const store=await openStorage(db,file);await store.write(JSON.stringify(db));
    await assert.rejects(store.run(async()=>{db.products[0].stock=0;throw new Error('failed mutation');}));
    assert.equal(db.products[0].stock,100);
    assert.equal(JSON.parse(fs.readFileSync(file)).products[0].stock,100);
    await store.run(async()=>{db.products[0].stock=99;await store.write(JSON.stringify(db));});
    assert.equal(JSON.parse(fs.readFileSync(file)).products[0].stock,99);
    console.log('PASS: failed mutation rolls back memory; next transaction succeeds');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
