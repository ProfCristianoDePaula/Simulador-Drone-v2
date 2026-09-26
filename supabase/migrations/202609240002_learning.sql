begin;
alter table public.academy_classes add column archived boolean not null default false;
create table public.academy_missions(id text not null,version integer not null,config jsonb not null,published boolean not null default true,primary key(id,version));
create table public.academy_assignments(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.academy_classes(id),
 mission_id text not null,mission_version integer not null,foreign key(mission_id,mission_version) references public.academy_missions(id,version),
 title text not null check(length(title) between 1 and 150),due_at timestamptz,max_attempts integer not null default 3 check(max_attempts between 1 and 20),
 pass_score integer not null default 70 check(pass_score between 0 and 100),grade_rule text not null default 'best' check(grade_rule in('best','latest')),
 created_at timestamptz not null default now()
);
create table public.academy_attempts(
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.academy_assignments(id),student_id uuid not null references public.academy_profiles(id),
 status text not null default 'flying' check(status in('flying','submitted','abandoned')),started_at timestamptz not null default now(),submitted_at timestamptz,
 payload jsonb,score numeric(5,2) check(score between 0 and 100),breakdown jsonb,passed boolean,critical boolean not null default false,
 review_score numeric(5,2) check(review_score between 0 and 100),feedback text not null default '',
 additional_attempt boolean not null default false
);
create index academy_attempts_assignment_student on public.academy_attempts(assignment_id,student_id);
create table public.academy_evidence(
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.academy_attempts(id),path text not null unique,
 kind text not null check(kind in('photo','video')),created_at timestamptz not null default now()
);
create table public.academy_audit_log(id bigint generated always as identity primary key,actor_id uuid references public.academy_profiles(id),action text not null,target_id uuid,detail jsonb not null default '{}',created_at timestamptz not null default now());

create function academy_private.can_read_attempt(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academy_attempts t join public.academy_assignments a on a.id=t.assignment_id where t.id=aid and (t.student_id=auth.uid() or academy_private.manages(a.class_id)));
$$;
alter table public.academy_missions enable row level security;
alter table public.academy_assignments enable row level security;
alter table public.academy_attempts enable row level security;
alter table public.academy_evidence enable row level security;
alter table public.academy_audit_log enable row level security;
revoke all on public.academy_missions,public.academy_assignments,public.academy_attempts,public.academy_evidence,public.academy_audit_log from anon,authenticated;
grant select on public.academy_missions,public.academy_assignments,public.academy_attempts,public.academy_evidence,public.academy_audit_log to authenticated;
create policy missions_read on public.academy_missions for select to authenticated using(published);
create policy assignments_read on public.academy_assignments for select to authenticated using(academy_private.manages(class_id) or academy_private.member_of(class_id));
create policy attempts_read on public.academy_attempts for select to authenticated using(academy_private.can_read_attempt(id));
create policy evidence_read on public.academy_evidence for select to authenticated using(academy_private.can_read_attempt(attempt_id));
create policy audit_read on public.academy_audit_log for select to authenticated using(academy_private.current_role()='superadmin' or actor_id=auth.uid());

