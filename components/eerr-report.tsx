import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { calcularEERR } from "@/lib/actions/eerr"
import { getDetalleVentas } from "@/lib/actions/getDetalleVentas"
import { getDetalleGastosIngresos } from "@/lib/actions/getDetalleGastosIngresos"
import { getVentaModelosByIds } from "@/lib/actions/getVentaModelosByIds"
import { buildModelBreakdown } from "@/lib/eerr/model-breakdown"
import { EERRVentasTable } from "@/components/eerr-ventas-table"
import { EERRGastosIngresosTable } from "@/components/eerr-gastos-ingresos-table"
import { ROASAnalysisModal } from "@/components/roas-analysis-modal"
import { DollarSign, Receipt, ShoppingCart, Target, TrendingUp } from "lucide-react"
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

export async function EERRReport({ searchParams: searchParamsPromise }: EERRReportProps) {
  const searchParams = await searchParamsPromise
  const fechaDesde = searchParams.fechaDesde
    ? new Date(searchParams.fechaDesde as string)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const fechaHasta = searchParams.fechaHasta ? new Date(searchParams.fechaHasta as string) : new Date()
  const canal =
    searchParams.canal && searchParams.canal !== "all" ? (searchParams.canal as Plataforma | "General") : undefined

  const [eerrData, detalleVentas, detalleGastosIngresos] = await Promise.all([
    calcularEERR(fechaDesde, fechaHasta, canal),
    getDetalleVentas(fechaDesde, fechaHasta, canal),
    getDetalleGastosIngresos(fechaDesde, fechaHasta, canal),
  ])

  const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString()}`
  const pctSobrePV = (value: number) => (toNumber(eerrData.ventasNetas) > 0 ? ((value / toNumber(eerrData.ventasNetas)) * 100).toFixed(1) : "0.0")
  const pctSobreCosto = (value: number) =>
    toNumber(eerrData.costoProducto) > 0 ? ((value / toNumber(eerrData.costoProducto)) * 100).toFixed(1) : "0.0"

  const devoluciones = Array.isArray(eerrData.detalleDevoluciones) ? eerrData.detalleDevoluciones : []
  const perdidasDevoluciones = round2(
    devoluciones.length > 0
      ? devoluciones.reduce((acc: number, row: any) => acc + toNumber(row?.perdida_total), 0)
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
    if (categoria === normalize(ENVIO_DEVOLUCIONES_CATEGORY)) return false
    if (categoria === normalize(ADS_CATEGORY)) return false
    if (isUGC(row)) return false
    return true
  })

  const enviosTNRows = gastosEstructuraBase.filter(
    (row: any) => normalize(row?.categoria) === normalize(ENVIO_CATEGORY) && String(row?.canal) === "TN",
  )
  const totalEnviosTNRows = round2(enviosTNRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const totalEnviosCostosPlataformaTN = round2(toNumber(eerrData.envios))
  const diferenciaEnviosTN = round2(totalEnviosTNRows - totalEnviosCostosPlataformaTN)

  const estructuraRows = gastosEstructuraBase.filter(
    (row: any) => !(normalize(row?.categoria) === normalize(ENVIO_CATEGORY) && String(row?.canal) === "TN"),
  )
  const estructuraRowsTotal = round2(estructuraRows.reduce((acc: number, row: any) => acc + toNumber(row?.montoARS), 0))
  const estructuraTotal = round2(estructuraRowsTotal + diferenciaEnviosTN)
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
  const acosBeEscala = ventasNetas > 0 ? round2(margenContribucion / ventasNetas) : 0
  const cpaBeMarketing = cantidadVentas > 0 ? round2(margenContribucion / cantidadVentas) : 0
  const cpaActual = cantidadVentas > 0 ? round2(inversionMarketing / cantidadVentas) : 0

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

  return (
    <div className="space-y-6">
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
              <div>ROAS para ESCALAR ADS (BE): <span className="font-semibold">{roasEscalaBE.toFixed(2)}x</span></div>
              <div>ROAS para NO PERDER PLATA (BE): <span className="font-semibold">{roasNegocioBE.toFixed(2)}x</span></div>
              <div>ROAS Actual: <span className="font-semibold">{roasActual.toFixed(2)}x</span></div>
              <div>ACOS BE Escala: <span className="font-semibold">{acosBeEscala.toFixed(2)}</span></div>
              <div>CPA BE Marketing: <span className="font-semibold">{formatCurrency(cpaBeMarketing)}</span></div>
              <div>CPA Actual: <span className="font-semibold">{formatCurrency(cpaActual)}</span></div>
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
            {diferenciaEnviosTN !== 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Ajuste envios TN (pagados - plataforma)</span>
                <span>-{formatCurrency(diferenciaEnviosTN)}</span>
              </div>
            )}
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
