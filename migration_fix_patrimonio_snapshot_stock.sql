BEGIN;

CREATE OR REPLACE FUNCTION registrar_patrimonio_diario(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_patrimonio_stock NUMERIC(14,2);
  v_unidades_stock INT;
  v_mp_disponible NUMERIC(14,2);
  v_mp_a_liquidar NUMERIC(14,2);
  v_mp_retenido NUMERIC(14,2);
  v_tn_a_liquidar NUMERIC(14,2);
  v_total_liq NUMERIC(14,2);
  v_patrimonio_total NUMERIC(14,2);
BEGIN
  WITH stock_por_producto AS (
    SELECT
      m.producto_id,
      SUM(
        CASE
          WHEN m.tipo = 'entrada' THEN m.cantidad
          WHEN m.tipo = 'salida' THEN -m.cantidad
          ELSE 0
        END
      ) AS cantidad_stock
    FROM movimientos_stock m
    WHERE m.fecha < (p_fecha + INTERVAL '1 day')
    GROUP BY m.producto_id
  )
  SELECT
    COALESCE(SUM(p."costoUnitarioARS" * spp.cantidad_stock), 0),
    COALESCE(SUM(spp.cantidad_stock), 0)
  INTO
    v_patrimonio_stock,
    v_unidades_stock
  FROM stock_por_producto spp
  JOIN productos p ON p.id = spp.producto_id;

  SELECT
    COALESCE(mp_disponible, 0),
    COALESCE(mp_a_liquidar, 0),
    COALESCE(mp_retenido, 0),
    COALESCE(tn_a_liquidar, 0)
  INTO
    v_mp_disponible,
    v_mp_a_liquidar,
    v_mp_retenido,
    v_tn_a_liquidar
  FROM liquidaciones
  WHERE fecha <= p_fecha
  ORDER BY fecha DESC
  LIMIT 1;

  v_mp_disponible := COALESCE(v_mp_disponible, 0);
  v_mp_a_liquidar := COALESCE(v_mp_a_liquidar, 0);
  v_mp_retenido := COALESCE(v_mp_retenido, 0);
  v_tn_a_liquidar := COALESCE(v_tn_a_liquidar, 0);

  v_total_liq := v_mp_disponible + v_mp_a_liquidar + v_tn_a_liquidar;
  v_patrimonio_total := v_patrimonio_stock + v_total_liq;

  INSERT INTO patrimonio_historico (
    fecha,
    patrimonio_stock,
    unidades_stock,
    mp_disponible,
    mp_a_liquidar,
    mp_retenido,
    tn_a_liquidar,
    total_liquidaciones,
    patrimonio_total
  ) VALUES (
    p_fecha,
    v_patrimonio_stock,
    v_unidades_stock,
    v_mp_disponible,
    v_mp_a_liquidar,
    v_mp_retenido,
    v_tn_a_liquidar,
    v_total_liq,
    v_patrimonio_total
  )
  ON CONFLICT (fecha)
  DO UPDATE SET
    patrimonio_stock = EXCLUDED.patrimonio_stock,
    unidades_stock = EXCLUDED.unidades_stock,
    mp_disponible = EXCLUDED.mp_disponible,
    mp_a_liquidar = EXCLUDED.mp_a_liquidar,
    mp_retenido = EXCLUDED.mp_retenido,
    tn_a_liquidar = EXCLUDED.tn_a_liquidar,
    total_liquidaciones = EXCLUDED.total_liquidaciones,
    patrimonio_total = EXCLUDED.patrimonio_total,
    created_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
