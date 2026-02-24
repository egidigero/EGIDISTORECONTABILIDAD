-- Backfill canonico de devoluciones para alinear perdida_total con reglas de negocio:
-- 1) "Sin reembolso" no tiene perdida.
-- 2) "ML sin reclamo" no pierde envios (solo producto si aplica).

BEGIN;

-- Regla 1: Sin reembolso
UPDATE devoluciones
SET
  costo_envio_original = 0,
  costo_envio_devolucion = 0,
  costo_envio_nuevo = 0,
  monto_reembolsado = 0,
  producto_recuperable = true,
  updated_at = NOW()
WHERE
  COALESCE(tipo_resolucion, '') = 'Sin reembolso'
  OR COALESCE(estado, '') ILIKE '%Sin reembolso%';

-- Regla 2: Mercado Libre sin reclamo
UPDATE devoluciones
SET
  costo_envio_original = 0,
  costo_envio_devolucion = 0,
  costo_envio_nuevo = 0,
  updated_at = NOW()
WHERE
  plataforma = 'ML'
  AND fue_reclamo = false;

COMMIT;
