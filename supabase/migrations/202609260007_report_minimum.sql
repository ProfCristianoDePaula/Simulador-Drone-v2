begin;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.academy_submit_attempt(uuid,jsonb)'::regprocedure) into definition;
 if position('between 60 and 4000' in definition)=0 then raise exception 'Critério anterior de relatório não encontrado.'; end if;
 execute replace(definition,'between 60 and 4000','between 5 and 4000');
end;
$migration$;
commit;
