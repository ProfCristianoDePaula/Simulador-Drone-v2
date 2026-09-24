-- Execute uma vez no SQL Editor do projeto Supabase. Todas as alterações são atômicas.
begin;
create schema if not exists academy_private;
revoke all on schema academy_private from public, anon, authenticated;
grant usage on schema academy_private to authenticated;

create table public.academy_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'student' check(role in ('student','teacher','superadmin')),
  created_at timestamptz not null default now()
);
create table public.academy_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 100),
  teacher_id uuid not null references public.academy_profiles(id),
  created_at timestamptz not null default now()
);
create table public.academy_memberships (
  class_id uuid references public.academy_classes(id) on delete cascade,
  student_id uuid references public.academy_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(class_id,student_id)
);
create index academy_memberships_student on public.academy_memberships(student_id);
create index academy_classes_teacher on public.academy_classes(teacher_id);
create index academy_profiles_email on public.academy_profiles(lower(email));
create table public.academy_invites (
  class_id uuid primary key references public.academy_classes(id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  enabled boolean not null default true
);
create table academy_private.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index academy_join_attempts_user on academy_private.join_attempts(user_id,attempted_at);

create function academy_private.sync_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.academy_profiles(id,email,full_name)
  values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),120))
  on conflict(id) do update set email=excluded.email;
  return new;
end; $$;
create trigger academy_user_profile after insert or update of email on auth.users for each row execute function academy_private.sync_profile();
insert into public.academy_profiles(id,email,full_name)
select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name',''),120) from auth.users;

create function academy_private.current_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.academy_profiles where id=auth.uid();
$$;
create function academy_private.manages(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select academy_private.current_role()='superadmin' or exists(select 1 from public.academy_classes where id=cid and teacher_id=auth.uid() and academy_private.current_role()='teacher');
$$;
create function academy_private.member_of(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.academy_memberships where class_id=cid and student_id=auth.uid());
$$;
create function academy_private.teaches(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.academy_memberships m where m.student_id=uid and academy_private.manages(m.class_id));
$$;
alter table public.academy_profiles enable row level security;
alter table public.academy_classes enable row level security;
alter table public.academy_memberships enable row level security;
alter table public.academy_invites enable row level security;
alter table academy_private.join_attempts enable row level security;
revoke all on public.academy_profiles,public.academy_classes,public.academy_memberships,public.academy_invites from anon,authenticated;
grant select on public.academy_profiles,public.academy_classes,public.academy_memberships,public.academy_invites to authenticated;
create policy academy_profile_read on public.academy_profiles for select to authenticated using(id=auth.uid() or academy_private.current_role()='superadmin' or academy_private.teaches(id));
create policy academy_class_read on public.academy_classes for select to authenticated using(academy_private.manages(id) or academy_private.member_of(id));
create policy academy_membership_read on public.academy_memberships for select to authenticated using(student_id=auth.uid() or academy_private.manages(class_id));
create policy academy_invite_read on public.academy_invites for select to authenticated using(academy_private.manages(class_id));

create function public.academy_create_class(class_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
  if coalesce(academy_private.current_role(),'') not in ('teacher','superadmin') then raise exception 'Acesso restrito a professores.'; end if;
  if class_name is null or length(trim(class_name)) not between 1 and 100 then raise exception 'Nome de turma inválido.'; end if;
  insert into public.academy_classes(name,teacher_id) values(trim(class_name),auth.uid()) returning id into cid;
  insert into public.academy_invites(class_id) values(cid);
  return cid;
end; $$;

create function public.academy_join_class(invite_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; uid uuid:=auth.uid();
begin
  if uid is null or coalesce(academy_private.current_role(),'')<>'student' then raise exception 'Apenas alunos podem entrar por código.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  delete from academy_private.join_attempts where user_id=uid and attempted_at<now()-interval '1 hour';
  if (select count(*) from academy_private.join_attempts where user_id=uid)>=20 then return jsonb_build_object('ok',false,'message','Limite de tentativas. Aguarde uma hora.'); end if;
  if exists(select 1 from academy_private.join_attempts where user_id=uid and attempted_at>now()-interval '5 seconds') then return jsonb_build_object('ok',false,'message','Aguarde cinco segundos para tentar novamente.'); end if;
  insert into academy_private.join_attempts(user_id) values(uid);
  select class_id into cid from public.academy_invites where code=upper(trim(invite_code)) and enabled;
  if cid is null then return jsonb_build_object('ok',false,'message','Código inválido ou entrada desativada.'); end if;
  insert into public.academy_memberships(class_id,student_id) values(cid,uid) on conflict do nothing;
  return jsonb_build_object('ok',true,'class_id',cid);
end; $$;

create function public.academy_add_student(cid uuid,student_email text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
  if not coalesce(academy_private.manages(cid),false) then raise exception 'Sem permissão para esta turma.'; end if;
  select p.id into uid from public.academy_profiles p join auth.users u on u.id=p.id where lower(p.email)=lower(trim(student_email)) and p.role='student' and u.email_confirmed_at is not null;
  if uid is null then raise exception 'Aluno não encontrado ou e-mail ainda não confirmado.'; end if;
  insert into public.academy_memberships(class_id,student_id) values(cid,uid) on conflict do nothing;
end; $$;
create function public.academy_remove_student(cid uuid,uid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(academy_private.manages(cid),false) then raise exception 'Sem permissão para esta turma.'; end if;
  delete from public.academy_memberships where class_id=cid and student_id=uid;
end; $$;
create function public.academy_update_invite(cid uuid,rotate_code boolean,allow_join boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(academy_private.manages(cid),false) then raise exception 'Sem permissão para esta turma.'; end if;
  update public.academy_invites set enabled=coalesce(allow_join,enabled),code=case when rotate_code then upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) else code end where class_id=cid;
end; $$;
create function public.academy_set_role(uid uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(72624001);
  if coalesce(academy_private.current_role(),'')<>'superadmin' then raise exception 'Acesso restrito ao superadmin.'; end if;
  if new_role is null or new_role not in ('student','teacher','superadmin') then raise exception 'Perfil inválido.'; end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Usuário deve confirmar o e-mail primeiro.'; end if;
  if new_role<>'superadmin' and exists(select 1 from public.academy_profiles where id=uid and role='superadmin') and (select count(*) from public.academy_profiles where role='superadmin')<=1 then raise exception 'Não é possível remover o último superadmin.'; end if;
  if new_role='student' and exists(select 1 from public.academy_classes where teacher_id=uid) then raise exception 'Este usuário ainda é responsável por turmas.'; end if;
  update public.academy_profiles set role=new_role where id=uid;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end; $$;

revoke all on function academy_private.sync_profile(),academy_private.current_role(),academy_private.manages(uuid),academy_private.member_of(uuid),academy_private.teaches(uuid) from public,anon,authenticated;
grant execute on function academy_private.current_role(),academy_private.manages(uuid),academy_private.member_of(uuid),academy_private.teaches(uuid) to authenticated;
revoke all on function public.academy_create_class(text),public.academy_join_class(text),public.academy_add_student(uuid,text),public.academy_remove_student(uuid,uuid),public.academy_update_invite(uuid,boolean,boolean),public.academy_set_role(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_create_class(text),public.academy_join_class(text),public.academy_add_student(uuid,text),public.academy_remove_student(uuid,uuid),public.academy_update_invite(uuid,boolean,boolean),public.academy_set_role(uuid,text) to authenticated;
commit;
