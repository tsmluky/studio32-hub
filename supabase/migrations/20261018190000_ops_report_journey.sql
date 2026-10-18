-- Additive report journey. Existing Hub, outreach and appointment tables are untouched.
begin;

create table if not exists public.ops_report_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id text not null references public.workspaces(id),
 owner_id uuid not null references auth.users(id),
 request_key uuid not null,
 kind text not null check (kind in ('lookup','report')),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<16000),
 status text not null default 'queued' check(status in ('queued','running','succeeded','needs_review','failed')),
 stage text not null default 'En cola', progress integer not null default 0 check(progress between 0 and 100),
 result jsonb, error text, attempts integer not null default 0,
 lease_token uuid, lease_until timestamptz, worker_id text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), finished_at timestamptz,
 unique(owner_id,request_key)
);
create index if not exists ops_report_jobs_claim on public.ops_report_jobs(status,created_at);
create index if not exists ops_report_jobs_owner on public.ops_report_jobs(owner_id,created_at desc);

create table if not exists public.ops_report_documents (
 id uuid primary key, workspace_id text not null references public.workspaces(id),
 business_key text not null, business jsonb not null check(jsonb_typeof(business)='object'),
 report_type text not null check(report_type='diagnostico'), title text not null,
 storage_path text unique not null, sha256 text not null check(length(sha256)=64),
 bytes integer not null check(bytes>0 and bytes<=20971520),
 motor_version text not null, generated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 job_id uuid not null references public.ops_report_jobs(id)
);
create index if not exists ops_report_documents_cache on public.ops_report_documents(workspace_id,business_key,report_type,generated_at desc);
create table if not exists public.ops_report_workers (
 id text primary key, workspace_id text not null references public.workspaces(id),
 last_seen timestamptz not null default now(), status text not null, current_job uuid,
 version text not null
);

