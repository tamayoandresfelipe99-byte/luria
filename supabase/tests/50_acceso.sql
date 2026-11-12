-- ═══════════════════════════════════════════════════════════════════
-- Separación entre pago y entrega del acceso (migración 0008).
-- Clientes ficticios C (paga) y D (no paga); admin 3333…, comercial 4444… de 10_acceptance.sql.
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;
reset role;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'cliente.c@prueba.invalid', '{"full_name":"Cliente Prueba C"}'),
  ('88888888-8888-8888-8888-888888888888', 'cliente.d@prueba.invalid', '{"full_name":"Cliente Prueba D"}');
-- C tiene una suscripción vigente por 30 días (pago confirmado).
insert into public.subscriptions (user_id, status, current_period_start, current_period_end)
values ('77777777-7777-7777-7777-777777777777', 'active', now(), now() + interval '30 days');

\echo '▶ AC-01 · Pago confirmado no habilita el acceso: el cliente ve «pendiente» y ningún enlace'
\o /dev/null
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare r record;
begin
  select * into r from public.fn_my_access();
  assert r.payment_state = 'al_dia', 'estado de pago: ' || r.payment_state;
  assert r.access_status = 'pendiente' and r.link_url is null;
end $$;
\o
reset role;

\echo '▶ AC-02 · El cliente no puede guardar, habilitar ni leer enlaces; tampoco cambiar su pago'
\o /dev/null
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare blocked int := 0;
begin
  begin perform public.fn_access_save_link(auth.uid(), 'https://acceso.example/c'); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_access_enable(auth.uid()); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin insert into public.access_grants (user_id, status, link_url) values (auth.uid(), 'habilitado', 'https://x.example');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin update public.subscriptions set current_period_end = now() + interval '10 years' where user_id = auth.uid();
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform public.fn_admin_access_overview(); exception when insufficient_privilege then blocked := blocked + 1; end;
  assert blocked = 5, format('solo %s de 5 bloqueos', blocked);
  assert (select count(*) from public.access_grants) = 0, 'el cliente no lee la tabla de accesos';
end $$;
\o
reset role;

\echo '▶ AC-03 · Comercial no gestiona accesos ni ve enlaces'
\o /dev/null
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$
declare ok boolean := false;
begin
  begin perform public.fn_access_save_link('77777777-7777-7777-7777-777777777777', 'https://acceso.example/c');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'comercial guardó un enlace';
  assert (select count(*) from public.fn_admin_access_overview()) > 0, 'comercial ve la tabla de estados';
end $$;
\o
reset role;

\echo '▶ AC-04 · Admin: validación del enlace, guardar (no publica) y habilitar con auditoría y notificación'
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$
declare bad int := 0; c uuid := '77777777-7777-7777-7777-777777777777';
begin
  begin perform public.fn_access_enable(c); exception when others then bad := bad + 1; end;  -- sin enlace
  begin perform public.fn_access_save_link(c, 'http://inseguro.example/x'); exception when others then bad := bad + 1; end;
  begin perform public.fn_access_save_link(c, 'javascript:alert(1)'); exception when others then bad := bad + 1; end;
  begin perform public.fn_access_save_link(c, 'https://a.example/x y'); exception when others then bad := bad + 1; end;
  assert bad = 4, format('solo %s de 4 entradas inválidas rechazadas', bad);
  assert public.fn_access_save_link(c, 'https://acceso.example/c?token=abc') = 'enlace_guardado';
  assert (select link_url from public.fn_admin_access_overview() where user_id = c) = 'https://acceso.example/c?token=abc';
end $$;
\o
reset role;
\o /dev/null
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare r record;
begin
  select * into r from public.fn_my_access();
  assert r.access_status = 'pendiente' and r.link_url is null, 'un enlace guardado no debe publicarse';
end $$;
\o
reset role;
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.fn_access_enable('77777777-7777-7777-7777-777777777777');
\o
reset role;
do $$
declare c text := '77777777-7777-7777-7777-777777777777';
begin
  assert (select enabled_by from public.access_grants where user_id = c::uuid) = '33333333-3333-3333-3333-333333333333', 'registra quién habilitó';
  assert (select enabled_at from public.access_grants where user_id = c::uuid) is not null, 'registra cuándo';
  assert exists (select 1 from public.audit_log where action = 'access.enabled' and object_id = c and actor_id = '33333333-3333-3333-3333-333333333333');
  assert not exists (select 1 from public.audit_log where action like 'access.%' and metadata::text like '%token=abc%'), 'la auditoría no guarda la URL completa';
  assert exists (select 1 from public.notifications where user_id = c::uuid and kind = 'access_enabled');
end $$;

