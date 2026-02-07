# Mejoras en Devoluciones y Control de Stock

## Resumen de Cambios Implementados

### 1. Retención de Dinero en Mercado Pago
**Problema anterior**: Todas las devoluciones ML preguntaban el estado del dinero (a liquidar o liquidado).

**Solución implementada**:
- Las devoluciones con `mp_retenido = true` (dinero retenido) **NO preguntan** el estado del dinero
- El dinero se resta **directamente de `mp_retenido`** en la liquidación
- Solo se pregunta el estado cuando NO hay dinero retenido

**Archivos modificados**:
- `lib/actions/devoluciones.ts`: Lógica actualizada en líneas 576-604
- Ahora detecta si `mpRetener` está activado y resta de `delta_mp_retenido` directamente

---

### 2. Campo "Fue Reclamo" para Devoluciones ML
**Problema anterior**: Todas las devoluciones ML restaban el envío de mp_disponible automáticamente.

**Solución implementada**:
- Nuevo campo `fue_reclamo` en tabla `devoluciones` (boolean, nullable)
- **Reclamo = TRUE**: Se resta el envío original de mp_disponible (comportamiento actual)
- **No reclamo = FALSE**: NO se resta el envío, solo se mueve el dinero
- **NULL**: No aplica (TN o Directo), backward compatibility

**Cambios en base de datos**:
- Migración: `migration_devoluciones_reclamo_stock.sql`
- Nueva columna con comentario explicativo

**Cambios en lógica**:
- `lib/actions/devoluciones.ts`: Lógica de envío actualizada (líneas 592-602)
- Solo resta envío si `plataforma !== 'ML' || fueReclamo !== false`

**Cambios en UI**:
- `components/devolucion-actions.tsx`: Nueva pregunta en modal de avance
- Aparece SOLO para devoluciones ML al hacer Reembolso
- Opciones: "Sí, fue reclamo" / "No, no fue reclamo"

**Validaciones**:
- `lib/validations.ts`: Campo `fueReclamo` agregado al schema

---

### 3. Control de Stock para Devoluciones

#### Estados de Stock Implementados:
1. **No Recibido**: Devolución creada pero producto no recibido aún
2. **A Probar**: Producto recibido (`fecha_recepcion` != null), pendiente de prueba
3. **Probado Funcionando**: Producto probado y funciona, listo para reincorporar
4. **Probado No Funcionando**: Stock roto, no recuperable
5. **Reincorporado a Stock**: Ya fue agregado de vuelta al stock

#### 📌 Filtro Especial: Sin Reembolso
**Devoluciones excluidas del control de stock**:
- **Condición**: `tipo_resolucion = 'Sin reembolso'`
- **Razón**: Cliente nunca devolvió el producto físicamente, no hay stock que gestionar
- **Implementación**: Filtro en vista `devoluciones_stock_control`
- **Ejemplo**: Cliente no envió el producto de vuelta, se libera el dinero retenido (si lo había) y se cierra el caso

Estas devoluciones **NO aparecen** en el control de stock porque:
- ❌ No hay producto físico que recibir, probar o reincorporar
- ❌ No hay dinero que devolver al cliente
- ✅ Solo se registra el evento para historial contable

#### Nuevos Campos en Tabla `devoluciones`:
- `stock_reincorporado` (boolean): Indica si ya fue reincorporado
- `resultado_prueba` actualizado con nuevo estado "A Probar"

#### Función de Reincorporación:
- Nueva función PostgreSQL: `reincorporar_stock_devolucion(devolucion_id, deposito)`
- Valida que el producto esté probado y funcionando
- Incrementa `stockPropio` o `stockFull` según depósito elegido
- Registra movimiento en `movimientos_stock` con origen 'reincorporacion'
- Marca `stock_reincorporado = TRUE`

#### Vista de Control:
- Nueva vista: `devoluciones_stock_control`
- Muestra estado legible del stock
- Filtra solo productos recuperables
- Incluye información de venta y producto

#### Componente UI:
- **Nuevo archivo**: `components/stock-devoluciones-control.tsx`
- Agrupa productos por estado (A Probar, Listo para Reincorporar, Roto, etc.)
- Botón "Reincorporar" para productos probados funcionando
- Modal para elegir depósito (Propio o Full)
- Badges de colores según estado

