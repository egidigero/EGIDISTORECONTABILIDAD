# Explicación del Sistema de Devoluciones

## Fechas en el Sistema

El sistema maneja **tres fechas diferentes** para cada devolución:

### 1. **Fecha de Compra** (`fecha_compra`)
- Es la fecha en que se realizó la venta original
- Se copia automáticamente desde la venta asociada
- **No se puede modificar** porque es un dato histórico
- Se usa para calcular plazos de garantía y para reportes

### 2. **Fecha de Reclamo** (`fecha_reclamo`)
- Es la fecha en que el cliente **inició el reclamo**
- Puede ser diferente a la fecha de compra (días o semanas después)
- Se puede editar **solo al crear** la devolución (para casos donde se registra el reclamo días después)
- Una vez creada, queda fija para mantener trazabilidad
- **Importante**: Esta es la fecha que se muestra en la columna "Día de reclamo" en la tabla

### 3. **Fecha Completada** (`fecha_completada`)
- Es la fecha en que se **finalizó/resolvió** la devolución
- Solo se completa cuando el estado cambia a alguno de los estados finales:
  - "Entregada - Reembolso"
  - "Entregada - Cambio mismo producto"
  - "Entregada - Cambio otro producto"
  - "Entregada - Sin reembolso"
  - "Rechazada"

### ¿Por qué tres fechas?
Esto permite:
- **Análisis de tiempo de respuesta**: Cuánto tardamos desde el reclamo hasta la resolución
- **Trazabilidad completa**: Saber cuándo se compró, cuándo reclamó el cliente, cuándo se resolvió
- **Reportes precisos**: Ver devoluciones por período de reclamo vs período de resolución

---

## Costos de Envío

### Costo de Envío Original (`costo_envio_original`)
- Es el costo del envío **de la venta original**
- Se copia automáticamente desde la venta
- Representa lo que se gastó para enviarle el producto al cliente la primera vez

### Costo de Envío Devolución (`costo_envio_devolucion`)
- Es el costo del envío **para que el cliente devuelva el producto**
- Se registra al crear la devolución
- Puede ser:
  - $0 si el cliente paga el envío o lo trae personalmente
  - El monto real si nosotros pagamos el envío de vuelta

### ¿El cambio de costo de envío solo afecta a esa devolución?
**SÍ**, cada devolución tiene su propio registro de costos de envío:
- Cambiar el `costo_envio_devolucion` de una devolución **NO afecta** a otras devoluciones
- Cada devolución está atada a un **gasto específico** en el sistema contable (via `id_gasto_creado`)
- Si modificas el costo, se actualiza solo ese gasto específico

---

## Producto Recuperable

### ¿Qué significa "Se recupera producto"?
- **Sí (Recuperable)**: El producto vuelve en condiciones de ser revendido
  - NO se cuenta como pérdida de producto
  - Solo se cuentan costos de envío como pérdida
  
- **No (No recuperable)**: El producto está dañado o no se puede revender
  - Se cuenta el **costo del producto** como pérdida
  - Se suman envíos y comisiones

### ¿Cuándo se puede cambiar?
- Se puede cambiar **en cualquier momento** mientras editas la devolución
- El sistema recalcula automáticamente la pérdida según:
  - Si es recuperable: pérdida = envíos + comisiones
  - Si no es recuperable: pérdida = envíos + comisiones + costo producto

---

## Motivos de Reclamo

Ahora los motivos son un **desplegable con opciones predefinidas y específicas**:

### Opciones disponibles:
**Problemas técnicos del producto:**
1. No enciende
2. Duración corta de batería
3. Problemas de carga
4. Pantalla defectuosa
5. Botones no funcionan
6. Problemas de conectividad
7. Software/Firmware defectuoso
8. Sensor defectuoso

**Problemas de envío y logística:**
9. Daño físico en envío
10. Producto incorrecto enviado

**Otros:**
11. No coincide con descripción
12. Arrepentimiento del cliente
13. Defecto de fabricación
14. Otro

### Ventajas:
- **Datos específicos**: Motivos técnicos detallados para identificar problemas exactos
- **Reportes acumulativos**: Saber exactamente cuántos productos tienen problemas de batería, pantalla, etc.
- **Análisis de calidad**: Identificar patrones de defectos por producto
- **Decisiones de compra**: Datos para decidir si seguir vendiendo un producto problemático

---

## Estados de Devolución

El estado **"Pendiente" cambió a "En devolución"** para ser más claro:

### Estados disponibles:
1. **En devolución**: El reclamo está activo, el producto viene en camino
2. **Aceptada en camino**: Aceptamos el reclamo, está en tránsito
3. **Entregada - Reembolso**: Se completó con reembolso al cliente
4. **Entregada - Cambio mismo producto**: Se le envió el mismo producto de reemplazo
5. **Entregada - Cambio otro producto**: Se le envió un producto diferente
6. **Entregada - Sin reembolso**: Se recibió pero no se reembolsó (ej: fuera de garantía)
7. **Rechazada**: Se rechazó el reclamo

