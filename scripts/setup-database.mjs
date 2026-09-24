import fs from 'node:fs/promises';
import pg from 'pg';
const envFile=await fs.readFile(process.env.DRONE_ENV_FILE||'.env','utf8');
const values=Object.fromEntries(envFile.split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const split=line.indexOf('=');return [line.slice(0,split),line.slice(split+1).replace(/^['"]|['"]$/g,'')];}));
const ref=values.SUPABASE_PROJECT_REF;
if(!ref)throw new Error('Projeto não configurado.');
if(values.SUPABASE_DB_PASSWORD_CONFIRMED!=='true')throw new Error('Confirme a senha do banco para o projeto atual antes de executar.');
const ca=await fs.readFile(new URL('../supabase/prod-ca-2021.crt',import.meta.url),'utf8');
const client=new pg.Client({host:values.SUPABASE_DB_HOST||`db.${ref}.supabase.co`,port:Number(values.SUPABASE_DB_PORT)||5432,user:values.SUPABASE_DB_USER||'postgres',database:'postgres',password:values.SUPABASE_DB_PASSWORD||values.SUPABASE_PASSWORD,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:12000});
try{
  await client.connect();
  const {rows}=await client.query("select to_regclass('public.academy_profiles') is not null as installed");
  console.log('Conexão PostgreSQL confirmada; migração existente:',rows[0].installed);
  if(process.argv.includes('--apply')){
    if(!rows[0].installed){await client.query(await fs.readFile(new URL('../supabase/migrations/202609240001_academy.sql',import.meta.url),'utf8'));console.log('Migração aplicada.');}
    else console.log('Migração não reaplicada: tabelas já existentes.');
    const user=await client.query("select 1 from auth.users where lower(email)=$1 and email_confirmed_at is not null",['dev.cristianodepaula@gmail.com']);
    if(user.rowCount===1){await client.query(await fs.readFile(new URL('../supabase/bootstrap-superadmin.sql',import.meta.url),'utf8'));console.log('Superadmin ativado para a conta confirmada.');}
    else console.log('Superadmin pendente: cadastre e confirme o e-mail antes do bootstrap.');
  }
}catch(error){console.error('Falha na configuração:',error.code||error.name,error.message);process.exitCode=1;}
finally{await client.end();}
