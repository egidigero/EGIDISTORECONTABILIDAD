-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  descripcion TEXT
);

-- Tabla de cajas (solo para depósito CASA)
CREATE TABLE IF NOT EXISTS cajas (
  id VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL
);

-- Tabla de stock por ubicación
CREATE TABLE IF NOT EXISTS stock_ubicacion (
  id SERIAL PRIMARY KEY,
  producto_id VARCHAR REFERENCES productos(id),
  deposito VARCHAR NOT NULL, -- CASA o FULL_ML
  cantidad INTEGER NOT NULL,
  caja_id VARCHAR REFERENCES cajas(id)
);

-- Tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id SERIAL PRIMARY KEY,
  producto_id VARCHAR REFERENCES productos(id),
  deposito_origen VARCHAR NOT NULL,
  deposito_destino VARCHAR,
  caja_origen_id VARCHAR,
  caja_destino_id VARCHAR,
  tipo VARCHAR NOT NULL, -- INGRESO, EGRESO, TRANSFERENCIA
  cantidad INTEGER NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  observaciones TEXT
);
