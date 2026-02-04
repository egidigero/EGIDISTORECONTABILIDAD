# Actualizaciones - Patrimonio y Margen Real

## ✅ Cambios Implementados

### 1. **Historial de Patrimonio**

**Problema**: El patrimonio era un cálculo único en tiempo real, sin posibilidad de ver la evolución.

**Solución**: Sistema de snapshots históricos del patrimonio.

#### Nueva Tabla: `patrimonio_historico`
```sql
- fecha (única por día)
- patrimonio_stock
- unidades_stock
- mp_disponible
- mp_a_liquidar
- mp_retenido
- tn_a_liquidar
- total_liquidaciones
- patrimonio_total
```

#### Función: `registrar_patrimonio_diario(fecha)`
- Calcula patrimonio en stock (costo × unidades)
- Obtiene última liquidación
- Calcula patrimonio total
- Guarda snapshot con upsert (actualiza si existe)

#### Vista: `patrimonio_evolucion`
- Muestra todos los snapshots históricos
- Calcula `variacion_dia` automáticamente
- Calcula `variacion_porcentaje` respecto al día anterior
- Ordenada por fecha descendente

#### Componente UI: `<PatrimonioEvolucion />`
- Gráfico de área con evolución temporal
- Selector de rango: 7d / 30d / 90d / Todo
- Cards con patrimonio total, stock y liquidaciones
- Gráfico de variaciones diarias
- Integración con Recharts

#### Acciones: `lib/actions/patrimonio.ts`
- `registrarPatrimonioDiario(fecha?)` - Registra snapshot de un día
- `getPatrimonioEvolucion(dias?)` - Obtiene histórico
- `getPatrimonioActual()` - Obtiene último snapshot
- `registrarPatrimonioRango(inicio, fin)` - Backfill de datos históricos

---

### 2. **Cálculo de Margen Real en Ventas**

**Problema**: El margen no incluía el costo de envío, dando una imagen incorrecta de la rentabilidad.

**Solución**: Margen calculado igual que en la calculadora de precios.

#### Cambios en `lib/calculos.ts`

**Antes:**
```typescript
const ingresoMargen = precioNeto - costoProducto
const rentabilidadSobreCosto = costoProducto > 0 
  ? ingresoMargen / costoProducto 
  : 0
```

**Ahora:**
```typescript
// Margen = Precio Neto - Costo Producto - Costo Envío
const ingresoMargen = precioNeto - costoProducto - cargoEnvioCosto

// Rentabilidad sobre el costo TOTAL (producto + envío)
const costoTotal = costoProducto + cargoEnvioCosto
const rentabilidadSobreCosto = costoTotal > 0 
  ? ingresoMargen / costoTotal 
  : 0
```

#### Impacto
- ✅ El campo `ingresoMargen` en tabla `ventas` ahora refleja el margen REAL
- ✅ `rentabilidadSobrePV` sigue siendo sobre precio de venta bruto
- ✅ `rentabilidadSobreCosto` ahora es sobre costo total (producto + envío)
- ✅ Compatible con calculadora de precios - mismo cálculo
- ✅ No afecta liquidaciones ni otros módulos - solo mejora precisión

---

## 📁 Archivos Creados

1. **`migration_patrimonio_historico.sql`** - Migración completa
2. **`components/patrimonio-evolucion.tsx`** - Componente de visualización
3. **`lib/actions/patrimonio.ts`** - Acciones del servidor

## 📝 Archivos Modificados

1. **`lib/calculos.ts`** - Cálculo de margen mejorado (líneas ~154-165)

---

## 🚀 Uso

### Registrar Patrimonio Diario

**Opción 1: Desde código**
```typescript
import { registrarPatrimonioDiario } from "@/lib/actions/patrimonio"

// Registrar hoy
await registrarPatrimonioDiario()

// Registrar fecha específica
await registrarPatrimonioDiario('2026-02-01')
```

**Opción 2: Desde SQL**
```sql
-- Registrar hoy
SELECT registrar_patrimonio_diario(CURRENT_DATE);

-- Registrar fecha específica
SELECT registrar_patrimonio_diario('2026-02-01');
```

**Opción 3: Cron Job Diario**
Configurar en Supabase o servidor para ejecutar automáticamente:
```sql
-- Ejecutar todos los días a las 23:59
SELECT registrar_patrimonio_diario(CURRENT_DATE);
```

### Ver Evolución del Patrimonio

**En UI:**
```tsx
import { PatrimonioEvolucion } from "@/components/patrimonio-evolucion"

// En tu página
<PatrimonioEvolucion />
```

