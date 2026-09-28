begin;
create function public.academy_edit_user(uid uuid,new_name text,new_role text,is_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare old_name text;
begin
 if coalesce(academy_private.current_role(),'')<>'superadmin' then raise exception 'Acesso restrito ao administrador.';end if;
 if new_name is null or length(trim(new_name)) not between 1 and 120 then raise exception 'O nome deve ter de 1 a 120 caracteres.';end if;
 perform pg_advisory_xact_lock(72624001);
 select full_name into old_name from public.academy_profiles where id=uid for update;
 perform public.academy_manage_user(uid,new_role,is_active);
 update public.academy_profiles set full_name=trim(new_name) where id=uid;
 insert into public.academy_audit_log(actor_id,action,target_id,detail) values(auth.uid(),'edit_user_name',uid,jsonb_build_object('old_name',old_name,'name',trim(new_name)));
end; $$;
revoke all on function public.academy_edit_user(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.academy_edit_user(uuid,text,text,boolean) to authenticated;
commit;
