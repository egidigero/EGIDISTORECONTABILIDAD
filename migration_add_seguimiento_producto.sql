-- Agregar campos para seguimiento post-recepción del producto
ALTER TABLE devoluciones
ADD COLUMN IF NOT EXISTS fecha_recepcion DATE,
ADD COLUMN IF NOT EXISTS ubicacion_producto TEXT,
ADD COLUMN IF NOT EXISTS fecha_prueba DATE,
ADD COLUMN IF NOT EXISTS resultado_prueba TEXT CHECK (resultado_prueba IN ('Pendiente', 'Funciona - Recuperable', 'No funciona - No recuperable')),
ADD COLUMN IF NOT EXISTS observaciones_prueba TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN devoluciones.fecha_recepcion IS 'Fecha en que se recibió físicamente el producto devuelto';
COMMENT ON COLUMN devoluciones.ubicacion_producto IS 'Ubicación física donde se almacena el producto (ej: Estante A3, Con técnico)';
COMMENT ON COLUMN devoluciones.fecha_prueba IS 'Fecha en que se probó el producto';
COMMENT ON COLUMN devoluciones.resultado_prueba IS 'Resultado de la prueba: Pendiente, Funciona - Recuperable, o No funciona - No recuperable';
COMMENT ON COLUMN devoluciones.observaciones_prueba IS 'Observaciones detalladas sobre la prueba realizada al producto';

-- Recrear la vista devoluciones_resumen para incluir los nuevos campos
DROP VIEW IF EXISTS devoluciones_resumen CASCADE;

CREATE OR REPLACE VIEW devoluciones_resumen AS
SELECT 
  d.id,
  d.id_devolucion,
  d.numero_devolucion,
  d.venta_id,
  d.producto_nuevo_id,
  d.fecha_compra,
  d.fecha_reclamo,
  d.nombre_contacto,
  d.telefono_contacto,
  d.numero_seguimiento,
  d.motivo,
  d.plataforma,
  d.estado,
  d.tipo_resolucion,
  d.costo_producto_original,
  d.costo_producto_nuevo,
  d.producto_recuperable,
  d.costo_envio_original,
  d.costo_envio_devolucion,
  d.costo_envio_nuevo,
  d.total_costos_envio,
  d.monto_venta_original,
  d.monto_reembolsado,
  d.observaciones,
  d.mp_estado,
  d.mp_retenido,
  d.perdida_total,
  d.impacto_ventas_netas,
  d.created_at,
  d.updated_at,
  -- Nuevos campos de seguimiento
  d.fecha_recepcion,
  d.ubicacion_producto,
  d.fecha_prueba,
  d.resultado_prueba,
  d.observaciones_prueba,
  -- Datos de la venta
  v.sale_code,
  v.comprador,
  v.producto_id,
  p.modelo AS producto_modelo
FROM devoluciones d
LEFT JOIN ventas v ON d.venta_id = v.id
LEFT JOIN productos p ON v.producto_id = p.id;

COMMENT ON VIEW devoluciones_resumen IS 'Vista consolidada de devoluciones con datos de venta y seguimiento del producto';
