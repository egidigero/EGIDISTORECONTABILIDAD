-- Migration: Actualización de tabla devoluciones existente
-- Descripción: Agrega campos nuevos sin perder datos existentes

-- IMPORTANTE: Esta migración actualiza la tabla existente
-- Si preferís empezar de cero, ejecutá antes: DROP TABLE devoluciones CASCADE;

BEGIN;

-- 1. Renombrar campos existentes para que coincidan con el nuevo esquema
ALTER TABLE devoluciones RENAME COLUMN "ventaId" TO venta_id;
ALTER TABLE devoluciones RENAME COLUMN "montoDevuelto" TO monto_devuelto_viejo; -- Lo vamos a reemplazar
ALTER TABLE devoluciones RENAME COLUMN "costoEnvioIda" TO costo_envio_devolucion;
ALTER TABLE devoluciones RENAME COLUMN "costoEnvioVuelta" TO costo_envio_nuevo;
ALTER TABLE devoluciones RENAME COLUMN "recuperoProducto" TO producto_recuperable;
ALTER TABLE devoluciones RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE devoluciones RENAME COLUMN "updatedAt" TO updated_at;

-- 2. Cambiar tipo de ID de TEXT a UUID
ALTER TABLE devoluciones DROP CONSTRAINT IF EXISTS devoluciones_pkey;
ALTER TABLE devoluciones ALTER COLUMN id TYPE UUID USING gen_random_uuid();
ALTER TABLE devoluciones ADD PRIMARY KEY (id);

-- 3. Cambiar referencia de venta_id
ALTER TABLE devoluciones DROP CONSTRAINT IF EXISTS devoluciones_ventaId_fkey;
ALTER TABLE devoluciones ALTER COLUMN venta_id TYPE UUID USING venta_id::UUID;
ALTER TABLE devoluciones ADD CONSTRAINT devoluciones_venta_id_fkey 
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;

-- 4. Agregar campos nuevos de fechas
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS fecha_compra TIMESTAMP;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS fecha_reclamo TIMESTAMP;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMP;

-- Migrar fecha existente a fecha_reclamo
UPDATE devoluciones SET fecha_reclamo = fecha WHERE fecha_reclamo IS NULL;
-- Obtener fecha_compra de la venta
UPDATE devoluciones d SET fecha_compra = v.fecha 
FROM ventas v WHERE d.venta_id::text = v.id AND d.fecha_compra IS NULL;

ALTER TABLE devoluciones ALTER COLUMN fecha_compra SET NOT NULL;
ALTER TABLE devoluciones ALTER COLUMN fecha_reclamo SET NOT NULL;

-- 5. Agregar campos de contacto
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS nombre_contacto TEXT;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS telefono_contacto TEXT;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS id_devolucion TEXT UNIQUE;

-- 6. Agregar campo de producto nuevo
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS producto_nuevo_id UUID REFERENCES productos(id) ON DELETE SET NULL;

-- 7. Actualizar campo de estados con nuevo constraint
ALTER TABLE devoluciones DROP CONSTRAINT IF EXISTS devoluciones_estado_check;
ALTER TABLE devoluciones ADD CONSTRAINT devoluciones_estado_check CHECK (estado IN (
    'Pendiente',
    'Aceptada en camino',
    'Entregada - Reembolso',
    'Entregada - Cambio mismo producto',
    'Entregada - Cambio otro producto',
    'Entregada - Sin reembolso',
    'Rechazada'
));

-- Migrar estados viejos a nuevos
UPDATE devoluciones SET estado = 'Pendiente' WHERE estado NOT IN (
    'Pendiente', 'Aceptada en camino', 'Entregada - Reembolso', 
    'Entregada - Cambio mismo producto', 'Entregada - Cambio otro producto',
    'Entregada - Sin reembolso', 'Rechazada'
);

-- 8. Agregar campo tipo_resolucion
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS tipo_resolucion TEXT;
ALTER TABLE devoluciones ADD CONSTRAINT devoluciones_tipo_resolucion_check CHECK (
    tipo_resolucion IS NULL OR tipo_resolucion IN (
        'Reembolso',
        'Cambio mismo producto',
        'Cambio otro producto',
        'Sin reembolso'
    )
);

