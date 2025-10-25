-- Migration: Recrear vista devoluciones_resumen (safe swap)
-- Objetivo: crear una versión robusta de la vista `devoluciones_resumen` que tolera
-- diferencias entre camelCase y snake_case en instalaciones heterogéneas y expone
-- las columnas clave que usa la UI (id_devolucion, numero_seguimiento, fechas en formato TIMESTAMP, etc.).

-- NOTA: Esta migración no modifica la tabla `devoluciones`. Solo crea/renombra la vista.
-- Procedimiento:
--  1) Crea `devoluciones_resumen_new` con la definición deseada.
--  2) Si existe `devoluciones_resumen`, la renombra a `devoluciones_resumen_old`.
--  3) Renombra `devoluciones_resumen_new` a `devoluciones_resumen` (operación atómica).
--  4) Elimina la vista antigua `devoluciones_resumen_old` si existía.

-- La definición usa `to_jsonb(d)->> 'campo'` con COALESCE para tolerar nombres camelCase/snake_case
-- y asegura que las fechas resulten en TIMESTAMP (o NULL) para evitar "Invalid Date" en el frontend.

CREATE OR REPLACE VIEW devoluciones_resumen_new AS
SELECT
    -- Identificador único (uuid)
    d.id AS id,

    -- id_devolucion: acepta id_devolucion o idDevolucion
    COALESCE(
        d.id_devolucion,
        (to_jsonb(d) ->> 'idDevolucion'),
        (to_jsonb(d) ->> 'id_devolucion')
    ) AS id_devolucion,

    -- numero_seguimiento: acepta numeroSeguimiento o numero_seguimiento
    COALESCE(
        d.numero_seguimiento,
        (to_jsonb(d) ->> 'numeroSeguimiento'),
        (to_jsonb(d) ->> 'numero_seguimiento')
    ) AS numero_seguimiento,

    -- Fechas: intentar la columna TIMESTAMP, si no usar las variantes camelCase/snake_case y castear a timestamp
    COALESCE(
        d.fecha_compra,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fechaCompra','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fecha_compra','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp,
        d.created_at
    ) AS fecha_compra,

    COALESCE(
        d.fecha_reclamo,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fechaReclamo','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fecha_reclamo','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp,
        d.created_at
    ) AS fecha_reclamo,

    COALESCE(
        d.fecha_completada,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fechaCompletada','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp,
        (to_timestamp(NULLIF(to_jsonb(d) ->> 'fecha_completada','') , 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::timestamp
    ) AS fecha_completada,

    -- Estados y texto descriptivo
    COALESCE(d.estado, to_jsonb(d) ->> 'estado') AS estado,
    COALESCE(d.tipo_resolucion, to_jsonb(d) ->> 'tipoResolucion', to_jsonb(d) ->> 'tipo_resolucion') AS tipo_resolucion,
    COALESCE(d.plataforma, to_jsonb(d) ->> 'plataforma') AS plataforma,
    COALESCE(d.motivo, to_jsonb(d) ->> 'motivo') AS motivo,

    -- Contacto
    COALESCE(d.telefono_contacto, to_jsonb(d) ->> 'telefonoContacto', to_jsonb(d) ->> 'telefono_contacto') AS telefono_contacto,
    COALESCE(d.nombre_contacto, to_jsonb(d) ->> 'nombreContacto', to_jsonb(d) ->> 'nombre_contacto') AS nombre_contacto,

    -- Referencia a venta (acepta venta_id o ventaId).
    -- Incluimos d.venta_id directo porque la tabla original expone ese campo.
    COALESCE(
        d.venta_id::text,
        (to_jsonb(d) ->> 'venta_id'),
        (to_jsonb(d) ->> 'ventaId')
    ) AS venta_id_text,

    -- Campos financieros/estadísticos expuestos por la tabla
    COALESCE(d.total_costos_envio, (to_jsonb(d) ->> 'totalCostosEnvio')::numeric, (to_jsonb(d) ->> 'total_costos_envio')::numeric) AS total_costos_envio,
    COALESCE(d.total_costo_productos, (to_jsonb(d) ->> 'totalCostoProductos')::numeric, (to_jsonb(d) ->> 'total_costo_productos')::numeric) AS total_costo_productos,
    COALESCE(d.monto_reembolsado, (to_jsonb(d) ->> 'montoReembolsado')::numeric, (to_jsonb(d) ->> 'monto_reembolsado')::numeric) AS monto_reembolsado,
    COALESCE(d.perdida_total, (to_jsonb(d) ->> 'perdidaTotal')::numeric, (to_jsonb(d) ->> 'perdida_total')::numeric) AS perdida_total,
    COALESCE(d.impacto_ventas_netas, (to_jsonb(d) ->> 'impactoVentasNetas')::numeric, (to_jsonb(d) ->> 'impacto_ventas_netas')::numeric) AS impacto_ventas_netas,

    -- Producto y venta: haremos LEFT JOINs intentando enlazar por las variantes de venta_id/ventaId
    v.id as venta_id,
    -- sale_code: extraer por JSON para tolerar variaciones de nombre (sale_code, saleCode, salecode, code)
    COALESCE(
        (to_jsonb(v) ->> 'sale_code'),
        (to_jsonb(v) ->> 'saleCode'),
        (to_jsonb(v) ->> 'salecode'),
        (to_jsonb(v) ->> 'code')
    ) AS sale_code,
    -- comprador (buyer)
    COALESCE(
        (to_jsonb(v) ->> 'comprador'),
        (to_jsonb(v) ->> 'buyer'),
        (to_jsonb(v) ->> 'customer_name')
    ) AS comprador,
    -- pv_bruto: extraer variantes y castear a numeric de forma segura
    COALESCE(
        (NULLIF(to_jsonb(v) ->> 'pv_bruto',''))::numeric,
        (NULLIF(to_jsonb(v) ->> 'pvBruto',''))::numeric,
        (NULLIF(to_jsonb(v) ->> 'pvBrutoLocal',''))::numeric
    ) AS venta_pv_bruto,

    p.id as producto_id,
    COALESCE(
        (to_jsonb(p) ->> 'modelo'),
        (to_jsonb(p) ->> 'nombre'),
        (to_jsonb(p) ->> 'title')
    ) AS producto_modelo,
    COALESCE(
        (to_jsonb(p) ->> 'sku'),
        (to_jsonb(p) ->> 'codigo_sku')
    ) AS producto_sku,

    pn.id as producto_nuevo_id,
    COALESCE(
        (to_jsonb(pn) ->> 'modelo'),
        (to_jsonb(pn) ->> 'nombre'),
        (to_jsonb(pn) ->> 'title')
    ) AS producto_nuevo_modelo,
    COALESCE(
        (to_jsonb(pn) ->> 'sku'),
        (to_jsonb(pn) ->> 'codigo_sku')
    ) AS producto_nuevo_sku,

    d.observaciones,
    d.producto_recuperable,
    d.comision_devuelta

FROM devoluciones d
-- Usamos sólo comparación de valores extraídos a JSON para evitar referencias a columnas
-- que pueden existir con nombres diferentes (camelCase vs snake_case).
LEFT JOIN ventas v ON (
    (d.venta_id IS NOT NULL AND d.venta_id::text = v.id) OR
    (to_jsonb(d) ->> 'ventaId') = v.id OR
    (to_jsonb(d) ->> 'venta_id') = v.id
)
LEFT JOIN productos p ON (
    -- la propiedad del producto puede venir en v como productoId o producto_id
    (to_jsonb(v) ->> 'productoId') = p.id OR
    (to_jsonb(v) ->> 'producto_id') = p.id
)
LEFT JOIN productos pn ON (
    (to_jsonb(d) ->> 'productoNuevoId') = pn.id OR
    (to_jsonb(d) ->> 'producto_nuevo_id') = pn.id
)

ORDER BY fecha_reclamo DESC;

-- Swap seguro: renombrar vistas (se realiza en un DO bloque para evitar DROP CASCADE)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen') THEN
        EXECUTE 'ALTER VIEW devoluciones_resumen RENAME TO devoluciones_resumen_old';
    END IF;
    EXECUTE 'ALTER VIEW devoluciones_resumen_new RENAME TO devoluciones_resumen';
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'devoluciones_resumen_old') THEN
        EXECUTE 'DROP VIEW IF EXISTS devoluciones_resumen_old';
    END IF;
END
$$;

COMMENT ON VIEW devoluciones_resumen IS 'Vista resumen recreada (robusta) — incluye alias camelCase/snake_case y normaliza fechas para UI.';

-- Fin migration