**Desde acciones:**
```typescript
import { getPatrimonioEvolucion, getPatrimonioActual } from "@/lib/actions/patrimonio"

// Últimos 30 días
const { data } = await getPatrimonioEvolucion(30)

// Patrimonio actual
const { data: actual } = await getPatrimonioActual()
```

**Desde SQL:**
```sql
-- Ver evolución completa
SELECT * FROM patrimonio_evolucion ORDER BY fecha DESC;

-- Últimos 30 días
SELECT * FROM patrimonio_evolucion ORDER BY fecha DESC LIMIT 30;

-- Ver crecimiento del mes
SELECT 
  fecha,
  patrimonio_total,
  variacion_dia,
  variacion_porcentaje
FROM patrimonio_evolucion
WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY fecha;
```

### Backfill de Datos Históricos

Si quieres llenar datos de días pasados:

```typescript
import { registrarPatrimonioRango } from "@/lib/actions/patrimonio"

// Registrar todo enero 2026
await registrarPatrimonioRango('2026-01-01', '2026-01-31')
```

---

## 📊 Ejemplos de Consultas Útiles

### Ver crecimiento mensual
```sql
SELECT 
  DATE_TRUNC('month', fecha) AS mes,
  AVG(patrimonio_total) AS patrimonio_promedio,
  MAX(patrimonio_total) - MIN(patrimonio_total) AS crecimiento_mes
FROM patrimonio_historico
GROUP BY DATE_TRUNC('month', fecha)
ORDER BY mes DESC;
```

### Ver mejor y peor día del mes
```sql
SELECT 
  fecha,
  patrimonio_total,
  variacion_dia,
  variacion_porcentaje
FROM patrimonio_evolucion
WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY variacion_dia DESC
LIMIT 5;
```

### Proyección de crecimiento
```sql
WITH stats AS (
  SELECT 
    AVG(variacion_dia) AS promedio_diario,
    STDDEV(variacion_dia) AS desviacion
  FROM patrimonio_evolucion
  WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
  promedio_diario * 30 AS crecimiento_proyectado_30d,
  promedio_diario * 365 AS crecimiento_proyectado_anual
FROM stats;
```

---

## 🔄 Integración Sugerida

### En Dashboard Principal
```tsx
import { PatrimonioEvolucion } from "@/components/patrimonio-evolucion"
import { getPatrimonioActual } from "@/lib/actions/patrimonio"

export default async function DashboardPage() {
  const { data: patrimonioActual } = await getPatrimonioActual()
  
  return (
    <div>
      {/* Card resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Patrimonio Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            ${patrimonioActual?.patrimonio_total.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      
      {/* Gráfico completo */}
      <PatrimonioEvolucion />
    </div>
  )
}
```

### Cron Job Recomendado
Configurar en Supabase Edge Functions o servidor:

```typescript
// edge-functions/registro-patrimonio-diario/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"

serve(async (req) => {
  const supabase = createClient(/* credenciales */)
  
  const { data, error } = await supabase.rpc('registrar_patrimonio_diario', {
    p_fecha: new Date().toISOString().split('T')[0]
  })
  
  return new Response(
    JSON.stringify({ success: !error, data }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

Luego configurar en Supabase Dashboard → Edge Functions → Cron Jobs:
```
0 23 * * * # Ejecutar todos los días a las 23:00
```

---

## ⚠️ Notas Importantes

1. **Patrimonio vs Liquidaciones**: El patrimonio considera solo `mp_disponible + mp_a_liquidar + tn_a_liquidar`, NO incluye `mp_retenido` porque es dinero bloqueado.

2. **Backfill Histórico**: Puedes registrar fechas pasadas, pero los datos de stock serán los actuales (no hay histórico de stock). Es mejor empezar desde hoy.

3. **Performance**: La vista `patrimonio_evolucion` usa `LAG()` para calcular variaciones, es eficiente pero con miles de registros puede ser lento. Limitar las queries con `LIMIT`.

4. **Cálculo de Margen**: El nuevo cálculo solo afecta ventas FUTURAS. Las ventas existentes mantienen su margen calculado con la fórmula anterior.

5. **Automatización**: Configurar el cron job es ALTAMENTE RECOMENDADO para mantener el histórico actualizado.

---

## 🎯 Próximos Pasos Sugeridos

1. Agregar página dedicada `/patrimonio` con el componente
2. Configurar cron job automático
3. Agregar alertas cuando el patrimonio baja X%
4. Dashboard con KPIs: ROI mensual, velocidad de crecimiento, etc.
5. Exportar reportes de patrimonio en PDF/Excel