-- 9. Agregar campos de costos de producto
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS costo_producto_original DECIMAL(12,2) DEFAULT 0;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS costo_producto_nuevo DECIMAL(12,2) DEFAULT 0;

-- Obtener costo del producto original de la venta
UPDATE devoluciones d 
SET costo_producto_original = v.costo_producto 
FROM ventas v 
WHERE d.venta_id::text = v.id AND d.costo_producto_original = 0;

-- 10. Agregar campo de envío original
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS costo_envio_original DECIMAL(12,2) DEFAULT 0;

-- Obtener costo de envío original de la venta
UPDATE devoluciones d 
SET costo_envio_original = v.cargo_envio_costo 
FROM ventas v 
WHERE d.venta_id::text = v.id AND d.costo_envio_original = 0;

-- 11. Agregar campos de impacto financiero
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS monto_venta_original DECIMAL(12,2) DEFAULT 0;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS monto_reembolsado DECIMAL(12,2) DEFAULT 0;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS comision_original DECIMAL(12,2) DEFAULT 0;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS comision_devuelta BOOLEAN DEFAULT false;

-- Obtener datos de la venta original
UPDATE devoluciones d 
SET 
    monto_venta_original = v.pv_bruto,
    comision_original = v.comision + COALESCE(v.iva, 0) + COALESCE(v.iibb, 0)
FROM ventas v 
WHERE d.venta_id::text = v.id AND d.monto_venta_original = 0;

-- Migrar monto_devuelto_viejo a monto_reembolsado
UPDATE devoluciones SET monto_reembolsado = monto_devuelto_viejo WHERE monto_reembolsado = 0;

-- 12. Eliminar campo viejo
ALTER TABLE devoluciones DROP COLUMN IF EXISTS monto_devuelto_viejo;
ALTER TABLE devoluciones DROP COLUMN IF EXISTS fecha; -- Ya lo migramos a fecha_reclamo

-- 13. Actualizar campo plataforma para que sea TEXT en vez de ENUM
ALTER TABLE devoluciones ALTER COLUMN plataforma TYPE TEXT;
ALTER TABLE devoluciones ADD CONSTRAINT devoluciones_plataforma_check 
    CHECK (plataforma IN ('TN', 'ML', 'Directo'));

-- 14. Agregar columnas calculadas
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS total_costos_envio DECIMAL(12,2) 
    GENERATED ALWAYS AS (
        COALESCE(costo_envio_original, 0) + 
        COALESCE(costo_envio_devolucion, 0) + 
        COALESCE(costo_envio_nuevo, 0)
    ) STORED;

ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS total_costo_productos DECIMAL(12,2) 
    GENERATED ALWAYS AS (
        CASE 
            WHEN producto_recuperable THEN COALESCE(costo_producto_nuevo, 0)
            ELSE COALESCE(costo_producto_original, 0) + COALESCE(costo_producto_nuevo, 0)
        END
    ) STORED;

ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS impacto_ventas_netas DECIMAL(12,2) 
    GENERATED ALWAYS AS (
        CASE 
            WHEN tipo_resolucion = 'Reembolso' THEN -COALESCE(monto_venta_original, 0)
            ELSE 0
        END
    ) STORED;

ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS perdida_total DECIMAL(12,2) 
    GENERATED ALWAYS AS (
        COALESCE(costo_envio_original, 0) + 
        COALESCE(costo_envio_devolucion, 0) + 
        COALESCE(costo_envio_nuevo, 0) +
        CASE 
            WHEN producto_recuperable THEN COALESCE(costo_producto_nuevo, 0)
            ELSE COALESCE(costo_producto_original, 0) + COALESCE(costo_producto_nuevo, 0)
        END +
        COALESCE(monto_reembolsado, 0) -
        CASE 
            WHEN comision_devuelta THEN COALESCE(comision_original, 0)
            ELSE 0
        END
    ) STORED;

