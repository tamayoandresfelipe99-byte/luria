-- Límite de solicitudes compartido entre instancias (docs/14-limitaciones.md #5).
-- Ventana fija por clave. La clave llega ya resumida con SHA-256 desde la aplicación,
-- así que la tabla no guarda IP, correo ni identificadores en claro.

create table public.rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null default now(),
  hits integer not null default 1
);
alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;
revoke all on public.rate_limits from public, anon, authenticated;
-- Sin políticas: solo la función (security definer) y service_role acceden.

-- Registra un intento y devuelve true si sigue dentro del límite. Atómico (una sola sentencia).
create function public.fn_rate_limit_hit(p_key_hash text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hits int;
begin
  if p_max < 1 or p_window_seconds < 1 then raise exception 'Parámetros de límite inválidos'; end if;
  insert into public.rate_limits as r (key_hash, window_start, hits)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update set
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function public.fn_rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.fn_rate_limit_hit(text, int, int) to service_role;

-- Limpieza: claves sin actividad en el último día. La llama la tarea programada diaria.
create function public.fn_rate_limit_cleanup()
returns integer language sql security definer set search_path = public, pg_temp as $$
  with d as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.fn_rate_limit_cleanup() from public, anon, authenticated;
grant execute on function public.fn_rate_limit_cleanup() to service_role;
