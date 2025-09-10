-- Verificar valores de tarifas para entender el problema de comisiones
-- Ejecutar en Supabase SQL Editor

-- 1. Ver todas las tarifas para TN
SELECT 
    plataforma,
    metodoPago,
    condicion,
    comisionPct,
    comisionExtraPct,
    iibbPct,
    fijoPorOperacion,
    descuentoPct
FROM tarifas 
WHERE plataforma = 'TN';

-- 2. Ver la tarifa específica para TN + Transferencia
SELECT 
    plataforma,
    metodoPago,
    condicion,
    comisionPct,
    comisionExtraPct,
    iibbPct,
    fijoPorOperacion,
    descuentoPct
FROM tarifas 
WHERE plataforma = 'TN' 
AND metodoPago = 'Transferencia';

-- 3. Ver los datos de la venta problemática
SELECT 
    id,
    plataforma,
    metodoPago,
    pvBruto,
    comision,
    iibb,
    fecha,
    comprador
FROM ventas 
WHERE comprador LIKE '%Gerónimo%'
ORDER BY fecha DESC
LIMIT 3;

-- 4. Calcular manualmente la comisión esperada
-- Si pvBruto = 5460 y comisionPct = 0.21% (0.0021), entonces comision debería ser:
-- 5460 * 0.0021 = 11.466
-- Si pvBruto = 5460 y comisionPct = 21% (0.21), entonces comision debería ser:
-- 5460 * 0.21 = 1146.6

SELECT 
    'Cálculo manual' as tipo,
    5460 as precio_ejemplo,
    0.0021 as comision_como_decimal,
    5460 * 0.0021 as resultado_decimal,
    0.21 as comision_como_porcentaje,
    5460 * 0.21 as resultado_porcentaje;
