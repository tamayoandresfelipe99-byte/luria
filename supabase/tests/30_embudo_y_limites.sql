-- Embudo: activation_done y renewal_done emitidos por la base de datos (migración 20261111000200).
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'cliente.embudo@prueba.invalid', '{"full_name":"Cliente Embudo"}');

\echo '▶ A08 embudo · activation_done una sola vez y renewal_done por cada renovación'
do $$
declare
  u constant uuid := '55555555-5555-5555-5555-555555555555';
  o public.orders; s public.subscriptions; r jsonb;
  act0 int; ren0 int;
begin
  act0 := (select count(*) from public.analytics_events where event = 'activation_done');
  ren0 := (select count(*) from public.analytics_events where event = 'renewal_done');

  -- Primera compra: vigencia nueva, sin renovación.
  o := public.fn_create_order(u, 'embudo-1');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-embudo-1', 4000000, 'COP', 'approved', 'CARD', '2026-11-10 15:00:00+00');
  assert (select count(*) from public.analytics_events where event = 'renewal_done') = ren0, 'la primera compra no es renovación';
  select * into s from public.subscriptions where user_id = u;

  -- Primera activación → un evento; reactivar (reintento del adaptador) no duplica.
  perform public.fn_mark_license_active(s.id, 'lic-embudo', s.current_period_end);
  perform public.fn_mark_license_active(s.id, 'lic-embudo', s.current_period_end);
  assert (select count(*) from public.analytics_events where event = 'activation_done') = act0 + 1, 'activation_done una vez';

  -- Renovación pagada → renewal_done; el evento duplicado de la pasarela no lo repite.
  o := public.fn_create_order(u, 'embudo-2');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-embudo-2', 4000000, 'COP', 'approved', 'CARD', '2026-12-05 15:00:00+00');
  r := public.fn_apply_payment(o.id, 'wompi', 'tx-embudo-2', 4000000, 'COP', 'approved', 'CARD', '2026-12-05 15:00:00+00');
  assert (select count(*) from public.analytics_events where event = 'renewal_done') = ren0 + 1, 'renewal_done una vez por renovación';
  perform public.fn_mark_license_active(s.id, 'lic-embudo', (select current_period_end from public.subscriptions where id = s.id));
  assert (select count(*) from public.analytics_events where event = 'activation_done') = act0 + 1, 'la renovación no es una nueva activación';

  -- Sin datos personales.
  assert not exists (select 1 from public.analytics_events where event in ('activation_done', 'renewal_done') and (path is not null or channel is not null));
end $$;

\echo '▶ Límite de solicitudes compartido: ventana fija, reinicio y limpieza'
do $$
declare k constant text := repeat('a', 64); ok boolean;
begin
  for i in 1..3 loop
    ok := public.fn_rate_limit_hit(k, 3, 60);
    assert ok, 'los primeros 3 intentos pasan';
  end loop;
  assert not public.fn_rate_limit_hit(k, 3, 60), 'el 4.º intento se bloquea';
  -- Ventana vencida → se reinicia el contador.
  update public.rate_limits set window_start = now() - interval '2 minutes' where key_hash = k;
  assert public.fn_rate_limit_hit(k, 3, 60), 'tras la ventana vuelve a permitir';
  assert (select hits from public.rate_limits where key_hash = k) = 1;
  -- La clave debe ser un SHA-256 (sin datos personales en claro).
  begin
    perform public.fn_rate_limit_hit('cliente@correo.com', 3, 60);
    raise exception 'debía fallar';
  exception when check_violation then null;
  end;
  update public.rate_limits set window_start = now() - interval '2 days' where key_hash = k;
  assert public.fn_rate_limit_cleanup() = 1, 'limpia claves inactivas';
end $$;

\echo '▶ Límite de solicitudes: clientes no pueden leer ni llamar'
set role authenticated;
do $$ begin
  begin
    perform 1 from public.rate_limits;
    raise exception 'debía fallar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fn_rate_limit_hit(repeat('b', 64), 1, 60);
    raise exception 'debía fallar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
