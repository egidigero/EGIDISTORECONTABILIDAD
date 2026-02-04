-- Vista para calcular el stock real de cada producto desde los movimientos
CREATE OR REPLACE VIEW stock_calculado AS
SELECT 
  p.id as producto_id,
  p.modelo,
  p.sku,
  p.activo,
  -- Stock PROPIO: suma de entradas menos salidas del depósito PROPIO
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN tipo = 'entrada' AND deposito_origen = 'PROPIO' THEN cantidad
        WHEN tipo = 'salida' AND deposito_origen = 'PROPIO' THEN -cantidad
        ELSE 0
      END
    )
    FROM movimientos_stock m
    WHERE m.producto_id = p.id
    ), 0
  ) as stock_propio_calculado,
  
  -- Stock FULL: suma de entradas menos salidas del depósito FULL
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN tipo = 'entrada' AND deposito_origen = 'FULL' THEN cantidad
        WHEN tipo = 'salida' AND deposito_origen = 'FULL' THEN -cantidad
        ELSE 0
      END
    )
    FROM movimientos_stock m
    WHERE m.producto_id = p.id
    ), 0
  ) as stock_full_calculado,
  
  -- Stock total (PROPIO + FULL)
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN tipo = 'entrada' THEN cantidad
        WHEN tipo = 'salida' THEN -cantidad
        ELSE 0
      END
    )
    FROM movimientos_stock m
    WHERE m.producto_id = p.id
    ), 0
  ) as stock_total_calculado,
  
  -- Fecha del último movimiento
  (SELECT MAX(fecha) FROM movimientos_stock m WHERE m.producto_id = p.id) as ultimo_movimiento,
  
  -- Cantidad de movimientos
  (SELECT COUNT(*) FROM movimientos_stock m WHERE m.producto_id = p.id) as cantidad_movimientos

FROM productos p;

-- Crear índice para mejorar performance de la vista
CREATE INDEX IF NOT EXISTS idx_movimientos_producto_deposito 
ON movimientos_stock(producto_id, deposito_origen, tipo);

-- Comentario explicativo
COMMENT ON VIEW stock_calculado IS 'Vista que calcula el stock real de cada producto basándose en los movimientos de stock registrados. El stock se calcula sumando entradas y restando salidas por depósito.';
