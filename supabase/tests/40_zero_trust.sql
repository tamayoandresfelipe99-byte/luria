-- ═══════════════════════════════════════════════════════════════════
-- Auditoría Zero Trust de la base de datos (se ejecuta después de 10, 20 y 30).
-- Comprueba invariantes globales, no casos sueltos: si una migración futura
-- crea una tabla sin RLS o una función privilegiada abierta, esta prueba falla.
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;
reset role;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

\echo '▶ ZT-01 · Toda tabla de public tiene RLS activado y forzado'
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity);
  assert bad is null, 'tablas sin RLS forzado: ' || bad;
end $$;

\echo '▶ ZT-02 · Ninguna función SECURITY DEFINER es ejecutable por anon; authenticated solo las permitidas'
do $$
declare bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
  assert bad is null, 'anon puede ejecutar: ' || bad;
  select string_agg(p.oid::regprocedure::text, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in ('has_role', 'is_staff', 'fn_cancel_renewal', 'fn_resume_renewal');
  assert bad is null, 'authenticated puede ejecutar funciones privilegiadas: ' || bad;
end $$;

\echo '▶ ZT-03 · Toda función SECURITY DEFINER fija search_path (evita secuestro de objetos)'
do $$
declare bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert bad is null, 'sin search_path: ' || bad;
end $$;

\echo '▶ ZT-04 · anon solo puede leer el catálogo; no escribe en ninguna tabla'
do $$
declare bad text;
begin
  select string_agg(format('%s:%s', c.relname, priv), ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) priv
   where n.nspname = 'public' and c.relkind in ('r','v','m')
     and has_table_privilege('anon', c.oid, priv)
     and not (priv = 'SELECT' and c.relname in ('products', 'features', 'environments'));
  assert bad is null, 'privilegios indebidos de anon: ' || bad;
end $$;

\echo '▶ ZT-05 · authenticated no tiene DELETE/TRUNCATE en ninguna tabla ni INSERT/UPDATE en datos financieros o de roles'
do $$
declare bad text;
begin
  select string_agg(format('%s:%s', c.relname, priv), ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['DELETE','TRUNCATE','TRIGGER','REFERENCES']) priv
   where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, priv);
  assert bad is null, 'authenticated con privilegios destructivos: ' || bad;
  select string_agg(format('%s:%s', t, priv), ', ') into bad
    from unnest(array['staff_roles','orders','payments','payment_events','subscriptions','subscription_periods',
                      'licenses','activation_tasks','audit_log','commissions','referrers','attribution',
                      'analytics_events','rate_limits','eligibility_checks','profiles']) t
    cross join unnest(array['INSERT','UPDATE']) priv
   where has_table_privilege('authenticated', ('public.' || t)::regclass, priv)
     and not (t = 'profiles' and priv = 'UPDATE');  -- solo columnas full_name y phone (ZT-08)
  assert bad is null, 'authenticated puede escribir: ' || bad;
end $$;

\echo '▶ ZT-06 · Escalamiento vertical: un cliente no puede darse un rol ni llamar funciones de servidor'
\o /dev/null
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare blocked int := 0;
begin
  begin insert into public.staff_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'admin');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_register_manual_payment('22222222-2222-2222-2222-222222222222', 'LUR-20261111-AAAAAAAAAA', 'nequi', 'REF1234', 40000, now(), 'intento de fraude por cliente');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_create_order('22222222-2222-2222-2222-222222222222', 'k-zt-06');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_mark_license_active((select id from public.subscriptions limit 1), 'lic-falsa', now() + interval '1 year');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_rate_limit_hit('x', 1, 1);
  exception when insufficient_privilege then blocked := blocked + 1; end;
  assert blocked = 5, format('solo %s de 5 intentos de escalamiento fueron bloqueados', blocked);
  assert not public.has_role('admin') and not public.is_staff(), 'el cliente no debe tener rol';
end $$;
\o
reset role;

\echo '▶ ZT-07 · Aislamiento horizontal: el cliente B no ve datos personales del cliente A en ninguna tabla'
insert into public.support_requests (user_id, category, description) values
  ('11111111-1111-1111-1111-111111111111', 'tecnica', 'Solicitud privada del cliente A para prueba');
insert into public.consents (user_id, purpose, granted, notice_version) values
  ('11111111-1111-1111-1111-111111111111', 'marketing', true, 'zt');
insert into public.eligibility_checks (user_id, platform, browser, device, virtual_only, result) values
  ('11111111-1111-1111-1111-111111111111', 'zajuna', 'chrome', 'portatil', true, 'en_prueba');
\o /dev/null
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare a uuid := '11111111-1111-1111-1111-111111111111'; n int; blocked int := 0;
begin
  assert (select count(*) from public.profiles where id = a) = 0, 'perfil ajeno visible';
  assert (select count(*) from public.support_requests where user_id = a) = 0, 'soporte ajeno visible';
  assert (select count(*) from public.consents where user_id = a) = 0, 'consentimientos ajenos visibles';
  assert (select count(*) from public.eligibility_checks where user_id = a) = 0, 'elegibilidad ajena visible';
  assert (select count(*) from public.subscription_periods) = (select count(*) from public.subscription_periods sp join public.subscriptions s on s.id = sp.subscription_id where s.user_id = auth.uid()), 'periodos ajenos visibles';
  assert (select count(*) from public.staff_roles) = 0, 'el cliente ve roles del personal';
  -- Lecturas que deben fallar por privilegio (no solo devolver vacío)
  begin perform 1 from public.attribution; exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform 1 from public.rate_limits; exception when insufficient_privilege then blocked := blocked + 1; end;
  -- Escrituras a nombre de otro
  begin insert into public.consents (user_id, purpose, granted, notice_version) values (a, 'marketing', false, 'zt');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin insert into public.support_requests (user_id, category, description) values (a, 'otra', 'suplantación de otro usuario');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  update public.support_requests set status = 'cerrada' where user_id = a;
  get diagnostics n = row_count;
  assert n = 0, 'modificó soporte ajeno';
  assert blocked >= 3, format('solo %s bloqueos', blocked);
end $$;
\o
reset role;

\echo '▶ ZT-08 · Perfil: el cliente no puede cambiar correo, identificador externo ni fechas'
\o /dev/null
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare blocked int := 0;
begin
  begin update public.profiles set email = 'robo@prueba.invalid' where id = auth.uid();
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin update public.profiles set created_at = now() where id = auth.uid();
  exception when insufficient_privilege then blocked := blocked + 1; end;
  assert blocked = 2, format('solo %s de 2 bloqueos', blocked);
end $$;
\o
reset role;

\echo '▶ ZT-09 · Personal sin rol admin no ve roles ajenos ni puede ascender'
\o /dev/null
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare ok boolean := false;
begin
  assert (select count(*) from public.staff_roles where user_id <> auth.uid()) = 0, 'comercial ve roles ajenos';
  begin insert into public.staff_roles (user_id, role) values (auth.uid(), 'admin');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'comercial pudo darse rol admin';
  assert not public.has_role('admin');
end $$;
\o
reset role;

\echo '▶ ZT-10 · La auditoría es de solo inserción, incluso para service_role'
do $$
declare ok boolean := false;
begin
  set local role service_role;
  begin update public.audit_log set action = 'borrado' where true;
  exception when others then ok := true; end;
  assert ok, 'audit_log admite modificaciones';
end $$;
reset role;
\echo '✔ Auditoría Zero Trust superada'
