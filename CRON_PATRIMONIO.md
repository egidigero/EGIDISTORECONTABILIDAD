# Configuración Cron - Patrimonio Diario

Se han configurado **3 opciones** para ejecutar automáticamente el registro de patrimonio diario a las 00:00 Argentina (03:00 UTC):

## Opción 1: Vercel Cron Jobs (RECOMENDADO)

Si tu app está desplegada en Vercel:

1. ✅ Ya está configurado en `vercel.json`
2. Agrega variable de entorno en Vercel Dashboard:
   - `CRON_SECRET=tu-token-secreto-aleatorio`
3. Despliega: `git push` 
4. Vercel ejecutará automáticamente `/api/cron/patrimonio` todos los días a las 03:00 UTC

**Verificación:**
- Ve a Vercel Dashboard > Tu Proyecto > Settings > Cron Jobs
- Deberías ver el cron programado

---

## Opción 2: PostgreSQL pg_cron (Supabase)

Si prefieres ejecutar directamente en la base de datos:

1. Ejecuta `migration_cron_patrimonio.sql` en Supabase SQL Editor
2. Esto programará la función `registrar_patrimonio_diario()` 
3. Se ejecutará automáticamente a las 03:00 UTC todos los días

**Verificar:**
```sql
SELECT * FROM cron.job;
```

**Ver historial:**
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Opción 3: Cron Externo (cron-job.org, EasyCron, etc.)

1. Registra en un servicio de cron jobs gratuito
2. Configura URL: `https://tu-dominio.com/api/cron/patrimonio`
3. Método: GET o POST
4. Header: `Authorization: Bearer tu-token-secreto`
5. Schedule: `0 3 * * *` (00:00 Argentina / 03:00 UTC)

---

## Prueba Manual

Para probar que funciona:

**Desde terminal:**
```bash
curl -X POST https://tu-dominio.com/api/cron/patrimonio \
  -H "Authorization: Bearer tu-token-secreto"
```

**Desde Supabase:**
```sql
SELECT registrar_patrimonio_diario();
```

**Desde la app:**
- Ve a `/patrimonio` y haz clic en "Registrar Snapshot Hoy"

---

## Zona Horaria

- Vercel Cron usa **UTC** por defecto
- `03:00 UTC` = `00:00 Argentina` (UTC-3)
- Para cambiar horario, modifica `"schedule"` en `vercel.json`:
- `"0 3 * * *"` = 03:00 UTC (00:00 Argentina)
  - `"0 20 * * *"` = 20:00 UTC (17:00 Argentina)
  - `"0 2 * * *"` = 02:00 UTC (23:00 Argentina del día anterior)

---

## Recomendación

**Usa Vercel Cron** si estás en Vercel (más simple, sin configuración adicional).

**Usa pg_cron** si quieres que sea 100% independiente del hosting.
