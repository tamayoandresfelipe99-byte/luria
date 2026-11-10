-- ═══════════════════════════════════════════════════════════════════
-- Pruebas de aceptación sobre PostgreSQL (autoridad transaccional).
-- Cada bloque lanza una excepción si falla; el script corre con ON_ERROR_STOP.
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Datos de prueba (ficticios, identificados como tales)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'cliente.a@prueba.invalid', '{"full_name":"Cliente Prueba A"}'),
  ('22222222-2222-2222-2222-222222222222', 'cliente.b@prueba.invalid', '{"full_name":"Cliente Prueba B"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@prueba.invalid', '{"full_name":"Admin Prueba"}'),
  ('44444444-4444-4444-4444-444444444444', 'comercial@prueba.invalid', '{"full_name":"Comercial Prueba"}');
insert into public.staff_roles (user_id, role) values
  ('33333333-3333-3333-3333-333333333333', 'admin'),
  ('44444444-4444-4444-4444-444444444444', 'comercial');

\echo '▶ Perfil creado automáticamente al registrarse'
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'deben existir 4 perfiles';
  assert (select external_ref from public.profiles where id = '11111111-1111-1111-1111-111111111111') ~ '^usr_[a-f0-9]{24}$';
end $$;

\echo '▶ A04 · El precio lo define el servidor (trigger)'
do $$ begin
  begin
    insert into public.orders (user_id, product_sku, amount_cop, reference, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 'luria-mensual', 1000, 'LUR-20261110-AAAAAAAAAA', 'x');
    raise exception 'debía fallar';
  exception when raise_exception then
    if sqlerrm = 'debía fallar' then raise; end if;
  end;
end $$;

\echo '▶ Pedido idempotente y único pendiente por cliente'
do $$
declare o1 public.orders; o2 public.orders; o3 public.orders;
begin
  o1 := public.fn_create_order('11111111-1111-1111-1111-111111111111', 'k1');
  o2 := public.fn_create_order('11111111-1111-1111-1111-111111111111', 'k1');
  o3 := public.fn_create_order('11111111-1111-1111-1111-111111111111', 'k2');
  assert o1.id = o2.id and o1.id = o3.id, 'debe reutilizar el pedido pendiente';
  assert o1.amount_cop = 40000, 'precio del producto';
  assert o1.reference ~ '^LUR-[0-9]{8}-[A-Z0-9]{10}$';
end $$;

\echo '▶ A03 · Pago aprobado registra una única vigencia · A05 duplicado'
do $$
declare o public.orders; r1 jsonb; r2 jsonb;
begin
  select * into o from public.orders where user_id = '11111111-1111-1111-1111-111111111111';
  r1 := public.fn_apply_payment(o.id, 'wompi', 'tx-A', 4000000, 'COP', 'approved', 'NEQUI', '2026-11-10 15:00:00+00');
  r2 := public.fn_apply_payment(o.id, 'wompi', 'tx-A', 4000000, 'COP', 'approved', 'NEQUI', '2026-11-10 15:00:00+00');
  assert r1->>'outcome' = 'applied', r1::text;
  assert r2->>'outcome' = 'noop', r2::text;
  assert (select count(*) from public.subscription_periods) = 1;
  assert (select count(*) from public.subscriptions) = 1;
  assert (select count(*) from public.licenses) = 1;
  assert (select status from public.orders where id = o.id) = 'paid';
  assert (select current_period_end from public.subscriptions) = '2026-12-11 04:59:59.999+00', (select current_period_end::text from public.subscriptions);
  assert (select status from public.subscriptions) = 'pending_activation', 'sin licencia confirmada no está activa';
  assert (select status from public.licenses) = 'requested';
end $$;

\echo '▶ A05 · Evento duplicado deduplicado'
do $$
declare a record; b record;
begin
  select * into a from public.fn_record_event('wompi', 'k-evt-1', 'transaction.updated', 'tx-A', true);
  perform public.fn_finish_event(a.event_id, 'processed', null);
  select * into b from public.fn_record_event('wompi', 'k-evt-1', 'transaction.updated', 'tx-A', true);
  assert not a.duplicate and b.duplicate, 'segundo evento debe marcarse duplicado';
  assert b.previous_status = 'processed';
  assert (select attempts from public.payment_events where dedupe_key = 'k-evt-1') = 2;
end $$;

\echo '▶ A07 · Eventos fuera de orden'
do $$
declare o public.orders; r jsonb;
begin
  select * into o from public.orders where user_id = '11111111-1111-1111-1111-111111111111';
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-A', 4000000, 'COP', 'pending', null, now());
  assert r->>'outcome' = 'noop', r::text;
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-A', 4000000, 'COP', 'declined', null, now());
  assert r->>'outcome' = 'conflict', r::text;
  assert (select status from public.payments where provider_transaction_id = 'tx-A') = 'approved';
end $$;

\echo '▶ A09 · Fallo de licencia → tarea auditable (idempotente)'
do $$
declare pay uuid; sub uuid;
begin
  select id into pay from public.payments where provider_transaction_id = 'tx-A';
  select id into sub from public.subscriptions limit 1;
  perform public.fn_upsert_activation_task(pay, sub, 'activation', 'UPSTREAM_ERROR', 'timeout', 24);
  perform public.fn_upsert_activation_task(pay, sub, 'activation', 'UPSTREAM_ERROR', 'timeout', 24);
  assert (select count(*) from public.activation_tasks) = 1;
  assert (select attempts from public.activation_tasks) = 2;
  assert (select status from public.subscriptions where id = sub) = 'activation_failed';
  perform public.fn_mark_license_active(sub, 'EXT-1', (select current_period_end from public.subscriptions where id = sub));
  assert (select status from public.subscriptions where id = sub) = 'active';
  assert (select status from public.activation_tasks) = 'done';
  assert (select status from public.licenses) = 'active';
