import {withSupabase} from '@supabase/server';
import {SUPABASE_URL,SUPABASE_PUBLIC_KEY} from '../src/services/supabase.js';
const url=process.env.SUPABASE_URL||SUPABASE_URL;
export const handleSession=withSupabase({auth:'user',cors:'disabled',issuer:`${url}/auth/v1`,audience:'authenticated',env:{url,publishableKeys:{default:process.env.SUPABASE_PUBLISHABLE_KEY||SUPABASE_PUBLIC_KEY},secretKeys:{},jwks:new URL(process.env.SUPABASE_JWKS_URL||`${url}/auth/v1/.well-known/jwks.json`)}},async(_req,ctx)=>{
 const {data,error}=await ctx.supabase.from('academy_profiles').select('id,email,full_name,role,active').eq('id',ctx.userClaims.id).single();
 if(error)return Response.json({error:'Perfil indisponível. Verifique as migrações do banco.'},{status:503});
 if(!data.active)return Response.json({error:'Acesso acadêmico desativado. Procure o administrador.'},{status:403});
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
});
export default async function session(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return;}
 try{const headers=new Headers();if(req.headers.authorization)headers.set('authorization',req.headers.authorization);const response=await handleSession(new Request('https://academy.invalid/api/session',{headers}));res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.setHeader('Cache-Control','no-store');res.end(await response.text());}
 catch{res.statusCode=503;res.end(JSON.stringify({error:'Serviço de autenticação indisponível.'}));}
}
