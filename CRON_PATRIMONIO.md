# Configuracion Cron - Patrimonio Diario

Se configuraron **3 opciones** para registrar el snapshot diario del patrimonio a las **23:59 Argentina**, que equivale a **02:59 UTC del dia siguiente**.

## Opcion 1: Vercel Cron Jobs

Si la app esta desplegada en Vercel:

1. Ya esta configurado en `vercel.json`.
2. Agrega `CRON_SECRET` en las variables de entorno del proyecto.
3. Despliega los cambios.
4. Vercel ejecutara `/api/cron/patrimonio` todos los dias a las `02:59 UTC`.

## Opcion 2: PostgreSQL pg_cron

Si prefieres correrlo directo en la base:

1. Ejecuta `migration_cron_patrimonio.sql` en Supabase SQL Editor.
2. Eso programara `registrar_patrimonio_diario()`.
3. La ejecucion quedara a las `02:59 UTC`, o sea `23:59 AR`.

## Opcion 3: Cron Externo

1. Registra un job en cron-job.org, EasyCron o similar.
2. Configura la URL `https://tu-dominio.com/api/cron/patrimonio`.
3. Usa metodo `GET` o `POST`.
4. Envia `Authorization: Bearer tu-token-secreto`.
5. Schedule: `59 2 * * *`.

## Prueba Manual

Desde terminal:

```bash
curl -X POST https://tu-dominio.com/api/cron/patrimonio \
  -H "Authorization: Bearer tu-token-secreto"
```

Desde Supabase:

```sql
SELECT registrar_patrimonio_diario();
```

Desde la app:

- Ve a `/patrimonio`.
- Usa "Registrar Snapshot Hoy" solo si quieres forzar un cierre manual.

## Zona Horaria

- Vercel Cron corre en UTC.
- `59 2 * * *` = `02:59 UTC` = `23:59 Argentina`.
- Si cambias el horario, piensa siempre en UTC y en la fecha Argentina que quieres cerrar.
