-- Agregar columnas courier y externalOrderId a la tabla ventas
-- Ejecutar en Supabase SQL Editor

ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS courier TEXT,
ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN ventas.courier IS 'Empresa de courier utilizada para el envío (Correo Argentino, OCA, etc.)';
COMMENT ON COLUMN ventas."externalOrderId" IS 'ID de orden externa de la plataforma (ML, TN, etc.)';