end $$;

\echo '▶ A13 · Renovación anticipada extiende sin duplicar ni perder días'
do $$
declare o public.orders; r jsonb;
begin
  o := public.fn_create_order('11111111-1111-1111-1111-111111111111', 'k-renew');
  assert o.is_renewal, 'debe marcarse como renovación';
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-B', 4000000, 'COP', 'approved', 'CARD', '2026-12-05 15:00:00+00');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-B', 4000000, 'COP', 'approved', 'CARD', '2026-12-05 15:00:00+00');
  assert (select count(*) from public.subscription_periods) = 2;
  assert (select current_period_end from public.subscriptions) = '2027-01-11 04:59:59.999+00';
  assert (select status from public.subscriptions) = 'active', 'renovación de suscripción activa conserva el estado';
end $$;

\echo '▶ A21 · Fin de mes y año bisiesto (ancla 31)'
do $$
declare p record;
begin
  select * into p from public.fn_next_period('2027-02-01 02:00:00+00', null, null);  -- 31-ene 21:00 Bogotá
  assert p.o_anchor = 31, p.o_anchor::text;
  assert (p.o_end at time zone 'America/Bogota')::date = '2027-02-28';
  select * into p from public.fn_next_period('2027-02-20 12:00:00+00', p.o_end, 31);
  assert (p.o_end at time zone 'America/Bogota')::date = '2027-03-31', 'sin deriva';
  select * into p from public.fn_next_period('2028-01-31 15:00:00+00', null, null);
  assert (p.o_end at time zone 'America/Bogota')::date = '2028-02-29';
  select * into p from public.fn_next_period('2026-12-15 15:00:00+00', null, null);
  assert (p.o_end at time zone 'America/Bogota')::date = '2027-01-15';
end $$;

\echo '▶ A04 · Importe distinto al pedido no habilita nada'
do $$
declare o public.orders; r jsonb;
begin
  o := public.fn_create_order('22222222-2222-2222-2222-222222222222', 'kb');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-cheap', 10000, 'COP', 'approved', 'CARD', now());
  assert r->>'outcome' = 'amount_mismatch', r::text;
  assert not exists (select 1 from public.subscriptions where user_id = '22222222-2222-2222-2222-222222222222');
  assert (select discrepancy from public.payments where provider_transaction_id = 'tx-cheap');
end $$;

\echo '▶ Pago manual exige administrador, evidencia y referencia única'
do $$
declare o public.orders; r jsonb; ok boolean;
begin
  select * into o from public.orders where user_id = '22222222-2222-2222-2222-222222222222';
  ok := false;
  begin perform public.fn_register_manual_payment('44444444-4444-4444-4444-444444444444', o.reference, 'nequi', 'M123456', 40000, now(), 'Comprobante revisado en app');
  exception when others then ok := true; end;
  assert ok, 'comercial no puede registrar pagos manuales';
  ok := false;
  begin perform public.fn_register_manual_payment('33333333-3333-3333-3333-333333333333', o.reference, 'nequi', 'M123456', 40000, now(), 'corto');
  exception when others then ok := true; end;
  assert ok, 'evidencia insuficiente debe fallar';
  r := public.fn_register_manual_payment('33333333-3333-3333-3333-333333333333', o.reference, 'nequi', 'M123456', 40000, now() - interval '1 hour',
                                          'Comprobante Nequi verificado en el extracto del comercio');
  assert r->>'outcome' = 'applied', r::text;
  assert exists (select 1 from public.audit_log where action = 'payment.manual_registered');
  -- reutilizar el mismo comprobante en otro pedido
  o := public.fn_create_order('22222222-2222-2222-2222-222222222222', 'kb2');
  r := public.fn_apply_payment(o.id, 'manual', 'nequi:M123456', 4000000, 'COP', 'approved', 'nequi', now(), '{"note":"x"}');
  assert r->>'outcome' = 'noop', 'la misma referencia externa no genera una segunda vigencia: ' || r::text;
end $$;

\echo '▶ A14 · Reembolso revoca y anula comisión'
do $$
declare o public.orders; r jsonb;
begin
  select * into o from public.orders where reference = (select o2.reference from public.orders o2 join public.payments p on p.order_id = o2.id where p.provider_transaction_id = 'tx-B');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-B', 4000000, 'COP', 'refunded', null, now());
  assert r->>'outcome' = 'applied', r::text;
  assert r ? 'revoke', 'debe pedir revocación';
  assert (r->'revoke'->>'external_license_id') = 'EXT-1';
  assert (select status from public.subscriptions where user_id = '11111111-1111-1111-1111-111111111111') = 'revoked';
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-B', 4000000, 'COP', 'refunded', null, now());
  assert r->>'outcome' = 'noop';
end $$;

\echo '▶ A11 · Vencimiento por tarea programada'
do $$
declare n int;
begin
  select count(*) into n from public.fn_expire_due('2030-01-01 00:00:00+00');
  assert n >= 1, 'debe expirar licencias vencidas';
  assert (select status from public.subscriptions where user_id = '22222222-2222-2222-2222-222222222222') = 'expired';
end $$;

\echo '▶ Auditoría inmutable'
do $$
declare ok boolean := false;
begin
  begin delete from public.audit_log; exception when raise_exception then ok := true; end;
  assert ok, 'audit_log no debe permitir borrado';
end $$;

\echo '▶ Funciones verificadas no publicables sin evidencia'
do $$
declare ok boolean := false;
begin
  begin update public.features set verification_status = 'verificada' where id = 'reenvios';
  exception when check_violation then ok := true; end;
  assert ok;
end $$;
