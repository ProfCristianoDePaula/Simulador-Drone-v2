import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {connectDatabase} from './database-client.mjs';
let client;
try{
 ({client}=await connectDatabase());
 await client.query('create schema if not exists academy_private');
 await client.query('create table if not exists academy_private.schema_migrations(version text primary key,checksum text not null,applied_at timestamptz default now())');
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await fs.readdir(dir)).filter(n=>n.endsWith('.sql')).sort()){
  const sql=await fs.readFile(new URL(name,dir),'utf8');const checksum=crypto.createHash('sha256').update(sql).digest('hex');
  const existing=await client.query('select checksum from academy_private.schema_migrations where version=$1',[name]);
  if(existing.rowCount){if(existing.rows[0].checksum!==checksum)throw new Error(`Migração alterada após aplicação: ${name}`);continue;}
  if(name.startsWith('202609240001')){const {rows}=await client.query("select to_regclass('public.academy_profiles') is not null as present");if(rows[0].present)throw new Error('Banco contém a base sem registro de migração. Compare o esquema antes de adotar a versão inicial.');}
  await client.query('begin');
  try{await client.query(sql.replace(/^begin;\s*/m,'').replace(/commit;\s*$/,''));await client.query('insert into academy_private.schema_migrations(version,checksum) values($1,$2)',[name,checksum]);await client.query('commit');console.log('Aplicada:',name);}catch(error){await client.query('rollback');throw error;}
 }
}catch(error){console.error('Migração não concluída:',error.code||'',error.message);process.exitCode=1;}finally{await client?.end();}
