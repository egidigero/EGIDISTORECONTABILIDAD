-- =====================================================================
-- Migración: Mejoras en Devoluciones y Control de Stock
-- =====================================================================
-- 
-- CAMBIOS:
-- 1. Agregar campo 'fue_reclamo' a devoluciones (para ML: si resta envío de mp_disponible)
-- 2. Agregar estados de stock para devoluciones: a_probar, probado_funcionando, probado_no_funcionando
-- 3. Crear tabla movimientos_stock_devoluciones para rastrear movimientos
--
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. AGREGAR CAMPO 'fue_reclamo' A DEVOLUCIONES
-- =====================================================================
-- Para devoluciones de ML: indica si se debe restar el envío de mp_disponible
-- - Reclamo: resta envío de mp_disponible (comportamiento actual)
-- - No reclamo: NO resta envío, solo mueve el dinero

ALTER TABLE devoluciones 
  ADD COLUMN IF NOT EXISTS fue_reclamo BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN devoluciones.fue_reclamo IS 
'Para devoluciones ML: indica si fue un reclamo que requiere restar el envío de mp_disponible. 
NULL = no aplica (TN o Directo), 
TRUE = fue reclamo (resta envío), 
FALSE = no fue reclamo (no resta envío)';

-- =====================================================================
-- 2. MEJORAR ESTADOS DE STOCK PARA DEVOLUCIONES
-- =====================================================================
-- Agregar estados más detallados para el control de productos devueltos

-- Modificar el check constraint de resultado_prueba para incluir más estados
ALTER TABLE devoluciones 
  DROP CONSTRAINT IF EXISTS devoluciones_resultado_prueba_check;

ALTER TABLE devoluciones 
  ADD CONSTRAINT devoluciones_resultado_prueba_check 
  CHECK (resultado_prueba IN (
    'Pendiente',                    -- Inicial: aún no se probó
    'A Probar',                     -- Recibido, pendiente de prueba
    'Funciona - Recuperable',       -- Probado y funciona, se puede revender
    'No funciona - No recuperable'  -- Probado y no funciona, pérdida
  ));

-- Actualizar valores existentes
UPDATE devoluciones 
SET resultado_prueba = 'A Probar' 
WHERE resultado_prueba = 'Pendiente' 
  AND fecha_recepcion IS NOT NULL;

-- Agregar campo para indicar si el producto devuelto ya fue reincorporado a stock
ALTER TABLE devoluciones 
  ADD COLUMN IF NOT EXISTS stock_reincorporado BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN devoluciones.stock_reincorporado IS 
'Indica si el producto devuelto (cuando funciona) ya fue reincorporado al stock disponible';

-- =====================================================================
-- 3. TABLA DE MOVIMIENTOS DE STOCK MEJORADA
-- =====================================================================
-- Ya existe movimientos_stock, vamos a asegurarnos que tenga todos los campos necesarios

-- Agregar campo de origen (venta, devolucion, ingreso manual, etc)
ALTER TABLE movimientos_stock 
  ADD COLUMN IF NOT EXISTS origen_tipo TEXT;

ALTER TABLE movimientos_stock 
  ADD COLUMN IF NOT EXISTS origen_id TEXT;

-- Agregar constraint para origen_tipo
ALTER TABLE movimientos_stock 
  DROP CONSTRAINT IF EXISTS movimientos_stock_origen_tipo_check;

ALTER TABLE movimientos_stock 
  ADD CONSTRAINT movimientos_stock_origen_tipo_check 
  CHECK (origen_tipo IN (
    'venta',           -- Salida por venta
    'devolucion',      -- Entrada por devolución
    'ingreso_manual',  -- Entrada manual de stock
    'ajuste',          -- Ajuste de inventario
    'transferencia',   -- Transferencia entre depósitos
    'perdida',         -- Pérdida o robo
    'reincorporacion'  -- Reincorporación de stock devuelto probado
  ));

COMMENT ON COLUMN movimientos_stock.origen_tipo IS 
'Tipo de operación que generó el movimiento: venta, devolucion, ingreso_manual, ajuste, transferencia, perdida, reincorporacion';

COMMENT ON COLUMN movimientos_stock.origen_id IS 
'ID de la operación origen (ID de venta, devolución, etc)';

-- Asegurar que tipo tenga los valores correctos
ALTER TABLE movimientos_stock 
  DROP CONSTRAINT IF EXISTS movimientos_stock_tipo_check;

ALTER TABLE movimientos_stock 
  ADD CONSTRAINT movimientos_stock_tipo_check 
  CHECK (tipo IN (
    'entrada',    -- Ingreso de stock
    'salida',     -- Egreso de stock
    'ajuste'      -- Ajuste (puede ser + o -)
  ));

-- =====================================================================
-- 4. VISTA PARA CONTROL DE STOCK DE DEVOLUCIONES
-- =====================================================================

CREATE OR REPLACE VIEW devoluciones_stock_control AS
SELECT 
  d.id,
  d.id_devolucion,
  d.numero_seguimiento,
  d.fecha_recepcion,
  d.fecha_prueba,
  d.resultado_prueba,
  d.stock_reincorporado,
  d.ubicacion_producto,
  d.observaciones_prueba,
  v."saleCode" AS sale_code,
  v.comprador,
  p.modelo AS producto_modelo,
  p.sku AS producto_sku,
  p.id AS producto_id,
  -- Estado legible del stock
  CASE 
    WHEN d.fecha_recepcion IS NULL THEN 'No Recibido'
    WHEN d.resultado_prueba = 'Pendiente' OR d.resultado_prueba = 'A Probar' THEN 'A Probar'
    WHEN d.resultado_prueba = 'Funciona - Recuperable' AND d.stock_reincorporado = TRUE THEN 'Reincorporado a Stock'
    WHEN d.resultado_prueba = 'Funciona - Recuperable' AND d.stock_reincorporado = FALSE THEN 'Probado - Pendiente Reincorporar'
    WHEN d.resultado_prueba = 'No funciona - No recuperable' THEN 'Stock Roto'
    ELSE 'Desconocido'
  END AS estado_stock,
  d.created_at,
  d.updated_at
