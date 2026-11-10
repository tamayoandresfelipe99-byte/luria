-- ═══════════════════════════════════════════════════════════════════
-- LURIA · Migración 0002 · Control de acceso (RLS + privilegios)
-- Principio: mínimo privilegio. Los clientes solo LEEN lo suyo.
-- Toda escritura financiera (pedidos, pagos, suscripciones, licencias)
-- ocurre en el servidor mediante funciones SECURITY DEFINER o service_role.
-- ═══════════════════════════════════════════════════════════════════

-- Ayudantes de rol (SECURITY DEFINER para no exponer staff_roles).
create function public.has_role(r public.staff_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = r)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid())
$$;

-- Quitar privilegios por defecto y otorgar solo lo necesario.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function public.has_role(public.staff_role), public.is_staff() to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ── Catálogo público ───────────────────────────────────────────────
grant select on public.products, public.features, public.environments to anon, authenticated;
create policy products_public on public.products for select using (active);
create policy features_public on public.features for select using (true);
create policy environments_public on public.environments for select using (true);
grant update on public.features, public.environments, public.products to authenticated;
create policy features_admin on public.features for update using (public.has_role('admin')) with check (public.has_role('admin'));
create policy environments_admin on public.environments for update using (public.has_role('admin')) with check (public.has_role('admin'));
create policy products_admin on public.products for update using (public.has_role('admin')) with check (public.has_role('admin'));

-- ── Perfiles ───────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_own_read on public.profiles for select using (id = auth.uid());
create policy profiles_staff_read on public.profiles for select using (public.is_staff());
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

grant select on public.staff_roles to authenticated;
create policy staff_roles_own on public.staff_roles for select using (user_id = auth.uid() or public.has_role('admin'));

-- ── Pedidos, pagos, suscripciones, licencias: el cliente solo ve lo propio ─
grant select on public.orders, public.payments, public.subscriptions, public.subscription_periods, public.licenses to authenticated;

create policy orders_own on public.orders for select using (user_id = auth.uid());
create policy orders_staff on public.orders for select using (public.has_role('admin') or public.has_role('comercial') or public.has_role('soporte'));

create policy payments_own on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy payments_staff on public.payments for select using (public.has_role('admin') or public.has_role('comercial'));

create policy subs_own on public.subscriptions for select using (user_id = auth.uid());
create policy subs_staff on public.subscriptions for select using (public.is_staff());

create policy periods_own on public.subscription_periods for select
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and s.user_id = auth.uid()));
create policy periods_staff on public.subscription_periods for select using (public.is_staff());

create policy licenses_own on public.licenses for select using (user_id = auth.uid());
create policy licenses_ops on public.licenses for select using (public.has_role('admin') or public.has_role('soporte'));

-- ── Operación interna ──────────────────────────────────────────────
grant select on public.payment_events, public.activation_tasks, public.audit_log to authenticated;
create policy events_admin on public.payment_events for select using (public.has_role('admin'));
create policy tasks_ops on public.activation_tasks for select using (public.has_role('admin') or public.has_role('soporte'));
create policy audit_admin on public.audit_log for select using (public.has_role('admin'));

-- ── Soporte ────────────────────────────────────────────────────────
grant select, insert on public.support_requests to authenticated;
grant update (status, assigned_to) on public.support_requests to authenticated;
create policy support_own_read on public.support_requests for select using (user_id = auth.uid());
create policy support_own_insert on public.support_requests for insert with check (user_id = auth.uid() and status = 'abierta' and assigned_to is null);
create policy support_staff_read on public.support_requests for select using (public.has_role('soporte') or public.has_role('admin'));
create policy support_staff_update on public.support_requests for update
  using (public.has_role('soporte') or public.has_role('admin'))
  with check (public.has_role('soporte') or public.has_role('admin'));

-- ── Consentimientos ────────────────────────────────────────────────
grant select, insert on public.consents to authenticated;
create policy consents_own_read on public.consents for select using (user_id = auth.uid());
create policy consents_own_insert on public.consents for insert with check (user_id = auth.uid());
create policy consents_admin on public.consents for select using (public.has_role('admin'));

-- ── Elegibilidad ───────────────────────────────────────────────────
grant select on public.eligibility_checks to authenticated;
create policy elig_own on public.eligibility_checks for select using (user_id = auth.uid());
create policy elig_staff on public.eligibility_checks for select using (public.has_role('admin') or public.has_role('comercial'));

-- ── Comercial ──────────────────────────────────────────────────────
grant select on public.referrers, public.attribution, public.commissions to authenticated;
create policy referrers_com on public.referrers for select using (public.has_role('comercial') or public.has_role('admin'));
create policy attribution_com on public.attribution for select using (public.has_role('comercial') or public.has_role('admin'));
create policy commissions_com on public.commissions for select using (public.has_role('comercial') or public.has_role('admin'));

-- ── Analítica: lectura agregada para comercial/admin; escritura solo servidor ─
grant select on public.analytics_events to authenticated;
create policy analytics_read on public.analytics_events for select using (public.has_role('comercial') or public.has_role('admin'));
