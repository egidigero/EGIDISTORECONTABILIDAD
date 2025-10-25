-- Migration: Recrear vista devoluciones_resumen (conservadora, sin JOINs)
-- Objetivo: crear una versión simple y robusta de la vista `devoluciones_resumen` que solo
-- expone columnas directas de la tabla `devoluciones` (con tolerancia a camelCase/snake_case)
-- Esto evita errores de referencias a columnas inexistentes en tablas relacionadas.

CREATE OR REPLACE VIEW devoluciones_resumen_new AS
SELECT
  d.id,
  -- id_devolucion (acepta id_devolucion o idDevolucion)
  COALESCE(d.id_devolucion, (to_jsonb(d) ->> 'idDevolucion'), (to_jsonb(d) ->> 'id_devolucion')) AS id_devolucion,
  -- numero_seguimiento
  COALESCE(d.numero_seguimiento, (to_jsonb(d) ->> 'numeroSeguimiento'), (to_jsonb(d) ->> 'numero_seguimiento')) AS numero_seguimiento,
  -- fechas (intentar columna TIMESTAMP, fallback a variantes string, fallback a created_at)
  COALESCE(d.fecha_compra, (NULLIF(to_jsonb(d) ->> 'fechaCompra',''))::timestamp, (NULLIF(to_jsonb(d) ->> 'fecha_compra',''))::timestamp, d.created_at) AS fecha_compra,
  COALESCE(d.fecha_reclamo, (NULLIF(to_jsonb(d) ->> 'fechaReclamo',''))::timestamp, (NULLIF(to_jsonb(d) ->> 'fecha_reclamo',''))::timestamp, d.created_at) AS fecha_reclamo,
  COALESCE(d.fecha_completada, (NULLIF(to_jsonb(d) ->> 'fechaCompletada',''))::timestamp, (NULLIF(to_jsonb(d) ->> 'fecha_completada',''))::timestamp) AS fecha_completada,

  d.estado,
  d.tipo_resolucion,
  d.plataforma,
  d.motivo,
  d.telefono_contacto,
  d.nombre_contacto,

  d.venta_id,
  d.producto_nuevo_id,

  d.costo_producto_original,
  d.costo_producto_nuevo,
  d.costo_envio_original,
  d.costo_envio_devolucion,
  d.costo_envio_nuevo,
  d.total_costos_envio,
  d.total_costo_productos,
  d.monto_reembolsado,
  d.perdida_total,
  d.impacto_ventas_netas,
  d.producto_recuperable,
  d.observaciones,
  d.created_at,
  d.updated_at,
  d.mp_estado,
  d.mp_retenido,
  d.delta_mp_disponible,
  d.delta_mp_a_liquidar,
  d.delta_mp_retenido,
  d.delta_tn_a_liquidar,
  d.fecha_impacto
FROM devoluciones d;

-- Swap seguro: renombrar vistas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen') THEN
    EXECUTE 'ALTER VIEW devoluciones_resumen RENAME TO devoluciones_resumen_old';
  END IF;
  EXECUTE 'ALTER VIEW devoluciones_resumen_new RENAME TO devoluciones_resumen';
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen_old') THEN
    EXECUTE 'DROP VIEW IF EXISTS devoluciones_resumen_old';
  END IF;
END
$$;

COMMENT ON VIEW devoluciones_resumen IS 'Versión conservadora de la vista: solo columnas de devoluciones (sin joins)';
