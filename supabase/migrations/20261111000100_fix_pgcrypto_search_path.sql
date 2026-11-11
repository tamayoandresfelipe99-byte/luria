-- En Supabase, pgcrypto está instalada en el esquema `extensions`, no en `public`.
-- fn_create_order usa gen_random_bytes() y su search_path (public, pg_temp) no la encontraba:
-- toda compra fallaba con "function gen_random_bytes(integer) does not exist".
-- Detectado con Supabase local (docs/13-pruebas-resultados.md). En PostgreSQL sin Supabase
-- el esquema `extensions` no existe y se ignora en el search_path.
alter function public.fn_create_order(uuid, text) set search_path = public, extensions, pg_temp;
