-- Verificar y corregir la configuración del campo ID en la tabla ventas
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la estructura actual de la tabla ventas
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ventas' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Si el campo ID no tiene auto-increment, agregarlo
-- (Descomenta las siguientes líneas si es necesario)

-- DROP SEQUENCE IF EXISTS ventas_id_seq CASCADE;
-- CREATE SEQUENCE ventas_id_seq;
-- ALTER TABLE ventas ALTER COLUMN id SET DEFAULT nextval('ventas_id_seq');
-- ALTER SEQUENCE ventas_id_seq OWNED BY ventas.id;
-- SELECT setval('ventas_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM ventas;

-- 3. Verificar que el campo ID sea NOT NULL y PRIMARY KEY
-- ALTER TABLE ventas ALTER COLUMN id SET NOT NULL;
-- ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_pkey;
-- ALTER TABLE ventas ADD PRIMARY KEY (id);
