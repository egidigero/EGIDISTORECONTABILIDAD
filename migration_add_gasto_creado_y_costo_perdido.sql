-- Migration: add gasto_creado_id and costo_producto_perdido to devoluciones
-- Run this migration against your Supabase/Postgres database.

BEGIN;

-- Add column to store created gasto_ingreso id for idempotency
ALTER TABLE IF EXISTS devoluciones
  ADD COLUMN IF NOT EXISTS gasto_creado_id TEXT;

-- Add column to store product cost marked as lost when devolución final and non-recoverable
ALTER TABLE IF EXISTS devoluciones
  ADD COLUMN IF NOT EXISTS costo_producto_perdido DECIMAL(12,2) DEFAULT 0;

COMMIT;
