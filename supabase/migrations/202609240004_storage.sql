begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('academy-evidence','academy-evidence',false,10485760,array['image/png','video/webm','video/mp4']) on conflict(id) do nothing;
create policy academy_upload_evidence on storage.objects for insert to authenticated with check(bucket_id='academy-evidence' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.academy_attempts t where t.id::text=(storage.foldername(name))[2] and t.student_id=auth.uid() and t.status='flying'));
create policy academy_read_evidence on storage.objects for select to authenticated using(bucket_id='academy-evidence' and exists(select 1 from public.academy_evidence e where e.path=name and academy_private.can_read_attempt(e.attempt_id)));
commit;
