-- Migration: Corregir cálculo de pérdida en cambios (sin modificar tabla)
-- Descripción: En cambios, el envío original NO es pérdida (el cliente sigue con un producto)
-- Solución: Recrear la vista devoluciones_resumen para ajustar perdida_total en cambios

-- 1. Recrear la vista con ajuste de pérdida en cambios
CREATE OR REPLACE VIEW devoluciones_resumen AS
SELECT
    d.id,
    d.id_devolucion,
    d.numero_seguimiento,
    d.fecha_compra,
    d.fecha_reclamo,
    d.fecha_completada,
    d.fecha_recepcion,
    d.fecha_prueba,
    d.estado,
    d.tipo_resolucion,
    d.plataforma,
    d.motivo,
    d.telefono_contacto,
    d.nombre_contacto,
    d.venta_id::text AS venta_id_text,
    d.total_costos_envio,
    d.total_costo_productos,
    d.monto_reembolsado,
    d.costo_envio_original,
    d.costo_envio_devolucion,
    d.costo_envio_nuevo,
    
    -- AJUSTE: En cambios, restar el envío original de la pérdida
    CASE 
        WHEN d.tipo_resolucion IN ('Cambio mismo producto', 'Cambio otro producto') THEN
            COALESCE(d.perdida_total, 0) - COALESCE(d.costo_envio_original, 0)
        ELSE
            COALESCE(d.perdida_total, 0)
    END AS perdida_total,
    
    d.impacto_ventas_netas,
    d.producto_recuperable,
    d.ubicacion_producto,
    d.resultado_prueba,
    d.observaciones_prueba,
    d.comision_devuelta,
    
    -- Joins con ventas y productos
    v.id as venta_id,
    v.sale_code,
    v.comprador,
    v.pv_bruto AS venta_pv_bruto,
    
    p.id as producto_id,
    p.modelo AS producto_modelo,
    p.sku AS producto_sku,
    
    pn.id as producto_nuevo_id,
    pn.modelo AS producto_nuevo_modelo,
    pn.sku AS producto_nuevo_sku,
    
    d.created_at,
    d.updated_at

FROM devoluciones d
LEFT JOIN ventas v ON d.venta_id = v.id
LEFT JOIN productos p ON v.producto_id = p.id
LEFT JOIN productos pn ON d.producto_nuevo_id = pn.id;

-- 2. Actualizar fechas de recepción para devoluciones completadas sin fecha
-- (excepto Adriana Ramos)
UPDATE devoluciones
SET 
    fecha_recepcion = COALESCE(fecha_completada, fecha_reclamo + INTERVAL '7 days'),
    updated_at = NOW()
WHERE 
    estado IN (
        'Entregada - Reembolso',
        'Entregada - Cambio mismo producto',
        'Entregada - Cambio otro producto',
        'Entregada - Sin reembolso'
    )
    AND fecha_recepcion IS NULL
    AND LOWER(nombre_contacto) NOT LIKE '%adriana%ramos%'
    AND LOWER(nombre_contacto) NOT LIKE '%ramos%adriana%';

-- 3. Verificación
SELECT 
    id_devolucion,
    nombre_contacto,
    estado,
    tipo_resolucion,
    costo_envio_original,
    perdida_total,
    fecha_recepcion
FROM devoluciones_resumen
WHERE estado LIKE 'Entregada%'
ORDER BY fecha_reclamo DESC
LIMIT 10;
