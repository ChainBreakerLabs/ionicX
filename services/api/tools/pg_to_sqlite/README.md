# pg_to_sqlite

Genera `bible.sqlite` para releases a partir de Postgres **o** desde los `INSERT` existentes en las migraciones.

## Uso rápido (sin Postgres)

Desde `services/api/`:

```bash
# genera dist/db/bible.sqlite usando los INSERT de migrations/
go run ./tools/pg_to_sqlite --source migrations
```

## Uso con Postgres (recomendado si tienes la DB viva)

```bash
# DATABASE_URL debe apuntar a tu Postgres
DATABASE_URL="postgres://user:pass@localhost:5432/dbname?sslmode=disable" \
  go run ./tools/pg_to_sqlite --source postgres
```

## Flags

- `--sqlite` salida (default: `dist/db/bible.sqlite`)
- `--schema` esquema SQLite (default: `tools/schema.sql`)
- `--migrations` carpeta de migraciones (default: `migrations`)
- `--source` `postgres` | `migrations`
- `--pg` URL Postgres (default: `DATABASE_URL`)

El comando hace `ANALYZE` al final y, si la fuente es Postgres, valida conteos por tabla.
