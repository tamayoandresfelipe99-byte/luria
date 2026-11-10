-- ═══════════════════════════════════════════════════════════════════
-- LURIA · Migración 0003 · Funciones transaccionales
-- Autoridad de los cambios de estado de pedido / pago / suscripción / licencia.
-- Idempotentes y seguras ante eventos duplicados o fuera de orden.
-- ═══════════════════════════════════════════════════════════════════

-- ── Fechas: regla de aniversario mensual en America/Bogota ─────────
create function public.fn_add_months_anchored(p_date date, p_months int, p_anchor int)
returns date language sql immutable as $$
  select make_date(
    extract(year from t)::int,
    extract(month from t)::int,
    least(p_anchor, extract(day from (t + interval '1 month' - interval '1 day'))::int)
  )
  from (select date_trunc('month', p_date::timestamp) + make_interval(months => p_months) as t) s
$$;

create function public.fn_end_of_bogota_day(p_date date)
returns timestamptz language sql immutable as $$
  select (p_date + time '23:59:59.999') at time zone 'America/Bogota'
$$;

create function public.fn_next_period(p_paid_at timestamptz, p_current_end timestamptz, p_anchor int)
returns table (o_start timestamptz, o_end timestamptz, o_anchor int, o_continuation boolean)
language plpgsql stable as $$
declare v_local date;
begin
  if p_current_end is not null and p_anchor is not null and p_paid_at <= p_current_end then
    v_local := (p_current_end at time zone 'America/Bogota')::date;
    return query select p_current_end + interval '1 millisecond',
      public.fn_end_of_bogota_day(public.fn_add_months_anchored(v_local, 1, p_anchor)), p_anchor, true;
  else
    v_local := (p_paid_at at time zone 'America/Bogota')::date;
    return query select p_paid_at,
      public.fn_end_of_bogota_day(public.fn_add_months_anchored(v_local, 1, extract(day from v_local)::int)),
      extract(day from v_local)::int, false;
  end if;
end $$;

-- ── Transiciones de pago ───────────────────────────────────────────
create function public.fn_payment_rank(s public.payment_status)
returns int language sql immutable as $$
  select case s when 'pending' then 0 when 'refunded' then 2 when 'reversed' then 2 else 1 end
$$;

create function public.fn_decide_payment(p_current public.payment_status, p_incoming public.payment_status)
returns text language sql immutable as $$
  select case
    when p_current is null then 'apply'
    when p_current = p_incoming then 'noop'
    when public.fn_payment_rank(p_incoming) < public.fn_payment_rank(p_current) then 'noop'
    when public.fn_payment_rank(p_incoming) = public.fn_payment_rank(p_current) then 'conflict'
    when public.fn_payment_rank(p_incoming) = 2 and p_current <> 'approved' then 'conflict'
    else 'apply'
  end
$$;

-- ── Eventos de pago (deduplicación) ────────────────────────────────
create function public.fn_record_event(
  p_provider text, p_dedupe_key text, p_event_type text, p_tx_id text, p_signature_valid boolean
) returns table (event_id uuid, duplicate boolean, previous_status public.event_status)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  insert into public.payment_events as e (provider, dedupe_key, event_type, provider_transaction_id, signature_valid)
  values (p_provider, p_dedupe_key, p_event_type, p_tx_id, p_signature_valid)
  on conflict (dedupe_key) do update set attempts = e.attempts + 1
  returning e.id, (e.xmax <> 0), e.processing_status;
end $$;

