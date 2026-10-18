-- Read/write assertions rolled back as one transaction. No accounts or grants changed.
begin;
create temporary table ops_test_users as
select user_id,row_number() over(order by member_id='pancho' desc,member_id) as n
from public.workspace_members where workspace_id='studio32';
do $$begin
 if (select count(*) from ops_test_users)<2 then raise exception 'Necesita dos miembros existentes para probar aislamiento';end if;
 if has_table_privilege('anon','public.ops_report_documents','SELECT') then raise exception 'Anon puede leer documentos';end if;
 if has_table_privilege('authenticated','public.ops_report_jobs','INSERT') then raise exception 'El navegador puede insertar trabajos sin RPC';end if;
 if has_function_privilege('authenticated','public.ops_desktop_enqueue(uuid,text,jsonb,uuid)','EXECUTE') then raise exception 'El navegador puede suplantar propietarios';end if;
 if has_function_privilege('authenticated','public.ops_finish_report_job(uuid,uuid,jsonb,jsonb,text,text)','EXECUTE') then raise exception 'El navegador puede publicar informes';end if;
 if (select public from storage.buckets where id='studio32-reports') then raise exception 'El bucket es público';end if;
end $$;
insert into public.ops_report_jobs(id,workspace_id,owner_id,request_key,kind,payload)
select '11111111-1111-4111-8111-111111111111','studio32',user_id,gen_random_uuid(),'lookup','{"query":"Prueba aislada"}' from ops_test_users where n=1;
select set_config('request.jwt.claim.sub',(select user_id::text from ops_test_users where n=2),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.ops_report_jobs where id='11111111-1111-4111-8111-111111111111') then raise exception 'Otro miembro puede leer el trabajo privado';end if;
 begin
  perform public.ops_enqueue_report('11111111-1111-4111-8111-111111111111','inventado',gen_random_uuid());
  raise exception 'Aceptó un candidato de otro usuario';
 exception when raise_exception then
  if sqlerrm='Aceptó un candidato de otro usuario' then raise;end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from ops_test_users where n=1),true);
set local role authenticated;
do $$declare a uuid;b uuid;k uuid:=gen_random_uuid();begin
 if not exists(select 1 from public.ops_report_jobs where id='11111111-1111-4111-8111-111111111111') then raise exception 'No puede ver su propio encargo';end if;
 a:=public.ops_enqueue_lookup('Prueba idempotencia','Valencia',k);
 b:=public.ops_enqueue_lookup('Prueba idempotencia','Valencia',k);
 if a<>b then raise exception 'Se duplicó una solicitud reintentada';end if;
 begin
  perform public.ops_enqueue_lookup(null,'Valencia',gen_random_uuid());
  raise exception 'Aceptó nombre nulo';
 exception when raise_exception then
  if sqlerrm='Aceptó nombre nulo' then raise;end if;
 end;
end $$;
reset role;
select 'OK: permisos, aislamiento por propietario, candidato ajeno, bucket privado e idempotencia' as comprobacion;
rollback;
