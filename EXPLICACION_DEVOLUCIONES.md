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

Ahora los motivos son un **desplegable con opciones predefinidas**:

### Opciones disponibles:
1. Producto defectuoso
2. Producto dañado en envío
3. Producto incorrecto enviado
4. No conforme con el producto
5. Producto no coincide con descripción
6. Cambio de opinión del cliente
7. Garantía
8. Otro

### Ventajas:
- **Datos consistentes**: Todos usan la misma nomenclatura
- **Reportes acumulativos**: Puedes saber cuántos reclamos por cada motivo
- **Análisis de problemas**: Identificar patrones (ej: muchos "dañados en envío" = problema con courier)

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

## Preguntas y Respuestas

**P: Si cambio el costo de envío, ¿afecta a otras devoluciones?**  
R: No, cada devolución tiene su propio registro independiente.

**P: ¿Puedo cambiar "se recupera producto" en cualquier momento?**  
R: Sí, mientras edites la devolución. El cálculo de pérdida se actualiza automáticamente.

**P: ¿Por qué hay tres fechas diferentes?**  
R: Para tener trazabilidad completa y poder analizar tiempos de respuesta.

**P: ¿Cómo sé si un cambio de producto está bien registrado?**  
R: En los detalles expandibles verás el desglose completo de costos, incluyendo diferencias de productos.
