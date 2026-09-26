import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {courseMissions} from '../src/training/catalog.js';
import {createEvaluator,targetVisible,matchesGoal} from '../src/training/evaluator.js';
import {csvCell} from '../src/ui/dom.js';
const ids=['00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000014'];
const base={x:0,z:0,h:12,speed:0,yaw:0,gimbal:0,zoom:1,battery:100,mode:'Normal',gps:'Bom',link:'Bom',homeValid:true,rthH:50,maxH:100,maxD:400,flying:true,crashed:false,auto:'',recording:false};
function eventsFor(m){let t=0;const events=[];for(const g of m.goals){let s={...base};if(g.kind==='point'){s.x=g.x;s.z=g.z;s.h=g.h;}if(g.kind==='land'){s.x=0;s.z=0;s.h=0;s.flying=false;}const prev=events.at(-1)?.s;if(prev){const distance=Math.hypot(s.x-prev.x,s.z-prev.z,s.h-prev.h);const n=Math.ceil(distance/1.5);for(let i=1;i<=n;i++){t+=.5;events.push({type:'frame',t,s:{...s,x:prev.x+(s.x-prev.x)*i/n,z:prev.z+(s.z-prev.z)*i/n,h:prev.h+(s.h-prev.h)*i/n,flying:i===n?s.flying:true,speed:3}});}}
 for(let j=0;j<Math.ceil((g.seconds+1)*2);j++){t+=.5;events.push({type:'frame',t,s:{...s}});}}return events;}
test('avaliação exige enquadramento, sequência e permanência',()=>{
 const m=courseMissions[0],e=createEvaluator(m);e.feed({type:'frame',t:0,s:base});e.feed({type:'frame',t:.5,s:{...base,x:25,z:-45}});assert.equal(e.progress.index,0);
 for(const event of eventsFor(m))e.feed(event);assert.equal(e.progress.index,m.goals.length);
 assert.equal(targetVisible({x:0,z:-20,h:12,radius:65},base),true);assert.equal(targetVisible({x:0,z:20,h:12,radius:65},base),false);
 assert.match(csvCell('=HYPERLINK("x")'),/^"'/);
});
test('todas as missões têm objetivos executáveis e rubrica de cem pontos',()=>{assert.equal(courseMissions.length,12);for(const m of courseMissions){assert.ok(m.goals.length>=4);assert.equal(m.goals.at(-1).kind,'land');assert.equal(m.maxScore,100);}});
test('banco avalia a tentativa, controla autoria e isola administração',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);for(const name of (await fs.readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await fs.readFile(new URL(name,dir),'utf8'));
  // Every catalog goal must be reachable and agree with the authoritative SQL predicate.
  for(const mission of courseMissions)for(const goal of mission.goals){
   const state={...base,power:true},event={type:'frame',t:1,s:state};
   switch(goal.kind){
    case 'point':Object.assign(state,{x:goal.x,z:goal.z,h:goal.h});break;
    case 'land':Object.assign(state,{flying:false,h:0});break;
    case 'mode':state.mode=goal.value;break;
    case 'auto':state.auto=goal.value;break;
    case 'photo':Object.assign(state,{x:goal.x,z:goal.z+20,h:goal.h});event.type='photo';break;
    case 'video':Object.assign(state,{mode:goal.value,recording:true});break;
    case 'calibration':Object.assign(state,{flying:false,calibrated:true});break;
    case 'manual':state.speed=1;break;
    case 'link':Object.assign(state,{link:'Perdido',lossAction:'Pairar'});break;
    case 'gps':state.gps='Fraco';break;
    case 'setting':state[goal.key]=goal.minimum??goal.value;break;
   }
   assert.equal(matchesGoal(goal,event),true,`${mission.id}: ${goal.label}`);
   assert.equal((await db.query('select academy_private.goal_matches($1,$2) as matches',[goal,event])).rows[0].matches,true,`${mission.id}: SQL ${goal.label}`);
   state.crashed=true;
   assert.equal(matchesGoal(goal,event),false);
   assert.equal((await db.query('select academy_private.goal_matches($1,$2) as matches',[goal,event])).rows[0].matches,false);
  }
  for(const [i,id] of ids.entries())await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`test${i}@example.test`]);
  await db.query("update public.academy_profiles set role='superadmin' where id=$1",[ids[0]]);
  const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  await as(ids[0]);await db.query("select public.academy_manage_user($1,'teacher',true)",[ids[1]]);
  await assert.rejects(db.query("select public.academy_create_class('Turma admin')"),/professores/);
  await as(ids[1]);const cid=(await db.query("select public.academy_create_class('Turma') as id")).rows[0].id;await db.query('select public.academy_add_student($1,$2)',[cid,'test2@example.test']);
  const aid=(await db.query("select public.academy_assign($1,'primeiro-voo','Atividade',null,1,70,'best') as id",[cid])).rows[0].id;
  await as(ids[2]);const attempt=(await db.query('select row_to_json(public.academy_start_attempt($1)) as attempt',[aid])).rows[0].attempt;
  await assert.rejects(db.query('select public.academy_start_attempt($1)',[aid]),/anterior/);
  await as(ids[3]);assert.equal((await db.query('select * from public.academy_attempts')).rows.length,0);await assert.rejects(db.query('select public.academy_start_attempt($1)',[aid]),/indisponível/);
  await db.exec('reset role');await db.query("update public.academy_attempts set started_at=now()-interval '10 minutes' where id=$1",[attempt.id]);
  await as(ids[2]);const payload={initial:base,events:eventsFor(courseMissions[0]),pre:Array(6).fill(true),post:Array(6).fill(true),quiz:1,report:'Teste'};
  await assert.rejects(db.query('select public.academy_submit_attempt($1,$2)',[attempt.id,{events:null}]),/Telemetria/);
  const incomplete=structuredClone(payload);delete incomplete.events[0].s.flying;
  await assert.rejects(db.query('select public.academy_submit_attempt($1,$2)',[attempt.id,incomplete]),/incompleto/);
  const result=(await db.query('select public.academy_submit_attempt($1,$2) as result',[attempt.id,payload])).rows[0].result;
  assert.equal(Number(result.score),100);assert.equal(result.passed,true);assert.equal(result.breakdown.completed.length,4);
  const repeat=(await db.query('select public.academy_submit_attempt($1,$2) as result',[attempt.id,{score:999}])).rows[0].result;assert.equal(Number(repeat.score),100);
  await assert.rejects(db.query('update public.academy_attempts set score=100'),/permission denied/);
  await assert.rejects(db.query('select public.academy_review_attempt($1,100,$2,true)',[attempt.id,'Alteração indevida']),/Sem permissão/);
  await assert.rejects(db.query('select public.academy_start_attempt($1)',[aid]),/Limite/);
  await as(ids[1]);await db.query('select public.academy_review_attempt($1,90,$2,true)',[attempt.id,'Revisão do professor']);
  await as(ids[2]);const retry=(await db.query('select row_to_json(public.academy_start_attempt($1)) as attempt',[aid])).rows[0].attempt;assert.ok(retry.id);
  await as(ids[0]);assert.equal((await db.query('select * from public.academy_classes')).rows.length,0);await db.query("select public.academy_manage_user($1,'student',false)",[ids[2]]);
  await as(ids[2]);assert.equal((await db.query('select * from public.academy_attempts')).rows.length,0);await assert.rejects(db.query('select public.academy_submit_attempt($1,$2)',[retry.id,payload]),/Matrícula/);
 }finally{await db.close();}
});
