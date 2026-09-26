import fs from 'node:fs/promises';
import pg from 'pg';
export async function connectDatabase(){
 const text=await fs.readFile(process.env.DRONE_ENV_FILE||'.env','utf8');
 const env=Object.fromEntries(text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
 if(!env.SUPABASE_PROJECT_REF||env.SUPABASE_DB_PASSWORD_CONFIRMED!=='true')throw new Error('Configure e confirme o projeto e a senha no .env.');
 const ca=await fs.readFile(new URL('../supabase/prod-ca-2021.crt',import.meta.url),'utf8');
 const client=new pg.Client({host:env.SUPABASE_DB_HOST||`db.${env.SUPABASE_PROJECT_REF}.supabase.co`,port:Number(env.SUPABASE_DB_PORT)||5432,user:env.SUPABASE_DB_USER||'postgres',database:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:12000});
 await client.connect();return {client,env};
}