---

## Cambio de Productos

### ¿Cómo funciona el cambio de producto?

Cuando seleccionas un "Producto nuevo" en la devolución:

1. **El sistema registra**:
   - `costo_producto_original`: Lo que costó el producto que devolvió
   - `costo_producto_nuevo`: Lo que cuesta el producto que se le envía
   - `producto_nuevo_id`: Referencia al nuevo producto

2. **Cálculo de pérdida**:
   - Si ambos productos cuestan lo mismo: sin pérdida adicional de producto
   - Si el nuevo es más caro: pérdida = (costo_nuevo - costo_original)
   - Si el nuevo es más barato: ganancia = (costo_original - costo_nuevo)

3. **Se crea un gasto nuevo** (`id_gasto_creado_producto_nuevo`) para registrar:
   - El envío del producto nuevo
   - La diferencia de costo si corresponde

### Ejemplo:
- Cliente compró Producto A ($10,000)
- Lo devuelve y quiere Producto B ($12,000)
- Pérdida adicional: $2,000 + costo envío nuevo

---

## Resumen de Cambios Realizados

### ✅ Tabla de Devoluciones:
- **ID**: Ahora solo muestra DEV-XXX (sin número de seguimiento adicional)
- **Día de reclamo**: Nueva columna con la fecha de reclamo
- **Venta**: Solo muestra el nombre del comprador
- **Producto**: Ahora muestra el nombre del producto correctamente
- **Pérdida**: Tiene un botón "Ver más" que expande detalles

### ✅ Detalles Expandibles:
Al hacer clic en el botón de la pérdida, se muestra:
- **Detalle de la pérdida**: Desglose completo de costos
  - Costo producto
  - Envío original
  - Envío devolución
  - Comisión
  - Total pérdida
- **Detalle del problema**: 
  - Motivo del reclamo
  - Observaciones
  - Si el producto es recuperable

### ✅ Estado:
- "Pendiente" → "En devolución"

### ✅ Motivo:
- Ahora es un desplegable con opciones predefinidas
- Permite análisis acumulativo de problemas

---

## Nuevos Reportes Avanzados

### 📊 Análisis por Producto

Para cada modelo de producto, ahora puedes ver:

**Métricas principales:**
- Cantidad total de devoluciones
- Pérdida total acumulada
- Pérdida promedio por devolución
- Cantidad de productos recuperables vs no recuperables
- Tasa de no recuperables (%)

**Análisis de problemas:**
- Problema principal del producto
- Top 3 motivos de devolución con cantidades
- Permite identificar si un producto tiene un defecto recurrente

**Ejemplo de uso:**
Si ves que el "DT NO.1 V 2" tiene 5 devoluciones y 4 son por "Duración corta de batería", sabrás que:
1. Hay un problema real con la batería de ese modelo
2. Deberías considerar cambiar de proveedor o dejar de vender ese modelo
3. Puedes calcular el impacto económico real de ese defecto

### 💰 Resumen de Costos por Modelo

**Ranking de productos por pérdida:**
- Ordenados de mayor a menor pérdida total
- Muestra el porcentaje que representa cada producto del total de pérdidas
- Incluye cantidad de devoluciones por producto
- Visualización con barras de progreso

**Para qué sirve:**
- Identificar qué productos están generando más pérdidas
- Tomar decisiones de inventario basadas en datos
- Negociar mejores condiciones con proveedores de productos problemáticos
- Ajustar precios considerando el riesgo de devolución

### 🔍 Insights que puedes obtener:

1. **Calidad del producto**: Si un modelo tiene muchas devoluciones por defectos técnicos
2. **Problemas del proveedor**: Si varios modelos del mismo proveedor tienen el mismo problema
3. **Expectativas vs realidad**: Si hay muchos "No coincide con descripción", mejorar las fotos/descripciones
4. **ROI por producto**: Considerar el costo de devoluciones al calcular la rentabilidad

---

## Preguntas y Respuestas

**P: Si cambio el costo de envío, ¿afecta a otras devoluciones?**  
R: No, cada devolución tiene su propio registro independiente.

**P: ¿Puedo cambiar "se recupera producto" en cualquier momento?**  
R: Sí, mientras edites la devolución. El cálculo de pérdida se actualiza automáticamente.

**P: ¿Por qué hay tres fechas diferentes?**  
R: Para tener trazabilidad completa y poder analizar tiempos de respuesta.

**P: ¿Cómo sé si un cambio de producto está bien registrado?**  
R: En los detalles expandibles verás el desglose completo de costos, incluyendo diferencias de productos.
