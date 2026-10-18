begin;
-- A supplied website is verified on the PC before it becomes a selectable candidate.
create or replace function public.ops_enqueue_lookup_web(p_query text,p_city text,p_web text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_workspace_member('studio32') then raise exception 'Acceso no permitido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,32));
 select id into v_id from public.ops_report_jobs where owner_id=auth.uid() and request_key=p_request_key;
 if found then return v_id; end if;
 if p_query is null or length(trim(p_query)) not between 2 and 160 or length(coalesce(p_city,''))>120 then raise exception 'Indica el nombre del restaurante'; end if;
 if p_web is null or length(p_web)>2048 or p_web !~ '^https?://' then raise exception 'Indica una web pública http o https'; end if;
 if (select count(*) from public.ops_report_jobs where owner_id=auth.uid() and status in ('queued','running'))>=5 then raise exception 'Ya tienes cinco encargos pendientes'; end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload)
 values('studio32',auth.uid(),p_request_key,'lookup',jsonb_build_object('query',trim(p_query),'city',trim(coalesce(p_city,'')),'web',p_web))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ops_enqueue_lookup_web(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ops_enqueue_lookup_web(text,text,text,uuid) to authenticated;
commit;
