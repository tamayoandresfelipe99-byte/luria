-- ═══════════════════════════════════════════════════════════════════
-- LURIA · Migración 0001 · Esquema comercial
-- Base de datos COMERCIAL: no almacena datos académicos, de aprendices,
-- ni contraseñas institucionales. Los importes se guardan en pesos enteros
-- (orders) y en centavos (payments) tal como los reporta el proveedor.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Tipos ──────────────────────────────────────────────────────────
create type public.staff_role as enum ('comercial', 'soporte', 'admin');
create type public.order_status as enum ('pending_payment', 'paid', 'expired', 'cancelled', 'failed', 'refunded');
create type public.payment_status as enum ('pending', 'approved', 'declined', 'voided', 'error', 'refunded', 'reversed');
create type public.subscription_status as enum ('pending_activation', 'active', 'activation_failed', 'expired', 'revoked');
create type public.license_status as enum ('requested', 'active', 'expired', 'revoked', 'failed');
create type public.feature_status as enum ('declarada', 'en_validacion', 'verificada', 'parcial', 'no_disponible');
create type public.compat_status as enum ('verificado', 'en_prueba', 'no_compatible', 'desconocido');
create type public.consent_purpose as enum ('terms', 'privacy', 'marketing', 'analytics');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.task_kind as enum ('activation', 'revocation');
create type public.event_status as enum ('received', 'processed', 'ignored', 'rejected', 'review', 'error');
create type public.support_status as enum ('abierta', 'en_proceso', 'esperando_cliente', 'resuelta', 'cerrada');
create type public.commission_status as enum ('atribuible', 'recibida', 'anulada');

-- ── Usuarios (perfil comercial vinculado a auth.users) ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,15}$'),
  -- Identificador estable ante la extensión (no expone el correo ni el id interno).
  external_ref text not null unique default ('usr_' || encode(gen_random_bytes(12), 'hex')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.staff_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ── Catálogo ───────────────────────────────────────────────────────
create table public.products (
  sku text primary key,
  name text not null,
  price_cop integer not null check (price_cop > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  period_months smallint not null default 1 check (period_months = 1),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.features (
  id text primary key,
  position smallint not null unique,
  name text not null,
  description text not null,
  benefit text not null,
  verification_status public.feature_status not null default 'declarada',
  evidence text,
  verified_version text,
  updated_at timestamptz not null default now(),
  -- No se puede marcar verificada sin evidencia y versión.
  constraint features_verified_needs_evidence check (
    verification_status <> 'verificada' or (evidence is not null and verified_version is not null)
  )
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  domain text,
  version text,
  browser text not null,
  compatibility_status public.compat_status not null default 'desconocido',
  evidence text,
  tested_at timestamptz,
  tested_by uuid references public.profiles (id),
  constraint environments_verified_needs_evidence check (
    compatibility_status <> 'verificado' or (evidence is not null and tested_at is not null)
  )
);

create table public.eligibility_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  platform text not null,
  domain text,
  browser text not null,
  device text not null,
  virtual_only boolean not null,
  result public.compat_status not null,
  created_at timestamptz not null default now()
);
create index eligibility_user_idx on public.eligibility_checks (user_id, created_at desc);

-- ── Consentimientos (solo inserción; manda el registro más reciente) ─
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.consent_purpose not null,
  granted boolean not null,
  channel text not null default 'web',
  notice_version text not null,
  created_at timestamptz not null default now()
);
create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

-- ── Pedidos ────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  product_sku text not null references public.products (sku),
  amount_cop integer not null check (amount_cop > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  reference text not null unique check (reference ~ '^LUR-[0-9]{8}-[A-Z0-9]{10}$'),
  status public.order_status not null default 'pending_payment',
  idempotency_key text not null,
  is_renewal boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
-- Un solo pedido pendiente por cliente (evita pagos duplicados por doble clic).
create unique index orders_one_pending_per_user on public.orders (user_id) where status = 'pending_payment';
create index orders_user_idx on public.orders (user_id, created_at desc);

-- El precio lo define el servidor: el importe debe coincidir con el producto vigente.
create function public.trg_orders_price_guard() returns trigger
language plpgsql as $$
declare v_price integer;
begin
  select price_cop into v_price from public.products where sku = new.product_sku and active;
  if v_price is null then raise exception 'Producto inactivo o inexistente: %', new.product_sku; end if;
  if tg_op = 'INSERT' and new.amount_cop <> v_price then
    raise exception 'El importe del pedido (%) no coincide con el precio vigente (%)', new.amount_cop, v_price;
  end if;
  if tg_op = 'UPDATE' and new.amount_cop <> old.amount_cop then
    raise exception 'El importe de un pedido no puede modificarse';
  end if;
  return new;
end $$;
create trigger orders_price_guard before insert or update on public.orders
  for each row execute function public.trg_orders_price_guard();

-- ── Pagos ──────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('wompi', 'mercadopago', 'payu', 'mock', 'manual')),
  provider_transaction_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  status public.payment_status not null,
  method text,
  discrepancy boolean not null default false,
  manual_evidence jsonb,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id),
  constraint manual_needs_evidence check (provider <> 'manual' or manual_evidence is not null)
);
create index payments_order_idx on public.payments (order_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dedupe_key text not null unique,
  event_type text not null,
  provider_transaction_id text,
  signature_valid boolean not null,
  processing_status public.event_status not null default 'received',
  note text,
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index payment_events_status_idx on public.payment_events (processing_status, received_at desc);

-- ── Suscripciones y vigencias ──────────────────────────────────────
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  status public.subscription_status not null,
  renewal_mode text not null default 'manual' check (renewal_mode in ('manual', 'automatic')),
  anchor_day smallint check (anchor_day between 1 and 31),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_end_idx on public.subscriptions (current_period_end) where status in ('active', 'pending_activation', 'activation_failed');

create table public.subscription_periods (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  subscription_id uuid not null unique references public.subscriptions (id) on delete restrict,
  external_license_id text unique,
  status public.license_status not null default 'requested',
  valid_until timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.activation_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id),
  payment_id uuid not null references public.payments (id),
  subscription_id uuid not null references public.subscriptions (id),
  kind public.task_kind not null,
  status public.task_status not null default 'open',
  attempts integer not null default 1,
  assigned_to uuid references public.profiles (id),
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  due_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (payment_id, kind)
);
create index activation_tasks_open_idx on public.activation_tasks (status, due_at) where status in ('open', 'in_progress');

