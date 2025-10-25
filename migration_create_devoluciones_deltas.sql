-- Migration: create normalized table `devoluciones_deltas` to store one row per
-- accounting-impact event for a devolución (reclamo/completada/manual).
-- This allows storing multiple impact dates per devolución without overwriting
-- the single set of delta_* columns on `devoluciones`.
--
-- Usage: run in Supabase SQL editor or via psql against your DB.

BEGIN;

-- Create the table
CREATE TABLE IF NOT EXISTS devoluciones_deltas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Use the same type as `devoluciones.id` (some installations have text IDs).
  -- If your `devoluciones.id` is a UUID column, replace TEXT with UUID.
  devolucion_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manual', -- recommended values: 'reclamo', 'completada', 'manual'
  fecha_impacto DATE NOT NULL,
  delta_mp_disponible NUMERIC(14,2) NOT NULL DEFAULT 0,
  delta_mp_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0,
  delta_mp_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
  delta_tn_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0,
  gasto_creado_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_devolucion
    FOREIGN KEY(devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE
);

-- Indexes to support lookups by date and by devolucion
CREATE INDEX IF NOT EXISTS idx_devoluciones_deltas_fecha_impacto ON devoluciones_deltas (fecha_impacto);
CREATE INDEX IF NOT EXISTS idx_devoluciones_deltas_devolucion_id ON devoluciones_deltas (devolucion_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devoluciones_deltas_devolucion_tipo ON devoluciones_deltas (devolucion_id, tipo);

-- Backfill: copy existing delta_* and fecha_impacto values from `devoluciones` into new table
-- Only insert rows where any delta is non-zero OR fecha_impacto is not null.
-- NOTE: review this backfill before running in production; adapt types if your PK is integer.
INSERT INTO devoluciones_deltas (devolucion_id, tipo, fecha_impacto, delta_mp_disponible, delta_mp_a_liquidar, delta_mp_retenido, delta_tn_a_liquidar, created_at)
SELECT id AS devolucion_id,
       'reclamo'::text AS tipo,
       COALESCE(fecha_impacto, fecha_completada, fecha_reclamo, CURRENT_DATE) AS fecha_impacto,
       COALESCE(delta_mp_disponible, 0)::numeric(14,2),
       COALESCE(delta_mp_a_liquidar, 0)::numeric(14,2),
       COALESCE(delta_mp_retenido, 0)::numeric(14,2),
       COALESCE(delta_tn_a_liquidar, 0)::numeric(14,2),
       now()
FROM devoluciones
WHERE COALESCE(delta_mp_disponible,0) <> 0
   OR COALESCE(delta_mp_a_liquidar,0) <> 0
   OR COALESCE(delta_mp_retenido,0) <> 0
   OR COALESCE(delta_tn_a_liquidar,0) <> 0
   OR fecha_impacto IS NOT NULL;

COMMIT;

-- After applying this migration, update server code to write to `devoluciones_deltas` instead
-- of persisting delta_* fields directly on `devoluciones`. Keep `devoluciones.fecha_impacto`
-- for compatibility if desired, but prefer the normalized table for multi-event tracking.
