import test from 'node:test';
import assert from 'node:assert/strict';
import {handleUserEmail} from '../api/user-email.js';

const actor='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://supabase.invalid',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'secret-test'};
const timestamp='2026-09-30T12:00:00Z';
function fixture({role='superadmin',active=true,confirmed=false,authStatus=200,updateStatus=200,email='student@example.test'}={}){
 const calls=[];let current={id:target,email,email_confirmed_at:confirmed?timestamp:null};
 const fetcher=async(url,options)=>{
  calls.push({url,options});const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:actor},{status:authStatus});
  if(path==='/rest/v1/academy_profiles')return Response.json([{role,active}]);
  if(path===`/auth/v1/admin/users/${target}`){
   if(options.method==='PUT'){
    if(updateStatus!==200)return Response.json({message:'internal secret details'},{status:updateStatus});
    current={...current,email_confirmed_at:timestamp,identities:[{provider:'email',identity_data:{email_verified:true}}]};
   }
   return Response.json(current);
  }
  throw new Error('Unexpected network call '+url);
 };
 return {fetcher,calls};
}
const request=(body={id:target,email:'student@example.test'},token='user-token')=>new Request('https://academy.invalid/api/user-email',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)});

test('email confirmation rejects unauthenticated requests before accessing Auth',async()=>{
 const f=fixture(),response=await handleUserEmail(request(undefined,''),{...f,env});assert.equal(response.status,401);assert.equal(f.calls.length,0);
});
test('only an active administrator can read status or confirm email',async()=>{
 for(const settings of [{role:'student'},{role:'teacher'},{active:false},{authStatus:401}]){
  for(const req of [request(),new Request(`https://academy.invalid/api/user-email?ids=${target}`,{headers:{Authorization:'Bearer user-token'}})]){
   const f=fixture(settings),response=await handleUserEmail(req,{...f,env});assert.equal(response.status,settings.authStatus?401:403);
   assert.ok(f.calls.every(call=>!call.url.includes('/admin/users/')));
  }
 }
});
test('confirmation uses the Auth admin API and returns only the email status',async()=>{
 const f=fixture(),response=await handleUserEmail(request(),{...f,env});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{id:target,email:'student@example.test',email_confirmed_at:timestamp});
 const update=f.calls.find(call=>call.options.method==='PUT');assert.deepEqual(JSON.parse(update.options.body),{email_confirm:true});
 assert.equal(update.options.headers.apikey,'secret-test');assert.equal(f.calls[0].options.headers.apikey,'public-test');assert.equal(f.calls[1].options.headers.Authorization,'Bearer user-token');
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('already confirmed accounts are idempotent',async()=>{
 const f=fixture({confirmed:true});assert.equal((await handleUserEmail(request(),{...f,env})).status,200);assert.ok(f.calls.every(c=>c.options.method!=='PUT'));
});
test('a changed email is not silently confirmed',async()=>{
 const f=fixture({email:'changed@example.test'});assert.equal((await handleUserEmail(request(),{...f,env})).status,409);assert.ok(f.calls.every(c=>c.options.method!=='PUT'));
});
test('invalid IDs and oversized status batches cannot reach the admin API',async()=>{
 for(const req of [request({id:'../../users',email:'x@y.test'}),request({id:target}),new Request('https://academy.invalid/api/user-email?ids='+Array(31).fill(target).join(','),{headers:{Authorization:'Bearer user-token'}})]){
  const f=fixture();assert.equal((await handleUserEmail(req,{...f,env})).status,400);assert.ok(f.calls.every(c=>!c.url.includes('/admin/users/')));
 }
});
test('missing server key and upstream failures do not report success or expose secrets',async()=>{
 const missing=await handleUserEmail(request(),{...fixture(),env:{...env,SUPABASE_SECRET_KEY:''}});assert.equal(missing.status,503);
 const failure=await handleUserEmail(request(),{...fixture({updateStatus:500}),env});assert.equal(failure.status,502);assert.doesNotMatch(await failure.text(),/internal secret details|secret-test/);
});
test('status query is read-only and exposes no identity metadata',async()=>{
 const f=fixture({confirmed:true}),response=await handleUserEmail(new Request(`https://academy.invalid/api/user-email?ids=${target}`,{headers:{Authorization:'Bearer user-token'}}),{...f,env});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{users:[{id:target,email:'student@example.test',email_confirmed_at:timestamp}]});assert.ok(f.calls.every(c=>!c.options.method));
});
test('unsupported methods are rejected',async()=>{assert.equal((await handleUserEmail(new Request('https://academy.invalid/api/user-email',{method:'DELETE'}),{...fixture(),env})).status,405);});
