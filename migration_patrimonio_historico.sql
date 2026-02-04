-- =====================================================================
-- Migración: Tabla de Historial de Patrimonio
-- =====================================================================
-- Permite rastrear la evolución del patrimonio a lo largo del tiempo

BEGIN;

-- Crear tabla para registrar snapshots del patrimonio
CREATE TABLE IF NOT EXISTS patrimonio_historico (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha DATE NOT NULL,
  
  -- Stock
  patrimonio_stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  unidades_stock INT NOT NULL DEFAULT 0,
  
  -- Liquidaciones
  mp_disponible NUMERIC(14,2) NOT NULL DEFAULT 0,
  mp_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0,
  mp_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
  tn_a_liquidar NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_liquidaciones NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Totales
  patrimonio_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT patrimonio_historico_fecha_unique UNIQUE (fecha)
);

CREATE INDEX IF NOT EXISTS idx_patrimonio_historico_fecha 
  ON patrimonio_historico(fecha DESC);

COMMENT ON TABLE patrimonio_historico IS 
'Registro histórico del patrimonio total del negocio (stock + liquidaciones)';

-- Función para calcular y guardar snapshot de patrimonio
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
  -- Calcular patrimonio en stock
  SELECT 
    COALESCE(SUM(("costoUnitarioARS" * ("stockPropio" + "stockFull"))), 0),
    COALESCE(SUM("stockPropio" + "stockFull"), 0)
  INTO 
    v_patrimonio_stock,
    v_unidades_stock
  FROM productos;
  
  -- Obtener última liquidación <= fecha
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
  
  -- Si no hay liquidaciones, usar 0
  v_mp_disponible := COALESCE(v_mp_disponible, 0);
  v_mp_a_liquidar := COALESCE(v_mp_a_liquidar, 0);
  v_mp_retenido := COALESCE(v_mp_retenido, 0);
  v_tn_a_liquidar := COALESCE(v_tn_a_liquidar, 0);
  
  -- Calcular total liquidaciones
  v_total_liq := v_mp_disponible + v_mp_a_liquidar + v_tn_a_liquidar;
  
  -- Calcular patrimonio total
  v_patrimonio_total := v_patrimonio_stock + v_total_liq;
  
  -- Insertar o actualizar registro
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

COMMENT ON FUNCTION registrar_patrimonio_diario IS 
'Registra un snapshot del patrimonio total para una fecha específica';

-- Vista para ver la evolución del patrimonio
CREATE OR REPLACE VIEW patrimonio_evolucion AS
SELECT 
  fecha,
  patrimonio_stock,
  unidades_stock,
  mp_disponible,
  mp_a_liquidar,
  mp_retenido,
  tn_a_liquidar,
  total_liquidaciones,
  patrimonio_total,
  -- Calcular variación respecto al día anterior
  patrimonio_total - LAG(patrimonio_total, 1) OVER (ORDER BY fecha) AS variacion_dia,
  -- Calcular % de cambio
  CASE 
    WHEN LAG(patrimonio_total, 1) OVER (ORDER BY fecha) > 0 
    THEN ((patrimonio_total - LAG(patrimonio_total, 1) OVER (ORDER BY fecha)) / LAG(patrimonio_total, 1) OVER (ORDER BY fecha)) * 100
    ELSE 0
  END AS variacion_porcentaje,
  created_at
FROM patrimonio_historico
ORDER BY fecha DESC;

COMMENT ON VIEW patrimonio_evolucion IS 
'Evolución del patrimonio con variaciones diarias calculadas';

-- Registrar patrimonio de hoy (inicial)
SELECT registrar_patrimonio_diario(CURRENT_DATE);

COMMIT;

-- =====================================================================
-- NOTAS DE USO:
-- =====================================================================
-- 
-- 1. Registrar patrimonio diario (ejecutar en cron job):
--    SELECT registrar_patrimonio_diario(CURRENT_DATE);
--
-- 2. Ver evolución del patrimonio:
--    SELECT * FROM patrimonio_evolucion ORDER BY fecha DESC LIMIT 30;
--
-- 3. Ver patrimonio de un mes específico:
--    SELECT * FROM patrimonio_evolucion 
--    WHERE fecha >= '2026-01-01' AND fecha <= '2026-01-31';
--
-- =====================================================================
