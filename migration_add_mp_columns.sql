-- Migración: agregar columnas relacionadas con Mercado Pago (mp_estado, mp_retenido)
-- WARNING: Haz un backup o snapshot antes de ejecutar en producción.
-- Ejecutar en Supabase SQL editor o con psql conectando a la DB.

BEGIN;

-- 1) Tabla devoluciones: persistir elección de mp (estado y retenido)
ALTER TABLE IF EXISTS devoluciones
  ADD COLUMN IF NOT EXISTS mp_estado VARCHAR(32),
  ADD COLUMN IF NOT EXISTS mp_retenido BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Tabla liquidaciones: agregar acumulador de dinero retenido en Mercado Pago
-- Usamos NUMERIC(14,2) para representar montos con precisión
ALTER TABLE IF EXISTS liquidaciones
  ADD COLUMN IF NOT EXISTS mp_retenido NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMIT;

-- Nota:
-- - `mp_estado` guarda 'a_liquidar' | 'liquidado' (texto). Podés convertirlo a ENUM si preferís.
-- - `mp_retenido` en `devoluciones` es boolean (si la devolución movió dinero a retenido).
-- - `mp_retenido` en `liquidaciones` es monto (NUMERIC) que representa el total retenido en esa fecha.
-- - Después de ejecutar, reinicia o redeploya la app si tu entorno cachea el esquema de PostgREST.
-- - Si usás Supabase, abrí SQL Editor y pegá este archivo para ejecutarlo.

-- Opcional: índice para consultas por fecha en liquidaciones (si no existe)
-- CREATE INDEX IF NOT EXISTS idx_liquidaciones_fecha ON liquidaciones (fecha);
