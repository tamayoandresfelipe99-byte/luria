-- ═══════════════════════════════════════════════════════════════════
-- LURIA · Migración 0008 · Separación entre pago y entrega del acceso
--
-- Dos procesos independientes y coordinados:
--   A. Estado de pago (calculado): pendiente_pago · en_verificacion · al_dia · por_vencer (≤ 7 días) · vencido
--   B. Estado de acceso (gestionado por un administrador): pendiente · enlace_guardado · habilitado · suspendido · revocado
-- Un pago confirmado NO habilita el acceso; un enlace guardado NO se publica.
-- El cliente nunca lee la tabla de accesos: solo `fn_my_access()`, que entrega el enlace
-- únicamente si el acceso está habilitado Y la suscripción está vigente.
-- ═══════════════════════════════════════════════════════════════════

create type public.access_status as enum ('pendiente', 'enlace_guardado', 'habilitado', 'suspendido', 'revocado');

create table public.access_grants (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.access_status not null default 'pendiente',
  link_url text check (link_url is null or (char_length(link_url) <= 2048 and link_url ~ '^https://[^[:space:]<>"''`]+$')),
  link_saved_by uuid references public.profiles (id),
  link_saved_at timestamptz,
  enabled_by uuid references public.profiles (id),
  enabled_at timestamptz,
  status_changed_by uuid references public.profiles (id),
  status_changed_at timestamptz not null default now(),
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enabled_needs_link check (status <> 'habilitado' or link_url is not null)
);
create index access_grants_status_idx on public.access_grants (status);
create trigger access_grants_touch before update on public.access_grants
  for each row execute function public.trg_touch_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('access_enabled', 'access_link_updated', 'access_suspended', 'access_revoked')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ── RLS y privilegios ──────────────────────────────────────────────
alter table public.access_grants enable row level security;
alter table public.access_grants force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on public.access_grants, public.notifications from public, anon, authenticated;

-- Accesos: solo el personal de operación lee la tabla (los clientes, 0 filas). Escritura: solo funciones.
grant select on public.access_grants to authenticated;
create policy access_ops_read on public.access_grants for select using (public.has_role('admin') or public.has_role('soporte'));

-- Notificaciones: cada cliente lee las suyas y solo puede marcarlas como leídas.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_own_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Estado de pago (A) ─────────────────────────────────────────────
create function public.fn_payment_state(p_user uuid, p_now timestamptz default now()) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.subscriptions;
  v_has_sub boolean;
  v_pending boolean;
begin
  select * into s from public.subscriptions where user_id = p_user;
  v_has_sub := found;
  if v_has_sub and s.status not in ('revoked', 'expired') and s.current_period_end > p_now then
    return case when s.current_period_end > p_now + interval '7 days' then 'al_dia' else 'por_vencer' end;
  end if;
  -- Último pago del cliente: en curso o con discrepancia de importe → en verificación.
  select (p.status = 'pending' or p.discrepancy) into v_pending
    from public.payments p join public.orders o on o.id = p.order_id
   where o.user_id = p_user order by p.created_at desc limit 1;
  if coalesce(v_pending, false) then return 'en_verificacion'; end if;
  if v_has_sub and s.current_period_end is not null and s.status <> 'revoked' then return 'vencido'; end if;
  return 'pendiente_pago';
end $$;

create function public.fn_subscription_current(p_user uuid, p_now timestamptz default now()) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.subscriptions
     where user_id = p_user and status not in ('revoked', 'expired') and current_period_end > p_now
  )
$$;

-- Verificación de rol dentro de cada función: no basta con ocultar botones ni con la API.
create function public.fn_require_admin() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Solo un administrador puede gestionar accesos' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

-- Huella del enlace para la auditoría: se registra el dominio y un resumen, no la URL completa.
create function public.fn_link_fingerprint(p_url text) returns jsonb
language sql immutable set search_path = public, extensions, pg_temp as $$
  select case when p_url is null then null else jsonb_build_object(
    'host', substring(p_url from '^https://([^/?#]+)'),
    'sha256', encode(digest(p_url, 'sha256'), 'hex')
  ) end
$$;

-- ── Acciones administrativas (B) ───────────────────────────────────
create function public.fn_access_save_link(p_user uuid, p_url text) returns public.access_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.fn_require_admin();
  g public.access_grants;
  v_url text := btrim(p_url);