FROM devoluciones d
  LEFT JOIN ventas v ON d.venta_id = v.id
  LEFT JOIN productos p ON v."productoId" = p.id
WHERE d.producto_recuperable = TRUE  -- Solo productos potencialmente recuperables
  -- Excluir "Sin reembolso" (cliente nunca devolvió, no hay producto físico que gestionar)
  AND (d.tipo_resolucion IS NULL OR d.tipo_resolucion != 'Sin reembolso')
ORDER BY d.fecha_recepcion DESC NULLS LAST, d.created_at DESC;

COMMENT ON VIEW devoluciones_stock_control IS 
'Vista para control de stock de productos devueltos: estado de prueba y reincorporación. 
EXCLUYE: Devoluciones "Sin reembolso" (cliente nunca devolvió el producto, no hay stock que gestionar).';

-- =====================================================================
-- 5. FUNCIÓN PARA REINCORPORAR STOCK DEVUELTO
-- =====================================================================

CREATE OR REPLACE FUNCTION reincorporar_stock_devolucion(
  p_devolucion_id TEXT,
  p_deposito TEXT DEFAULT 'Propio'
) RETURNS BOOLEAN AS $$
DECLARE
  v_producto_id TEXT;
  v_cantidad INT := 1;
  v_resultado_prueba TEXT;
  v_stock_reincorporado BOOLEAN;
BEGIN
  -- Obtener datos de la devolución
  SELECT 
    v."productoId",
    d.resultado_prueba,
    d.stock_reincorporado
  INTO 
    v_producto_id,
    v_resultado_prueba,
    v_stock_reincorporado
  FROM devoluciones d
    LEFT JOIN ventas v ON d.venta_id = v.id
  WHERE d.id = p_devolucion_id;

  -- Validaciones
  IF v_producto_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el producto para la devolución %', p_devolucion_id;
  END IF;

  IF v_resultado_prueba != 'Funciona - Recuperable' THEN
    RAISE EXCEPTION 'Solo se puede reincorporar stock de productos que funcionan. Estado actual: %', v_resultado_prueba;
  END IF;

  IF v_stock_reincorporado = TRUE THEN
    RAISE EXCEPTION 'Este producto ya fue reincorporado al stock';
  END IF;

  -- Actualizar stock del producto
  IF p_deposito = 'Propio' THEN
    UPDATE productos 
    SET "stockPropio" = "stockPropio" + v_cantidad
    WHERE id = v_producto_id;
  ELSIF p_deposito = 'Full' THEN
    UPDATE productos 
    SET "stockFull" = "stockFull" + v_cantidad
    WHERE id = v_producto_id;
  ELSE
    RAISE EXCEPTION 'Depósito inválido: %. Use "Propio" o "Full"', p_deposito;
  END IF;

  -- Registrar movimiento de stock
  INSERT INTO movimientos_stock (
    producto_id,
    deposito_origen,
    deposito_destino,
    tipo,
    cantidad,
    fecha,
    observaciones,
    origen_tipo,
    origen_id
  ) VALUES (
    v_producto_id,
    'Devoluciones',
    p_deposito,
    'entrada',
    v_cantidad,
    NOW(),
    'Reincorporación de producto devuelto probado y funcionando',
    'reincorporacion',
    p_devolucion_id
  );

  -- Marcar devolución como reincorporada
  UPDATE devoluciones 
  SET stock_reincorporado = TRUE,
      updated_at = NOW()
  WHERE id = p_devolucion_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reincorporar_stock_devolucion IS 
'Reincorpora al stock un producto devuelto que fue probado y funciona';

-- =====================================================================
-- 6. ÍNDICES PARA MEJORAR PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_devoluciones_fue_reclamo 
  ON devoluciones(fue_reclamo) 
  WHERE fue_reclamo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devoluciones_resultado_prueba 
  ON devoluciones(resultado_prueba);

CREATE INDEX IF NOT EXISTS idx_devoluciones_stock_reincorporado 
  ON devoluciones(stock_reincorporado) 
  WHERE stock_reincorporado = FALSE;

CREATE INDEX IF NOT EXISTS idx_movimientos_stock_origen 
  ON movimientos_stock(origen_tipo, origen_id);

COMMIT;

-- =====================================================================
-- NOTAS DE USO:
-- =====================================================================
-- 
-- 1. Para marcar una devolución ML como reclamo o no:
--    UPDATE devoluciones SET fue_reclamo = TRUE WHERE id = 'xxx';  -- Es reclamo
--    UPDATE devoluciones SET fue_reclamo = FALSE WHERE id = 'xxx'; -- No es reclamo
--
-- 2. Para reincorporar stock de una devolución probada:
--    SELECT reincorporar_stock_devolucion('id_devolucion', 'Propio');
--
-- 3. Ver stock de devoluciones:
--    SELECT * FROM devoluciones_stock_control WHERE estado_stock = 'A Probar';
--
-- =====================================================================