create or replace function public.academy_create_class(class_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if coalesce(academy_private.current_role(),'')<>'teacher' then raise exception 'Apenas professores criam turmas.'; end if;
 insert into public.academy_classes(name,teacher_id) values(trim(class_name),auth.uid()) returning id into cid;
 insert into public.academy_invites(class_id) values(cid);return cid;
end; $$;
create function public.academy_edit_class(cid uuid,new_name text,is_archived boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(academy_private.manages(cid),false) then raise exception 'Sem permissão.';end if;
 update public.academy_classes set name=trim(new_name),archived=is_archived where id=cid;
 if is_archived then update public.academy_invites set enabled=false where class_id=cid;end if;
end; $$;
create function public.academy_assign(cid uuid,mid text,title text,deadline timestamptz,attempt_limit integer,passing integer,rule text) returns uuid language plpgsql security definer set search_path='' as $$
declare aid uuid;ver integer;
begin
 if not coalesce(academy_private.manages(cid),false) or exists(select 1 from public.academy_classes where id=cid and archived) then raise exception 'Turma indisponível.';end if;
 select max(version) into ver from public.academy_missions where id=mid and published;
 if ver is null then raise exception 'Missão indisponível.';end if;
 insert into public.academy_assignments(class_id,mission_id,mission_version,title,due_at,max_attempts,pass_score,grade_rule) values(cid,mid,ver,title,deadline,attempt_limit,passing,rule) returning id into aid;return aid;
end; $$;
create function public.academy_start_attempt(aid uuid) returns public.academy_attempts language plpgsql security definer set search_path='' as $$
declare a public.academy_assignments;t public.academy_attempts;used integer;bonus integer;
begin
 if coalesce(academy_private.current_role(),'')<>'student' then raise exception 'Apenas alunos fazem atividades avaliadas.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||aid::text,0));
 select * into a from public.academy_assignments where id=aid;
 if a.id is null or not coalesce(academy_private.member_of(a.class_id),false) or exists(select 1 from public.academy_classes where id=a.class_id and archived) then raise exception 'Atividade indisponível.';end if;
 if a.due_at is not null and now()>a.due_at then raise exception 'Prazo encerrado.';end if;
 if exists(select 1 from public.academy_attempts where student_id=auth.uid() and assignment_id=aid and status='flying') then raise exception 'Encerre a tentativa anterior antes de iniciar outra.';end if;
 select count(*),count(*) filter(where additional_attempt) into used,bonus from public.academy_attempts where student_id=auth.uid() and assignment_id=aid;
 if used>=a.max_attempts+bonus then raise exception 'Limite de tentativas atingido.';end if;
 insert into public.academy_attempts(assignment_id,student_id) values(aid,auth.uid()) returning * into t;return t;
end; $$;
create function public.academy_abandon_attempt(tid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.academy_attempts set status='abandoned',submitted_at=now() where id=tid and student_id=auth.uid() and status='flying';
 if not found then raise exception 'Tentativa indisponível.';end if;
end; $$;

create function academy_private.goal_matches(g jsonb,e jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb:=e->'s';dx double precision;dz double precision;dy double precision;angle double precision;dist double precision;
begin
 if coalesce((s->>'crashed')::boolean,false) then return false;end if;
 case g->>'kind'
 when 'point' then return (s->>'flying')::boolean and sqrt(power((s->>'x')::float-(g->>'x')::float,2)+power((s->>'z')::float-(g->>'z')::float,2))<(g->>'radius')::float and abs((s->>'h')::float-(g->>'h')::float)<(g->>'tolerance')::float and (s->>'speed')::float<4;
 when 'land' then return not (s->>'flying')::boolean and (s->>'h')::float<0.5 and sqrt(power((s->>'x')::float,2)+power((s->>'z')::float,2))<(g->>'radius')::float;
 when 'mode' then return (s->>'flying')::boolean and s->>'mode'=g->>'value';
 when 'auto' then return (s->>'flying')::boolean and s->>'auto'=g->>'value';
 when 'video' then return (s->>'flying')::boolean and (s->>'recording')::boolean and s->>'mode'=g->>'value';
 when 'calibration' then return not (s->>'flying')::boolean and (s->>'calibrated')::boolean;
 when 'manual' then return (s->>'flying')::boolean and coalesce(s->>'auto','')='' and (s->>'speed')::float>0.3;
 when 'link' then return (s->>'flying')::boolean and s->>'link'='Perdido' and s->>'lossAction'='Pairar' and (s->>'speed')::float<1;
 when 'gps' then return (s->>'flying')::boolean and s->>'gps'='Fraco' and (s->>'h')::float>5 and (s->>'h')::float<40;
 when 'setting' then return (s->>'power')::boolean and case when g ? 'minimum' then (s->>(g->>'key'))::float>=(g->>'minimum')::float else s->(g->>'key')=g->'value' end;
 when 'photo' then
  if e->>'type'<>'photo' or not (s->>'flying')::boolean then return false;end if;
  dx:=(g->>'x')::float-(s->>'x')::float;dz:=(g->>'z')::float-(s->>'z')::float;dy:=(g->>'h')::float-(s->>'h')::float;dist:=sqrt(dx*dx+dz*dz+dy*dy);
  angle:=atan2(dx,-dz)-(s->>'yaw')::float;
  return dist between 5 and coalesce((g->>'radius')::float,65) and abs(atan2(sin(angle),cos(angle)))<0.3/greatest(1,(s->>'zoom')::float) and abs(atan2(dy,sqrt(dx*dx+dz*dz))-(s->>'gimbal')::float*pi()/180)<0.3/greatest(1,(s->>'zoom')::float);
 else return false;end case;
end; $$;

create function public.academy_submit_attempt(tid uuid,submission jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.academy_attempts;a public.academy_assignments;m jsonb;e jsonb;s jsonb;g jsonb;z jsonb;initial jsonb;prior jsonb;
 idx integer:=0;hold float:=0;last_t float:=-1;frame_t float:=0;dt float;clock float;airborne boolean:=false;calc_critical boolean:=false;flight_time float:=0;
 pre numeric:=0;pilot numeric:=0;objectives numeric:=0;post numeric:=0;total numeric;complete jsonb:='[]';details jsonb;calc_passed boolean;
begin
 select * into t from public.academy_attempts where id=tid and student_id=auth.uid() for update;
 if t.id is null then raise exception 'Tentativa indisponível.';end if;
 if t.status='submitted' then return jsonb_build_object('score',t.score,'breakdown',t.breakdown,'passed',t.passed);end if;
 if t.status<>'flying' then raise exception 'Tentativa encerrada.';end if;
 select * into a from public.academy_assignments where id=t.assignment_id;
 if not coalesce(academy_private.member_of(a.class_id),false) then raise exception 'Matrícula não está ativa.';end if;
 if a.due_at is not null and now()>a.due_at then raise exception 'Prazo de entrega encerrado.';end if;
 select config into m from public.academy_missions where id=a.mission_id and version=a.mission_version;
 if jsonb_typeof(submission->'events') is distinct from 'array' then raise exception 'Telemetria inválida ou muito grande.';end if;
 if jsonb_array_length(submission->'events') not between 2 and 8000 or octet_length(submission::text)>8000000 then raise exception 'Telemetria inválida ou muito grande.';end if;
 initial:=submission->'initial';
 for e in select value from jsonb_array_elements(submission->'events') loop
  s:=e->'s';clock:=(e->>'t')::float;
  if clock is null or clock<last_t or clock<0 or clock>(m->>'maxDuration')::float+5 or clock>extract(epoch from now()-t.started_at)+10 then raise exception 'Cronologia inválida.';end if;
  if coalesce(e->>'type','') not in('frame','photo','video') or jsonb_typeof(s) is distinct from 'object' then raise exception 'Evento inválido.';end if;
  if exists(select 1 from unnest(array['x','z','h','speed']) as required(key) where jsonb_typeof(s->key) is distinct from 'number') or jsonb_typeof(s->'flying') is distinct from 'boolean' or jsonb_typeof(s->'crashed') is distinct from 'boolean' then raise exception 'Estado físico incompleto.';end if;
  if (s->>'x')::float not between -500 and 500 or (s->>'z')::float not between -500 and 500 or (s->>'h')::float not between 0 and 210 or (s->>'speed')::float not between 0 and 30 then raise exception 'Estado físico inválido.';end if;
  dt:=0;
  if e->>'type'='frame' then
   dt:=clock-frame_t;if dt>2 then raise exception 'Amostras de voo incompletas.';end if;
   if prior is not null and (sqrt(power((s->>'x')::float-(prior->>'x')::float,2)+power((s->>'z')::float-(prior->>'z')::float,2))>dt*25+2 or abs((s->>'h')::float-(prior->>'h')::float)>dt*6+1) then raise exception 'Deslocamento inconsistente.';end if;
   prior:=s;frame_t:=clock;
  end if;
  last_t:=clock;airborne:=airborne or (s->>'flying')::boolean;if (s->>'flying')::boolean then flight_time:=flight_time+dt;end if;
  calc_critical:=calc_critical or coalesce((s->>'crashed')::boolean,false);
  for z in select value from jsonb_array_elements(m->'zones') loop
   calc_critical:=calc_critical or ((s->>'flying')::boolean and sqrt(power((s->>'x')::float-(z->>'x')::float,2)+power((s->>'z')::float-(z->>'z')::float,2))<(z->>'radius')::float);
  end loop;
  if e->>'type' in('photo','video') and not exists(select 1 from public.academy_evidence where id=(e->>'evidence_id')::uuid and attempt_id=tid and kind=e->>'type') then raise exception 'Evidência não enviada.';end if;
  g:=m->'goals'->idx;
  if g is not null then
   if academy_private.goal_matches(g,e) and (g->>'kind'<>'land' or airborne) then
    hold:=hold+least(dt,1);if (g->>'seconds')::float=0 or hold>=(g->>'seconds')::float then complete:=complete||jsonb_build_array(jsonb_build_object('index',idx,'t',clock));idx:=idx+1;hold:=0;end if;
   elsif e->>'type'='frame' and g->>'kind'<>'photo' then hold:=0;end if;
  end if;
 end loop;
 if not airborne or flight_time<5 then raise exception 'Realize o voo antes de entregar.';end if;
 if exists(select 1 from jsonb_array_elements(m->'goals') with ordinality as goal(value,n) where value->>'kind'='video' and n<=idx) and not exists(select 1 from public.academy_evidence where attempt_id=tid and kind='video') then raise exception 'Envie o clipe de vídeo da tomada avaliada.';end if;
 if (s->>'flying')::boolean then raise exception 'Pouse antes de entregar.';end if;
 if submission->'pre'='[true,true,true,true,true,true]'::jsonb and (submission->>'quiz')::integer=(m->'quiz'->>'answer')::integer and (initial->>'battery')::float>=50 and initial->>'gps'='Bom' and (initial->>'homeValid')::boolean and (initial->>'rthH')::float<=(initial->>'maxH')::float then pre:=20;end if;
 if not calc_critical then pilot:=20;if sqrt(power((s->>'x')::float,2)+power((s->>'z')::float,2))<12 then pilot:=30;end if;end if;
 objectives:=round((35.0*idx/jsonb_array_length(m->'goals'))::numeric,2);
 if submission->'post'='[true,true,true,true,true,true]'::jsonb then post:=10;end if;
 if length(trim(submission->>'report')) between 60 and 4000 then post:=post+5;end if;
 total:=pre+pilot+objectives+post;calc_passed:=total>=a.pass_score and not calc_critical;
 details:=jsonb_build_object('preFlight',pre,'piloting',pilot,'objectives',objectives,'postFlight',post,'completed',complete,'critical',calc_critical,'flightSeconds',flight_time,'total',total);
 update public.academy_attempts set status='submitted',submitted_at=now(),payload=submission,score=total,breakdown=details,passed=calc_passed,critical=calc_critical where id=tid;
 return jsonb_build_object('score',total,'breakdown',details,'passed',calc_passed);
end; $$;

create function public.academy_review_attempt(tid uuid,new_score numeric,comment text,allow_retry boolean) returns void language plpgsql security definer set search_path='' as $$
declare t public.academy_attempts;cid uuid;passing integer;
begin
 select * into t from public.academy_attempts where id=tid for update;
 select class_id,pass_score into cid,passing from public.academy_assignments where id=t.assignment_id;
 if not coalesce(academy_private.manages(cid),false) or t.id is null then raise exception 'Sem permissão.';end if;
 if length(trim(comment)) not between 5 and 2000 then raise exception 'Informe uma justificativa de 5 a 2000 caracteres.';end if;
 if new_score is not null and (new_score<0 or new_score>100 or t.status<>'submitted') then raise exception 'Nota inválida.';end if;
 update public.academy_attempts set review_score=new_score,feedback=comment,additional_attempt=allow_retry,passed=case when new_score is null then score>=passing and not critical else new_score>=passing and not critical end where id=tid;
 insert into public.academy_audit_log(actor_id,action,target_id,detail) values(auth.uid(),'review_attempt',tid,jsonb_build_object('before',t.review_score,'after',new_score,'reason',comment,'retry',allow_retry));
end; $$;

create function public.academy_register_evidence(tid uuid,file_path text,file_kind text) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if coalesce(academy_private.current_role(),'')<>'student' or not exists(select 1 from public.academy_attempts where id=tid and student_id=auth.uid() and status='flying') then raise exception 'Tentativa indisponível.';end if;
 if split_part(file_path,'/',1)<>auth.uid()::text or split_part(file_path,'/',2)<>tid::text then raise exception 'Caminho inválido.';end if;
 if not exists(select 1 from storage.objects where bucket_id='academy-evidence' and name=file_path) then raise exception 'Arquivo não enviado.';end if;
 insert into public.academy_evidence(attempt_id,path,kind) values(tid,file_path,file_kind) on conflict(path) do update set path=excluded.path returning id into eid;return eid;
end; $$;

create or replace function public.academy_update_invite(cid uuid,rotate_code boolean,allow_join boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(academy_private.manages(cid),false) then raise exception 'Sem permissão.';end if;
 if allow_join and exists(select 1 from public.academy_classes where id=cid and archived) then raise exception 'Turma arquivada.';end if;
 update public.academy_invites set enabled=coalesce(allow_join,enabled),code=case when rotate_code then upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) else code end where class_id=cid;
end; $$;

revoke all on function academy_private.can_read_attempt(uuid),academy_private.goal_matches(jsonb,jsonb) from public,anon,authenticated;
grant execute on function academy_private.can_read_attempt(uuid) to authenticated;
revoke all on function public.academy_edit_class(uuid,text,boolean),public.academy_assign(uuid,text,text,timestamptz,integer,integer,text),public.academy_start_attempt(uuid),public.academy_abandon_attempt(uuid),public.academy_submit_attempt(uuid,jsonb),public.academy_review_attempt(uuid,numeric,text,boolean),public.academy_register_evidence(uuid,text,text) from public,anon,authenticated;
grant execute on function public.academy_edit_class(uuid,text,boolean),public.academy_assign(uuid,text,text,timestamptz,integer,integer,text),public.academy_start_attempt(uuid),public.academy_abandon_attempt(uuid),public.academy_submit_attempt(uuid,jsonb),public.academy_review_attempt(uuid,numeric,text,boolean),public.academy_register_evidence(uuid,text,text) to authenticated;
commit;