begin
  if v_url is null or v_url !~ '^https://[^[:space:]<>"''`]+$' or char_length(v_url) > 2048 then
    raise exception 'El enlace debe empezar por https:// y no contener espacios' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Cliente inexistente' using errcode = '22023';
  end if;
  insert into public.access_grants (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into g from public.access_grants where user_id = p_user for update;
  -- Si ya estaba habilitado, se sustituye el enlace y sigue habilitado; en otro caso queda guardado, no publicado.
  update public.access_grants set
    link_url = v_url, link_saved_by = v_actor, link_saved_at = now(),
    status = case when g.status = 'habilitado' then 'habilitado'::public.access_status else 'enlace_guardado'::public.access_status end,
    status_changed_by = case when g.status = 'habilitado' then status_changed_by else v_actor end,
    status_changed_at = case when g.status = 'habilitado' then status_changed_at else now() end,
    status_reason = case when g.status = 'habilitado' then status_reason else null end
  where user_id = p_user returning * into g;
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, metadata)
  values (v_actor, 'admin', 'access.link_saved', 'user', p_user::text,
          jsonb_build_object('status', g.status, 'link', public.fn_link_fingerprint(v_url)));
  if g.status = 'habilitado' then
    insert into public.notifications (user_id, kind, title, body)
    values (p_user, 'access_link_updated', 'Tu enlace de acceso a LURIA se actualizó',
            'Usa el botón «Acceder a LURIA» de tu cuenta para entrar con el enlace nuevo.');
  end if;
  return g.status;
end $$;

create function public.fn_access_enable(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.fn_require_admin();
  g public.access_grants;
begin
  select * into g from public.access_grants where user_id = p_user for update;
  if not found or g.link_url is null then
    raise exception 'Primero guarda el enlace del cliente' using errcode = '22023';
  end if;
  if g.status = 'habilitado' then raise exception 'El acceso ya está habilitado' using errcode = '22023'; end if;
  if g.status not in ('enlace_guardado', 'suspendido') then
    raise exception 'Guarda de nuevo el enlace antes de habilitar un acceso revocado' using errcode = '22023';
  end if;
  if not public.fn_subscription_current(p_user) then
    raise exception 'La suscripción del cliente no está vigente: no se puede habilitar el acceso' using errcode = '22023';
  end if;
  update public.access_grants set
    status = 'habilitado', enabled_by = v_actor, enabled_at = now(),
    status_changed_by = v_actor, status_changed_at = now(), status_reason = null
  where user_id = p_user;
  insert into public.notifications (user_id, kind, title, body)
  values (p_user, 'access_enabled', 'Tu acceso a LURIA está habilitado',
          'Ya puedes utilizar LURIA. Encuentra el botón «Acceder a LURIA» en tu cuenta.');
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, metadata)
  values (v_actor, 'admin', 'access.enabled', 'user', p_user::text, jsonb_build_object('link', public.fn_link_fingerprint(g.link_url)));
end $$;

create function public.fn_access_revoke(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.fn_require_admin();
  g public.access_grants;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'Indica el motivo de la revocación (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into g from public.access_grants where user_id = p_user for update;
  if not found or g.status in ('pendiente', 'revocado') then
    raise exception 'No hay un acceso que revocar' using errcode = '22023';
  end if;
  update public.access_grants set status = 'revocado', status_changed_by = v_actor, status_changed_at = now(),
         status_reason = left(btrim(p_reason), 500)
   where user_id = p_user;
  if g.status in ('habilitado', 'suspendido') then
    insert into public.notifications (user_id, kind, title, body)
    values (p_user, 'access_revoked', 'Tu acceso a LURIA fue retirado',
            'Si crees que se trata de un error, escríbenos desde la sección de soporte.');
  end if;
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, reason, metadata)
  values (v_actor, 'admin', 'access.revoked', 'user', p_user::text, left(btrim(p_reason), 500), jsonb_build_object('previous', g.status));
end $$;

