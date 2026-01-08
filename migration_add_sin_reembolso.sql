-- Agregar "Sin reembolso" al enum de tipo_resolucion
-- Esto permite marcar devoluciones donde el cliente nunca devolvió el producto

-- 1. Agregar el nuevo valor al tipo enum existente
ALTER TYPE tipo_resolucion_enum ADD VALUE IF NOT EXISTS 'Sin reembolso';

-- 2. Agregar el nuevo valor al estado enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'Entregada - Sin reembolso' 
        AND enumtypid = 'estado_devolucion_enum'::regtype
    ) THEN
        ALTER TYPE estado_devolucion_enum ADD VALUE 'Entregada - Sin reembolso';
    END IF;
END $$;

-- 3. Comentar el propósito del nuevo tipo
COMMENT ON TYPE tipo_resolucion_enum IS 'Tipo de resolución de devolución: Reembolso (cliente recibe dinero), Cambio mismo producto, Cambio otro producto, o Sin reembolso (cliente nunca devolvió, se libera dinero retenido)';

-- 4. Crear tipo de delta para sin_reembolso en devoluciones_deltas si no existe
DO $$ 
BEGIN
    -- Verificar si la tabla devoluciones_deltas existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devoluciones_deltas') THEN
        -- Verificar si el tipo enum existe
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_delta_devolucion_enum') THEN
            -- Agregar 'sin_reembolso' si no existe
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'sin_reembolso' 
                AND enumtypid = 'tipo_delta_devolucion_enum'::regtype
            ) THEN
                ALTER TYPE tipo_delta_devolucion_enum ADD VALUE 'sin_reembolso';
            END IF;
        END IF;
    END IF;
END $$;

-- 5. Verificar los nuevos valores
SELECT 
    'Verificación de enums' as mensaje,
    unnest(enum_range(NULL::tipo_resolucion_enum)) as tipo_resolucion,
    unnest(enum_range(NULL::estado_devolucion_enum)) as estado_devolucion;
