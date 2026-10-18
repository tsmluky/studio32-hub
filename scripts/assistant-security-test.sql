-- Existing members only, everything rolled back.
begin;
create temporary table assistant_test_users as select user_id,row_number() over(order by member_id='pancho' desc,member_id) n from public.workspace_members where workspace_id='studio32';
do $$begin
 if has_function_privilege('authenticated','public.ops_request_report(uuid,text,text,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.ops_claim_assistant_job()','EXECUTE') or has_function_privilege('anon','public.ops_enqueue_assistant(text,jsonb,text,uuid)','EXECUTE') then raise exception 'Privilegios excesivos';end if;
 if has_table_privilege('authenticated','public.ops_assistant_threads','INSERT') or has_table_privilege('anon','public.ops_assistant_threads','SELECT') then raise exception 'Conversaciones sin protección';end if;
 if exists(select 1 from storage.buckets where id in ('studio32-reports','studio32-audio') and public) then raise exception 'Bucket público';end if;
end $$;
insert into public.ops_assistant_threads(owner_id,thread,payload) select user_id,'test-private','{"messages":[{"content":"privado"}]}' from assistant_test_users where n=1;
insert into storage.objects(bucket_id,name) select 'studio32-audio',user_id::text || '/22222222-2222-4222-8222-222222222222' from assistant_test_users where n=1;
select set_config('request.jwt.claim.sub',(select user_id::text from assistant_test_users where n=2),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.ops_assistant_threads where thread='test-private')then raise exception 'Conversación ajena visible';end if;
 if exists(select 1 from storage.objects where bucket_id='studio32-audio' and name like '%22222222-2222-4222-8222-222222222222') then raise exception 'Audio ajeno visible';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from assistant_test_users where n=1),true);
set local role authenticated;
do $$declare a uuid;b uuid;k uuid:=gen_random_uuid();begin
 a:=public.ops_enqueue_assistant('messages','{"text":"Prueba"}','general',k);
 b:=public.ops_enqueue_assistant('messages','{"text":"Prueba"}','general',k);
 if a<>b then raise exception 'Inferencia duplicada';end if;
 if not exists(select 1 from public.ops_assistant_jobs where id=a and owner_id=auth.uid())then raise exception 'Propietario incorrecto';end if;
 begin
 perform public.ops_enqueue_assistant('shell','{}','general',gen_random_uuid());
 raise exception 'Aceptó shell';
 exception when raise_exception then if sqlerrm='Aceptó shell' then raise;end if;end;
 begin
 perform public.ops_enqueue_assistant('transcribe','{"path":"otra-persona/audio"}','general',gen_random_uuid());
 raise exception 'Aceptó audio ajeno';
 exception when raise_exception then if sqlerrm='Aceptó audio ajeno' then raise;end if;end;
 begin
 perform public.ops_enqueue_report_kind('inventado','completo',gen_random_uuid());
 raise exception 'Aceptó negocio inventado';
 exception when raise_exception then if sqlerrm='Aceptó negocio inventado' then raise;end if;end;
end $$;
reset role;
-- Expired/wrong worker cannot publish into the owner's thread.
do $$declare j uuid;begin
 select id into j from public.ops_assistant_jobs where operation='messages' and body->>'text'='Prueba' order by created_at desc limit 1;
 if public.ops_publish_assistant(j,gen_random_uuid(),'{"messages":[]}',null,null,true) then raise exception 'Publicación sin lease';end if;
end $$;
select 'OK: owner isolation, no anon/service spoofing, idempotency, input limits, private audio, lease protection' comprobacion;
rollback;
