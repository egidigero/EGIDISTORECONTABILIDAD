import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calcularEERR } from "@/lib/actions/eerr"
import { supabase } from "@/lib/supabase"

type PatrimonioConciliacionProps = {
  dias?: number
}

type SnapshotRow = {
  fecha: string
  patrimonio_stock: number
  total_liquidaciones: number
  patrimonio_total: number
}

type StockDriver = {
  productoId: string
  modelo: string
  deltaQty: number
  deltaValor: number
}

type DriverRow = {
  label: string
  value: number
  note?: string
}

const IMPORTACION_CATEGORIES = new Set(["pago de importacion"])

function formatDateOnly(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDateOnly(value: string) {
  const [y, m, d] = String(value).split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`
}

function metricTone(value: number) {
  if (Math.abs(value) < 0.01) return "text-muted-foreground"
  return value >= 0 ? "text-emerald-600" : "text-red-600"
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function buildLecturaRapida(params: {
  dias: number
  deltaPatrimonio: number
  deltaLiquidaciones: number
  deltaStock: number
  margenFinal: number
  pagosImportacion: number
}) {
  const { dias, deltaPatrimonio, deltaLiquidaciones, deltaStock, margenFinal, pagosImportacion } = params

  const movimientoPatrimonio = deltaPatrimonio >= 0 ? "subio" : "bajo"
  const movimientoLiquidaciones = deltaLiquidaciones >= 0 ? "subieron" : "bajaron"
  const movimientoStock = deltaStock >= 0 ? "subio" : "bajo"

  let texto = `En los ultimos ${dias} dias el patrimonio ${movimientoPatrimonio} ${formatCurrency(Math.abs(deltaPatrimonio))}. `
  texto += `Las liquidaciones ${movimientoLiquidaciones} ${formatCurrency(Math.abs(deltaLiquidaciones))} y el stock ${movimientoStock} ${formatCurrency(Math.abs(deltaStock))}. `
  texto += `El resultado conciliable del EERR fue ${formatSignedCurrency(margenFinal)}. `

  if (Math.abs(pagosImportacion) > 0.01) {
    texto += `Ademas hubo pagos de importacion por ${formatCurrency(pagosImportacion)} que deberian mover composicion entre liquidaciones y stock, no el patrimonio total.`
  }

  return texto
}

function buildResultadoDrivers(eerr: any): DriverRow[] {
  const rows: DriverRow[] = [
    { label: "Ventas netas", value: Number(eerr?.ventasNetas || 0), note: "suma al patrimonio" },
    { label: "Costo producto", value: -Number(eerr?.costoProducto || 0), note: "sale del stock vendido" },
    { label: "Costos plataforma", value: -Number(eerr?.totalCostosPlataformaAjustado ?? eerr?.totalCostosPlataforma ?? 0) },
    { label: "Publicidad", value: -Number(eerr?.publicidad || 0) },
    { label: "Otros gastos", value: -Number(eerr?.otrosGastos || 0) },
    { label: "Otros ingresos", value: Number(eerr?.otrosIngresos || 0) },
    { label: "Perdidas por devoluciones", value: -Number(eerr?.perdidasPorDevoluciones ?? eerr?.devolucionesPerdidaTotal ?? 0) },
    { label: "Gastos personales", value: -Number(eerr?.gastosPersonales || 0) },
    { label: "Ingresos personales", value: Number((eerr as any)?.ingresosPersonales || 0) },
  ]

  return rows
    .filter((row) => Math.abs(row.value) > 0.01)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6)
}

function buildStockDrivers(movimientos: any[], productos: any[]): StockDriver[] {
  const productoMap = new Map(
    (productos || []).map((producto: any) => [
      String(producto.id),
      {
        modelo: String(producto.modelo || producto.sku || producto.id),
        costo: Number(producto.costoUnitarioARS || 0),
      },
    ]),
  )

  const qtyMap = new Map<string, number>()

  for (const movimiento of movimientos || []) {
    const productoId = String(movimiento.producto_id)
    const cantidad = Number(movimiento.cantidad || 0)
    const signo = movimiento.tipo === "entrada" ? 1 : movimiento.tipo === "salida" ? -1 : 0

    if (!productoId || !cantidad || signo === 0) continue

    qtyMap.set(productoId, (qtyMap.get(productoId) || 0) + (cantidad * signo))
  }

  return Array.from(qtyMap.entries())
    .map(([productoId, deltaQty]) => {
      const producto = productoMap.get(productoId)
      const costo = Number(producto?.costo || 0)
      return {
        productoId,
        modelo: producto?.modelo || productoId,
        deltaQty,
        deltaValor: Math.round(deltaQty * costo * 100) / 100,
      }
    })
    .filter((row) => Math.abs(row.deltaValor) > 0.01 || Math.abs(row.deltaQty) > 0)
    .sort((a, b) => Math.abs(b.deltaValor) - Math.abs(a.deltaValor))
    .slice(0, 6)
}

export async function PatrimonioConciliacion({ dias = 30 }: PatrimonioConciliacionProps) {
  const { data: latestSnapshot, error: latestError } = await supabase
    .from("patrimonio_historico")
    .select("fecha, patrimonio_stock, total_liquidaciones, patrimonio_total")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError || !latestSnapshot) {
    return null
  }

  const fechaFin = parseDateOnly(String(latestSnapshot.fecha))
  const fechaInicioPeriodo = addDays(fechaFin, -(dias - 1))
  const fechaInicioStr = formatDateOnly(fechaInicioPeriodo)
  const fechaFinStr = formatDateOnly(fechaFin)
  const fechaFinMasUnoStr = formatDateOnly(addDays(fechaFin, 1))
  const fechaAperturaStr = formatDateOnly(addDays(fechaInicioPeriodo, -1))

  const [
    { data: apertura },
    { data: snapshotAnterior },
    eerr,
    { data: gastosIngresos },
    { data: movimientosPeriodo },
    { data: productos },
  ] = await Promise.all([
    supabase
      .from("patrimonio_historico")
      .select("fecha, patrimonio_stock, total_liquidaciones, patrimonio_total")
      .lte("fecha", fechaAperturaStr)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patrimonio_historico")
      .select("fecha, patrimonio_stock, total_liquidaciones, patrimonio_total")
      .lt("fecha", String(latestSnapshot.fecha))
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    calcularEERR(new Date(`${fechaInicioStr}T00:00:00.000Z`), new Date(`${fechaFinStr}T23:59:59.999Z`), "General"),
    supabase
      .from("gastos_ingresos")
      .select("fecha, tipo, categoria, descripcion, montoARS, esPersonal")
      .gte("fecha", fechaInicioStr)
      .lte("fecha", fechaFinStr),
    supabase
      .from("movimientos_stock")
      .select("producto_id, cantidad, tipo, fecha")
      .gte("fecha", fechaInicioStr)
      .lt("fecha", fechaFinMasUnoStr),
    supabase
      .from("productos")
      .select("id, modelo, sku, costoUnitarioARS"),
  ])

  const snapshotInicial: SnapshotRow = (apertura as SnapshotRow) || (latestSnapshot as SnapshotRow)
  const snapshotFinal: SnapshotRow = latestSnapshot as SnapshotRow

  const deltaStock = Number(snapshotFinal.patrimonio_stock || 0) - Number(snapshotInicial.patrimonio_stock || 0)
  const deltaLiquidaciones = Number(snapshotFinal.total_liquidaciones || 0) - Number(snapshotInicial.total_liquidaciones || 0)
  const deltaPatrimonio = Number(snapshotFinal.patrimonio_total || 0) - Number(snapshotInicial.patrimonio_total || 0)

  const deltaUltimoDiaStock = snapshotAnterior
    ? Number(snapshotFinal.patrimonio_stock || 0) - Number((snapshotAnterior as SnapshotRow).patrimonio_stock || 0)
    : 0
  const deltaUltimoDiaLiquidaciones = snapshotAnterior
    ? Number(snapshotFinal.total_liquidaciones || 0) - Number((snapshotAnterior as SnapshotRow).total_liquidaciones || 0)
    : 0
  const deltaUltimoDiaPatrimonio = snapshotAnterior
    ? Number(snapshotFinal.patrimonio_total || 0) - Number((snapshotAnterior as SnapshotRow).patrimonio_total || 0)
    : 0

  const margenNegocio = Number((eerr as any)?.margenNetoNegocio || 0)
  const margenFinal = Number((eerr as any)?.margenFinalConPersonales ?? margenNegocio)
  const ajustePersonales = margenFinal - margenNegocio
  const diferenciaConciliacion = deltaPatrimonio - margenFinal
  const liquidacionesEsperadas = margenFinal - deltaStock

  const pagosImportacion = (gastosIngresos || []).reduce((total: number, row: any) => {
    const categoria = normalize(row?.categoria)
    if (String(row?.tipo) !== "Gasto") return total
    if (!IMPORTACION_CATEGORIES.has(categoria)) return total
    return total + Number(row?.montoARS || 0)
  }, 0)

  const resultadoDrivers = buildResultadoDrivers(eerr)
  const stockDrivers = buildStockDrivers(movimientosPeriodo || [], productos || [])
  const lecturaRapida = buildLecturaRapida({
    dias,
    deltaPatrimonio,
    deltaLiquidaciones,
    deltaStock,
    margenFinal,
    pagosImportacion,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Control de Patrimonio</CardTitle>
        <CardDescription>
          Te muestra por que subio o bajo el patrimonio en los ultimos {dias} dias y donde mirar si algo no cierra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Apertura periodo</p>
            <p className="text-2xl font-bold">{formatCurrency(snapshotInicial.patrimonio_total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{parseDateOnly(snapshotInicial.fecha).toLocaleDateString("es-AR")}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Cierre periodo</p>
            <p className="text-2xl font-bold">{formatCurrency(snapshotFinal.patrimonio_total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{parseDateOnly(snapshotFinal.fecha).toLocaleDateString("es-AR")}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Variacion patrimonio</p>
            <p className={`text-2xl font-bold ${metricTone(deltaPatrimonio)}`}>{formatSignedCurrency(deltaPatrimonio)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Stock + liquidaciones</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Ultimo cambio diario</p>
            <p className={`text-2xl font-bold ${metricTone(deltaUltimoDiaPatrimonio)}`}>{formatSignedCurrency(deltaUltimoDiaPatrimonio)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stock {formatSignedCurrency(deltaUltimoDiaStock)} | Liquidaciones {formatSignedCurrency(deltaUltimoDiaLiquidaciones)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>{lecturaRapida}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Resultado EERR negocio</p>
            <p className={`text-2xl font-bold ${metricTone(margenNegocio)}`}>{formatCurrency(margenNegocio)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Ajuste personales</p>
            <p className={`text-2xl font-bold ${metricTone(ajustePersonales)}`}>{formatCurrency(ajustePersonales)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Resultado conciliable</p>
            <p className={`text-2xl font-bold ${metricTone(margenFinal)}`}>{formatCurrency(margenFinal)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Delta stock</p>
            <p className={`text-2xl font-bold ${metricTone(deltaStock)}`}>{formatSignedCurrency(deltaStock)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Pagos importacion</p>
            <p className={`text-2xl font-bold ${metricTone(-pagosImportacion)}`}>{formatCurrency(pagosImportacion)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Deberian mover composicion, no patrimonio</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Delta liquidaciones esperada</p>
            <p className={`text-2xl font-bold ${metricTone(liquidacionesEsperadas)}`}>{formatSignedCurrency(liquidacionesEsperadas)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Resultado conciliable - delta stock</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Delta liquidaciones real</p>
            <p className={`text-2xl font-bold ${metricTone(deltaLiquidaciones)}`}>{formatSignedCurrency(deltaLiquidaciones)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Caja + pendiente a cobrar</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Brecha</p>
            <p className={`text-2xl font-bold ${metricTone(-Math.abs(diferenciaConciliacion))}`}>{formatSignedCurrency(diferenciaConciliacion)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Si queda algo, revisa fechas de devoluciones e importaciones</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Drivers del resultado</p>
            <div className="space-y-3">
              {resultadoDrivers.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p>{row.label}</p>
                    {row.note ? <p className="text-xs text-muted-foreground">{row.note}</p> : null}
                  </div>
                  <p className={`font-medium ${metricTone(row.value)}`}>{formatSignedCurrency(row.value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Productos que mas movieron el stock</p>
            <div className="space-y-3">
              {stockDrivers.length > 0 ? stockDrivers.map((row) => (
                <div key={row.productoId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p>{row.modelo}</p>
                    <p className="text-xs text-muted-foreground">{row.deltaQty >= 0 ? "+" : ""}{row.deltaQty} unidades</p>
                  </div>
                  <p className={`font-medium ${metricTone(row.deltaValor)}`}>{formatSignedCurrency(row.deltaValor)}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No hubo movimientos de stock valorizables en el periodo.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Formula de lectura: <strong>delta patrimonio</strong> = <strong>delta liquidaciones</strong> + <strong>delta stock</strong>.
          </p>
          <p>
            Si comparas contra EERR, la referencia correcta es el <strong>patrimonio total</strong>, no liquidaciones solas.
          </p>
          <p>
            Si la brecha no es chica, los sospechosos mas comunes son: snapshots viejos, pagos de importacion mal cargados o devoluciones tomadas por fechas distintas.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
