-- Migration: Agregar soporte para restauración de stock al eliminar ventas
-- Fecha: 2026-02-08
-- Descripción: Actualiza la restricción de movimientos_stock para permitir 
--              registrar entradas de stock cuando se eliminan ventas

BEGIN;

-- Eliminar constraint anterior
ALTER TABLE movimientos_stock 
  DROP CONSTRAINT IF EXISTS movimientos_stock_origen_tipo_check;

-- Agregar nuevo constraint con 'venta_eliminada'
ALTER TABLE movimientos_stock 
  ADD CONSTRAINT movimientos_stock_origen_tipo_check 
  CHECK (origen_tipo IN (
    'venta',           -- Salida por venta
    'venta_eliminada', -- Entrada por eliminación de venta (NUEVO)
    'devolucion',      -- Entrada por devolución
    'ingreso_manual',  -- Entrada manual de stock
    'ajuste',          -- Ajuste de inventario
    'transferencia',   -- Transferencia entre depósitos
    'perdida',         -- Pérdida o robo
    'reincorporacion'  -- Reincorporación de stock devuelto probado
  ));

-- Actualizar comentario
COMMENT ON COLUMN movimientos_stock.origen_tipo IS 
'Tipo de operación que generó el movimiento: venta, venta_eliminada, devolucion, ingreso_manual, ajuste, transferencia, perdida, reincorporacion';

COMMIT;

-- Verificación
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'movimientos_stock_origen_tipo_check';