-- 15. Crear índices
CREATE INDEX IF NOT EXISTS idx_devoluciones_venta_id ON devoluciones(venta_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha_reclamo ON devoluciones(fecha_reclamo);
CREATE INDEX IF NOT EXISTS idx_devoluciones_plataforma ON devoluciones(plataforma);
CREATE INDEX IF NOT EXISTS idx_devoluciones_id_devolucion ON devoluciones(id_devolucion);

-- 16. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_devoluciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_devoluciones_updated_at ON devoluciones;
CREATE TRIGGER trigger_devoluciones_updated_at
    BEFORE UPDATE ON devoluciones
    FOR EACH ROW
    EXECUTE FUNCTION update_devoluciones_updated_at();

-- 17. Función para generar ID de devolución automático
CREATE OR REPLACE FUNCTION generar_id_devolucion()
RETURNS TRIGGER AS $$
DECLARE
    nuevo_numero INTEGER;
    nuevo_id TEXT;
BEGIN
    IF NEW.id_devolucion IS NULL THEN
        SELECT COALESCE(MAX(CAST(SUBSTRING(id_devolucion FROM 5) AS INTEGER)), 0) + 1
        INTO nuevo_numero
        FROM devoluciones
        WHERE id_devolucion LIKE 'DEV-%';
        
        nuevo_id := 'DEV-' || LPAD(nuevo_numero::TEXT, 3, '0');
        NEW.id_devolucion := nuevo_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generar_id_devolucion ON devoluciones;
CREATE TRIGGER trigger_generar_id_devolucion
    BEFORE INSERT ON devoluciones
    FOR EACH ROW
    EXECUTE FUNCTION generar_id_devolucion();

-- 18. Generar IDs para registros existentes
UPDATE devoluciones 
SET id_devolucion = 'DEV-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE id_devolucion IS NULL;

-- 19. Vista resumen
CREATE OR REPLACE VIEW devoluciones_resumen AS
SELECT 
    d.id,
    d.id_devolucion,
    d.fecha_compra,
    d.fecha_reclamo,
    d.fecha_completada,
    d.estado,
    d.tipo_resolucion,
    d.plataforma,
    d.motivo,
    d.telefono_contacto,
    d.nombre_contacto,
    v.sale_code,
    v.comprador,
    v.pv_bruto as venta_pv_bruto,
    p.modelo as producto_modelo,
    p.sku as producto_sku,
    d.costo_producto_original,
    d.costo_producto_nuevo,
    d.total_costos_envio,
    d.total_costo_productos,
    d.monto_reembolsado,
    d.comision_devuelta,
    d.perdida_total,
    d.impacto_ventas_netas,
    pn.modelo as producto_nuevo_modelo,
    pn.sku as producto_nuevo_sku,
    d.producto_recuperable,
    d.observaciones
FROM devoluciones d
LEFT JOIN ventas v ON d.venta_id::text = v.id
LEFT JOIN productos p ON v.producto_id = p.id
LEFT JOIN productos pn ON d.producto_nuevo_id::text = pn.id
ORDER BY d.fecha_reclamo DESC;

-- 20. Comentarios
COMMENT ON TABLE devoluciones IS 'Gestión completa de devoluciones y cambios de productos con flujo de estados';
COMMENT ON COLUMN devoluciones.id_devolucion IS 'ID único para etiquetar en WhatsApp (ej: DEV-001)';
COMMENT ON COLUMN devoluciones.estado IS 'Flujo: Pendiente → Aceptada en camino → Entregada (con tipo) / Rechazada';
COMMENT ON COLUMN devoluciones.producto_recuperable IS 'Si el producto devuelto se puede revender (no se pierde como costo)';
COMMENT ON COLUMN devoluciones.comision_devuelta IS 'Si la plataforma devolvió la comisión (no es pérdida neta)';
COMMENT ON COLUMN devoluciones.perdida_total IS 'Pérdida total: envíos + productos perdidos + reembolso - comisión devuelta';

COMMIT;

-- Verificar migración
SELECT 
    'Devoluciones migradas' as info,
    COUNT(*) as total,
    COUNT(id_devolucion) as con_id_devolucion,
    COUNT(fecha_compra) as con_fecha_compra,
    COUNT(costo_producto_original) as con_costo_producto
FROM devoluciones;