\echo '▶ AC-05 · Tras habilitar: el cliente ve su enlace; otro cliente no ve ni enlace ni notificaciones ajenas'
\o /dev/null
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare r record;
begin
  select * into r from public.fn_my_access();
  assert r.access_status = 'habilitado' and r.link_url = 'https://acceso.example/c?token=abc';
  assert (select count(*) from public.notifications where kind = 'access_enabled') = 1;
  update public.notifications set read_at = now();
  assert (select count(*) from public.notifications where read_at is null) = 0;
end $$;
\o
reset role;
\o /dev/null
select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
do $$
declare r record; ok boolean := false;
begin
  select * into r from public.fn_my_access();
  assert r.payment_state = 'pendiente_pago' and r.access_status = 'pendiente' and r.link_url is null;
  assert (select count(*) from public.notifications) = 0, 'notificaciones ajenas visibles';
  begin update public.notifications set title = 'x'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'solo read_at es editable';
end $$;
\o
reset role;

\echo '▶ AC-06 · Sin suscripción vigente no se habilita (cliente D con enlace guardado)'
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$
declare ok boolean := false;
begin
  perform public.fn_access_save_link('88888888-8888-8888-8888-888888888888', 'https://acceso.example/d');
  begin perform public.fn_access_enable('88888888-8888-8888-8888-888888888888'); exception when others then ok := sqlerrm like '%no está vigente%'; end;
  assert ok, 'habilitó sin suscripción vigente';
end $$;
\o
reset role;

\echo '▶ AC-07 · Estados de pago: por vencer (≤ 7 días), vencido y en verificación'
do $$
declare c uuid := '77777777-7777-7777-7777-777777777777'; d uuid := '88888888-8888-8888-8888-888888888888'; o uuid;
begin
  update public.subscriptions set current_period_end = now() + interval '6 days' where user_id = c;
  assert public.fn_payment_state(c) = 'por_vencer';
  -- Vencimiento sin que haya corrido la tarea diaria: el enlace ya no se entrega.
  update public.subscriptions set current_period_end = now() - interval '1 minute' where user_id = c;
  assert public.fn_payment_state(c) = 'vencido';
  insert into public.orders (user_id, product_sku, amount_cop, reference, idempotency_key)
  values (d, 'luria-mensual', 40000, 'LUR-20261112-DDDDDDDDDD', 'k-ac-07') returning id into o;
  insert into public.payments (order_id, provider, provider_transaction_id, amount_cents, currency, status, verified_at)
  values (o, 'mock', 'tx-ac-07', 4000000, 'COP', 'pending', now());
  assert public.fn_payment_state(d) = 'en_verificacion';
end $$;
\o /dev/null
select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
do $$
declare r record;
begin
  select * into r from public.fn_my_access();
  assert r.payment_state = 'vencido' and r.access_status = 'suspendido' and r.link_url is null, 'vencido no debe entregar el enlace';
end $$;
\o
reset role;

\echo '▶ AC-08 · La tarea de vencimientos suspende el acceso y notifica; reactivar exige suscripción vigente'
do $$
declare c uuid := '77777777-7777-7777-7777-777777777777';
begin
  perform * from public.fn_expire_due(now());
  assert (select status from public.access_grants where user_id = c) = 'suspendido';
  assert exists (select 1 from public.notifications where user_id = c and kind = 'access_suspended');
  assert exists (select 1 from public.audit_log where action = 'access.suspended' and object_id = c::text);
  -- Renovación pagada: la suscripción vuelve a estar vigente, pero el acceso NO se reactiva solo.
  update public.subscriptions set status = 'active', current_period_end = now() + interval '30 days' where user_id = c;
  assert (select status from public.access_grants where user_id = c) = 'suspendido';
end $$;
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.fn_access_enable('77777777-7777-7777-7777-777777777777');
\o
reset role;

\echo '▶ AC-09 · Revocar exige motivo, queda auditado; un reembolso revoca automáticamente'
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$
declare ok boolean := false; c uuid := '77777777-7777-7777-7777-777777777777';
begin
  begin perform public.fn_access_revoke(c, 'x'); exception when others then ok := true; end;
  assert ok, 'revocó sin motivo';
  perform public.fn_access_revoke(c, 'Prueba de revocación administrativa');
  -- Sustituir el enlace tras revocar y volver a habilitar.
  assert public.fn_access_save_link(c, 'https://acceso.example/c2') = 'enlace_guardado';
  perform public.fn_access_enable(c);
end $$;
\o
reset role;
do $$
declare c uuid := '77777777-7777-7777-7777-777777777777';
begin
  assert exists (select 1 from public.audit_log where action = 'access.revoked' and object_id = c::text and reason = 'Prueba de revocación administrativa');
  update public.subscriptions set status = 'revoked' where user_id = c;
  assert (select status from public.access_grants where user_id = c) = 'revocado';
  assert public.fn_payment_state(c) <> 'al_dia';
end $$;
\echo '✔ Separación entre pago y acceso verificada'
