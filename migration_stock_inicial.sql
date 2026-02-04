-- Crear movimientos iniciales para todos los productos existentes que tengan stock pero no tengan movimientos

INSERT INTO movimientos_stock (producto_id, tipo, cantidad, deposito_origen, fecha, observaciones, origen_tipo)
SELECT 
  p.id,
  'entrada' as tipo,
  p."stockPropio" as cantidad,
  'PROPIO' as deposito_origen,
  '2025-01-01T00:00:00.000Z' as fecha,
  'Inventario inicial - Stock de apertura' as observaciones,
  'ingreso_manual' as origen_tipo
FROM productos p
WHERE p."stockPropio" > 0
  AND p.activo = true
  AND NOT EXISTS (
    SELECT 1 
    FROM movimientos_stock m 
    WHERE m.producto_id = p.id
  );
