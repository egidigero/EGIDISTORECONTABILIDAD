-- Script para agregar campo precioVenta a productos y configuraciones de comisiones
-- Fecha: 2025-09-04

-- Agregar campo precioVenta a productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS precio_venta DECIMAL(10,2) DEFAULT 0;

-- Crear tabla para configuraciones de comisiones y envíos
CREATE TABLE IF NOT EXISTS configuraciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plataforma VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'comision', 'envio', 'iva', 'iibb'
    valor DECIMAL(10,4) NOT NULL,
    descripcion TEXT,
    es_porcentaje BOOLEAN DEFAULT true,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plataforma, tipo)
);

-- Insertar configuraciones iniciales
INSERT INTO configuraciones (plataforma, tipo, valor, descripcion, es_porcentaje) VALUES
-- Tienda Nube
('Tienda Nube', 'iva', 21.0, 'IVA 21% sobre el precio', true),
('Tienda Nube', 'iibb', 0.3, 'IIBB 0.3% sobre el precio', true),
('Tienda Nube', 'envio', 0.0, 'Envío variable - configurar por venta', false),

-- Mercado Libre  
('Mercado Libre', 'comision', 21.0, 'Comisión 21% (ya incluye IVA)', true),
('Mercado Libre', 'envio', 5303.99, 'Envío fijo Mercado Libre', false)

ON CONFLICT (plataforma, tipo) DO NOTHING;

-- Comentarios sobre el uso
-- Para Tienda Nube: precio + IVA(21%) + IIBB(0.3%) + envío variable
-- Para Mercado Libre: precio + comisión(21% ya con IVA) + envío fijo(5303.99)
