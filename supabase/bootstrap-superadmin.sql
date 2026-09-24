-- Execute no SQL Editor APÓS cadastrar e confirmar este e-mail.
-- Não é uma função pública, nem uma promoção automática por metadados de cadastro.
do $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email)='dev.cristianodepaula@gmail.com' and email_confirmed_at is not null;
  if uid is null then raise exception 'Cadastre e confirme dev.cristianodepaula@gmail.com antes de executar.'; end if;
  update public.academy_profiles set role='superadmin' where id=uid;
  if not found then raise exception 'Aplique primeiro a migração academy.'; end if;
end $$;
