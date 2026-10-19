-- Transactional recovery test. Locks keep real workers away from these disposable rows.
begin;
select pg_advisory_xact_lock(320018);
select pg_advisory_xact_lock(320019);
do $$
declare u uuid; j uuid; a public.ops_report_jobs; b public.ops_report_jobs;
 x public.ops_assistant_jobs; y public.ops_assistant_jobs;
begin
 if exists(select 1 from public.ops_report_jobs where status in ('queued','running')) or exists(select 1 from public.ops_assistant_jobs where status in ('queued','running')) then raise exception 'Hay encargos reales pendientes; repetir en reposo'; end if;
 select user_id into u from public.workspace_members where workspace_id='studio32' and member_id='pancho';
 if u is null then raise exception 'Falta el miembro de prueba existente';end if;
 insert into public.ops_report_jobs(workspace_id,owner_id,request_key,kind,payload) values('studio32',u,gen_random_uuid(),'lookup','{"query":"Recuperación transaccional"}') returning id into j;
 select * into a from public.ops_claim_report_job('qa-rollback');
 if a.id<>j or a.attempts<>1 then raise exception 'No se reclamó la primera reserva';end if;
 update public.ops_report_jobs set lease_until=now()-interval '1 second' where id=j;
 select * into b from public.ops_claim_report_job('qa-rollback');
 if b.id<>j or b.attempts<>2 or b.lease_token=a.lease_token then raise exception 'No se recuperó con una reserva nueva';end if;
 if public.ops_finish_report_job(j,a.lease_token,'{}') then raise exception 'Un worker antiguo pudo publicar';end if;
 if not public.ops_finish_report_job(j,b.lease_token,'{"proof":true}') then raise exception 'El worker vigente no pudo terminar';end if;
 if public.ops_finish_report_job(j,b.lease_token,'{}') then raise exception 'Se volvió a finalizar un encargo';end if;
 update public.ops_report_jobs set status='running',attempts=3,lease_until=now()-interval '1 second' where id=j;
 perform public.ops_claim_report_job('qa-rollback');
 if not exists(select 1 from public.ops_report_jobs where id=j and status='failed')then raise exception 'No se limitan las interrupciones';end if;

 insert into public.ops_assistant_jobs(owner_id,request_key,operation,thread,body)values(u,gen_random_uuid(),'messages','qa-recovery','{"text":"Prueba"}')returning id into j;
 select * into x from public.ops_claim_assistant_job();
 update public.ops_assistant_jobs set lease_until=now()-interval '1 second' where id=j;
 select * into y from public.ops_claim_assistant_job();
 if y.id<>j or y.attempts<>2 or y.lease_token=x.lease_token then raise exception 'No se recuperó el asistente';end if;
 if public.ops_publish_assistant(j,x.lease_token,'{"messages":[]}',null,null,true)then raise exception 'El asistente antiguo pudo sobrescribir';end if;
 if not public.ops_publish_assistant(j,y.lease_token,'{"proof":true}','{}',null,true)then raise exception 'No publicó el asistente vigente';end if;
 if not exists(select 1 from public.ops_assistant_threads where owner_id=u and thread='qa-recovery' and payload->>'proof'='true')then raise exception 'No se publicó el snapshot';end if;
 update public.ops_assistant_jobs set status='running',attempts=3,lease_until=now()-interval '1 second' where id=j;
 perform public.ops_claim_assistant_job();
 if not exists(select 1 from public.ops_assistant_jobs where id=j and status='failed')then raise exception 'El asistente reintenta sin límite';end if;
end $$;
select 'OK: recuperación de ambas colas, lease nueva, worker antiguo bloqueado, publicación única y tres intentos máximos' comprobacion;
rollback;
