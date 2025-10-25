-- Migración: Añadir columnas de 'delta' en `devoluciones` para que el recálculo
-- de `liquidaciones` pueda sumar los ajustes por tipo (MP/TN) por fecha
-- y aplicarlos mediante la cascada en lugar de escribir directamente en la tabla
-- de liquidaciones desde múltiples puntos del código.
--
-- Recomendación: probar en staging antes de ejecutar en producción.
-- Ejecutar en Supabase SQL editor o psql.

BEGIN;

-- 1) Añadir columnas numéricas para representar cambios a aplicar en liquidaciones
ALTER TABLE IF EXISTS devoluciones
  ADD COLUMN IF NOT EXISTS delta_mp_disponible NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_mp_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_mp_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_tn_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 2) Añadir columna opcional que indica la fecha de impacto contable explícita
-- (si preferís usar fecha_completada ya existente, este campo es opcional);
ALTER TABLE IF EXISTS devoluciones
  ADD COLUMN IF NOT EXISTS fecha_impacto DATE;

-- 3) Índices para consultas por fecha de impacto o fecha_completada
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha_impacto ON devoluciones (fecha_impacto);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha_completada ON devoluciones (fecha_completada);

COMMIT;

-- NOTES:
-- - La idea es: cuando se procesa una devolución (create/update/finalize), en lugar de
--   tocar `liquidaciones` directamente, el código debe escribir los delta_* correspondientes
--   y guardar `fecha_impacto` (o usar `fecha_completada`) con la fecha donde se quiere
--   aplicar el efecto contable.
-- - Luego, `recalcularLiquidacionesEnCascada(fecha)` debe sumar todos los deltas de
--   devoluciones cuya `fecha_impacto` o `fecha_completada` sea la fecha objetivo y
--   agregar esos montos al cálculo central de la liquidación de esa fecha.
-- - Ejemplo de asignación de deltas (pseudocódigo):
--     delta_mp_disponible = -monto_a_decrementar_en_mp_disponible
--     delta_mp_a_liquidar = -monto_a_decrementar_en_mp_a_liquidar
--     delta_mp_retenido = +monto_a_incrementar_en_mp_retenido
--     delta_tn_a_liquidar = -monto_a_decrementar_en_tn_a_liquidar
-- - Recomiendo actualizar la función `createGastoIngreso` / `updateDevolucion` y
--   `updateDevolucion` para calcular y persistir estos valores en lugar de actualizar
--   `liquidaciones` directamente. Luego `recalcularLiquidacionesEnCascada` debe
--   agregarlos al sumar las fuentes de MP/TN cuando arme la liquidación.
-- - Después de ejecutar esta migración, desplegar la app y modificar la lógica
--   server-side para que use estos campos y luego ejecutar el recálculo para las
--   fechas afectadas.