---

### 4. Mejoras en Movimientos de Stock

#### Nuevos Campos en `movimientos_stock`:
- `origen_tipo`: Tipo de operación (venta, devolucion, ingreso_manual, ajuste, etc.)
- `origen_id`: ID de la operación origen (ID de venta, devolución, etc.)

#### Tipos de Origen Soportados:
- `venta`: Salida por venta
- `devolucion`: Entrada por devolución
- `ingreso_manual`: Entrada manual de stock
- `ajuste`: Ajuste de inventario
- `transferencia`: Transferencia entre depósitos
- `perdida`: Pérdida o robo
- `reincorporacion`: Reincorporación de stock devuelto probado

---

## Archivos Creados

1. **`migration_devoluciones_reclamo_stock.sql`**
   - Agrega campo `fue_reclamo`
   - Mejora estados de `resultado_prueba`
   - Agrega campo `stock_reincorporado`
   - Mejora `movimientos_stock` con origen
   - Crea vista `devoluciones_stock_control`
   - Crea función `reincorporar_stock_devolucion()`

2. **`components/stock-devoluciones-control.tsx`**
   - Componente React para control visual de stock
   - Integración con Supabase
   - UI agrupada por estados

---

## Archivos Modificados

1. **`lib/actions/devoluciones.ts`**
   - Lógica de retención actualizada (línea ~580-604)
   - Soporte para campo `fue_reclamo`
   - Mapping snake_case actualizado

2. **`lib/validations.ts`**
   - Campo `fueReclamo` agregado
   - Enum `resultado_prueba` actualizado

3. **`components/devolucion-actions.tsx`**
   - Estado `fueReclamo` agregado
   - Pregunta en modal para ML
   - Payload actualizado con `fueReclamo`
   - Ocultar pregunta de `mpEstado` cuando hay `mp_retenido`

---

## Cómo Usar

### 1. Aplicar Migración
```sql
-- Ejecutar en Supabase SQL Editor o psql
\i migration_devoluciones_reclamo_stock.sql
```

### 2. Crear Devolución ML
- Al hacer Reembolso en ML, aparecerá la pregunta "¿Fue un reclamo?"
- Si dices "Sí" → resta envío de mp_disponible
- Si dices "No" → solo mueve dinero, NO resta envío

### 3. Control de Stock de Devoluciones
- Acceder al componente `<StockDevolucionesControl />`
- Ver productos agrupados por estado
- Productos "Probado Funcionando" tienen botón "Reincorporar"
- Elegir depósito (Propio o Full) y confirmar

### 4. Verificar Movimientos
```sql
-- Ver movimientos de stock
SELECT * FROM movimientos_stock 
WHERE origen_tipo = 'reincorporacion' 
ORDER BY fecha DESC;

-- Ver stock de devoluciones
SELECT * FROM devoluciones_stock_control;
```

---

## Notas Importantes

- **Backward Compatibility**: Devoluciones existentes con `fue_reclamo = NULL` mantienen comportamiento anterior
- **Solo ML**: La pregunta de reclamo SOLO aparece para devoluciones de Mercado Libre
- **Retención Automática**: Si `mp_retenido = true`, NO pregunta estado, resta directo
- **Validación**: La función `reincorporar_stock_devolucion` valida que el producto esté probado y funcionando
- **Auditoría**: Todos los movimientos de stock quedan registrados en `movimientos_stock`

---

## Flujo Completo

```
1. Cliente reclama → Crear devolución
2. Recibir producto → Registrar recepción
   └─> Estado: "A Probar"
3. Probar producto → Registrar resultado
   ├─> Funciona → Estado: "Listo para Reincorporar"
   └─> No funciona → Estado: "Stock Roto"
4. Si funciona → Reincorporar
   └─> Elegir depósito → Stock actualizado
       └─> Estado: "Reincorporado a Stock"
```

---

## Próximos Pasos Sugeridos

1. Agregar página dedicada de control de stock en `/productos/stock-devoluciones`
2. Dashboard con métricas de devoluciones por estado
3. Notificaciones cuando hay productos "A Probar" pendientes
4. Exportar reportes de stock roto para análisis
