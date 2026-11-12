#!/usr/bin/env bash
# Ejecuta migraciones y pruebas SQL en un PostgreSQL temporal y desechable.
# Requisitos: binarios de PostgreSQL 15+ (initdb, pg_ctl, psql) en PATH o en /usr/lib/postgresql/*/bin.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

# initdb/postgres no se ejecutan como root: usar el usuario 'postgres' si es necesario.
AS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -r -s /bin/false postgres
  chown postgres "$DATA"
  AS=(runuser -u postgres --)
fi

"${AS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start -w >/dev/null
PSQL=("$PGBIN/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "· migración $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/10_acceptance.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/20_rls.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/30_embudo_y_limites.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/40_zero_trust.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/50_acceso.sql"
echo "✔ Todas las pruebas SQL pasaron"
