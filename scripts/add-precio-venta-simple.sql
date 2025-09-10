-- Ejecutar en Supabase SQL Editor

-- 1. Agregar campo precio_venta a la tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS precio_venta DECIMAL(10,2) DEFAULT 0;

-- 2. Opcional: Actualizar productos existentes (copiar precioVentaSugerido a precioVenta)
UPDATE productos 
SET precio_venta = COALESCE(precioVentaSugerido, 0) 
WHERE precio_venta = 0;
