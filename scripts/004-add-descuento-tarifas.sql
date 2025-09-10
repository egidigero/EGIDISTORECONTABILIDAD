-- Migración: Agregar columna descuentoPct a la tabla tarifas
-- Fecha: 2025-09-05
-- Razón: Manejar descuentos pre-comisión (ej: 15% en TN + Transferencia)

-- Agregar la columna descuentoPct con valor por defecto 0
ALTER TABLE tarifas 
ADD COLUMN IF NOT EXISTS "descuentoPct" DECIMAL(5,4) DEFAULT 0 NOT NULL;

-- Comentario para documentar el uso de la columna
COMMENT ON COLUMN tarifas."descuentoPct" IS 'Descuento porcentual aplicado ANTES de calcular comisiones (ej: 0.15 para 15% descuento en TN + Transferencia)';

-- Actualizar la tarifa específica de TN + Transferencia con 15% de descuento
-- (Asumiendo que ya existe esta combinación)
UPDATE tarifas 
SET "descuentoPct" = 0.15 
WHERE plataforma = 'TN' 
  AND "metodoPago" = 'PagoNube' 
  AND condicion = 'Transferencia';

-- Verificar la actualización
SELECT 
  plataforma,
  "metodoPago",
  condicion,
  "comisionPct",
  "descuentoPct",
  "iibbPct",
  "fijoPorOperacion"
FROM tarifas 
ORDER BY plataforma, "metodoPago", condicion;
