# Ingresos Personales

## Descripción

Se agregó la funcionalidad de **Ingresos Personales** para mantener una contabilidad clara entre movimientos del negocio y movimientos personales.

## Contexto

El negocio a veces presta dinero a socios o para gastos personales. Cuando ese dinero vuelve al negocio, no debe registrarse como "Ingreso del negocio" sino como "Ingreso Personal" para mantener separada la contabilidad personal de la empresarial.

## Categorías Disponibles

### Ingresos Personales (nuevas)
- **Ingresos Personales** - Categoría genérica para cualquier ingreso personal
- **Ingresos de Casa** - Ingresos relacionados con gastos de casa
- **Ingresos de Geronimo** - Ingresos personales de Geronimo
- **Ingresos de Sergio** - Ingresos personales de Sergio

### Gastos Personales (existentes)
- **Gastos de Casa**
- **Gastos de Geronimo**
- **Gastos de Sergio**

## Funcionamiento

### Campo `esPersonal`

Los gastos e ingresos se marcan automáticamente como personales (`esPersonal = true`) cuando pertenecen a una categoría personal:

**Gastos Personales:**
- Gastos de Casa
- Gastos de Geronimo
- Gastos de Sergio

**Ingresos Personales:**
- Ingresos Personales
- Ingresos de Casa
- Ingresos de Geronimo
- Ingresos de Sergio

### Impacto en Liquidaciones

✅ **SÍ afectan liquidaciones:**
- Todos los gastos personales
- Todos los ingresos personales

Los movimientos personales impactan el efectivo disponible del negocio, por lo que se incluyen en el cálculo de "MP Disponible" para liquidar.

### Impacto en Estado de Resultados (EERR)

✅ **SÍ aparecen en EERR:**
- Gastos personales (en sección "Gastos e Ingresos Personales")
- **Ingresos personales** (en sección "Gastos e Ingresos Personales")

Los movimientos personales se muestran en una sección dedicada del EERR:
- **Gastos Personales**: Restan del margen
- **Ingresos Personales**: Suman al margen (compensan los gastos)
- **Neto Movimientos Personales**: Muestra el balance final (Gastos - Ingresos)

Esto permite visualizar claramente el impacto de préstamos personales y su devolución en el resultado final del negocio.

## Archivos Modificados

### 1. Formulario
**`components/gasto-ingreso-form.tsx`**
- Agregadas categorías de Ingresos Personales en el selector

### 2. Lógica de Negocio
**`lib/actions/gastos-ingresos.ts`**
- Actualizado `createGastoIngreso()` para detectar ingresos personales
- Actualizado `updateGastoIngreso()` para detectar ingresos personales

### 3. Reportes
**`lib/actions/eerr.ts`**
- Separa ingresos personales de ingresos del negocio
- Calcula `totalIngresosPersonales` y los incluye en `detalleIngresosPersonales`
- Incluye ingresos personales en el cálculo del `margenFinalConPersonales`
- Los ingresos personales SUMAN al margen (compensan gastos personales)

**`components/eerr-report.tsx`**
- Nueva sección "Gastos e Ingresos Personales" en el EERR
- Muestra gastos personales (con detalle por categoría)
- Muestra ingresos personales (con detalle por categoría)
- Calcula "Neto Movimientos Personales"
- Actualizado "Margen Final después de Movimientos Personales"

**`lib/actions/devoluciones.ts`**
- Comentarios actualizados para claridad

**`components/analisis-ventas-30dias.tsx`**
- Comentarios actualizados para claridad

## Casos de Uso

### Ejemplo 1: Préstamo a socio
```
1. Registrar gasto personal:
   - Tipo: Gasto
   - Categoría: Gastos de Geronimo
   - Descripción: Préstamo para pago personal
   - Monto: $50,000

2. Cuando devuelve el dinero:
   - Tipo: Ingreso
   - Categoría: Ingresos de Geronimo
   - Descripción: Devolución de préstamo personal
   - Monto: $50,000
```

### Ejemplo 2: Pago de gastos de casa
```
1. Registrar gasto personal:
   - Tipo: Gasto
   - Categoría: Gastos de Casa
   - Descripción: Pago de servicios casa
   - Monto: $30,000

2. Cuando se reintegra:
   - Tipo: Ingreso
   - Categoría: Ingresos de Casa
   - Descripción: Reintegro gastos casa
   - Monto: $30,000
```

## Visualización

### En Liquidaciones
- Los ingresos personales se muestran separados de los ingresos del negocio
- Se indica claramente con una etiqueta "Personal"
- Afectan el cálculo de MP Disponible

### En EERR
- **SÍ aparecen** en una sección dedicada "Gastos e Ingresos Personales"
- Los gastos personales se muestran con signo negativo (restan)
- Los ingresos personales se muestran con signo positivo (suman)
- Se calcula un "Neto Movimientos Personales" que muestra el balance
- El "Margen Final" refleja el resultado después de incluir todos los movimientos personales

## Notas Importantes

1. **Coherencia con gastos personales**: Los ingresos personales funcionan exactamente igual que los gastos personales, manteniendo consistencia en el sistema.

2. **Impacto en efectivo**: Los movimientos personales afectan el efectivo disponible del negocio, por lo que se incluyen en las liquidaciones.

3. **Visibilidad en EERR**: A diferencia de lo que se pensó inicialmente, los movimientos personales **SÍ aparecen** en el EERR en una sección dedicada, para dar visibilidad completa al flujo de fondos personales y su compensación.

4. **Cálculo del margen**: El margen final se calcula como:
   ```
   Margen Final = Margen Neto del Negocio - Gastos Personales + Ingresos Personales
   ```

5. **Categorías flexibles**: Se ofrecen tanto una categoría genérica ("Ingresos Personales") como categorías específicas (Casa, Geronimo, Sergio) para máxima flexibilidad.

6. **Trazabilidad**: Todos los movimientos personales quedan registrados y pueden consultarse filtrando por `esPersonal = true`.
