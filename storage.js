const fs=require('fs');
const path=require('path');
function replace(db,value){for(const key of Object.keys(db))delete db[key];Object.assign(db,value);db.users||={};}
async function openStorage(db,file){
  let client=null,queue=Promise.resolve();
  if(process.env.DATABASE_URL){
    const {Client}=require('pg');client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
    await client.query('CREATE TABLE IF NOT EXISTS store (id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
    await client.query('INSERT INTO store(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(db)]);
    replace(db,(await client.query('SELECT data FROM store WHERE id=1')).rows[0].data);
    console.log('PostgreSQL connected');
  }
  return {
    write:async raw=>{
      if(client)return client.query('UPDATE store SET data=$1::jsonb, updated_at=now() WHERE id=1',[raw]);
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',raw);fs.renameSync(file+'.tmp',file);
    },
    run(task){
      const work=queue.then(async()=>{
        let before=JSON.stringify(db),begun=false;
        try{
          if(client){await client.query('BEGIN');begun=true;replace(db,(await client.query('SELECT data FROM store WHERE id=1 FOR UPDATE')).rows[0].data);before=JSON.stringify(db);}
          const result=await task();if(client)await client.query('COMMIT');return result;
        }catch(e){
          if(begun)await client.query('ROLLBACK').catch(()=>{});
          replace(db,JSON.parse(before));throw e;
        }
      });
      queue=work.catch(()=>{});return work;
    }
  };
}
module.exports={openStorage};
