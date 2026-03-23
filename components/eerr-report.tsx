import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { calcularEERR } from "@/lib/actions/eerr"
import { getDetalleVentas } from "@/lib/actions/getDetalleVentas"
import { getDetalleGastosIngresos } from "@/lib/actions/getDetalleGastosIngresos"
import { calcularPerdidaTotalAjustada } from "@/lib/devoluciones-loss"
import { getVentaModelosByIds } from "@/lib/actions/getVentaModelosByIds"
import { buildModelBreakdown } from "@/lib/eerr/model-breakdown"
import { supabase } from "@/lib/supabase"
import { EERRVentasTable } from "@/components/eerr-ventas-table"
import { EERRGastosIngresosTable } from "@/components/eerr-gastos-ingresos-table"
import { ROASAnalysisModal } from "@/components/roas-analysis-modal"
import { MetricInfoTooltip } from "@/components/metric-info-tooltip"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  DollarSign,
  Gauge,
  Receipt,
  Rocket,
  ShoppingCart,
  Target,
  TrendingUp,
  Warehouse,
} from "lucide-react"
import type { Plataforma } from "@/lib/types"

interface EERRReportProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

const canalLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
  General: "General",
}

const categoriasPersonales = ["Gastos de Casa", "Gastos de Geronimo", "Gastos de Sergio"]
const categoriasInteresesMP = ["Ingresos del negocio - Intereses de MP", "Ingresos por intereses de MP"]

const ADS_CATEGORY = "Gastos del negocio - ADS"
const ENVIO_CATEGORY = "Gastos del negocio - Envios"
const ENVIO_DEVOLUCIONES_CATEGORY = "Gastos del negocio - Envios devoluciones"
const PAGO_IMPORTACION_CATEGORY = "Pago de Importacion"
const DAY_MS = 24 * 60 * 60 * 1000

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
const endOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const round2 = (value: number): number => Math.round(value * 100) / 100

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const isUGC = (row: any): boolean => {
  const categoria = normalize(row?.categoria)
  const descripcion = normalize(row?.descripcion)
  return categoria.includes("ugc") || descripcion.includes("ugc")
}

const groupByCategoria = (rows: any[]): Array<[string, any[]]> => {
  const grouped = rows.reduce(
    (acc, row) => {
      const categoria = String(row?.categoria || "Sin categoria")
      if (!acc[categoria]) acc[categoria] = []
      acc[categoria].push(row)
      return acc
    },
    {} as Record<string, any[]>,
  )

  return Object.entries(grouped as Record<string, any[]>)
    .sort((a, b) => a[0].localeCompare(b[0])) as Array<[string, any[]]>
}

const getAlias = (row: any, keys: string[]): string => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim()
    }
  }
  return ""
}

const getFirstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const parseDateOrFallback = (value: string | undefined, fallback: Date): Date => {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

const getPreviousRange = (fechaDesde: Date, fechaHasta: Date) => {
  const durationMs = Math.max(fechaHasta.getTime() - fechaDesde.getTime(), 0) + DAY_MS
  const fechaHastaAnterior = new Date(fechaDesde.getTime() - 1)
  const fechaDesdeAnterior = new Date(fechaHastaAnterior.getTime() - durationMs + 1)
  return { fechaDesdeAnterior, fechaHastaAnterior }
}

type TrendTone = "up" | "down" | "neutral"
type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface TrendInfo {
  deltaPct: number | null
  tone: TrendTone
}

interface ComparativeMetrics {
  ventasNetas: number
  margenOperativoMonto: number
  margenOperativoPct: number
  roasActual: number
  roasNegocioBE: number
  roasEscalaBE: number
  cpaActual: number
  cpaBeMarketing: number
  colchonCpa: number
  colchonCpaPct: number
  costosPlataformaPct: number
  devolucionesTasaPct: number
  devolucionesPctSobreVentas: number
}

interface MetricComparison {
  key: string
  label: string
  current: number
  previous: number
  higherIsBetter: boolean
  formatter: (value: number) => string
  tooltip: {
    queMide: string
    paraQueSirve: string
    comoDecidir: string
  }
  trend: TrendInfo
}

interface TopSkuRow {
  sku: string
  devoluciones: number
  perdida: number
}

interface StockCoverageProductRow {
  productoId: string
  label: string
  sku: string
  stockActualUnidades: number
  ventas90dUnidades: number
  unidadesExcedentes90d: number
  valorExcedente90d: number
  coberturaMeses: number | null
  pctExcedenteSobreStockActual: number
}

interface StockCoverageMetrics {
  unidadesExcedentes90d: number
  valorExcedente90d: number
  coberturaMeses: number | null
  detalleProductos: StockCoverageProductRow[]
}

const calculateVariationPct = (current: number, previous: number): number | null => {
  if (Math.abs(previous) < 0.000001) {
    if (Math.abs(current) < 0.000001) return 0
    return null
  }
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

const getTrendTone = (deltaPct: number | null, higherIsBetter: boolean): TrendTone => {
  if (deltaPct === null || Math.abs(deltaPct) < 0.1) return "neutral"
  const improved = higherIsBetter ? deltaPct > 0 : deltaPct < 0
  return improved ? "up" : "down"
}

const buildTrend = (current: number, previous: number, higherIsBetter: boolean): TrendInfo => {
  const deltaPct = calculateVariationPct(current, previous)
  return { deltaPct, tone: getTrendTone(deltaPct, higherIsBetter) }
}

const trendClass = (tone: TrendTone): string => {
  if (tone === "up") return "text-emerald-700"
  if (tone === "down") return "text-red-700"
  return "text-muted-foreground"
}

const formatVariationPct = (value: number | null): string => {
  if (value === null) return "N/A"
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

const buildComparativeMetrics = (
  eerrData: any,
  detalleVentas: any[],
  detalleGastosIngresos: any[],
  cantidadVentasOverride?: number,
): ComparativeMetrics => {
  const devoluciones = Array.isArray(eerrData?.detalleDevoluciones) ? eerrData.detalleDevoluciones : []
  const perdidasDevoluciones = round2(
    devoluciones.length > 0
      ? devoluciones.reduce((acc: number, row: any) => acc + calcularPerdidaTotalAjustada(row), 0)
      : toNumber(eerrData?.devolucionesPerdidaTotal),
  )

  const ventasNetas = round2(toNumber(eerrData?.ventasNetas))
  const costoProducto = round2(toNumber(eerrData?.costoProducto))
  const comisionesTotales = round2(toNumber(eerrData?.comisiones))
  const enviosTotales = round2(toNumber(eerrData?.enviosTotales))
  const margenContribucion = round2(ventasNetas - (costoProducto + comisionesTotales + enviosTotales + perdidasDevoluciones))

  const movimientos = Array.isArray(detalleGastosIngresos) ? detalleGastosIngresos : []
  const gastosUGC = round2(
    movimientos
      .filter((row: any) => String(row?.tipo) === "Gasto" && isUGC(row))
      .reduce((acc: number, row: any) => acc + Math.abs(toNumber(row?.montoARS)), 0),
  )
  const gastosAds = round2(toNumber(eerrData?.publicidad))
  const inversionMarketing = round2(gastosAds + gastosUGC)

  const detalleOtrosGastos = Array.isArray(eerrData?.detalleOtrosGastos) ? eerrData.detalleOtrosGastos : []
  const gastosEstructuraBase = detalleOtrosGastos.filter((row: any) => {
    const categoria = normalize(row?.categoria)
    if (categoriasPersonales.map(normalize).includes(categoria)) return false
    if (categoria === normalize(PAGO_IMPORTACION_CATEGORY)) return false
    if (categoria === normalize(ENVIO_CATEGORY)) return false
    if (categoria === normalize(ENVIO_DEVOLUCIONES_CATEGORY)) return false
    if (categoria === normalize(ADS_CATEGORY)) return false
    if (isUGC(row)) return false
    return true
  })
  const estructuraRows = gastosEstructuraBase
  const estructuraRowsTotal = round2(estructuraRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const estructuraTotal = estructuraRowsTotal

  const detalleOtrosIngresos = Array.isArray(eerrData?.detalleOtrosIngresos) ? eerrData.detalleOtrosIngresos : []
  const interesesMPRows = detalleOtrosIngresos.filter((row: any) =>
    categoriasInteresesMP.map(normalize).includes(normalize(row?.categoria)),
  )
  const totalInteresesMP = round2(interesesMPRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const otrosIngresosOperativos = round2(
    detalleOtrosIngresos
      .filter((row: any) => !categoriasInteresesMP.map(normalize).includes(normalize(row?.categoria)))
      .reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0),
  )

  const baseNegocioAntesAds = round2(margenContribucion - estructuraTotal + otrosIngresosOperativos)
  const resultadoNetoSinInteresesMP = round2(margenContribucion - inversionMarketing - estructuraTotal + otrosIngresosOperativos)
  const margenOperativoMonto = resultadoNetoSinInteresesMP
  const margenOperativoPct = ventasNetas > 0 ? round2((margenOperativoMonto / ventasNetas) * 100) : 0

  const roasEscalaBE = margenContribucion > 0 ? round2(ventasNetas / margenContribucion) : 0
  const roasNegocioBE = baseNegocioAntesAds > 0 ? round2(ventasNetas / baseNegocioAntesAds) : 0
  const roasActual = inversionMarketing > 0 ? round2(ventasNetas / inversionMarketing) : 0

  const cantidadVentas =
    typeof cantidadVentasOverride === "number" && Number.isFinite(cantidadVentasOverride)
      ? cantidadVentasOverride
      : Array.isArray(detalleVentas)
        ? detalleVentas.length
        : 0
  const cpaBeMarketing = cantidadVentas > 0 ? round2(margenContribucion / cantidadVentas) : 0
  const cpaActual = cantidadVentas > 0 ? round2(inversionMarketing / cantidadVentas) : 0
  const colchonCpa = round2(cpaBeMarketing - cpaActual)
  const colchonCpaPct = cpaBeMarketing > 0 ? round2((colchonCpa / cpaBeMarketing) * 100) : 0

  const costosPlataformaPct = ventasNetas > 0 ? round2(((comisionesTotales + enviosTotales) / ventasNetas) * 100) : 0
  const devolucionesTasaPct = cantidadVentas > 0 ? round2((devoluciones.length / cantidadVentas) * 100) : 0
  const devolucionesPctSobreVentas = ventasNetas > 0 ? round2((perdidasDevoluciones / ventasNetas) * 100) : 0

  return {
    ventasNetas,
    margenOperativoMonto,
    margenOperativoPct,
    roasActual,
    roasNegocioBE,
    roasEscalaBE,
    cpaActual,
    cpaBeMarketing,
    colchonCpa,
    colchonCpaPct,
    costosPlataformaPct,
    devolucionesTasaPct,
    devolucionesPctSobreVentas,
  }
}

const getMarginStatus = (margenOperativoPct: number): { label: string; emoji: string; variant: BadgeVariant } => {
  if (margenOperativoPct < 10) return { label: "Escala pausada", emoji: "🔴", variant: "destructive" }
  if (margenOperativoPct < 15) return { label: "Rentable", emoji: "🟡", variant: "secondary" }
  if (margenOperativoPct <= 20) return { label: "Optimo", emoji: "🟢", variant: "default" }
  return { label: "Escalable agresivo", emoji: "🚀", variant: "default" }
}

const getEscalaBadge = (margenOperativoPct: number): { label: string; variant: BadgeVariant } => {
  if (margenOperativoPct >= 15) return { label: "✔ Escalable", variant: "default" }
  if (margenOperativoPct >= 10) return { label: "⚠ Escalar con control", variant: "secondary" }
  return { label: "✖ No escalar", variant: "destructive" }
}

const getScaleCapacity = (
  margenOperativoPct: number,
  roasActual: number,
  roasEscalaBE: number,
  colchonCpa: number,
): { label: string; emoji: string; variant: BadgeVariant } => {
  const margenFuerte = margenOperativoPct >= 15
  const margenMinimo = margenOperativoPct >= 10
  const roasEscalaOk = roasEscalaBE > 0 && roasActual >= roasEscalaBE
  const cpaOk = colchonCpa >= 0

  if (margenFuerte && roasEscalaOk && cpaOk) return { label: "listo para escalar", emoji: "🟢", variant: "default" }
  if (margenMinimo && (roasEscalaOk || cpaOk)) return { label: "escala controlada", emoji: "🟡", variant: "secondary" }
  return { label: "no escalar", emoji: "🔴", variant: "destructive" }
}

const getDevolucionesStatus = (
  devolucionesPct: number,
): { label: string; emoji: string; className: string; variant: BadgeVariant } => {
  if (devolucionesPct < 5) return { label: "Controlado", emoji: "🟢", className: "text-emerald-700", variant: "default" }
  if (devolucionesPct <= 10) return { label: "Atencion", emoji: "🟡", className: "text-amber-700", variant: "secondary" }
  return { label: "Critico", emoji: "🔴", className: "text-red-700", variant: "destructive" }
}

const buildTopSkuRows = (
  devoluciones: any[],
  detalleVentas: any[],
  ventaIdToModelFallback: Record<string, string>,
): TopSkuRow[] => {
  const ventaIdToSku = new Map<string, string>()
  for (const venta of Array.isArray(detalleVentas) ? detalleVentas : []) {
    const ventaId = String(venta?.id ?? "").trim()
    if (!ventaId) continue
    const sku = getAlias(venta?.producto, ["sku"]) || getAlias(venta?.productos, ["sku"]) || getAlias(venta, ["sku"])
    if (sku) ventaIdToSku.set(ventaId, sku)
  }

  const grouped = new Map<string, TopSkuRow>()
  for (const devolucion of Array.isArray(devoluciones) ? devoluciones : []) {
    const ventaId = String(devolucion?.venta_id ?? "").trim()
    const sku =
      getAlias(devolucion, ["producto_sku", "productoSku", "sku"]) ||
      (ventaId ? ventaIdToSku.get(ventaId) ?? "" : "") ||
      getAlias(devolucion, ["producto_modelo", "productoModelo", "modelo"]) ||
      (ventaId ? String(ventaIdToModelFallback[ventaId] ?? "").trim() : "") ||
      "Sin SKU"
    const current = grouped.get(sku) ?? { sku, devoluciones: 0, perdida: 0 }
    current.devoluciones += 1
    current.perdida = round2(current.perdida + calcularPerdidaTotalAjustada(devolucion))
    grouped.set(sku, current)
  }

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (b.devoluciones !== a.devoluciones) return b.devoluciones - a.devoluciones
      return b.perdida - a.perdida
    })
    .slice(0, 5)
}

const STOCK_COVERAGE_DAYS = 90

const getStockCoverageMetrics = async (
  fechaHasta: Date,
  canal?: Plataforma | "General",
): Promise<StockCoverageMetrics> => {
  const fechaCierre = endOfLocalDay(fechaHasta)
  const ventasWindowStart = startOfLocalDay(new Date(fechaCierre.getTime() - (STOCK_COVERAGE_DAYS - 1) * DAY_MS))

  const [{ data: productosData, error: productosError }, ventas90d] = await Promise.all([
    supabase.from("productos").select("id,modelo,sku,costoUnitarioARS"),
    getDetalleVentas(ventasWindowStart, fechaCierre, canal),
  ])

  if (productosError) {
    console.warn("No se pudo calcular cobertura de stock: error leyendo productos", productosError)
    return { unidadesExcedentes90d: 0, valorExcedente90d: 0, coberturaMeses: null, detalleProductos: [] }
  }

  const movimientos: any[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("movimientos_stock")
      .select("producto_id,tipo,cantidad,fecha")
      .lte("fecha", fechaCierre.toISOString())
      .order("fecha", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.warn("No se pudo calcular cobertura de stock: error leyendo movimientos_stock", error)
      return { unidadesExcedentes90d: 0, valorExcedente90d: 0, coberturaMeses: null, detalleProductos: [] }
    }

    if (!data || data.length === 0) break
    movimientos.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  const productMeta = new Map<string, { label: string; sku: string; cost: number }>()
  for (const producto of productosData || []) {
    const pid = String((producto as any)?.id ?? "").trim()
    if (!pid) continue
    const sku = getAlias(producto, ["sku"])
    const label = getAlias(producto, ["modelo"]) || sku || pid
    productMeta.set(pid, {
      label,
      sku,
      cost: toNumber((producto as any)?.costoUnitarioARS),
    })
  }

  const stockByProduct = new Map<string, number>()
  for (const mov of movimientos) {
    const pid = String(mov?.producto_id ?? "").trim()
    if (!pid) continue
    const tipo = String(mov?.tipo ?? "").toLowerCase()
    const qty = Math.abs(toNumber(mov?.cantidad))
    if (qty <= 0 || (tipo !== "entrada" && tipo !== "salida")) continue
    const delta = tipo === "entrada" ? qty : -qty
    stockByProduct.set(pid, round2((stockByProduct.get(pid) ?? 0) + delta))
  }

  const ventas90dByProduct = new Map<string, number>()
  for (const venta of Array.isArray(ventas90d) ? ventas90d : []) {
    const pid = String(
      venta?.productoId ?? venta?.producto_id ?? venta?.producto?.id ?? venta?.productos?.id ?? "",
    ).trim()
    if (!pid) continue
    ventas90dByProduct.set(pid, (ventas90dByProduct.get(pid) ?? 0) + 1)
  }

  let totalStockValue = 0
  let totalDemand90dValue = 0
  let totalExcessUnits = 0
  let totalExcessValue = 0

  const detalleProductos: StockCoverageProductRow[] = []
  const allProductIds = new Set<string>([...productMeta.keys(), ...stockByProduct.keys(), ...ventas90dByProduct.keys()])
  for (const pid of allProductIds) {
    const meta = productMeta.get(pid) ?? { label: pid, sku: "", cost: 0 }
    const stockActualUnidades = Math.max(0, round2(stockByProduct.get(pid) ?? 0))
    const ventas90dUnidades = round2(ventas90dByProduct.get(pid) ?? 0)
    const unidadesExcedentes90d = Math.max(0, round2(stockActualUnidades - ventas90dUnidades))
    const valorExcedente90d = round2(unidadesExcedentes90d * meta.cost)
    const promedioMensual = ventas90dUnidades / 3
    const coberturaMeses = promedioMensual > 0 ? round2(stockActualUnidades / promedioMensual) : null
    const pctExcedenteSobreStockActual =
      stockActualUnidades > 0 ? round2((unidadesExcedentes90d / stockActualUnidades) * 100) : 0

    totalStockValue += round2(stockActualUnidades * meta.cost)
    totalDemand90dValue += round2(ventas90dUnidades * meta.cost)
    totalExcessUnits += unidadesExcedentes90d
    totalExcessValue += valorExcedente90d

    if (unidadesExcedentes90d <= 0) continue
    detalleProductos.push({
      productoId: pid,
      label: meta.label,
      sku: meta.sku,
      stockActualUnidades,
      ventas90dUnidades,
      unidadesExcedentes90d,
      valorExcedente90d,
      coberturaMeses,
      pctExcedenteSobreStockActual,
    })
  }

  const coberturaMeses =
    totalDemand90dValue > 0 ? round2(totalStockValue / (totalDemand90dValue / 3)) : null

  return {
    unidadesExcedentes90d: round2(totalExcessUnits),
    valorExcedente90d: round2(totalExcessValue),
    coberturaMeses,
    detalleProductos: detalleProductos.sort((a, b) => {
      if (b.valorExcedente90d !== a.valorExcedente90d) return b.valorExcedente90d - a.valorExcedente90d
      if ((b.coberturaMeses ?? Number.POSITIVE_INFINITY) !== (a.coberturaMeses ?? Number.POSITIVE_INFINITY)) {
        return (b.coberturaMeses ?? Number.POSITIVE_INFINITY) - (a.coberturaMeses ?? Number.POSITIVE_INFINITY)
      }
      return b.unidadesExcedentes90d - a.unidadesExcedentes90d
    }),
  }
}

export async function EERRReport({ searchParams: searchParamsPromise }: EERRReportProps) {
  const searchParams = await searchParamsPromise
  const fechaDesdeParam = getFirstParam(searchParams.fechaDesde)
  const fechaHastaParam = getFirstParam(searchParams.fechaHasta)
  const canalParam = getFirstParam(searchParams.canal)
  const devolucionesVistaParam = getFirstParam(searchParams.devolucionesVista)

  const parsedDesde = parseDateOrFallback(fechaDesdeParam, new Date(Date.now() - 30 * DAY_MS))
  const parsedHasta = parseDateOrFallback(fechaHastaParam, new Date())
  const fechaDesde = parsedDesde.getTime() <= parsedHasta.getTime() ? parsedDesde : parsedHasta
  const fechaHasta = parsedDesde.getTime() <= parsedHasta.getTime() ? parsedHasta : parsedDesde
  const canal = canalParam && canalParam !== "all" ? (canalParam as Plataforma | "General") : undefined
  const devolucionesVista = devolucionesVistaParam === "compra" ? "compra" : "reclamo"
  const devolucionesVistaLabel = devolucionesVista === "compra" ? "fecha de compra" : "fecha de reclamo"

  const { fechaDesdeAnterior, fechaHastaAnterior } = getPreviousRange(fechaDesde, fechaHasta)

  const [
    eerrData,
    eerrDataAnterior,
    detalleVentas,
    detalleVentasAnterior,
    detalleGastosIngresos,
    detalleGastosIngresosAnterior,
  ] = await Promise.all([
    calcularEERR(fechaDesde, fechaHasta, canal, devolucionesVista),
    calcularEERR(fechaDesdeAnterior, fechaHastaAnterior, canal, devolucionesVista),
    getDetalleVentas(fechaDesde, fechaHasta, canal),
    getDetalleVentas(fechaDesdeAnterior, fechaHastaAnterior, canal),
    getDetalleGastosIngresos(fechaDesde, fechaHasta, canal),
    getDetalleGastosIngresos(fechaDesdeAnterior, fechaHastaAnterior, canal),
  ])

  const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString()}`
  const pctSobrePV = (value: number) => (toNumber(eerrData.ventasNetas) > 0 ? ((value / toNumber(eerrData.ventasNetas)) * 100).toFixed(1) : "0.0")
  const pctSobreCosto = (value: number) =>
    toNumber(eerrData.costoProducto) > 0 ? ((value / toNumber(eerrData.costoProducto)) * 100).toFixed(1) : "0.0"

  const devoluciones = Array.isArray(eerrData.detalleDevoluciones) ? eerrData.detalleDevoluciones : []
  const perdidasDevoluciones = round2(
    devoluciones.length > 0
      ? devoluciones.reduce((acc: number, row: any) => acc + calcularPerdidaTotalAjustada(row), 0)
      : toNumber(eerrData.devolucionesPerdidaTotal),
  )

  const ventasNetas = round2(toNumber(eerrData.ventasNetas))
  const costoProducto = round2(toNumber(eerrData.costoProducto))
  const comisionesTotales = round2(toNumber(eerrData.comisiones))
  const enviosTotales = round2(toNumber(eerrData.enviosTotales))
  const costosVariables = round2(costoProducto + comisionesTotales + enviosTotales + perdidasDevoluciones)
  const margenContribucion = round2(ventasNetas - costosVariables)

  const movimientos = Array.isArray(detalleGastosIngresos) ? detalleGastosIngresos : []
  const gastosUGCRows = movimientos.filter((row: any) => String(row?.tipo) === "Gasto" && isUGC(row))
  const gastosAds = round2(toNumber(eerrData.publicidad))
  const gastosUGC = round2(gastosUGCRows.reduce((acc: number, row: any) => acc + Math.abs(toNumber(row?.montoARS)), 0))
  const inversionMarketing = round2(gastosAds + gastosUGC)
  const resultadoOperativoMarketing = round2(margenContribucion - inversionMarketing)

  const detalleOtrosGastos = Array.isArray(eerrData.detalleOtrosGastos) ? eerrData.detalleOtrosGastos : []
  const gastosEstructuraBase = detalleOtrosGastos.filter((row: any) => {
    const categoria = normalize(row?.categoria)
    if (categoriasPersonales.map(normalize).includes(categoria)) return false
    if (categoria === normalize(PAGO_IMPORTACION_CATEGORY)) return false
    if (categoria === normalize(ENVIO_CATEGORY)) return false
    if (categoria === normalize(ENVIO_DEVOLUCIONES_CATEGORY)) return false
    if (categoria === normalize(ADS_CATEGORY)) return false
    if (isUGC(row)) return false
    return true
  })

  const estructuraRows = gastosEstructuraBase
  const estructuraRowsTotal = round2(estructuraRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const estructuraTotal = estructuraRowsTotal
  const estructuraAgrupada = groupByCategoria(estructuraRows)

  const detalleOtrosIngresos = Array.isArray(eerrData.detalleOtrosIngresos) ? eerrData.detalleOtrosIngresos : []
  const interesesMPRows = detalleOtrosIngresos.filter((row: any) =>
    categoriasInteresesMP.map(normalize).includes(normalize(row?.categoria)),
  )
  const totalInteresesMP = round2(interesesMPRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const otrosIngresosOperativos = round2(
    detalleOtrosIngresos
      .filter((row: any) => !categoriasInteresesMP.map(normalize).includes(normalize(row?.categoria)))
      .reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0),
  )

  const baseNegocioAntesAds = round2(margenContribucion - estructuraTotal + otrosIngresosOperativos)
  const resultadoNetoSinInteresesMP = round2(resultadoOperativoMarketing - estructuraTotal + otrosIngresosOperativos)
  const resultadoNetoFinal = round2(resultadoNetoSinInteresesMP + totalInteresesMP)

  const devolucionVentaIds = Array.from(
    new Set(
      devoluciones
        .map((row: any) => String(row?.venta_id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  )
  const ventaIdToModelFallback = await getVentaModelosByIds(devolucionVentaIds)
  const { modelBreakdown, devolucionesNoAsignadas, cantidadVentas } = buildModelBreakdown({
    detalleVentas: Array.isArray(detalleVentas) ? detalleVentas : [],
    devoluciones,
    ventasNetas,
    ventaIdToModelFallback,
  })

  const roasEscalaBE = margenContribucion > 0 ? round2(ventasNetas / margenContribucion) : 0
  const roasNegocioBE = baseNegocioAntesAds > 0 ? round2(ventasNetas / baseNegocioAntesAds) : 0
  const roasActual = inversionMarketing > 0 ? round2(ventasNetas / inversionMarketing) : 0
  const cpaBeMarketing = cantidadVentas > 0 ? round2(margenContribucion / cantidadVentas) : 0
  const cpaActual = cantidadVentas > 0 ? round2(inversionMarketing / cantidadVentas) : 0
  const colchonCpa = round2(cpaBeMarketing - cpaActual)
  const colchonCpaPct = cpaBeMarketing > 0 ? round2((colchonCpa / cpaBeMarketing) * 100) : 0

  const gastosPersonalesRows = detalleOtrosGastos.filter((row: any) =>
    categoriasPersonales.map(normalize).includes(normalize(row?.categoria)),
  )
  const ingresosPersonalesRows = Array.isArray((eerrData as any).detalleIngresosPersonales)
    ? (eerrData as any).detalleIngresosPersonales
    : []
  const totalGastosPersonales = round2(gastosPersonalesRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const totalIngresosPersonales = round2(
    ingresosPersonalesRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0),
  )
  const resultadoFinalConPersonales = round2(resultadoNetoFinal - totalGastosPersonales + totalIngresosPersonales)

  const metricsActual: ComparativeMetrics = {
    ventasNetas,
    margenOperativoMonto: resultadoNetoSinInteresesMP,
    margenOperativoPct: ventasNetas > 0 ? round2((resultadoNetoSinInteresesMP / ventasNetas) * 100) : 0,
    roasActual,
    roasNegocioBE,
    roasEscalaBE,
    cpaActual,
    cpaBeMarketing,
    colchonCpa,
    colchonCpaPct,
    costosPlataformaPct: ventasNetas > 0 ? round2(((comisionesTotales + enviosTotales) / ventasNetas) * 100) : 0,
    devolucionesTasaPct: Array.isArray(detalleVentas) && detalleVentas.length > 0 ? round2((devoluciones.length / detalleVentas.length) * 100) : 0,
    devolucionesPctSobreVentas: ventasNetas > 0 ? round2((perdidasDevoluciones / ventasNetas) * 100) : 0,
  }

  const { cantidadVentas: cantidadVentasAnterior } = buildModelBreakdown({
    detalleVentas: Array.isArray(detalleVentasAnterior) ? detalleVentasAnterior : [],
    devoluciones: Array.isArray(eerrDataAnterior?.detalleDevoluciones) ? eerrDataAnterior.detalleDevoluciones : [],
    ventasNetas: round2(toNumber(eerrDataAnterior?.ventasNetas)),
  })

  const metricsAnterior = buildComparativeMetrics(
    eerrDataAnterior,
    detalleVentasAnterior,
    detalleGastosIngresosAnterior,
    cantidadVentasAnterior,
  )
  const stockCoverageActual = await getStockCoverageMetrics(fechaHasta, canal)
  const topSkuRows = buildTopSkuRows(devoluciones, detalleVentas, ventaIdToModelFallback)
  const marginStatus = getMarginStatus(metricsActual.margenOperativoPct)
  const escalaBadge = getEscalaBadge(metricsActual.margenOperativoPct)
  const scaleCapacity = getScaleCapacity(
    metricsActual.margenOperativoPct,
    metricsActual.roasActual,
    metricsActual.roasEscalaBE,
    metricsActual.colchonCpa,
  )
  const devolucionesStatus = getDevolucionesStatus(metricsActual.devolucionesTasaPct)
  const negocioRentable = metricsActual.roasNegocioBE > 0 && metricsActual.roasActual >= metricsActual.roasNegocioBE

  const trendMargenOperativoPct = buildTrend(metricsActual.margenOperativoPct, metricsAnterior.margenOperativoPct, true)
  const trendMargenOperativoMonto = buildTrend(metricsActual.margenOperativoMonto, metricsAnterior.margenOperativoMonto, true)
  const trendFacturacion = buildTrend(metricsActual.ventasNetas, metricsAnterior.ventasNetas, true)
  const trendCostosPlataforma = buildTrend(metricsActual.costosPlataformaPct, metricsAnterior.costosPlataformaPct, false)
  const trendDevoluciones = buildTrend(metricsActual.devolucionesPctSobreVentas, metricsAnterior.devolucionesPctSobreVentas, false)
  const trendDevolucionesTasa = buildTrend(metricsActual.devolucionesTasaPct, metricsAnterior.devolucionesTasaPct, false)

  const objetivosEnRiesgo: string[] = []
  if (metricsActual.margenOperativoPct < 10) objetivosEnRiesgo.push("Margen neto")
  if (metricsActual.devolucionesTasaPct > 10) objetivosEnRiesgo.push("Devoluciones")
  if (metricsActual.colchonCpa < 0) objetivosEnRiesgo.push("CPA marketing")

  const formatPercent = (value: number) => `${value.toFixed(1)}%`
  const formatRatio = (value: number) => `${value.toFixed(2)}x`
  const formatUnits = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const formatCoverageMonths = (value: number | null) => (value === null ? "Sin ventas 90d" : `${value.toFixed(1)} meses`)
  const stockCoverageRows = stockCoverageActual.detalleProductos.slice(0, 12)

  const comparisonMetrics: MetricComparison[] = [
    {
      key: "margen_operativo_pct",
      label: "Margen neto %",
      current: metricsActual.margenOperativoPct,
      previous: metricsAnterior.margenOperativoPct,
      higherIsBetter: true,
      formatter: formatPercent,
      tooltip: {
        queMide: "Resultado neto (sin intereses MP) sobre ventas netas.",
        paraQueSirve: "Mide la salud principal del negocio.",
        comoDecidir: "Si cae debajo del 10%, se pausa el escalamiento.",
      },
      trend: buildTrend(metricsActual.margenOperativoPct, metricsAnterior.margenOperativoPct, true),
    },
    {
      key: "margen_operativo_ars",
      label: "Margen neto $",
      current: metricsActual.margenOperativoMonto,
      previous: metricsAnterior.margenOperativoMonto,
      higherIsBetter: true,
      formatter: formatCurrency,
      tooltip: {
        queMide: "Resultado neto (sin intereses MP) en pesos.",
        paraQueSirve: "Mide capacidad real de caja para crecer.",
        comoDecidir: "Si cae vs periodo anterior, escalar con control.",
      },
      trend: buildTrend(metricsActual.margenOperativoMonto, metricsAnterior.margenOperativoMonto, true),
    },
    {
      key: "facturacion",
      label: "Facturacion mensual",
      current: metricsActual.ventasNetas,
      previous: metricsAnterior.ventasNetas,
      higherIsBetter: true,
      formatter: formatCurrency,
      tooltip: {
        queMide: "Ventas netas del periodo filtrado.",
        paraQueSirve: "Mide traccion comercial del mes.",
        comoDecidir: "Escalar solo cuando crece junto al margen.",
      },
      trend: buildTrend(metricsActual.ventasNetas, metricsAnterior.ventasNetas, true),
    },
    {
      key: "roas_total",
      label: "ROAS total",
      current: metricsActual.roasActual,
      previous: metricsAnterior.roasActual,
      higherIsBetter: true,
      formatter: formatRatio,
      tooltip: {
        queMide: "Ventas netas por cada peso en marketing.",
        paraQueSirve: "Mide eficiencia de adquisicion.",
        comoDecidir: "Escalar solo por encima del ROAS BE.",
      },
      trend: buildTrend(metricsActual.roasActual, metricsAnterior.roasActual, true),
    },
    {
      key: "cpa_actual",
      label: "CPA actual",
      current: metricsActual.cpaActual,
      previous: metricsAnterior.cpaActual,
      higherIsBetter: false,
      formatter: formatCurrency,
      tooltip: {
        queMide: "Costo por adquisicion por venta.",
        paraQueSirve: "Controla la eficiencia del crecimiento.",
        comoDecidir: "Si supera CPA BE, frenar o optimizar.",
      },
      trend: buildTrend(metricsActual.cpaActual, metricsAnterior.cpaActual, false),
    },
    {
      key: "costos_plataforma",
      label: "% costos plataforma / ventas",
      current: metricsActual.costosPlataformaPct,
      previous: metricsAnterior.costosPlataformaPct,
      higherIsBetter: false,
      formatter: formatPercent,
      tooltip: {
        queMide: "(Comisiones + envios) / ventas netas.",
        paraQueSirve: "Mide friccion estructural de plataforma.",
        comoDecidir: "Si sube, revisar tarifas, pricing y logistica.",
      },
      trend: buildTrend(metricsActual.costosPlataformaPct, metricsAnterior.costosPlataformaPct, false),
    },
    {
      key: "devoluciones_pct",
      label: "% perdida devoluciones / ventas",
      current: metricsActual.devolucionesPctSobreVentas,
      previous: metricsAnterior.devolucionesPctSobreVentas,
      higherIsBetter: false,
      formatter: formatPercent,
      tooltip: {
        queMide: "Perdida economica de devoluciones sobre ventas netas.",
        paraQueSirve: "Detecta erosion de margen por postventa.",
        comoDecidir: "Arriba de 10% activar plan urgente.",
      },
      trend: buildTrend(metricsActual.devolucionesPctSobreVentas, metricsAnterior.devolucionesPctSobreVentas, false),
    },
  ]

  const renderTrend = (trend: TrendInfo) => (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendClass(trend.tone)}`}>
      {trend.tone === "up" && <ArrowUp className="h-3 w-3" />}
      {trend.tone === "down" && <ArrowDown className="h-3 w-3" />}
      {trend.tone === "neutral" && <ArrowRight className="h-3 w-3" />}
      {formatVariationPct(trend.deltaPct)}
    </span>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-medium">Vista de devoluciones en EERR</span>
            <Badge variant={devolucionesVista === "compra" ? "default" : "secondary"}>
              {devolucionesVista === "compra" ? "Fecha de compra" : "Fecha de reclamo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Solo cambia la imputacion temporal de devoluciones. Ventas, gastos, publicidad y el resto del EERR siguen con el mismo periodo operativo.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <ROASAnalysisModal
          ventasNetas={ventasNetas}
          margenContribucion={margenContribucion}
          baseNegocioAntesAds={baseNegocioAntesAds}
          resultadoNetoSinInteresesMP={resultadoNetoSinInteresesMP}
          resultadoNetoFinal={resultadoNetoFinal}
          inversionMarketing={inversionMarketing}
          gastosAds={gastosAds}
          gastosUGC={gastosUGC}
          cantidadVentas={cantidadVentas}
          modelBreakdown={modelBreakdown}
          devolucionesNoAsignadas={devolucionesNoAsignadas}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-700" />
            Estado del negocio
          </CardTitle>
          <CardDescription>
            {`Actual: ${fechaDesde.toLocaleDateString()} - ${fechaHasta.toLocaleDateString()} | Anterior: ${fechaDesdeAnterior.toLocaleDateString()} - ${fechaHastaAnterior.toLocaleDateString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-blue-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Margen neto %
                  <MetricInfoTooltip
                    queMide="Resultado neto (sin intereses MP) sobre ventas netas."
                    paraQueSirve="Es el KPI principal para habilitar o frenar escalamiento."
                    comoDecidir="Debajo de 10% se pausa escala; arriba de 15% se habilita escala fuerte."
                  />
                </div>
                <Badge variant={marginStatus.variant}>{`${marginStatus.emoji} ${marginStatus.label}`}</Badge>
              </div>
              <div className="text-3xl font-bold">{formatPercent(metricsActual.margenOperativoPct)}</div>
              <div className="text-xs text-muted-foreground">Objetivo: &gt;= 10%</div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{`Anterior: ${formatPercent(metricsAnterior.margenOperativoPct)}`}</span>
                {renderTrend(trendMargenOperativoPct)}
              </div>
            </div>

            <div className="rounded-lg border p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Margen neto $
                  <MetricInfoTooltip
                    queMide="Resultado neto (sin intereses MP) en pesos."
                    paraQueSirve="Muestra capacidad de caja para sostener crecimiento."
                    comoDecidir="Si baja vs periodo anterior, escalar con control o pausar."
                  />
                </div>
                <Badge variant={escalaBadge.variant}>{escalaBadge.label}</Badge>
              </div>
              <div className={`text-3xl font-bold ${metricsActual.margenOperativoMonto >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {formatCurrency(metricsActual.margenOperativoMonto)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{`Anterior: ${formatCurrency(metricsAnterior.margenOperativoMonto)}`}</span>
                {renderTrend(trendMargenOperativoMonto)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-md border p-3 bg-emerald-50/60">
              <div className="text-xs text-muted-foreground">¿El negocio es rentable?</div>
              <div className={`text-base font-semibold ${negocioRentable ? "text-emerald-700" : "text-red-700"}`}>
                {negocioRentable ? "Si" : "No"}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-blue-50/60">
              <div className="text-xs text-muted-foreground">¿Se puede escalar?</div>
              <div className="text-base font-semibold">{`${scaleCapacity.emoji} ${scaleCapacity.label}`}</div>
            </div>
            <div className="rounded-md border p-3 bg-slate-50/80">
              <div className="text-xs text-muted-foreground">¿Mejor o peor que antes?</div>
              <div className={`text-base font-semibold ${trendClass(trendMargenOperativoMonto.tone)}`}>
                {trendMargenOperativoMonto.tone === "up"
                  ? "Mejor"
                  : trendMargenOperativoMonto.tone === "down"
                    ? "Peor"
                    : "Estable"}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-amber-50/70">
              <div className="text-xs text-muted-foreground">Objetivo en riesgo</div>
              <div className={`text-base font-semibold ${objetivosEnRiesgo.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {objetivosEnRiesgo.length > 0 ? objetivosEnRiesgo.join(" + ") : "Sin riesgo critico"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo vs periodo anterior</CardTitle>
          <CardDescription>
            {`Mismo rango temporal anterior (${fechaDesdeAnterior.toLocaleDateString()} - ${fechaHastaAnterior.toLocaleDateString()}).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {comparisonMetrics.map((metric) => (
              <div key={metric.key} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-tight">{metric.label}</div>
                  <MetricInfoTooltip
                    queMide={metric.tooltip.queMide}
                    paraQueSirve={metric.tooltip.paraQueSirve}
                    comoDecidir={metric.tooltip.comoDecidir}
                  />
                </div>
                <div className="text-xl font-semibold">{metric.formatter(metric.current)}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{`Anterior: ${metric.formatter(metric.previous)}`}</span>
                  {renderTrend(metric.trend)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-700" />
            Rentabilidad
          </CardTitle>
          <CardDescription>Objetivo #1</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 space-y-2 bg-emerald-50/50">
            <div className="flex items-center gap-1 text-sm font-medium">
              ROAS total vs ROAS BE negocio
              <MetricInfoTooltip
                queMide="ROAS actual comparado contra el break-even del negocio."
                paraQueSirve="Confirma si el marketing sostiene resultado neto."
                comoDecidir="Solo rentable si ROAS actual supera ROAS BE negocio."
              />
            </div>
            <div className="flex justify-between text-sm"><span>ROAS actual</span><span className="font-semibold">{formatRatio(metricsActual.roasActual)}</span></div>
            <div className="flex justify-between text-sm"><span>ROAS BE</span><span className="font-semibold">{formatRatio(metricsActual.roasNegocioBE)}</span></div>
            <Badge variant={negocioRentable ? "default" : "destructive"}>{negocioRentable ? "🟢 rentable" : "🔴 no rentable"}</Badge>
          </div>

          <div className="rounded-lg border p-4 space-y-2 bg-blue-50/40">
            <div className="flex items-center gap-1 text-sm font-medium">
              CPA actual vs CPA BE
              <MetricInfoTooltip
                queMide="Costo por venta actual frente al maximo permitido."
                paraQueSirve="Evita escalar perdiendo margen."
                comoDecidir="Si CPA actual supera CPA BE, ajustar inversion."
              />
            </div>
            <div className="flex justify-between text-sm"><span>CPA actual</span><span className={`font-semibold ${metricsActual.cpaActual <= metricsActual.cpaBeMarketing ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(metricsActual.cpaActual)}</span></div>
            <div className="flex justify-between text-sm"><span>CPA BE</span><span className="font-semibold">{formatCurrency(metricsActual.cpaBeMarketing)}</span></div>
            <div className="flex justify-between text-sm"><span>Colchon CPA</span><span className={`font-semibold ${metricsActual.colchonCpa >= 0 ? "text-emerald-700" : "text-red-700"}`}>{`${formatCurrency(metricsActual.colchonCpa)} (${metricsActual.colchonCpaPct >= 0 ? "+" : ""}${metricsActual.colchonCpaPct.toFixed(1)}%)`}</span></div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              % costos plataforma / ventas
              <MetricInfoTooltip
                queMide="(Comisiones + envios) / ventas netas."
                paraQueSirve="Mide friccion estructural del canal."
                comoDecidir="Si sube mes a mes, corregir costos y pricing."
              />
            </div>
            <div className="text-2xl font-bold">{formatPercent(metricsActual.costosPlataformaPct)}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{`Anterior: ${formatPercent(metricsAnterior.costosPlataformaPct)}`}</span>
              {renderTrend(trendCostosPlataforma)}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              % devoluciones sobre ventas
              <MetricInfoTooltip
                queMide="Perdida por devoluciones sobre ventas netas."
                paraQueSirve="Mide impacto real de devoluciones en margen."
                comoDecidir="Si supera 10%, activar plan de correccion urgente."
              />
            </div>
            <div className="text-2xl font-bold">{formatPercent(metricsActual.devolucionesPctSobreVentas)}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{`Anterior: ${formatPercent(metricsAnterior.devolucionesPctSobreVentas)}`}</span>
              {renderTrend(trendDevoluciones)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-blue-700" />
            Escalamiento
          </CardTitle>
          <CardDescription>Objetivo #2</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              Facturacion mensual
              <MetricInfoTooltip
                queMide="Ventas netas del periodo filtrado."
                paraQueSirve="Mide traccion comercial mensual."
                comoDecidir="Escalar cuando facturacion y margen mejoran en paralelo."
              />
            </div>
            <div className="text-3xl font-bold">{formatCurrency(metricsActual.ventasNetas)}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{`Anterior: ${formatCurrency(metricsAnterior.ventasNetas)}`}</span>
              {renderTrend(trendFacturacion)}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm font-medium">
                Capacidad de escala
                <MetricInfoTooltip
                  queMide="Estado derivado de margen %, ROAS escala y colchon CPA."
                  paraQueSirve="Resume si se puede ampliar inversion."
                  comoDecidir="Verde escala, amarillo control, rojo no escalar."
                />
              </div>
              <Badge variant={scaleCapacity.variant}>{`${scaleCapacity.emoji} ${scaleCapacity.label}`}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-xs text-muted-foreground">Margen neto</div>
                <div className={`font-semibold ${metricsActual.margenOperativoPct >= 10 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatPercent(metricsActual.margenOperativoPct)}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-xs text-muted-foreground">ROAS escala</div>
                <div className={`font-semibold ${metricsActual.roasActual >= metricsActual.roasEscalaBE ? "text-emerald-700" : "text-red-700"}`}>
                  {`${formatRatio(metricsActual.roasActual)} / ${formatRatio(metricsActual.roasEscalaBE)}`}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-xs text-muted-foreground">Colchon CPA</div>
                <div className={`font-semibold ${metricsActual.colchonCpa >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {`${formatCurrency(metricsActual.colchonCpa)} (${metricsActual.colchonCpaPct >= 0 ? "+" : ""}${metricsActual.colchonCpaPct.toFixed(1)}%)`}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-slate-700" />
            Cobertura de stock
          </CardTitle>
          <CardDescription>
            {`Objetivo #3: detectar sobrestock segun rotacion. Excedente = stock actual menos ventas de los ultimos ${STOCK_COVERAGE_DAYS} dias.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 bg-slate-50/80 space-y-2">
              <div className="text-sm font-medium">Unidades excedentes a 90 dias</div>
              <div className="text-2xl font-semibold">{`${formatUnits(stockCoverageActual.unidadesExcedentes90d)}u`}</div>
              <div className="text-xs text-muted-foreground">Unidades que sobran por encima de lo que se vendio en los ultimos 90 dias.</div>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50/80 space-y-2">
              <div className="text-sm font-medium">$ excedente a 90 dias</div>
              <div className="text-2xl font-semibold">{formatCurrency(stockCoverageActual.valorExcedente90d)}</div>
              <div className="text-xs text-muted-foreground">Valuado a costo actual del producto.</div>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50/80 space-y-2">
              <div className="text-sm font-medium">Meses de cobertura</div>
              <div className="text-2xl font-semibold">{formatCoverageMonths(stockCoverageActual.coberturaMeses)}</div>
              <div className="text-xs text-muted-foreground">{`Basado en la velocidad de venta de los ultimos ${STOCK_COVERAGE_DAYS} dias.`}</div>
            </div>
          </div>

          <Accordion type="single" collapsible className="rounded-lg border px-4">
            <AccordionItem value="stock-drainage-detail" className="border-none">
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
                  <div>
                    <div className="text-sm font-medium">Detalle por producto</div>
                    <div className="text-xs text-muted-foreground">Cada fila muestra el excedente proyectado a 90 dias segun ventas recientes.</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{`${stockCoverageActual.detalleProductos.length} productos con excedente`}</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {stockCoverageRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin sobrestock segun rotacion de los ultimos 90 dias.</div>
                ) : (
                  <div className="space-y-2">
                    {stockCoverageRows.map((row) => (
                      <div key={row.productoId} className="flex items-center justify-between gap-4 rounded-md bg-slate-50/80 p-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{row.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.sku ? `SKU ${row.sku} - ` : ""}
                            {`${formatUnits(row.stockActualUnidades)}u stock - ${formatUnits(row.ventas90dUnidades)}u vendidas en 90d`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(row.valorExcedente90d)}</div>
                          <div className="text-xs text-muted-foreground">
                            {`${formatUnits(row.unidadesExcedentes90d)}u excedentes - ${formatCoverageMonths(row.coberturaMeses)}`}
                          </div>
                          <div className="text-xs text-muted-foreground">{`${formatPercent(row.pctExcedenteSobreStockActual)} del stock actual`}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            Devoluciones
          </CardTitle>
          <CardDescription>{`Objetivo #4 · vista por ${devolucionesVistaLabel}`}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              % devoluciones
              <MetricInfoTooltip
                queMide="Tasa de devoluciones por cantidad: devoluciones / ventas del periodo."
                paraQueSirve="Semaforo operativo de calidad y postventa."
                comoDecidir="Meta < 5%; alerta entre 5% y 10%; critico > 10%."
              />
            </div>
            <div className={`text-3xl font-bold ${devolucionesStatus.className}`}>{formatPercent(metricsActual.devolucionesTasaPct)}</div>
            <div className="flex items-center justify-between">
              <Badge variant={devolucionesStatus.variant}>{`${devolucionesStatus.emoji} ${devolucionesStatus.label}`}</Badge>
              <span className="text-xs text-muted-foreground">{`${devoluciones.length} devoluciones sobre ${Array.isArray(detalleVentas) ? detalleVentas.length : 0} ventas`}</span>
            </div>
            <div className="text-xs text-muted-foreground">{`Base temporal devoluciones: ${devolucionesVistaLabel}`}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{`Anterior: ${formatPercent(metricsAnterior.devolucionesTasaPct)}`}</span>
              {renderTrend(trendDevolucionesTasa)}
            </div>
            <div className="text-xs text-muted-foreground">
              {`Impacto economico (perdida/ventas): ${formatPercent(metricsActual.devolucionesPctSobreVentas)}`}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-1 text-sm font-medium">
              Top SKUs con devoluciones
              <MetricInfoTooltip
                queMide="SKUs/modelos con mayor frecuencia de devoluciones."
                paraQueSirve="Prioriza acciones sobre productos con mayor perdida."
                comoDecidir="Atacar primero mayor cantidad y mayor impacto economico."
              />
            </div>
            {topSkuRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin devoluciones en el periodo.</div>
            ) : (
              <ul className="space-y-2">
                {topSkuRows.map((row) => (
                  <li key={row.sku} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                    <span className="font-medium">{row.sku}</span>
                    <span className="text-muted-foreground">{`${row.devoluciones} dev. | -${formatCurrency(row.perdida)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Netas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ventasNetas)}</div>
            <div className="text-xs text-muted-foreground">Periodo operativo seleccionado</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Contribucion</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${margenContribucion >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(margenContribucion)}
            </div>
            <div className="flex gap-1 mt-2">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(margenContribucion)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(margenContribucion)}% s/Costo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversion Marketing</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{formatCurrency(inversionMarketing)}</div>
            <div className="text-xs text-muted-foreground">Ads {formatCurrency(gastosAds)} + UGC {formatCurrency(gastosUGC)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado Marketing</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resultadoOperativoMarketing >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(resultadoOperativoMarketing)}
            </div>
            <div className="flex gap-1 mt-2">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoOperativoMarketing)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoOperativoMarketing)}% s/Costo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neto s/ Intereses MP</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resultadoNetoSinInteresesMP >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(resultadoNetoSinInteresesMP)}
            </div>
            <div className="flex gap-1 mt-2">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoNetoSinInteresesMP)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoNetoSinInteresesMP)}% s/Costo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado Neto Final</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resultadoNetoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(resultadoNetoFinal)}
            </div>
            <div className="flex gap-1 mt-2">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoNetoFinal)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoNetoFinal)}% s/Costo</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Incluye intereses MP {formatCurrency(totalInteresesMP)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de Resultados</CardTitle>
          <CardDescription>
            Periodo: {fechaDesde.toLocaleDateString()} - {fechaHasta.toLocaleDateString()}
            {canal && ` | Canal: ${canalLabels[canal as keyof typeof canalLabels]}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-blue-200/70 bg-blue-50/35 p-4 shadow-sm space-y-2">
            <div className="font-semibold text-blue-900">Ingresos</div>
            <div className="flex justify-between">
              <span>Ventas Netas</span>
              <span className="font-semibold">{formatCurrency(ventasNetas)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200/70 bg-amber-50/35 p-4 shadow-sm space-y-2">
            <div className="font-semibold text-amber-900">Costos Variables</div>
            <div className="flex justify-between text-red-600"><span>(-) Costo productos</span><span>-{formatCurrency(costoProducto)}</span></div>
            <div className="flex justify-between text-red-600"><span>(-) Comisiones totales</span><span>-{formatCurrency(comisionesTotales)}</span></div>
            <div className="flex justify-between text-red-600 text-xs pl-4"><span>Base + IVA + IIBB</span><span>{formatCurrency(toNumber(eerrData.comisionesBase))} + {formatCurrency(toNumber(eerrData.ivaComisiones))} + {formatCurrency(toNumber(eerrData.iibbComisiones))}</span></div>
            <div className="flex justify-between text-red-600"><span>(-) Envios</span><span>-{formatCurrency(enviosTotales)}</span></div>
            <div className="flex justify-between text-red-600"><span>(-) Devoluciones</span><span>-{formatCurrency(perdidasDevoluciones)}</span></div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>= Margen de Contribucion</span>
              <span className={margenContribucion >= 0 ? "text-green-700" : "text-red-700"}>{formatCurrency(margenContribucion)}</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(margenContribucion)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(margenContribucion)}% s/Costo</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-violet-200/70 bg-violet-50/35 p-4 shadow-sm space-y-2">
            <div className="font-semibold text-violet-900">Marketing</div>
            <div className="flex justify-between text-red-600"><span>(-) Ads</span><span>-{formatCurrency(gastosAds)}</span></div>
            <div className="flex justify-between text-red-600"><span>(-) UGC</span><span>-{formatCurrency(gastosUGC)}</span></div>
            <div className="flex justify-between text-red-600 font-medium"><span>(-) Inversion Marketing</span><span>-{formatCurrency(inversionMarketing)}</span></div>
            <div className="grid md:grid-cols-2 gap-2 text-xs pt-1 rounded-md border bg-white/70 p-2">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  ROAS para ESCALAR ADS (BE)
                  <MetricInfoTooltip
                    queMide="El ROAS minimo para que el bloque de marketing no se coma el margen de contribucion."
                    paraQueSirve="Define el piso desde el cual podes escalar ads sin deteriorar la rentabilidad del sistema de adquisicion."
                    comoDecidir="Si el ROAS actual queda abajo, meter mas pauta empeora el negocio."
                  />
                </span>
                <span className="font-semibold">{roasEscalaBE.toFixed(2)}x</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  ROAS para NO PERDER PLATA (BE)
                  <MetricInfoTooltip
                    queMide="El ROAS necesario para que el negocio completo no quede en negativo antes de intereses MP."
                    paraQueSirve="Te muestra el piso real para no perder plata incluyendo estructura."
                    comoDecidir="Si el ROAS actual no llega, el marketing puede vender pero el negocio igual pierde."
                  />
                </span>
                <span className="font-semibold">{roasNegocioBE.toFixed(2)}x</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  ROAS Actual
                  <MetricInfoTooltip
                    queMide="Ventas netas sobre la inversion marketing total del periodo."
                    paraQueSirve="Resume si el mix de adquisicion esta devolviendo suficiente facturacion."
                    comoDecidir="Aca se calcula con Ads + UGC. Para separar Meta Ads de UGC necesitas ventas atribuidas por fuente."
                  />
                </span>
                <span className={`font-semibold ${roasActual >= roasNegocioBE ? "text-emerald-700" : "text-red-700"}`}>{roasActual.toFixed(2)}x</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  Colchon CPA
                  <MetricInfoTooltip
                    queMide="La diferencia entre el CPA maximo soportable y el CPA real."
                    paraQueSirve="Te dice rapido cuanto te sobra o cuanto te pasaste por venta."
                    comoDecidir="Positivo = todavia hay margen. Negativo = cada venta esta entrando mas cara de lo que soporta el margen."
                  />
                </span>
                <span className={`font-semibold ${colchonCpa >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(colchonCpa)} ({colchonCpaPct >= 0 ? "+" : ""}{colchonCpaPct.toFixed(0)}%)
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  CPA BE Marketing
                  <MetricInfoTooltip
                    queMide="El maximo costo por venta que el margen de contribucion puede pagar sin romper marketing."
                    paraQueSirve="Es tu techo operativo de adquisicion por venta."
                    comoDecidir="Si el CPA actual supera este valor, hace falta bajar costo o subir margen."
                  />
                </span>
                <span className="font-semibold">{formatCurrency(cpaBeMarketing)}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  CPA Actual
                  <MetricInfoTooltip
                    queMide="La inversion marketing real dividida por la cantidad de ventas del periodo."
                    paraQueSirve="Muestra cuanto te costo traer cada venta."
                    comoDecidir="Leelo contra el CPA BE, no aislado."
                  />
                </span>
                <span className={`font-semibold ${cpaActual <= cpaBeMarketing ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(cpaActual)}</span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              ROAS actual = ventas netas / (Ads + UGC). ROAS Meta Ads usa solo ventas atribuidas a Meta sobre gasto Meta; ROAS UGC usa ventas atribuidas a UGC sobre gasto UGC.
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>= Resultado Operativo Marketing</span>
              <span className={resultadoOperativoMarketing >= 0 ? "text-green-700" : "text-red-700"}>{formatCurrency(resultadoOperativoMarketing)}</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoOperativoMarketing)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoOperativoMarketing)}% s/Costo</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 shadow-sm space-y-2">
            <div className="font-semibold text-slate-900">Estructura (Gastos Fijos)</div>
            <div className="flex justify-between text-red-700 font-medium">
              <span>(-) Total Estructura</span>
              <span>-{formatCurrency(estructuraTotal)}</span>
            </div>
            {estructuraAgrupada.length > 0 ? (
              <Accordion type="multiple" className="w-full">
                {estructuraAgrupada.map(([categoria, rows], index) => {
                  const subtotal = round2(rows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
                  return (
                    <AccordionItem key={`${categoria}-${index}`} value={`estructura-${index}`}>
                      <AccordionTrigger className="py-2">
                        <div className="flex w-full items-center justify-between pr-2 text-sm">
                          <span>{categoria} ({rows.length})</span>
                          <span className="text-red-700">-{formatCurrency(subtotal)}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {rows.map((row: any) => (
                            <div key={row?.id ?? `${categoria}-${row?.fecha}-${row?.montoARS}`} className="flex justify-between text-xs text-muted-foreground">
                              <span>{row?.fecha?.slice?.(0, 10) || ""}{row?.descripcion ? `: ${row.descripcion}` : ""}</span>
                              <span className="text-red-600">-{formatCurrency(toNumber(row?.montoARS))}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            ) : (
              <div className="text-xs text-muted-foreground">Sin gastos de estructura para el periodo.</div>
            )}
          </div>

          <div className="rounded-lg border border-lime-200/70 bg-lime-50/35 p-4 shadow-sm space-y-2">
            <div className="font-semibold text-lime-900">Resultado Neto</div>
            <div className="flex justify-between">
              <span>Resultado Operativo Marketing</span>
              <span>{formatCurrency(resultadoOperativoMarketing)}</span>
            </div>
            <div className="flex justify-between text-red-700">
              <span>(-) Estructura</span>
              <span>-{formatCurrency(estructuraTotal)}</span>
            </div>
            {otrosIngresosOperativos !== 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>(+) Otros ingresos operativos (sin intereses MP)</span>
                <span>+{formatCurrency(otrosIngresosOperativos)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>= Margen Neto s/ Intereses MP</span>
              <span className={resultadoNetoSinInteresesMP >= 0 ? "text-green-700" : "text-red-700"}>{formatCurrency(resultadoNetoSinInteresesMP)}</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoNetoSinInteresesMP)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoNetoSinInteresesMP)}% s/Costo</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>(+) Intereses MP</span>
              <span>{formatCurrency(totalInteresesMP)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold text-base">
              <span>= Resultado Neto Final</span>
              <span className={resultadoNetoFinal >= 0 ? "text-green-700" : "text-red-700"}>{formatCurrency(resultadoNetoFinal)}</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-xs">{pctSobrePV(resultadoNetoFinal)}% s/PV</Badge>
              <Badge variant="outline" className="text-xs">{pctSobreCosto(resultadoNetoFinal)}% s/Costo</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos Personales (fuera del negocio)</CardTitle>
          <CardDescription>Se muestran despues del resultado de negocio para no mezclar capas operativas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3 space-y-2 bg-pink-50/70">
              <div className="font-medium text-pink-900">Gastos Personales</div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-red-600">-{formatCurrency(totalGastosPersonales)}</span>
              </div>
              <Accordion type="multiple" className="w-full">
                {groupByCategoria(gastosPersonalesRows).map(([categoria, rows], index) => {
                  const subtotal = round2(rows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
                  return (
                    <AccordionItem key={`gp-${categoria}-${index}`} value={`gp-${index}`}>
                      <AccordionTrigger className="py-2">
                        <div className="flex w-full items-center justify-between pr-2 text-sm">
                          <span>{categoria} ({rows.length})</span>
                          <span className="text-red-600">-{formatCurrency(subtotal)}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {rows.map((row: any) => (
                            <div key={row?.id ?? `${categoria}-${row?.fecha}-${row?.montoARS}`} className="flex justify-between text-xs text-muted-foreground">
                              <span>{row?.fecha?.slice?.(0, 10) || ""}{row?.descripcion ? `: ${row.descripcion}` : ""}</span>
                              <span className="text-red-600">-{formatCurrency(toNumber(row?.montoARS))}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>

            <div className="rounded-md border p-3 space-y-2 bg-emerald-50/70">
              <div className="font-medium text-emerald-900">Ingresos Personales</div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-emerald-700">+{formatCurrency(totalIngresosPersonales)}</span>
              </div>
              <Accordion type="multiple" className="w-full">
                {groupByCategoria(ingresosPersonalesRows).map(([categoria, rows], index) => {
                  const subtotal = round2(rows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
                  return (
                    <AccordionItem key={`ip-${categoria}-${index}`} value={`ip-${index}`}>
                      <AccordionTrigger className="py-2">
                        <div className="flex w-full items-center justify-between pr-2 text-sm">
                          <span>{categoria} ({rows.length})</span>
                          <span className="text-emerald-700">+{formatCurrency(subtotal)}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {rows.map((row: any) => (
                            <div key={row?.id ?? `${categoria}-${row?.fecha}-${row?.montoARS}`} className="flex justify-between text-xs text-muted-foreground">
                              <span>{row?.fecha?.slice?.(0, 10) || ""}{row?.descripcion ? `: ${row.descripcion}` : ""}</span>
                              <span className="text-emerald-700">+{formatCurrency(toNumber(row?.montoARS))}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>
          </div>

          <div className="rounded-md border p-3 bg-slate-50/70">
            <div className="flex justify-between font-semibold">
              <span>Resultado Neto Final con Personales</span>
              <span className={resultadoFinalConPersonales >= 0 ? "text-green-700" : "text-red-700"}>
                {formatCurrency(resultadoFinalConPersonales)}
              </span>
            </div>
          </div>

        </CardContent>
      </Card>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ventas">Detalle de Ventas ({detalleVentas.length})</TabsTrigger>
          <TabsTrigger value="gastos">Gastos e Ingresos ({detalleGastosIngresos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Ventas</CardTitle>
              <CardDescription>Todas las ventas del periodo seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <EERRVentasTable data={detalleVentas as any[]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Gastos e Ingresos</CardTitle>
              <CardDescription>Todos los movimientos del periodo seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <EERRGastosIngresosTable data={detalleGastosIngresos as any[]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
