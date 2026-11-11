-- Embudo analítico: emitir activation_done y renewal_done desde la base de datos
-- (docs/14-limitaciones.md #8). Se emiten aquí, y no en la aplicación, para cubrir todos los
-- caminos: webhook de la pasarela, simulador y activación manual desde el panel.
-- Los eventos no llevan datos personales: anon_id aleatorio, sin ruta ni canal.

-- activation_done: primera activación de la licencia de una suscripción.
create or replace function public.fn_mark_license_active(p_subscription_id uuid, p_external_license_id text, p_valid_until timestamptz, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_first boolean;
begin
  v_first := not exists (
    select 1 from public.audit_log
     where action = 'license.activated' and object_type = 'subscription' and object_id = p_subscription_id::text
  );
  update public.licenses set status = 'active', external_license_id = p_external_license_id,
         valid_until = p_valid_until, last_synced_at = now()
   where subscription_id = p_subscription_id;
  update public.subscriptions set status = 'active' where id = p_subscription_id and status <> 'revoked';
  update public.activation_tasks set status = 'done', resolved_at = now()
   where subscription_id = p_subscription_id and kind = 'activation' and status in ('open', 'in_progress');
  insert into public.audit_log (actor_id, actor_role, action, object_type, object_id, metadata)
  values (p_actor, case when p_actor is null then 'sistema' else 'admin' end, 'license.activated', 'subscription',
          p_subscription_id::text, jsonb_build_object('valid_until', p_valid_until));
  if v_first then
    insert into public.analytics_events (event, anon_id) values ('activation_done', gen_random_uuid()::text);
  end if;
end $$;

-- renewal_done: cada vigencia pagada después de la primera de la misma suscripción.
create function public.fn_track_renewal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.subscription_periods where subscription_id = new.subscription_id and id <> new.id) then
    insert into public.analytics_events (event, anon_id) values ('renewal_done', gen_random_uuid()::text);
  end if;
  return new;
end $$;
revoke all on function public.fn_track_renewal() from public, anon, authenticated;

create trigger subscription_periods_track_renewal
  after insert on public.subscription_periods
  for each row execute function public.fn_track_renewal();
