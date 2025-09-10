-- Verificar si hay relaciones de clave foránea con la tabla ventas
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar claves foráneas que REFERENCIAN a ventas.id
SELECT 
    tc.table_name as tabla_origen, 
    kcu.column_name as columna_origen,
    ccu.table_name AS tabla_referenciada,
    ccu.column_name AS columna_referenciada
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name='ventas';

-- 2. Verificar claves foráneas QUE SALEN de ventas hacia otras tablas
SELECT 
    tc.table_name as tabla_origen, 
    kcu.column_name as columna_origen,
    ccu.table_name AS tabla_referenciada,
    ccu.column_name AS columna_referenciada
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='ventas';

-- 3. Ver los datos existentes en ventas para entender el formato del ID
SELECT id, LENGTH(id) as longitud_id, fecha, comprador 
FROM ventas 
LIMIT 5;
