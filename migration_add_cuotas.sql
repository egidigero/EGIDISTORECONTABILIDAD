-- Migración: Agregar campo cuotas a tabla ventas
-- Fecha: 2025-10-06
-- Descripción: Agrega campo cuotas para almacenar la cantidad de cuotas sin interés
--              en ventas con TN + MercadoPago + "Cuotas sin interés"

-- Agregar columna cuotas (NULL por defecto, solo se llena para ventas con cuotas)
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS cuotas INTEGER DEFAULT NULL;

-- Comentario explicativo
COMMENT ON COLUMN ventas.cuotas IS 
'Cantidad de cuotas sin interés (1, 2, 3, 6). 
Solo aplica para TN + MercadoPago + condicion "Cuotas sin interés". 
NULL para otros casos.';

-- Verificar que se agregó correctamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'ventas' 
  AND column_name = 'cuotas';

-- Ejemplos de uso (Porcentajes reales MercadoPago Argentina):
-- 1 cuota (contado):  comision MP = 9%
-- 2 cuotas sin interés:  comision MP = 9% + 5.20% = 14.20%
-- 3 cuotas sin interés:  comision MP = 9% + 7.60% = 16.60%
-- 6 cuotas sin interés:  comision MP = 9% + 13.50% = 22.50%
