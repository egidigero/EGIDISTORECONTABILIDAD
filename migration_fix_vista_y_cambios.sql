-- Migration: Recrear vista devoluciones_resumen y actualizar perdida_total en cambios
-- Fecha: 2026-01-12

BEGIN;

-- 1. Recrear vista devoluciones_resumen COMPLETA con JOINs
DROP VIEW IF EXISTS devoluciones_resumen;

CREATE VIEW devoluciones_resumen AS
SELECT 
    d.id,
    d.id_devolucion,
    d.numero_seguimiento,
    d.fecha_compra,
    d.fecha_reclamo,
    d.fecha_completada,
    d.fecha_recepcion,
    d.estado,
    d.tipo_resolucion,
    d.plataforma,
    d.motivo,
    d.telefono_contacto,
    d.nombre_contacto,
    -- Datos de la venta original
    v.sale_code,
    v.comprador,
    v.pv_bruto as venta_pv_bruto,
    v.comision_original,
    -- Datos del producto original
    p.modelo as producto_modelo,
    p.sku as producto_sku,
    -- Costos detallados
    d.costo_producto_original,
    d.costo_producto_nuevo,
    d.costo_envio_original,
    d.costo_envio_devolucion,
    d.costo_envio_nuevo,
    d.total_costos_envio,
    d.total_costo_productos,
    d.monto_reembolsado,
    d.comision_devuelta,
    d.perdida_total,
    d.impacto_ventas_netas,
    -- Producto nuevo (si es cambio)
    pn.modelo as producto_nuevo_modelo,
    pn.sku as producto_nuevo_sku,
    -- Campos adicionales
    d.producto_recuperable,
    d.observaciones,
    d.created_at,
    d.updated_at,
    -- Campos MP
    d.mp_estado,
    d.mp_retenido,
    d.delta_mp_disponible,
    d.delta_mp_a_liquidar,
    d.delta_mp_retenido,
    d.delta_tn_a_liquidar,
    d.fecha_impacto
FROM devoluciones d
LEFT JOIN ventas v ON d.venta_id::text = v.id
LEFT JOIN productos p ON v.producto_id = p.id
LEFT JOIN productos pn ON d.producto_nuevo_id::text = pn.id
ORDER BY d.fecha_reclamo DESC;

COMMENT ON VIEW devoluciones_resumen IS 'Vista resumen de devoluciones con todos los datos relacionados para reportes';

-- 2. Actualizar perdida_total para CAMBIOS existentes (restar envío original)
UPDATE devoluciones
SET perdida_total = perdida_total - COALESCE(costo_envio_original, 0)
WHERE tipo_resolucion IN ('Cambio mismo producto', 'Cambio otro producto')
  AND costo_envio_original > 0
  AND perdida_total IS NOT NULL;

-- 3. Actualizar fecha_recepcion para devoluciones viejas con reembolso/cambio (excepto Adriana Ramos)
UPDATE devoluciones d
SET fecha_recepcion = COALESCE(d.fecha_completada, d.updated_at, d.created_at)
WHERE d.fecha_recepcion IS NULL
  AND d.tipo_resolucion IN ('Reembolso', 'Cambio mismo producto', 'Cambio otro producto')
  AND NOT EXISTS (
    SELECT 1 FROM ventas v 
    WHERE v.id = d.venta_id::text 
    AND LOWER(v.comprador) LIKE '%adriana%ramos%'
  );

COMMIT;

-- Verificar cambios
SELECT 
    'Cambios actualizados' as info,
    COUNT(*) as total_cambios,
    SUM(CASE WHEN costo_envio_original > 0 THEN 1 ELSE 0 END) as con_envio_original_positivo
FROM devoluciones
WHERE tipo_resolucion IN ('Cambio mismo producto', 'Cambio otro producto');

SELECT 
    'Devoluciones con fecha_recepcion actualizada' as info,
    COUNT(*) as total
FROM devoluciones
WHERE fecha_recepcion IS NOT NULL
  AND tipo_resolucion IN ('Reembolso', 'Cambio mismo producto', 'Cambio otro producto');
