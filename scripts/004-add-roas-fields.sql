-- Script para agregar campos ROAS a gastos_ingresos
-- Fecha: 2025-09-04

-- Agregar campos para ROAS y cálculo automático de gastos de publicidad
ALTER TABLE gastos_ingresos 
ADD COLUMN IF NOT EXISTS roas_objetivo DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ventas_periodo DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gasto_calculado DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS calculo_automatico BOOLEAN DEFAULT false;

-- Comentarios sobre el uso:
-- roas_objetivo: ROAS objetivo (ej: 3.0 significa que por cada $1 gastado en publicidad, se quieren $3 en ventas)
-- ventas_periodo: Ventas del período para calcular el gasto
-- gasto_calculado: Gasto calculado automáticamente basado en ventas_periodo / roas_objetivo
-- calculo_automatico: Si true, usa gasto_calculado; si false, usa montoARS manual
