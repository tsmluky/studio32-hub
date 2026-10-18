-- Additive: private assistant queue and full web reports. No outreach/booking changes.
begin;
alter table public.ops_report_documents drop constraint if exists ops_report_documents_report_type_check;
alter table public.ops_report_documents add constraint ops_report_documents_report_type_check check(report_type in ('diagnostico','completo'));

create or replace function public.ops_request_report(p_owner uuid,p_business text,p_type text,p_key uuid,p_lookup uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c jsonb; j uuid;
begin
 if not exists(select 1 from public.workspace_members where user_id=p_owner and workspace_id='studio32') then raise exception 'Acceso no permitido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_owner::text));
 select id into j from public.ops_report_jobs where owner_id=p_owner and request_key=p_key;
 if found then return j; end if;
 if p_type is null or p_type not in ('diagnostico','completo') then raise exception 'Tipo de informe inválido'; end if;
 if p_lookup is not null then
  select value into c from public.ops_report_jobs j,lateral jsonb_array_elements(j.result->'candidates') where j.id=p_lookup and j.owner_id=p_owner and j.status='succeeded' and j.kind='lookup' and value->>'id'=p_business limit 1;
 else
  select business into c from public.ops_report_documents where workspace_id='studio32' and business_key=p_business order by generated_at desc limit 1;
 end if;
 if c is null or coalesce(c->>'web','')='' then raise exception 'Busca y confirma la web del restaurante antes de continuar'; end if;
 if (select count(*) from public.ops_report_jobs where owner_id=p_owner and status in ('queued','running'))>=5 then raise exception 'Ya tienes cinco encargos pendientes'; end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload) values('studio32',p_owner,p_key,'report',jsonb_build_object('candidate',c,'report_type',p_type)) returning id into j;
 return j;
