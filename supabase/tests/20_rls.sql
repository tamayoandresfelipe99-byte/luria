-- ═══════════════════════════════════════════════════════════════════
-- A10 y control de acceso por rol (RLS) — se ejecuta después de 10_acceptance.sql
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

\echo '▶ A10 · Cliente B no ve pedidos, pagos ni suscripción del cliente A'
\o /dev/null
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  assert (select count(*) from public.orders where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'pedidos ajenos visibles';
  assert (select count(*) from public.orders) > 0, 'debe ver los propios';
  assert (select count(*) from public.payments p join public.orders o on o.id = p.order_id where o.user_id <> '22222222-2222-2222-2222-222222222222') = 0;
  assert (select count(*) from public.subscriptions where user_id <> '22222222-2222-2222-2222-222222222222') = 0;
  assert (select count(*) from public.licenses where user_id <> '22222222-2222-2222-2222-222222222222') = 0;
  assert (select count(*) from public.profiles) = 1, 'solo su perfil';
  assert (select count(*) from public.payment_events) = 0, 'eventos de pago solo admin';
  assert (select count(*) from public.audit_log) = 0, 'auditoría solo admin';
  assert (select count(*) from public.activation_tasks) = 0;
end $$;

\echo '▶ Cliente no puede escribir pedidos, pagos, suscripciones ni licencias'
do $$
declare ok int := 0;
begin
  begin insert into public.orders (user_id, product_sku, amount_cop, reference, idempotency_key)
        values ('22222222-2222-2222-2222-222222222222', 'luria-mensual', 40000, 'LUR-20261110-ZZZZZZZZZZ', 'hack');
  exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.payments set status = 'approved'; exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.subscriptions set current_period_end = now() + interval '10 years'; exception when insufficient_privilege then ok := ok + 1; end;
  begin update public.licenses set status = 'active'; exception when insufficient_privilege then ok := ok + 1; end;
  begin perform public.fn_apply_payment(gen_random_uuid(), 'wompi', 'x', 1, 'COP', 'approved', null, now());
  exception when insufficient_privilege then ok := ok + 1; end;
  begin insert into public.staff_roles values ('22222222-2222-2222-2222-222222222222', 'admin', null, now());
  exception when insufficient_privilege then ok := ok + 1; end;
  assert ok = 6, format('solo %s de 6 escrituras fueron bloqueadas', ok);
end $$;

\echo '▶ Cliente solo puede editar nombre y teléfono propios'
do $$
declare ok boolean := false; n int;
begin
  update public.profiles set full_name = 'Cliente B Editado' where id = '22222222-2222-2222-2222-222222222222';
  update public.profiles set full_name = 'Hackeado' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'no puede editar perfiles ajenos';
  begin update public.profiles set external_ref = 'usr_x' where id = '22222222-2222-2222-2222-222222222222';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'no puede cambiar su identificador ante la extensión';
end $$;

\echo '▶ Soporte: crea solicitudes propias y no puede autoasignarse estado'
do $$
declare ok boolean := false;
begin
  insert into public.support_requests (user_id, category, description) values ('22222222-2222-2222-2222-222222222222', 'instalacion', 'No encuentro el enlace de instalación');
  begin insert into public.support_requests (user_id, category, description) values ('11111111-1111-1111-1111-111111111111', 'pago', 'Solicitud a nombre de otro');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'no puede crear solicitudes a nombre de otro';
end $$;

\echo '▶ Cancelar renovación (A12): conserva la vigencia'
reset role;
update public.subscriptions set status = 'active', current_period_end = now() + interval '10 days'
 where user_id = '22222222-2222-2222-2222-222222222222';
\o /dev/null
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$
declare v_end timestamptz;
begin
  v_end := public.fn_cancel_renewal();
  assert v_end > now(), 'la vigencia se conserva';
  assert (select cancel_at_period_end from public.subscriptions) ;
  assert (select status from public.subscriptions) = 'active';
end $$;

\echo '▶ Comercial: ve ventas y atribución, no eventos técnicos ni auditoría'
reset role;
\o /dev/null
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$ begin
  assert (select count(*) from public.orders) >= 3, 'comercial ve pedidos';
  assert (select count(*) from public.payments) >= 2, 'comercial ve pagos';
  assert (select count(*) from public.payment_events) = 0, 'comercial no ve eventos técnicos';
  assert (select count(*) from public.audit_log) = 0, 'comercial no ve auditoría';
  assert (select count(*) from public.licenses) = 0, 'comercial no ve licencias';
  assert (select count(*) from public.support_requests) = 0, 'comercial no ve soporte';
end $$;

\echo '▶ Admin: ve auditoría y eventos'
reset role;
\o /dev/null
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  assert (select count(*) from public.audit_log) > 0;
  assert (select count(*) from public.payment_events) > 0;
  assert (select count(*) from public.activation_tasks) > 0;
end $$;

\echo '▶ Anónimo: solo catálogo público'
reset role;
set role anon;
do $$
declare ok boolean := false;
begin
  assert (select count(*) from public.features) = 6;
  assert (select price_cop from public.products where sku = 'luria-mensual') = 40000;
  begin perform 1 from public.orders; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anónimo no puede leer pedidos';
end $$;
reset role;
