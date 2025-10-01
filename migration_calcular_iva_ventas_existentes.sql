-- Script para calcular y actualizar el IVA en ventas existentes
-- Fecha: 2025-10-01
-- Descripción: Calcula el IVA de las ventas existentes basándose en la plataforma y comisión

-- IMPORTANTE: Este script actualiza los registros existentes.
-- Ejecutar en un ambiente de prueba primero si es posible.

-- Actualizar IVA para ventas de Tienda Nube (TN)
-- Para TN: IVA = 21% de la comisión
UPDATE ventas
SET iva = ROUND(comision * 0.21, 2),
    updatedAt = NOW()
WHERE plataforma = 'TN' 
  AND iva = 0;

-- Actualizar IVA para ventas de Mercado Libre (ML)
-- Para ML: La comisión ya incluye IVA, necesitamos desglosarlo
-- IVA = Comisión - (Comisión / 1.21)
UPDATE ventas
SET iva = ROUND(comision - (comision / 1.21), 2),
    updatedAt = NOW()
WHERE plataforma = 'ML' 
  AND iva = 0;

-- Ventas Directas no llevan IVA adicional (ya está en 0)

-- Verificar resultados
SELECT 
  plataforma,
  COUNT(*) as total_ventas,
  ROUND(AVG(comision), 2) as comision_promedio,
  ROUND(AVG(iva), 2) as iva_promedio,
  ROUND(AVG(iibb), 2) as iibb_promedio,
  ROUND(SUM(iva), 2) as iva_total
FROM ventas
GROUP BY plataforma
ORDER BY plataforma;

-- Verificar registros actualizados
SELECT 
  id,
  fecha,
  plataforma,
  comision,
  iva,
  iibb,
  updatedAt
FROM ventas
ORDER BY fecha DESC
LIMIT 10;
