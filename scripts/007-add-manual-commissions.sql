-- Agregar campos para comisiones manuales en la tabla ventas
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas para el manejo de comisiones manuales
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS calculo_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS comision_base_manual DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS comision_extra_manual DECIMAL(10,2);

-- 2. Agregar comentarios para documentar el propósito
COMMENT ON COLUMN ventas.calculo_manual IS 'Indica si se usaron comisiones manuales en lugar del cálculo automático';
COMMENT ON COLUMN ventas.comision_base_manual IS 'Comisión base ingresada manualmente (si calculo_manual = true)';
COMMENT ON COLUMN ventas.comision_extra_manual IS 'Comisión extra ingresada manualmente (si calculo_manual = true)';

-- 3. Verificar que se agregaron correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'ventas' 
AND column_name IN ('calculo_manual', 'comision_base_manual', 'comision_extra_manual');

-- 4. Ver algunos registros para confirmar
SELECT id, comprador, calculo_manual, comision_base_manual, comision_extra_manual, comision
FROM ventas 
LIMIT 3;
