import {SUPABASE_URL,SUPABASE_PUBLIC_KEY} from '../src/services/supabase.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
class Failure extends Error{constructor(status,message){super(message);this.status=status;}}

// Auth validates the caller's token; the profile query uses that same token and RLS.
// The privileged key is used only after checking the current administrator role.
export async function handleUserEmail(request,{fetcher=fetch,env=process.env}={}){
 try{
  if(!['GET','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST','Cache-Control':'no-store'}});
  const authorization=request.headers.get('authorization');
  if(!/^Bearer \S+$/i.test(authorization||''))throw new Failure(401,'Entre novamente para continuar.');
  const url=(env.SUPABASE_URL||SUPABASE_URL).replace(/\/$/,''),key=env.SUPABASE_PUBLISHABLE_KEY||SUPABASE_PUBLIC_KEY;
  const headers={apikey:key,Authorization:authorization};
  const call=(path,options={})=>fetcher(url+path,{...options,signal:AbortSignal.timeout(15000)});
  const auth=await call('/auth/v1/user',{headers});
  if(!auth.ok)throw new Failure(auth.status>=500?503:401,'Não foi possível validar sua sessão.');
  const user=await auth.json();
  if(!uuid.test(user.id||''))throw new Failure(401,'Sessão inválida.');
  const profiles=await call(`/rest/v1/academy_profiles?select=role,active&id=eq.${user.id}`,{headers});
  if(!profiles.ok)throw new Failure(503,'Não foi possível verificar as permissões.');
  const [profile]=await profiles.json();
  if(profile?.role!=='superadmin'||profile.active!==true)throw new Failure(403,'Acesso restrito ao administrador ativo.');

  let ids,body;
  if(request.method==='GET'){
   ids=new URL(request.url).searchParams.get('ids')?.split(',')||[];
   if(!ids.length||ids.length>30||ids.some(id=>!uuid.test(id)))throw new Failure(400,'Informe até 30 usuários válidos.');
  }else{
   try{body=await request.json();}catch{throw new Failure(400,'Solicitação inválida.');}
   if(!uuid.test(body?.id||'')||typeof body?.email!=='string'||!body.email.trim()||body.email.length>320)throw new Failure(400,'Informe o usuário e o e-mail exibido na lista.');
   ids=[body.id];
  }
  const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)throw new Failure(503,'Confirmação de e-mail indisponível. Configure SUPABASE_SECRET_KEY no servidor.');
  const adminHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
  async function getUser(id){
   const response=await call(`/auth/v1/admin/users/${id}`,{headers:adminHeaders});
   if(response.status===404)throw new Failure(404,'Usuário não encontrado no Auth.');
   if(!response.ok)throw new Failure(502,'Não foi possível consultar o e-mail no Supabase Auth.');
   const data=await response.json();return data.user||data;
  }
  const status=user=>({id:user.id,email:user.email||'',email_confirmed_at:user.email_confirmed_at||null});
  if(request.method==='GET'){
   const users=[];
   // Bound concurrent Auth requests independently of the table size.
   for(let i=0;i<ids.length;i+=5)users.push(...await Promise.all(ids.slice(i,i+5).map(async id=>status(await getUser(id)))));
   return json({users});
  }
  const target=await getUser(body.id);
  if(!target.email||target.email.toLowerCase()!==body.email.trim().toLowerCase())throw new Failure(409,'O e-mail da conta mudou. Atualize a lista antes de confirmar.');
  if(target.email_confirmed_at)return json(status(target));
  const update=await call(`/auth/v1/admin/users/${body.id}`,{method:'PUT',headers:adminHeaders,body:JSON.stringify({email_confirm:true})});
  if(!update.ok)throw new Failure(502,'O Supabase Auth não confirmou o e-mail. Tente novamente.');
  const result=await update.json(),confirmed=result.user||result;
  if(!confirmed.email_confirmed_at)throw new Failure(502,'A confirmação não foi concluída pelo Supabase Auth. Atualize a lista.');
  return json(status(confirmed));
 }catch(error){return json({error:error instanceof Failure?error.message:'Serviço de confirmação de e-mail indisponível.'},error instanceof Failure?error.status:503);}
}

export default async function userEmail(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 try{
  let body;
  if(req.method==='POST'){
   if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else{const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>4096){res.statusCode=413;res.end(JSON.stringify({error:'Solicitação muito grande.'}));return;}chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks).toString('utf8');}
   if(Buffer.byteLength(body)>4096){res.statusCode=413;res.end(JSON.stringify({error:'Solicitação muito grande.'}));return;}
  }
  const headers=new Headers();if(req.headers.authorization)headers.set('authorization',req.headers.authorization);
  const response=await handleUserEmail(new Request(new URL(req.url,'https://academy.invalid'),{method:req.method,headers,...(body!==undefined?{body}:{})}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Serviço de confirmação de e-mail indisponível.'}));}
}
