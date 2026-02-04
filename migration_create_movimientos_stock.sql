-- Crear tabla movimientos_stock si no existe
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id SERIAL PRIMARY KEY,
  producto_id TEXT NOT NULL,
  deposito_origen TEXT,
  deposito_destino TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad INTEGER NOT NULL DEFAULT 1,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones TEXT,
  origen_tipo TEXT,
  origen_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_producto_id ON movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_fecha ON movimientos_stock(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_origen ON movimientos_stock(origen_tipo, origen_id);

-- Verificar si existen movimientos
SELECT 
  COUNT(*) as total_movimientos,
  COUNT(DISTINCT producto_id) as productos_con_movimientos
FROM movimientos_stock;

-- Ver últimos 10 movimientos
SELECT 
  m.*,
  p.modelo as producto_modelo,
  p.sku as producto_sku
FROM movimientos_stock m
LEFT JOIN productos p ON m.producto_id = p.id
ORDER BY m.fecha DESC
LIMIT 10;

-- Habilitar RLS (Row Level Security) si está activado pero sin políticas
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir todas las operaciones (ajustar según necesidades de seguridad)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON movimientos_stock;
CREATE POLICY "Enable all operations for authenticated users"
  ON movimientos_stock
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- También crear política para usuarios anónimos (si es necesario)
DROP POLICY IF EXISTS "Enable read for all users" ON movimientos_stock;
CREATE POLICY "Enable read for all users"
  ON movimientos_stock
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON movimientos_stock;
CREATE POLICY "Enable insert for all users"
  ON movimientos_stock
  FOR INSERT
  WITH CHECK (true);