alter table public.ops_report_jobs enable row level security;
alter table public.ops_report_documents enable row level security;
alter table public.ops_report_workers enable row level security;
revoke all on public.ops_report_jobs,public.ops_report_documents,public.ops_report_workers from anon,authenticated;
grant select on public.ops_report_jobs,public.ops_report_documents,public.ops_report_workers to authenticated;
grant all on public.ops_report_jobs,public.ops_report_documents,public.ops_report_workers to service_role;
drop policy if exists ops_jobs_own on public.ops_report_jobs;
drop policy if exists ops_documents_workspace on public.ops_report_documents;
drop policy if exists ops_workers_workspace on public.ops_report_workers;
create policy ops_jobs_own on public.ops_report_jobs for select to authenticated
 using(owner_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy ops_documents_workspace on public.ops_report_documents for select to authenticated
 using(public.is_workspace_member(workspace_id));
create policy ops_workers_workspace on public.ops_report_workers for select to authenticated
 using(public.is_workspace_member(workspace_id));

create or replace function public.ops_enqueue_lookup(p_query text,p_city text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_workspace_member('studio32') then raise exception 'Acceso no permitido'; end if;
 select id into v_id from public.ops_report_jobs where owner_id=auth.uid() and request_key=p_request_key;
 if found then return v_id; end if;
 if p_query is null or length(trim(p_query)) not between 2 and 160 or length(coalesce(p_city,''))>120 then raise exception 'Indica el nombre del restaurante'; end if;
 if (select count(*) from public.ops_report_jobs where owner_id=auth.uid() and status in ('queued','running'))>=5 then raise exception 'Ya tienes cinco encargos pendientes'; end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload)
 values('studio32',auth.uid(),p_request_key,'lookup',jsonb_build_object('query',trim(p_query),'city',trim(coalesce(p_city,''))))
 on conflict(owner_id,request_key) do update set request_key=excluded.request_key returning id into v_id;
 return v_id;
end $$;

create or replace function public.ops_enqueue_report(p_lookup_id uuid,p_candidate_id text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_candidate jsonb; v_id uuid; v_lookup public.ops_report_jobs;
begin
 if auth.uid() is null or not public.is_workspace_member('studio32') then raise exception 'Acceso no permitido'; end if;
 select id into v_id from public.ops_report_jobs where owner_id=auth.uid() and request_key=p_request_key;
 if found then return v_id; end if;
 select * into v_lookup from public.ops_report_jobs where id=p_lookup_id and owner_id=auth.uid() and kind='lookup' and status='succeeded';
 if not found then raise exception 'Busca y selecciona el restaurante antes de continuar'; end if;
 select value into v_candidate from jsonb_array_elements(v_lookup.result->'candidates') where value->>'id'=p_candidate_id limit 1;
 if v_candidate is null or coalesce(v_candidate->>'web','')='' then raise exception 'Este local no tiene una web confirmada'; end if;
 if (select count(*) from public.ops_report_jobs where owner_id=auth.uid() and status in ('queued','running'))>=5 then raise exception 'Ya tienes cinco encargos pendientes'; end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload)
 values(v_lookup.workspace_id,auth.uid(),p_request_key,'report',jsonb_build_object('candidate',v_candidate,'report_type','diagnostico'))
 on conflict(owner_id,request_key) do update set request_key=excluded.request_key returning id into v_id;
 return v_id;
end $$;

-- The desktop can enqueue only for a configured, existing workspace member.
-- Never granted to browsers; used by the loopback development gateway.
create or replace function public.ops_desktop_enqueue(p_owner uuid,p_kind text,p_payload jsonb,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_candidate jsonb;
begin
 if not exists(select 1 from public.workspace_members where workspace_id='studio32' and user_id=p_owner) then raise exception 'Propietario no válido'; end if;
 select id into v_id from public.ops_report_jobs where owner_id=p_owner and request_key=p_request_key;
 if found then return v_id; end if;
 if (select count(*) from public.ops_report_jobs where owner_id=p_owner and status in ('queued','running'))>=5 then raise exception 'Ya tienes cinco encargos pendientes'; end if;
 if p_kind='lookup' then
   if p_payload->>'query' is null or length(trim(p_payload->>'query')) not between 2 and 160 or length(coalesce(p_payload->>'city',''))>120 then raise exception 'Búsqueda no válida'; end if;
 elsif p_kind='report' then
   select value into v_candidate from public.ops_report_jobs j, lateral jsonb_array_elements(j.result->'candidates')
    where j.id=(p_payload->>'lookup_id')::uuid and j.owner_id=p_owner and j.kind='lookup' and j.status='succeeded' and value->>'id'=p_payload->>'candidate_id' limit 1;
   if v_candidate is null or coalesce(v_candidate->>'web','')='' then raise exception 'Restaurante sin web confirmada'; end if;
   p_payload=jsonb_build_object('candidate',v_candidate,'report_type','diagnostico');
 else raise exception 'Tipo no permitido'; end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload) values('studio32',p_owner,p_request_key,p_kind,p_payload)
 on conflict(owner_id,request_key) do update set request_key=excluded.request_key returning id into v_id;
 return v_id;
end $$;

create or replace function public.ops_claim_report_job(p_worker text)
returns setof public.ops_report_jobs language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(320018);
 if exists(select 1 from public.ops_report_jobs where status='running' and lease_until>now()) then return; end if;
 update public.ops_report_jobs set status='failed',error='El trabajo se interrumpió varias veces. Vuelve a pedirlo.',stage='Necesita atención',finished_at=now(),updated_at=now()
 where status='running' and lease_until<now() and attempts>=3;
 select id into v_id from public.ops_report_jobs
 where workspace_id='studio32' and (status='queued' or (status='running' and lease_until<now() and attempts<3))
 order by created_at for update skip locked limit 1;
 if v_id is null then return; end if;
 return query update public.ops_report_jobs set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',
 worker_id=p_worker,stage='El sobremesa ha recogido el encargo',updated_at=now() where id=v_id returning *;
end $$;

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
   values((p_document->>'id')::uuid,j.workspace_id,p_document->>'business_key',j.payload->'candidate','diagnostico',p_document->>'title',p_document->>'storage_path',p_document->>'sha256',(p_document->>'bytes')::integer,p_document->>'motor_version',j.id)
   on conflict(id) do nothing;
 end if;
 update public.ops_report_jobs set status=p_status,result=p_result,error=p_error,stage=case p_status when 'succeeded' then 'Listo' when 'needs_review' then 'Necesita revisión' else 'Necesita atención' end,
 progress=case when p_status='succeeded' then 100 else progress end,finished_at=now(),updated_at=now(),lease_until=null where id=j.id;
 return true;
end $$;

revoke all on function public.ops_enqueue_lookup(text,text,uuid),public.ops_enqueue_report(uuid,text,uuid),public.ops_desktop_enqueue(uuid,text,jsonb,uuid),public.ops_claim_report_job(text),public.ops_finish_report_job(uuid,uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.ops_enqueue_lookup(text,text,uuid),public.ops_enqueue_report(uuid,text,uuid) to authenticated;
grant execute on function public.ops_desktop_enqueue(uuid,text,jsonb,uuid),public.ops_claim_report_job(text),public.ops_finish_report_job(uuid,uuid,jsonb,jsonb,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('studio32-reports','studio32-reports',false,20971520,array['application/pdf']) on conflict(id) do nothing;
drop policy if exists ops_report_file_read on storage.objects;
create policy ops_report_file_read on storage.objects for select to authenticated
using(bucket_id='studio32-reports' and exists(select 1 from public.ops_report_documents d where d.storage_path=name and public.is_workspace_member(d.workspace_id)));

commit;
