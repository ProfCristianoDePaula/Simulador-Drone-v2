begin;
alter table public.academy_profiles add column active boolean not null default true;
create or replace function academy_private.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.academy_profiles where id=auth.uid() and active; $$;
create or replace function academy_private.manages(cid uuid) returns boolean language sql stable security definer set search_path='' as $$ select academy_private.current_role()='teacher' and exists(select 1 from public.academy_classes where id=cid and teacher_id=auth.uid()); $$;
create or replace function academy_private.member_of(cid uuid) returns boolean language sql stable security definer set search_path='' as $$ select academy_private.current_role()='student' and exists(select 1 from public.academy_memberships where class_id=cid and student_id=auth.uid()); $$;
create or replace function academy_private.can_read_attempt(aid uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.academy_attempts t join public.academy_assignments a on a.id=t.assignment_id where t.id=aid and ((t.student_id=auth.uid() and academy_private.current_role()='student') or academy_private.manages(a.class_id))); $$;
create function public.academy_manage_user(uid uuid,new_role text,is_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare p public.academy_profiles;
begin
 perform pg_advisory_xact_lock(72624001);
 if coalesce(academy_private.current_role(),'')<>'superadmin' then raise exception 'Acesso restrito ao administrador.';end if;
 select * into p from public.academy_profiles where id=uid for update;
 if p.id is null or new_role is null or new_role not in('student','teacher','superadmin') or is_active is null then raise exception 'Usuário ou perfil inválido.';end if;
 if new_role<>'student' and not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Confirme o e-mail antes da promoção.';end if;
 if p.role='superadmin' and p.active and (new_role<>'superadmin' or not is_active) and (select count(*) from public.academy_profiles where role='superadmin' and active)<=1 then raise exception 'Não é possível desativar o último administrador.';end if;
 if new_role<>'teacher' and p.role='teacher' and exists(select 1 from public.academy_classes where teacher_id=uid and not archived) then raise exception 'O professor deve arquivar suas turmas antes de mudar de perfil.';end if;
 update public.academy_profiles set role=new_role,active=is_active where id=uid;
 insert into public.academy_audit_log(actor_id,action,target_id,detail) values(auth.uid(),'manage_user',uid,jsonb_build_object('old_role',p.role,'role',new_role,'old_active',p.active,'active',is_active));
end; $$;
-- A função antiga passa pelo mesmo controle; não deixa uma via alternativa para rebaixar perfis.
create or replace function public.academy_set_role(uid uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$ begin perform public.academy_manage_user(uid,new_role,true);end; $$;
revoke all on function public.academy_manage_user(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.academy_manage_user(uuid,text,boolean) to authenticated;
commit;
