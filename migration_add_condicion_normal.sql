-- Migración: Agregar condición "Normal" a las tablas
-- Fecha: 2025-10-01
-- Descripción: Agrega "Normal" como opción válida en los constraints de condición

-- PRIMERO: Verificar el tipo de dato y constraints actuales
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'condicion' 
  AND table_name IN ('ventas', 'tarifas')
ORDER BY table_name;

-- Ver constraints existentes
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('ventas', 'tarifas')
  AND (tc.constraint_name LIKE '%condicion%' OR cc.check_clause LIKE '%condicion%')
ORDER BY tc.table_name;

-- Si existe constraint CHECK, eliminarlo y recrearlo
DO $$ 
BEGIN
  -- Eliminar constraint en VENTAS si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ventas_condicion_check' 
    AND table_name = 'ventas'
  ) THEN
    ALTER TABLE ventas DROP CONSTRAINT ventas_condicion_check;
    RAISE NOTICE 'Constraint ventas_condicion_check eliminado';
  END IF;

  -- Eliminar constraint en TARIFAS si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tarifas_condicion_check' 
    AND table_name = 'tarifas'
  ) THEN
    ALTER TABLE tarifas DROP CONSTRAINT tarifas_condicion_check;
    RAISE NOTICE 'Constraint tarifas_condicion_check eliminado';
  END IF;
END $$;

-- Crear nuevos constraints con las 3 opciones
ALTER TABLE ventas 
ADD CONSTRAINT ventas_condicion_check 
CHECK (condicion IN ('Transferencia', 'Cuotas sin interés', 'Normal'));

ALTER TABLE tarifas 
ADD CONSTRAINT tarifas_condicion_check 
CHECK (condicion IN ('Transferencia', 'Cuotas sin interés', 'Normal'));

-- Verificar que los constraints se aplicaron correctamente
SELECT 
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_name LIKE '%condicion_check%'
ORDER BY tc.table_name;

-- Comentarios:
-- Este script:
-- 1. Verifica el esquema actual de las columnas condicion
-- 2. Elimina los constraints CHECK existentes si los hay
-- 3. Crea nuevos constraints que incluyen "Normal"
-- 4. Verifica que todo se aplicó correctamente
--
-- Si las columnas son VARCHAR sin constraints, el script agregará los constraints.
-- Si ya tienen constraints, los reemplazará con los nuevos valores.
