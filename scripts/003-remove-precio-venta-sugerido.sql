-- Migración: Eliminar columna precioVentaSugerido de la tabla productos
-- Fecha: 2025-09-05
-- Razón: La columna ya no se utiliza, reemplazada por precio_venta

-- Primero verificar que no hay datos importantes en esta columna
SELECT 
  COUNT(*) as total_productos,
  COUNT(CASE WHEN "precioVentaSugerido" > 0 THEN 1 END) as con_precio_sugerido,
  AVG("precioVentaSugerido") as precio_promedio_sugerido
FROM productos;

-- Si hay datos importantes, migrar a precio_venta (descomentar si es necesario)
-- UPDATE productos 
-- SET precio_venta = "precioVentaSugerido" 
-- WHERE precio_venta = 0 AND "precioVentaSugerido" > 0;

-- Eliminar la columna
ALTER TABLE productos DROP COLUMN IF EXISTS "precioVentaSugerido";

-- Verificar que la columna fue eliminada
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'productos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
