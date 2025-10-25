-- Migration: Agregar columna numero_seguimiento a devoluciones y exponerla en la vista
-- Descripción: Añade la columna `numero_seguimiento` (texto) en la tabla `devoluciones`
-- y actualiza la vista `devoluciones_resumen` para incluirla en los reportes.

BEGIN;

-- 1) Agregar columna en la tabla (si no existe)
ALTER TABLE devoluciones
	ADD COLUMN IF NOT EXISTS numero_seguimiento TEXT;

-- 2) Índice para búsquedas por tracking
CREATE INDEX IF NOT EXISTS idx_devoluciones_numero_seguimiento ON devoluciones(numero_seguimiento);

-- Safer replacement: create a temporary view `devoluciones_resumen_new`, test it, then atomically
-- rename it into place. This avoids dropping dependent objects unexpectedly.
-- 3a) Crear vista temporal con la nueva definición
CREATE OR REPLACE VIEW devoluciones_resumen_new AS
SELECT
	d.*,
	COALESCE(to_jsonb(v)->>'sale_code', to_jsonb(v)->>'saleCode') AS sale_code,
	COALESCE(to_jsonb(v)->>'comprador', to_jsonb(v)->>'buyer_name', to_jsonb(v)->>'buyerName') AS comprador,
	NULLIF(COALESCE(to_jsonb(v)->>'pv_bruto', to_jsonb(v)->>'pvBruto', to_jsonb(v)->>'monto_total'), '')::numeric AS venta_pv_bruto,
	p.modelo AS producto_modelo,
	p.sku AS producto_sku,
	pn.modelo AS producto_nuevo_modelo,
	pn.sku AS producto_nuevo_sku
FROM devoluciones d
-- Unir con la venta de forma segura leyendo el id de venta desde la fila `d` como jsonb
LEFT JOIN ventas v ON v.id = COALESCE(to_jsonb(d)->>'venta_id', to_jsonb(d)->>'ventaId')
-- Unir con el producto original leyendo de forma segura desde la fila `v` (jsonb)
LEFT JOIN productos p ON p.id::text = COALESCE(to_jsonb(v)->>'producto_id', to_jsonb(v)->>'productoId')
-- Unir con el producto nuevo leyendo el id desde la fila `d` (jsonb)
LEFT JOIN productos pn ON pn.id::text = COALESCE(to_jsonb(d)->>'producto_nuevo_id', to_jsonb(d)->>'productoNuevoId')
-- Ordenar por la fecha de reclamo leída de la fila `d` en cualquiera de sus variantes
ORDER BY (COALESCE(to_jsonb(d)->>'fecha_reclamo', to_jsonb(d)->>'fechaReclamo'))::timestamp DESC;

-- 3b) Atomically swap the new view into place (rename). This block will:
--   - if an existing `devoluciones_resumen` exists, rename it to `devoluciones_resumen_old`
--   - rename `devoluciones_resumen_new` to `devoluciones_resumen`
--   - drop the old view if present
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen') THEN
		EXECUTE 'ALTER VIEW devoluciones_resumen RENAME TO devoluciones_resumen_old';
	END IF;
	EXECUTE 'ALTER VIEW devoluciones_resumen_new RENAME TO devoluciones_resumen';
	IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen_old') THEN
		-- Drop old view safely (no CASCADE) only if desired; keep it to allow quick rollback.
		EXECUTE 'DROP VIEW IF EXISTS devoluciones_resumen_old';
	END IF;
END
$$;

COMMIT;

-- Nota: aplicar esta migración en la base de datos (psql / Supabase SQL editor). Si usás Supabase,
-- pegá este SQL en el editor y ejecútalo; si usás psql, ejecutá: psql -h <host> -d <db> -U <user> -f migration_add_numero_seguimiento.sql

