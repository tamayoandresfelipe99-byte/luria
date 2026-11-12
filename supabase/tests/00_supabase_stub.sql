-- SOLO PARA PRUEBAS LOCALES EN POSTGRESQL "PURO".
-- Emula las piezas de Supabase que usan las migraciones: roles, esquema auth y auth.uid().
-- En Supabase real NO se ejecuta este archivo.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
-- Igual que Supabase: todo objeto nuevo en public queda concedido por defecto a anon y authenticated.
-- Así las pruebas detectan tablas o funciones que una migración olvide restringir.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