end $$;
create or replace function public.ops_enqueue_report_kind(p_business text,p_type text,p_request_key uuid,p_lookup_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_workspace_member('studio32') then raise exception 'Acceso no permitido'; end if;
 return public.ops_request_report(auth.uid(),p_business,p_type,p_request_key,p_lookup_id);
end $$;

create table public.ops_assistant_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id text not null default 'studio32' references public.workspaces(id),
 owner_id uuid not null references auth.users(id), request_key uuid not null,
 operation text not null check(operation in ('messages','proposals','confirm','discard','complete-visit','transcribe')),
 thread text not null default 'general' check(length(thread) between 1 and 160),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=20000),
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
 result jsonb, error text, lease_token uuid, lease_until timestamptz, attempts int not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,request_key)
);
create index ops_assistant_claim on public.ops_assistant_jobs(status,created_at);
create table public.ops_assistant_threads (
 owner_id uuid not null references auth.users(id), workspace_id text not null default 'studio32' references public.workspaces(id),
 thread text not null, payload jsonb not null check(octet_length(payload::text)<1000000), updated_at timestamptz not null default now(), primary key(owner_id,thread)
);
create table public.ops_assistant_workers (
 id text primary key, workspace_id text not null default 'studio32' references public.workspaces(id),
 last_seen timestamptz not null default now(), status text not null, model_ready boolean not null default false, voice_ready boolean not null default false
);
alter table public.ops_assistant_jobs enable row level security;
alter table public.ops_assistant_threads enable row level security;
alter table public.ops_assistant_workers enable row level security;
revoke all on public.ops_assistant_jobs,public.ops_assistant_threads,public.ops_assistant_workers from anon,authenticated;
grant select on public.ops_assistant_jobs,public.ops_assistant_threads,public.ops_assistant_workers to authenticated;
grant all on public.ops_assistant_jobs,public.ops_assistant_threads,public.ops_assistant_workers to service_role;
create policy assistant_jobs_own on public.ops_assistant_jobs for select to authenticated using(owner_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy assistant_threads_own on public.ops_assistant_threads for select to authenticated using(owner_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy assistant_workers_members on public.ops_assistant_workers for select to authenticated using(public.is_workspace_member(workspace_id));

create or replace function public.ops_enqueue_assistant(p_operation text,p_body jsonb,p_thread text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare j uuid;
begin
 if auth.uid() is null or not public.is_workspace_member('studio32') then raise exception 'Acceso no permitido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text));
 select id into j from public.ops_assistant_jobs where owner_id=auth.uid() and request_key=p_request_key;
 if found then return j; end if;
 if p_operation is null or p_operation not in ('messages','proposals','confirm','discard','complete-visit','transcribe') or p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>20000 or p_thread is null or length(p_thread) not between 1 and 160 then raise exception 'Petición inválida'; end if;
 if p_operation='messages' and (p_body->>'text' is null or length(trim(p_body->>'text')) not between 1 and 4000) then raise exception 'Escribe un mensaje de hasta 4.000 caracteres'; end if;
 if p_operation='transcribe' and (p_body->>'path' is null or p_body->>'path' <> auth.uid()::text || '/' || p_request_key::text) then raise exception 'Audio no válido'; end if;
 if (select count(*) from public.ops_assistant_jobs where owner_id=auth.uid() and status in ('queued','running'))>=5 then raise exception 'Espera a que termine uno de tus cinco encargos'; end if;
 insert into public.ops_assistant_jobs(owner_id,request_key,operation,thread,body) values(auth.uid(),p_request_key,p_operation,p_thread,p_body) returning id into j;
 return j;
end $$;
create or replace function public.ops_claim_assistant_job()
returns setof public.ops_assistant_jobs language plpgsql security definer set search_path='' as $$
declare j uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(320019);
 if exists(select 1 from public.ops_assistant_jobs where status='running' and lease_until>now()) then return; end if;
 update public.ops_assistant_jobs set status='failed',error='El servicio se reinició varias veces. Vuelve a intentarlo.',updated_at=now() where status='running' and lease_until<now() and attempts>=3;
 select id into j from public.ops_assistant_jobs where status='queued' or (status='running' and lease_until<now() and attempts<3) order by created_at for update skip locked limit 1;
 if j is null then return; end if;
 return query update public.ops_assistant_jobs set status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() where id=j returning *;
end $$;
-- Lease check and publication are atomic: a stale process cannot overwrite a newer conversation.
create or replace function public.ops_publish_assistant(p_job uuid,p_lease uuid,p_snapshot jsonb,p_result jsonb,p_error text,p_done boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.ops_assistant_jobs;
begin
 select * into j from public.ops_assistant_jobs where id=p_job and status='running' and lease_token=p_lease and lease_until>now() for update;
 if not found then return false; end if;
 if p_snapshot is not null then
 insert into public.ops_assistant_threads(owner_id,thread,payload) values(j.owner_id,j.thread,p_snapshot)
 on conflict(owner_id,thread) do update set payload=excluded.payload,updated_at=now();
 end if;
 update public.ops_assistant_jobs set result=p_result,error=left(p_error,400),status=case when not p_done then 'running' when p_error is null then 'succeeded' else 'failed' end,lease_until=case when p_done then null else now()+interval '90 seconds' end,updated_at=now() where id=j.id;
 return true;
end $$;

revoke all on function public.ops_request_report(uuid,text,text,uuid,uuid),public.ops_enqueue_report_kind(text,text,uuid,uuid),public.ops_enqueue_assistant(text,jsonb,text,uuid),public.ops_claim_assistant_job(),public.ops_publish_assistant(uuid,uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.ops_enqueue_report_kind(text,text,uuid,uuid),public.ops_enqueue_assistant(text,jsonb,text,uuid) to authenticated;
grant execute on function public.ops_request_report(uuid,text,text,uuid,uuid),public.ops_claim_assistant_job(),public.ops_publish_assistant(uuid,uuid,jsonb,jsonb,text,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studio32-audio','studio32-audio',false,8388608,array['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a','audio/aac']) on conflict(id) do nothing;
create policy assistant_audio_insert on storage.objects for insert to authenticated with check(bucket_id='studio32-audio' and (storage.foldername(name))[1]=auth.uid()::text and public.is_workspace_member('studio32'));
create policy assistant_audio_read on storage.objects for select to authenticated using(bucket_id='studio32-audio' and (storage.foldername(name))[1]=auth.uid()::text and public.is_workspace_member('studio32'));
create policy assistant_audio_delete on storage.objects for delete to authenticated using(bucket_id='studio32-audio' and (storage.foldername(name))[1]=auth.uid()::text and public.is_workspace_member('studio32'));
create or replace function public.ops_finish_report_job(p_job uuid,p_lease uuid,p_result jsonb,p_document jsonb default null,p_status text default 'succeeded',p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.ops_report_jobs;
begin
 select * into j from public.ops_report_jobs where id=p_job and status='running' and lease_token=p_lease and lease_until>now() for update;
 if not found then return false; end if;
 if p_status not in ('succeeded','needs_review','failed') then raise exception 'Estado inválido'; end if;
 if p_document is not null then
   if j.kind<>'report' or p_status<>'succeeded' then raise exception 'Documento fuera de un encargo de informe'; end if;
   insert into public.ops_report_documents(id,workspace_id,business_key,business,report_type,title,storage_path,sha256,bytes,motor_version,job_id)
   values((p_document->>'id')::uuid,j.workspace_id,p_document->>'business_key',j.payload->'candidate',coalesce(j.payload->>'report_type','diagnostico'),p_document->>'title',p_document->>'storage_path',p_document->>'sha256',(p_document->>'bytes')::integer,p_document->>'motor_version',j.id)
   on conflict(id) do nothing;
 end if;
 update public.ops_report_jobs set status=p_status,result=p_result,error=p_error,stage=case p_status when 'succeeded' then 'Listo' when 'needs_review' then 'Necesita revisión' else 'Necesita atención' end,
 progress=case when p_status='succeeded' then 100 else progress end,finished_at=now(),updated_at=now(),lease_until=null where id=j.id;
 return true;
end $$;


commit;
