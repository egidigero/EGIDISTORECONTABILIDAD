-- Configuración de pg_cron para ejecutar registro de patrimonio diario
-- Solo usar si NO estás usando Vercel Cron Jobs

-- 1. Habilitar extensión pg_cron (requiere permisos de superusuario en Supabase)
-- Nota: En Supabase, pg_cron ya está habilitado por defecto

-- 2. Programar tarea diaria a las 02:59 UTC (23:59 Argentina)
-- Ajusta la zona horaria según necesites
SELECT cron.schedule(
  'registrar-patrimonio-diario',  -- nombre del job
  '59 2 * * *',                  -- cron expression: todos los dias a las 02:59 UTC
  $$
  SELECT registrar_patrimonio_diario();
  $$
);

-- Para verificar que el cron está activo:
-- SELECT * FROM cron.job;

-- Para ver el historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Para desactivar el cron:
-- SELECT cron.unschedule('registrar-patrimonio-diario');

-- Para cambiar el horario:
-- SELECT cron.unschedule('registrar-patrimonio-diario');
-- SELECT cron.schedule('registrar-patrimonio-diario', '59 2 * * *', 'SELECT registrar_patrimonio_diario();');

