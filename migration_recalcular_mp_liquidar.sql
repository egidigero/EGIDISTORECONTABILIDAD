-- Script para recalcular mp_a_liquidar basándose en las ventas ML existentes
-- Este script suma todas las ventas ML de cada fecha y actualiza el mp_a_liquidar correspondiente

-- Primero, crear una tabla temporal con los totales por fecha
WITH ventas_ml_por_fecha AS (
  SELECT 
    fecha,
    SUM(
      COALESCE("pvBruto", 0) 
      - COALESCE(comision, 0) 
      - COALESCE(iva, 0) 
      - COALESCE(iibb, 0) 
      - COALESCE("cargoEnvioCosto", 0)
    ) as total_a_liquidar_ml
  FROM ventas
  WHERE plataforma = 'ML'
  GROUP BY fecha
)

-- Actualizar las liquidaciones con los valores correctos
UPDATE liquidaciones l
SET 
  mp_a_liquidar = COALESCE(v.total_a_liquidar_ml, 0),
  updated_at = NOW()
FROM ventas_ml_por_fecha v
WHERE l.fecha = v.fecha;

-- Mostrar resumen de lo que se actualizó
SELECT 
  l.fecha,
  l.mp_a_liquidar as mp_a_liquidar_actualizado,
  COALESCE(v.total_a_liquidar_ml, 0) as total_calculado_ventas_ml,
  (SELECT COUNT(*) FROM ventas WHERE plataforma = 'ML' AND fecha = l.fecha) as cantidad_ventas_ml
FROM liquidaciones l
LEFT JOIN ventas_ml_por_fecha v ON l.fecha = v.fecha
WHERE EXISTS (SELECT 1 FROM ventas WHERE plataforma = 'ML' AND fecha = l.fecha)
ORDER BY l.fecha DESC;

-- Nota: Este script REEMPLAZA el mp_a_liquidar con el calculado desde las ventas
-- Si tienes mp_a_liquidar de periodos anteriores que se arrastra, esto lo perderá
-- Para ACUMULAR en lugar de reemplazar, usa el siguiente query alternativo:

/*
-- ALTERNATIVA: Solo AGREGAR las ventas ML al mp_a_liquidar existente
-- (usar esto si ya tienes saldos previos que quieres mantener)

WITH ventas_ml_por_fecha AS (
  SELECT 
    fecha,
    SUM(
      COALESCE("pvBruto", 0) 
      - COALESCE(comision, 0) 
      - COALESCE(iva, 0) 
      - COALESCE(iibb, 0) 
      - COALESCE("cargoEnvioCosto", 0)
    ) as total_a_liquidar_ml
  FROM ventas
  WHERE plataforma = 'ML'
  GROUP BY fecha
),
saldos_actuales AS (
  SELECT 
    l.id,
    l.fecha,
    l.mp_a_liquidar as mp_actual,
    COALESCE(v.total_a_liquidar_ml, 0) as ventas_ml_fecha
  FROM liquidaciones l
  LEFT JOIN ventas_ml_por_fecha v ON l.fecha = v.fecha
)
UPDATE liquidaciones
SET 
  mp_a_liquidar = s.mp_actual + s.ventas_ml_fecha,
  updated_at = NOW()
FROM saldos_actuales s
WHERE liquidaciones.id = s.id
  AND s.ventas_ml_fecha > 0;
*/
