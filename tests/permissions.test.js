import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('migração, RLS e operações de turmas respeitam os perfis',async()=>{
  const db=new PGlite();
  const admin='00000000-0000-4000-8000-000000000001';
  const teacher='00000000-0000-4000-8000-000000000002';
  const otherTeacher='00000000-0000-4000-8000-000000000003';
  const student='00000000-0000-4000-8000-000000000004';
  const outsider='00000000-0000-4000-8000-000000000005';
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(await fs.readFile(new URL('../supabase/migrations/202609240001_academy.sql',import.meta.url),'utf8'));
    for(const [id,email] of [[admin,'dev.cristianodepaula@gmail.com'],[teacher,'professor@example.test'],[otherTeacher,'outro@example.test'],[student,'aluno@example.test'],[outsider,'externo@example.test']]){
      await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),' {"role":"superadmin"}')`,[id,email]);
    }
    assert.ok((await db.query('select role from public.academy_profiles')).rows.every(p=>p.role==='student'),'metadados de cadastro não promovem usuários');
    await db.exec(await fs.readFile(new URL('../supabase/bootstrap-superadmin.sql',import.meta.url),'utf8'));
    const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
    await as(admin);
    await db.query("select public.academy_set_role($1,'teacher')",[teacher]);
    await db.query("select public.academy_set_role($1,'teacher')",[otherTeacher]);
    await assert.rejects(db.query("select public.academy_set_role($1,'student')",[admin]),/último superadmin/);
    await as(teacher);
    const cid=(await db.query("select public.academy_create_class('Turma de teste') as id")).rows[0].id;
    const code=(await db.query('select code from public.academy_invites')).rows[0].code;
    assert.equal(code.length,12);
    await as(student);
    assert.equal((await db.query('select * from public.academy_classes')).rows.length,0);
    assert.equal((await db.query('select * from public.academy_invites')).rows.length,0);
    await assert.rejects(db.query("update public.academy_profiles set role='superadmin' where id=$1",[student]),/permission denied/);
    await assert.rejects(db.query("select public.academy_set_role($1,'superadmin')",[student]),/restrito/);
    await assert.rejects(db.query("select public.academy_create_class('Indevida')"),/restrito/);
    await assert.rejects(db.query('insert into public.academy_memberships(class_id,student_id) values($1,$2)',[cid,student]),/permission denied/);
    assert.equal((await db.query('select public.academy_join_class($1) as result',[code.toLowerCase()])).rows[0].result.ok,true);
    assert.equal((await db.query('select * from public.academy_classes')).rows.length,1);
    assert.equal((await db.query('select * from public.academy_invites')).rows.length,0);
    await as(otherTeacher);
    assert.equal((await db.query('select * from public.academy_classes')).rows.length,0);
    await assert.rejects(db.query('select public.academy_add_student($1,$2)',[cid,'externo@example.test']),/Sem permissão/);
    await assert.rejects(db.query('select public.academy_update_invite($1,true,true)',[cid]),/Sem permissão/);
    await assert.rejects(db.query('select public.academy_remove_student($1,$2)',[cid,student]),/Sem permissão/);
    await as(teacher);
    await db.query('select public.academy_add_student($1,$2)',[cid,'externo@example.test']);
    assert.equal((await db.query('select * from public.academy_memberships')).rows.length,2);
    assert.equal((await db.query('select * from public.academy_profiles')).rows.length,3);
    await db.query('select public.academy_remove_student($1,$2)',[cid,outsider]);
    await db.query('select public.academy_update_invite($1,true,false)',[cid]);
    const newCode=(await db.query('select code from public.academy_invites')).rows[0].code;
    assert.notEqual(newCode,code);
    await as(outsider);
    assert.equal((await db.query('select public.academy_join_class($1) as result',[newCode])).rows[0].result.ok,false);
    assert.match((await db.query('select public.academy_join_class($1) as result',[newCode])).rows[0].result.message,/cinco segundos/);
    await db.exec('reset role');
    await db.query("update academy_private.join_attempts set attempted_at=now()-interval '10 seconds' where user_id=$1",[outsider]);
    await as(teacher);await db.query('select public.academy_update_invite($1,false,true)',[cid]);
    await as(outsider);assert.equal((await db.query('select public.academy_join_class($1) as result',[code])).rows[0].result.ok,false);
    await as(admin);assert.equal((await db.query('select * from public.academy_classes')).rows.length,1);
    await db.exec('reset role;set role anon');
    await assert.rejects(db.query('select * from public.academy_profiles'),/permission denied/);
    await assert.rejects(db.query('select public.academy_join_class($1)',[newCode]),/permission denied/);
  }finally{await db.close();}
});