-- ── Soporte ────────────────────────────────────────────────────────
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('compra', 'instalacion', 'compatibilidad', 'pago', 'renovacion', 'tecnica', 'otra')),
  description text not null check (char_length(description) between 10 and 2000),
  status public.support_status not null default 'abierta',
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_user_idx on public.support_requests (user_id, created_at desc);

-- ── Comercial: atribución, referidos, comisiones ───────────────────
create table public.referrers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,30}$'),
  display_name text not null,
  authorized boolean not null default false,
  commission_pct numeric(5, 2) check (commission_pct between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.attribution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'referido', 'organico', 'redes', 'directo', 'otro')),
  campaign text,
  referrer_id uuid references public.referrers (id),
  rule text not null default 'primer_toque',
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id),
  referrer_id uuid not null references public.referrers (id),
  amount_cop integer not null check (amount_cop >= 0),
  status public.commission_status not null default 'atribuible',
  received_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Analítica (separada de los registros financieros; sin datos personales) ─
create table public.analytics_events (
  id bigint generated always as identity primary key,
  anon_id text not null check (anon_id ~ '^[a-f0-9-]{36}$'),
  event text not null check (event in (
    'page_view', 'pricing_view', 'compat_check', 'signup_start', 'signup_done',
    'checkout_start', 'payment_verified', 'activation_done', 'renewal_done', 'cancellation'
  )),
  path text check (path is null or (path !~ '@' and char_length(path) <= 200)),
  channel text,
  created_at timestamptz not null default now()
);

-- ── Auditoría (inmutable) ──────────────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text not null,
  action text not null,
  object_type text not null,
  object_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_object_idx on public.audit_log (object_type, object_id, created_at desc);

create function public.trg_audit_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log es de solo inserción';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.trg_audit_immutable();

-- ── updated_at automático ──────────────────────────────────────────
create function public.trg_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['profiles','orders','payments','subscriptions','licenses','activation_tasks','support_requests','products','features']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.trg_touch_updated_at()', t, t);
  end loop;
end $$;

-- ── Perfil automático al registrarse ───────────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Sin nombre'),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