create function public.fn_finish_event(p_event_id uuid, p_status public.event_status, p_note text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.payment_events set processing_status = p_status, note = left(p_note, 500), processed_at = now()
  where id = p_event_id
$$;

-- ── Pedidos: el precio sale de `products`, nunca del navegador ─────
create function public.fn_create_order(p_user uuid, p_idempotency_key text)
returns public.orders
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_product public.products;
begin
  select * into v_order from public.orders where user_id = p_user and idempotency_key = p_idempotency_key;
  if found then return v_order; end if;

  update public.orders set status = 'expired'
   where user_id = p_user and status = 'pending_payment' and expires_at <= now();

  select * into v_order from public.orders where user_id = p_user and status = 'pending_payment';
  if found then return v_order; end if;

  select * into v_product from public.products where sku = 'luria-mensual' and active;
  if not found then raise exception 'Producto no disponible'; end if;

  insert into public.orders (user_id, product_sku, amount_cop, currency, reference, idempotency_key, is_renewal)
  values (
    p_user, v_product.sku, v_product.price_cop, v_product.currency,
    'LUR-' || to_char(now() at time zone 'America/Bogota', 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
    p_idempotency_key,
    exists (select 1 from public.subscriptions where user_id = p_user)
  ) returning * into v_order;

  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id)
  values (p_user, 'cliente', 'order.created', 'order', v_order.id::text);
  return v_order;
end $$;

-- ── Aplicar un pago verificado (núcleo transaccional) ──────────────
create function public.fn_apply_payment(
  p_order_id uuid,
  p_provider text,
  p_tx_id text,
  p_amount_cents bigint,
  p_currency text,
  p_status public.payment_status,
  p_method text,
  p_paid_at timestamptz,
  p_manual_evidence jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders;
  p public.payments;
  s public.subscriptions;
  per record;
  v_period public.subscription_periods;
  v_lic public.licenses;
  v_decision text;
  v_continuing boolean;
  v_ref uuid;
  v_pct numeric;
  v_result jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;

  select * into p from public.payments
   where provider = p_provider and provider_transaction_id = p_tx_id for update;

  -- A04: importe o moneda distintos → registrar discrepancia, no habilitar nada.
  if p_amount_cents <> o.amount_cop::bigint * 100 or p_currency <> o.currency then
    if p.id is null then
      insert into public.payments (order_id, provider, provider_transaction_id, amount_cents, currency, status, method, discrepancy, verified_at, manual_evidence)
      values (o.id, p_provider, p_tx_id, p_amount_cents, p_currency, p_status, p_method, true, now(), p_manual_evidence)
      returning * into p;
    else
      update public.payments set discrepancy = true where id = p.id returning * into p;
    end if;
    insert into public.audit_log (actor_role, action, object_type, object_id, metadata)
    values ('sistema', 'payment.amount_mismatch', 'payment', p.id::text,
            jsonb_build_object('expected_cents', o.amount_cop::bigint * 100, 'received_cents', p_amount_cents, 'currency', p_currency));
    return jsonb_build_object('outcome', 'amount_mismatch', 'payment_id', p.id, 'payment_status', p.status);
  end if;

  v_decision := public.fn_decide_payment(p.status, p_status);
  if v_decision <> 'apply' then
    return jsonb_build_object('outcome', v_decision, 'payment_id', p.id, 'payment_status', p.status);
  end if;

  if p.id is null then
    insert into public.payments (order_id, provider, provider_transaction_id, amount_cents, currency, status, method, verified_at, manual_evidence)
    values (o.id, p_provider, p_tx_id, p_amount_cents, p_currency, p_status, p_method, now(), p_manual_evidence)
    returning * into p;
  else
    update public.payments set status = p_status, method = coalesce(p_method, method), verified_at = now()
     where id = p.id returning * into p;
  end if;

  update public.orders set
    status = case p_status
      when 'approved' then 'paid'::public.order_status
      when 'pending' then 'pending_payment'::public.order_status
      when 'refunded' then 'refunded'::public.order_status
      when 'reversed' then 'refunded'::public.order_status
      else 'failed'::public.order_status end,
    paid_at = case when p_status = 'approved' then p_paid_at else paid_at end
  where id = o.id;

  insert into public.audit_log (actor_role, action, object_type, object_id, metadata)
  values ('sistema', 'payment.' || p_status, 'payment', p.id::text, jsonb_build_object('provider', p_provider, 'order', o.reference));

  v_result := jsonb_build_object('outcome', 'applied', 'payment_id', p.id, 'payment_status', p.status);

  -- Pago aprobado → una (y solo una) vigencia por pago.
  if p_status = 'approved' and not exists (select 1 from public.subscription_periods where payment_id = p.id) then
    select * into s from public.subscriptions where user_id = o.user_id for update;
    if not found then
      insert into public.subscriptions (user_id, status) values (o.user_id, 'pending_activation') returning * into s;
    end if;
    v_continuing := s.status not in ('revoked', 'expired');
    select * into per from public.fn_next_period(
      p_paid_at,
      case when v_continuing then s.current_period_end end,
      case when v_continuing then s.anchor_day::int end
    );
    insert into public.subscription_periods (subscription_id, payment_id, period_start, period_end)
    values (s.id, p.id, per.o_start, per.o_end);
    update public.subscriptions set
      current_period_start = case when per.o_continuation then current_period_start else per.o_start end,
      current_period_end = per.o_end,
      anchor_day = per.o_anchor,
      cancel_at_period_end = false,
      canceled_at = null,
      status = case when status = 'active' then 'active'::public.subscription_status else 'pending_activation'::public.subscription_status end
    where id = s.id returning * into s;
    insert into public.licenses (user_id, subscription_id) values (o.user_id, s.id) on conflict (subscription_id) do nothing;

    select a.referrer_id, r.commission_pct into v_ref, v_pct
      from public.attribution a join public.referrers r on r.id = a.referrer_id and r.authorized
     where a.user_id = o.user_id;
    if v_ref is not null then
      insert into public.commissions (payment_id, referrer_id, amount_cop)
      values (p.id, v_ref, floor(o.amount_cop * coalesce(v_pct, 0) / 100))
      on conflict (payment_id) do nothing;
    end if;

    v_result := v_result || jsonb_build_object('period', jsonb_build_object(
      'subscription_id', s.id, 'user_id', s.user_id, 'period_end', per.o_end, 'subscription_status', s.status));
  end if;

  -- Reembolso o reversión confirmados → revocar y anular comisión.
  if p_status in ('refunded', 'reversed') then
    select * into v_period from public.subscription_periods where payment_id = p.id for update;
    if found and not v_period.refunded then
      update public.subscription_periods set refunded = true where id = v_period.id;
      update public.subscriptions set status = 'revoked' where id = v_period.subscription_id;
      update public.commissions set status = 'anulada' where payment_id = p.id;
      select * into v_lic from public.licenses where subscription_id = v_period.subscription_id;
      v_result := v_result || jsonb_build_object('revoke', jsonb_build_object(
        'subscription_id', v_period.subscription_id, 'external_license_id', v_lic.external_license_id));
    end if;
  end if;

  return v_result;
end $$;

-- ── Licencias y tareas de activación ───────────────────────────────
create function public.fn_mark_license_active(p_subscription_id uuid, p_external_license_id text, p_valid_until timestamptz, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.licenses set status = 'active', external_license_id = p_external_license_id,
         valid_until = p_valid_until, last_synced_at = now()
   where subscription_id = p_subscription_id;
  update public.subscriptions set status = 'active' where id = p_subscription_id and status <> 'revoked';
  update public.activation_tasks set status = 'done', resolved_at = now()
   where subscription_id = p_subscription_id and kind = 'activation' and status in ('open', 'in_progress');
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, metadata)
  values (p_actor, case when p_actor is null then 'sistema' else 'admin' end, 'license.activated', 'subscription',
          p_subscription_id::text, jsonb_build_object('valid_until', p_valid_until));
end $$;

create function public.fn_mark_license_revoked(p_subscription_id uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.licenses set status = 'revoked', last_synced_at = now() where subscription_id = p_subscription_id;
  update public.activation_tasks set status = 'done', resolved_at = now()
   where subscription_id = p_subscription_id and kind = 'revocation' and status in ('open', 'in_progress');
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id)
  values (p_actor, case when p_actor is null then 'sistema' else 'admin' end, 'license.revoked', 'subscription', p_subscription_id::text);
end $$;

create function public.fn_upsert_activation_task(
  p_payment_id uuid, p_subscription_id uuid, p_kind public.task_kind, p_error_code text, p_error_message text, p_sla_hours int
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.activation_tasks as t (order_id, payment_id, subscription_id, kind, error_code, error_message, due_at)
  values ((select order_id from public.payments where id = p_payment_id), p_payment_id, p_subscription_id, p_kind,
          p_error_code, left(p_error_message, 500), now() + make_interval(hours => coalesce(p_sla_hours, 24)))
  on conflict (payment_id, kind) do update set
    attempts = t.attempts + 1, error_code = excluded.error_code, error_message = excluded.error_message,
    status = case when t.status = 'done' then t.status else 'open'::public.task_status end
  returning t.id into v_id;

  if p_kind = 'activation' and p_error_code not in ('LICENSE_ADAPTER_PENDING', 'MANUAL_ACTION_REQUIRED') then
    update public.subscriptions set status = 'activation_failed'
     where id = p_subscription_id and status = 'pending_activation';
  end if;
  insert into public.audit_log (actor_role, action, object_type, object_id, metadata)
  values ('sistema', 'task.' || p_kind || '.opened', 'activation_task', v_id::text, jsonb_build_object('code', p_error_code));
  return v_id;
end $$;

-- ── Pago manual con evidencia (transición desde Nequi manual) ──────
create function public.fn_register_manual_payment(
  p_actor uuid, p_order_reference text, p_method text, p_external_ref text,
  p_amount_cop int, p_paid_at timestamptz, p_evidence_note text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders;
  v_result jsonb;
begin
  if not exists (select 1 from public.staff_roles where user_id = p_actor and role = 'admin') then
    raise exception 'Solo un administrador puede registrar pagos manuales';
  end if;
  if p_evidence_note is null or char_length(trim(p_evidence_note)) < 10 then
    raise exception 'Se requiere evidencia del pago (mínimo 10 caracteres)';
  end if;
  if p_external_ref is null or char_length(trim(p_external_ref)) < 4 then
    raise exception 'Se requiere la referencia de la transacción en el medio de pago';
  end if;
  if p_paid_at > now() then raise exception 'La fecha de pago no puede ser futura'; end if;
  select * into o from public.orders where reference = p_order_reference;
  if not found then raise exception 'Pedido inexistente'; end if;
  if o.status <> 'pending_payment' then raise exception 'El pedido no está pendiente de pago'; end if;

  -- La referencia externa es única: el mismo comprobante no puede usarse dos veces.
  v_result := public.fn_apply_payment(
    o.id, 'manual', lower(p_method) || ':' || upper(trim(p_external_ref)), p_amount_cop::bigint * 100, 'COP',
    'approved', p_method, p_paid_at,
    jsonb_build_object('note', p_evidence_note, 'registered_by', p_actor, 'registered_at', now(), 'external_ref', p_external_ref)
  );
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, reason, metadata)
  values (p_actor, 'admin', 'payment.manual_registered', 'order', o.id::text, p_evidence_note, v_result);
  return v_result;
end $$;

-- ── Cliente: cancelar o reanudar renovaciones futuras ──────────────
create function public.fn_cancel_renewal() returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_end timestamptz;
begin
  update public.subscriptions set cancel_at_period_end = true, canceled_at = now()
   where user_id = auth.uid() and status in ('active', 'pending_activation', 'activation_failed')
  returning current_period_end into v_end;
  if v_end is null then raise exception 'No hay una suscripción vigente para cancelar'; end if;
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id)
  values (auth.uid(), 'cliente', 'subscription.cancel_at_period_end', 'user', auth.uid()::text);
  return v_end;
end $$;

create function public.fn_resume_renewal() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.subscriptions set cancel_at_period_end = false, canceled_at = null
   where user_id = auth.uid() and current_period_end > now() and status <> 'revoked';
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id)
  values (auth.uid(), 'cliente', 'subscription.resume', 'user', auth.uid()::text);
end $$;

-- ── Vencimientos (tarea programada diaria) ─────────────────────────
create function public.fn_expire_due(p_now timestamptz default now())
returns table (subscription_id uuid, external_license_id text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.orders set status = 'expired' where status = 'pending_payment' and expires_at <= p_now;
  return query
  with exp as (
    update public.subscriptions s set status = 'expired'
     where s.status in ('active', 'pending_activation', 'activation_failed') and s.current_period_end <= p_now
    returning s.id
  )
  update public.licenses l set status = 'expired', last_synced_at = p_now
    from exp where l.subscription_id = exp.id and l.status in ('active', 'requested')
  returning l.subscription_id, l.external_license_id;
end $$;

-- ── Privilegios de ejecución ───────────────────────────────────────
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_role(public.staff_role), public.is_staff() to authenticated;
grant execute on function public.fn_cancel_renewal(), public.fn_resume_renewal() to authenticated;
grant execute on all functions in schema public to service_role;