-- ── Coordinación automática con la suscripción ─────────────────────
-- Vencimiento → acceso suspendido. Reembolso o reversión → acceso revocado. La reactivación siempre es manual.
create function public.trg_access_follow_subscription() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.access_grants;
begin
  if new.status is not distinct from old.status or new.status not in ('expired', 'revoked') then return new; end if;
  select * into g from public.access_grants where user_id = new.user_id for update;
  if not found or g.status in ('pendiente', 'revocado') then return new; end if;
  if new.status = 'expired' and g.status = 'habilitado' then
    update public.access_grants set status = 'suspendido', status_changed_by = null, status_changed_at = now(),
           status_reason = 'Suscripción vencida' where user_id = new.user_id;
    insert into public.notifications (user_id, kind, title, body)
    values (new.user_id, 'access_suspended', 'Tu acceso a LURIA está suspendido',
            'Tu suscripción venció. Renueva tu plan para continuar utilizando LURIA.');
    insert into public.audit_log (actor_role, action, object_type, object_id, reason)
    values ('sistema', 'access.suspended', 'user', new.user_id::text, 'Suscripción vencida');
  elsif new.status = 'revoked' then
    update public.access_grants set status = 'revocado', status_changed_by = null, status_changed_at = now(),
           status_reason = 'Pago reembolsado o reversado' where user_id = new.user_id;
    if g.status in ('habilitado', 'suspendido') then
      insert into public.notifications (user_id, kind, title, body)
      values (new.user_id, 'access_revoked', 'Tu acceso a LURIA fue retirado',
              'El pago de tu suscripción fue reembolsado o reversado.');
    end if;
    insert into public.audit_log (actor_role, action, object_type, object_id, reason)
    values ('sistema', 'access.revoked', 'user', new.user_id::text, 'Pago reembolsado o reversado');
  end if;
  return new;
end $$;
create trigger subscriptions_access_follow after update of status on public.subscriptions
  for each row execute function public.trg_access_follow_subscription();

-- ── Lecturas ───────────────────────────────────────────────────────
-- Cliente: su propio estado. El enlace solo viaja si el acceso está habilitado y la suscripción vigente.
create function public.fn_my_access()
returns table (payment_state text, period_end timestamptz, access_status public.access_status, link_url text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  g public.access_grants;
  v_current boolean;
begin
  if v_uid is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  select * into g from public.access_grants where user_id = v_uid;
  v_current := public.fn_subscription_current(v_uid);
  return query select
    public.fn_payment_state(v_uid),
    (select s.current_period_end from public.subscriptions s where s.user_id = v_uid),
    case
      when g.user_id is null then 'pendiente'::public.access_status
      when g.status = 'habilitado' and not v_current then 'suspendido'::public.access_status
      -- El cliente no distingue «enlace guardado» de «pendiente»: el enlace no se publica hasta habilitarlo.
      when g.status = 'enlace_guardado' then 'pendiente'::public.access_status
      else g.status
    end,
    case when g.status = 'habilitado' and v_current then g.link_url else null end;
end $$;

-- Personal: tabla de clientes con ambos estados. Comercial ve los estados pero no los enlaces.
create function public.fn_admin_access_overview()
returns table (
  user_id uuid, full_name text, email text, registered_at timestamptz,
  payment_state text, period_end timestamptz,
  access_status public.access_status, link_url text,
  enabled_at timestamptz, enabled_by_name text, status_changed_at timestamptz, status_reason text,
  is_staff boolean
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_links boolean;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('soporte') or public.has_role('comercial')) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  v_links := public.has_role('admin') or public.has_role('soporte');
  return query
  select p.id, p.full_name, p.email, p.created_at,
         public.fn_payment_state(p.id),
         s.current_period_end,
         coalesce(g.status, 'pendiente'::public.access_status),
         case when v_links then g.link_url else null end,
         g.enabled_at, eb.full_name, g.status_changed_at, g.status_reason,
         exists (select 1 from public.staff_roles r where r.user_id = p.id)
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    left join public.access_grants g on g.user_id = p.id
    left join public.profiles eb on eb.id = g.enabled_by
   order by p.created_at desc;
end $$;

-- ── Privilegios de ejecución ───────────────────────────────────────
revoke all on function
  public.fn_payment_state(uuid, timestamptz), public.fn_subscription_current(uuid, timestamptz),
  public.fn_require_admin(), public.fn_link_fingerprint(text),
  public.fn_access_save_link(uuid, text), public.fn_access_enable(uuid), public.fn_access_revoke(uuid, text),
  public.trg_access_follow_subscription(), public.fn_my_access(), public.fn_admin_access_overview()
from public, anon, authenticated;
-- Cada una verifica el rol o la sesión por dentro; se conceden a usuarios con sesión.
grant execute on function
  public.fn_access_save_link(uuid, text), public.fn_access_enable(uuid), public.fn_access_revoke(uuid, text),
  public.fn_my_access(), public.fn_admin_access_overview()
to authenticated;
grant execute on all functions in schema public to service_role;
