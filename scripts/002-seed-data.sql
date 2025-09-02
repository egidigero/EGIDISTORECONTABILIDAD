-- Insertar productos de ejemplo
INSERT INTO productos (id, modelo, sku, "costoUnitarioARS", activo) VALUES
('prod_1', 'SmartWatch Pro X1', 'SW-PRO-X1', 15000.00, true),
('prod_2', 'SmartWatch Elegant Rose', 'SW-ELG-ROSE', 12000.00, true),
('prod_3', 'SmartWatch Sport Black', 'SW-SPT-BLK', 18000.00, true),
('prod_4', 'SmartWatch Classic Silver', 'SW-CLS-SLV', 14000.00, true),
('prod_5', 'SmartWatch Fitness Pink', 'SW-FIT-PINK', 16000.00, true);

-- Insertar tarifas por plataforma y método de pago
INSERT INTO tarifas (id, plataforma, "metodoPago", "comisionPct", "iibbPct", "fijoPorOperacion", key) VALUES
-- Tienda Nube
('tar_tn_pn', 'TN', 'PagoNube', 0.0699, 0.021, 0.00, 'TN_PagoNube'),
('tar_tn_mp', 'TN', 'MercadoPago', 0.0699, 0.021, 0.00, 'TN_MercadoPago'),
('tar_tn_tr', 'TN', 'Transferencia', 0.00, 0.00, 0.00, 'TN_Transferencia'),

-- Mercado Libre
('tar_ml_mp', 'ML', 'MercadoPago', 0.1699, 0.021, 0.00, 'ML_MercadoPago'),

-- Directo
('tar_dir_tr', 'Directo', 'Transferencia', 0.00, 0.00, 0.00, 'Directo_Transferencia'),
('tar_dir_ef', 'Directo', 'Efectivo', 0.00, 0.00, 0.00, 'Directo_Efectivo');

-- Insertar ventas de ejemplo
INSERT INTO ventas (
    id, fecha, comprador, plataforma, "metodoPago", "productoId", 
    "pvBruto", "cargoEnvioCosto", comision, iibb, "precioNeto", 
    "costoProducto", "ingresoMargen", "rentabilidadSobrePV", "rentabilidadSobreCosto",
    "estadoEnvio", "saleCode"
) VALUES
('venta_1', '2024-01-15 10:30:00', 'María González', 'TN', 'PagoNube', 'prod_1', 
 25000.00, 1500.00, 1747.50, 525.00, 22727.50, 15000.00, 6227.50, 0.2491, 0.4152,
 'Entregado', 'TN-2024-001'),
 
('venta_2', '2024-01-16 14:20:00', 'Ana Rodríguez', 'ML', 'MercadoPago', 'prod_2', 
 20000.00, 1200.00, 3398.00, 420.00, 16182.00, 12000.00, 2982.00, 0.1491, 0.2485,
 'EnCamino', 'ML-2024-002'),
 
('venta_3', '2024-01-17 09:15:00', 'Laura Martín', 'Directo', 'Transferencia', 'prod_3', 
 30000.00, 0.00, 0.00, 0.00, 30000.00, 18000.00, 12000.00, 0.4000, 0.6667,
 'Entregado', 'DIR-2024-003'),
 
('venta_4', '2024-01-18 16:45:00', 'Carmen Silva', 'TN', 'MercadoPago', 'prod_4', 
 22000.00, 1300.00, 1537.80, 462.00, 19700.20, 14000.00, 4400.20, 0.2000, 0.3143,
 'Pendiente', 'TN-2024-004'),
 
('venta_5', '2024-01-19 11:30:00', 'Sofía López', 'ML', 'MercadoPago', 'prod_5', 
 28000.00, 1400.00, 4756.00, 588.00, 22656.00, 16000.00, 5256.00, 0.1877, 0.3285,
 'EnCamino', 'ML-2024-005');

-- Insertar gastos de ejemplo
INSERT INTO gastos_ingresos (id, fecha, canal, tipo, categoria, descripcion, "montoARS") VALUES
('gasto_1', '2024-01-15', 'TN', 'Gasto', 'Marketing', 'Publicidad Facebook Ads', 5000.00),
('gasto_2', '2024-01-16', 'ML', 'Gasto', 'Envíos', 'Packaging y materiales', 2500.00),
('gasto_3', '2024-01-17', NULL, 'Gasto', 'Operativo', 'Servicios contables', 15000.00),
('ingreso_1', '2024-01-18', NULL, 'OtroIngreso', 'Financiero', 'Intereses plazo fijo', 3000.00),
('gasto_4', '2024-01-19', 'TN', 'Gasto', 'Marketing', 'Influencer marketing', 8000.00);

-- Insertar liquidaciones de ejemplo
INSERT INTO liquidaciones (id, fecha, "dineroFP", "disponibleMP_MELI", "aLiquidarMP", "liquidadoMP", "aLiquidarTN") VALUES
('liq_1', '2024-01-15', 50000.00, 25000.00, 15000.00, 10000.00, 20000.00),
('liq_2', '2024-01-16', 45000.00, 30000.00, 18000.00, 12000.00, 22000.00),
('liq_3', '2024-01-17', 52000.00, 28000.00, 16000.00, 14000.00, 25000.00);

-- Insertar devolución de ejemplo
INSERT INTO devoluciones (id, fecha, "ventaId", plataforma, motivo, estado, "montoDevuelto", "costoEnvioIda", "costoEnvioVuelta", "recuperoProducto", observaciones) VALUES
('dev_1', '2024-01-20', 'venta_1', 'TN', 'Producto defectuoso', 'Procesada', 25000.00, 1500.00, 1500.00, true, 'Cliente reportó pantalla rayada, producto recuperado en buen estado general');
