-- Migration: Sistema completo de devoluciones
-- Descripción: Crea/actualiza tabla devoluciones con todos los campos necesarios para gestión completa

-- 1. Eliminar tabla existente si existe (cuidado: esto borra datos)
-- Comentar esta línea si ya tenés devoluciones que querés conservar
-- DROP TABLE IF EXISTS devoluciones CASCADE;

-- 2. Crear tabla devoluciones (si no existe)
CREATE TABLE IF NOT EXISTS devoluciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Referencias
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_nuevo_id UUID REFERENCES productos(id) ON DELETE SET NULL, -- Solo si es cambio a otro producto
    
    -- Fechas
    fecha_compra TIMESTAMP NOT NULL,
    fecha_reclamo TIMESTAMP NOT NULL,
    fecha_completada TIMESTAMP, -- Cuando se completa la devolución
    
    -- Contacto del cliente
    nombre_contacto TEXT,
    telefono_contacto TEXT,
    id_devolucion TEXT UNIQUE, -- ID para etiquetar en WhatsApp (ej: DEV-001)
    
    -- Información del reclamo
    motivo TEXT NOT NULL,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('TN', 'ML', 'Directo')),
    
    -- Estados del flujo
    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN (
        'Pendiente',              -- Se quejaron, hay que analizar
        'Aceptada en camino',     -- Etiqueta generada, producto en camino
        'Entregada - Reembolso',  -- Se completó con reembolso
        'Entregada - Cambio mismo producto',  -- Se cambió por mismo modelo
        'Entregada - Cambio otro producto',   -- Se cambió por otro modelo
        'Entregada - Sin reembolso',          -- Se resolvió sin devolver plata
        'Rechazada'               -- No se aceptó la devolución
    )),
    
    -- Tipo de resolución (se completa cuando se entrega)
    tipo_resolucion TEXT CHECK (tipo_resolucion IN (
        'Reembolso',
        'Cambio mismo producto',
        'Cambio otro producto',
        'Sin reembolso'
    )),
    
    -- Costos del producto
    costo_producto_original DECIMAL(12,2) NOT NULL DEFAULT 0, -- Costo del producto vendido
    costo_producto_nuevo DECIMAL(12,2) DEFAULT 0, -- Si es cambio, costo del nuevo producto
    producto_recuperable BOOLEAN DEFAULT false, -- Si el producto devuelto se puede revender
    
    -- Costos de envío
    costo_envio_original DECIMAL(12,2) NOT NULL DEFAULT 0, -- Envío de la venta original (se pierde)
    costo_envio_devolucion DECIMAL(12,2) DEFAULT 0, -- Envío de retorno (pagás vos)
    costo_envio_nuevo DECIMAL(12,2) DEFAULT 0, -- Envío del nuevo producto (si es cambio)
    
    -- Impacto financiero
    monto_venta_original DECIMAL(12,2) NOT NULL DEFAULT 0, -- PV Bruto original
    monto_reembolsado DECIMAL(12,2) DEFAULT 0, -- Cuánto se devolvió al cliente
    comision_original DECIMAL(12,2) NOT NULL DEFAULT 0, -- Comisión de la venta original
    comision_devuelta BOOLEAN DEFAULT false, -- Si la plataforma devolvió la comisión
    
    -- Cálculos automáticos (columnas generadas)
    total_costos_envio DECIMAL(12,2) GENERATED ALWAYS AS (
        COALESCE(costo_envio_original, 0) + 
        COALESCE(costo_envio_devolucion, 0) + 
        COALESCE(costo_envio_nuevo, 0)
    ) STORED,
    
    total_costo_productos DECIMAL(12,2) GENERATED ALWAYS AS (
        CASE 
            WHEN producto_recuperable THEN COALESCE(costo_producto_nuevo, 0)
            ELSE COALESCE(costo_producto_original, 0) + COALESCE(costo_producto_nuevo, 0)
        END
    ) STORED,
    
    impacto_ventas_netas DECIMAL(12,2) GENERATED ALWAYS AS (
        CASE 
            WHEN tipo_resolucion = 'Reembolso' THEN -COALESCE(monto_venta_original, 0)
            ELSE 0
        END
    ) STORED,
    
    perdida_total DECIMAL(12,2) GENERATED ALWAYS AS (
        -- Costos de envío (siempre se pierden)
        COALESCE(costo_envio_original, 0) + 
        COALESCE(costo_envio_devolucion, 0) + 
        COALESCE(costo_envio_nuevo, 0) +
        -- Costo de productos perdidos
        CASE 
            WHEN producto_recuperable THEN COALESCE(costo_producto_nuevo, 0)
            ELSE COALESCE(costo_producto_original, 0) + COALESCE(costo_producto_nuevo, 0)
        END +
        -- Reembolso al cliente
        COALESCE(monto_reembolsado, 0) -
        -- Restar comisión devuelta (si la plataforma la devolvió, no es pérdida)
        CASE 
            WHEN comision_devuelta THEN COALESCE(comision_original, 0)
            ELSE 0
        END
    ) STORED,
    
    -- Observaciones
    observaciones TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_devoluciones_venta_id ON devoluciones(venta_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha_reclamo ON devoluciones(fecha_reclamo);
CREATE INDEX IF NOT EXISTS idx_devoluciones_plataforma ON devoluciones(plataforma);
CREATE INDEX IF NOT EXISTS idx_devoluciones_id_devolucion ON devoluciones(id_devolucion);

-- 4. Trigger para actualizar updated_at
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

-- 5. Función para generar ID de devolución automático
CREATE OR REPLACE FUNCTION generar_id_devolucion()
RETURNS TRIGGER AS $$
DECLARE
    nuevo_numero INTEGER;
    nuevo_id TEXT;
BEGIN
    IF NEW.id_devolucion IS NULL THEN
        -- Obtener el número más alto actual
        SELECT COALESCE(MAX(CAST(SUBSTRING(id_devolucion FROM 5) AS INTEGER)), 0) + 1
        INTO nuevo_numero
        FROM devoluciones
        WHERE id_devolucion LIKE 'DEV-%';
        
        -- Generar nuevo ID con formato DEV-XXX
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

-- 6. Comentarios para documentación
COMMENT ON TABLE devoluciones IS 'Gestión completa de devoluciones y cambios de productos';
COMMENT ON COLUMN devoluciones.id_devolucion IS 'ID único para etiquetar en WhatsApp (ej: DEV-001)';
COMMENT ON COLUMN devoluciones.estado IS 'Flujo: Pendiente → Aceptada en camino → Entregada (con tipo) / Rechazada';
COMMENT ON COLUMN devoluciones.producto_recuperable IS 'Si el producto devuelto se puede revender (no se pierde como costo)';
COMMENT ON COLUMN devoluciones.comision_devuelta IS 'Si la plataforma devolvió la comisión (no es pérdida neta)';
COMMENT ON COLUMN devoluciones.perdida_total IS 'Pérdida total calculada: envíos + productos perdidos + reembolso - comisión devuelta';

-- 7. Vista resumen para reportes
CREATE OR REPLACE VIEW devoluciones_resumen AS
SELECT 
    d.id,
    d.id_devolucion,
    d.fecha_reclamo,
    d.estado,
    d.tipo_resolucion,
    d.plataforma,
    d.motivo,
    d.telefono_contacto,
    -- Datos de la venta original
    v.sale_code,
    v.comprador,
    v.pv_bruto as venta_pv_bruto,
    -- Datos del producto
    p.modelo as producto_modelo,
    p.sku as producto_sku,
    -- Costos totales
    d.total_costos_envio,
    d.total_costo_productos,
    d.monto_reembolsado,
    d.perdida_total,
    d.impacto_ventas_netas,
    -- Producto nuevo (si es cambio)
    pn.modelo as producto_nuevo_modelo,
    pn.sku as producto_nuevo_sku
FROM devoluciones d
LEFT JOIN ventas v ON d.venta_id = v.id
LEFT JOIN productos p ON v.producto_id = p.id
LEFT JOIN productos pn ON d.producto_nuevo_id = pn.id
ORDER BY d.fecha_reclamo DESC;

COMMENT ON VIEW devoluciones_resumen IS 'Vista resumen de devoluciones con todos los datos relacionados para reportes';

-- 8. Consultas de ejemplo para verificar
-- SELECT * FROM devoluciones_resumen;
-- SELECT estado, COUNT(*), SUM(perdida_total) as perdida_total FROM devoluciones GROUP BY estado;
-- SELECT plataforma, COUNT(*), AVG(perdida_total) as perdida_promedio FROM devoluciones GROUP BY plataforma;
