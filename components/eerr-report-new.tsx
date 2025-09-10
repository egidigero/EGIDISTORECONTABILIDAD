import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { calcularEERR, getResumenPorPeriodo } from "@/lib/actions/eerr"
import { getDetalleVentas } from "@/lib/actions/getDetalleVentas"
import { getDetalleGastosIngresos } from "@/lib/actions/getDetalleGastosIngresos"
import { EERRVentasTable } from "@/components/eerr-ventas-table"
import { EERRGastosIngresosTable } from "@/components/eerr-gastos-ingresos-table"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Receipt } from "lucide-react"
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

export async function EERRReport({ searchParams: searchParamsPromise }: EERRReportProps) {
  // Parsear parámetros
  const searchParams = await searchParamsPromise
  const fechaDesde = searchParams.fechaDesde
    ? new Date(searchParams.fechaDesde as string)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const fechaHasta = searchParams.fechaHasta ? new Date(searchParams.fechaHasta as string) : new Date()
  const canal =
    searchParams.canal && searchParams.canal !== "all" ? (searchParams.canal as Plataforma | "General") : undefined

  // Obtener datos
  const [eerrData, resumenPeriodo, detalleVentas, detalleGastosIngresos] = await Promise.all([
    calcularEERR(fechaDesde, fechaHasta, canal),
    getResumenPorPeriodo(fechaDesde, fechaHasta, canal),
    getDetalleVentas(fechaDesde, fechaHasta, canal),
    getDetalleGastosIngresos(fechaDesde, fechaHasta, canal),
  ])

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
  const formatPercentage = (current: number, previous: number) => {
    if (previous === 0) return "N/A"
    const percentage = ((current - previous) / Math.abs(previous)) * 100
    return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(eerrData.ventasTotales)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {resumenPeriodo.variacion.ventasBrutas >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
              )}
              {formatPercentage(eerrData.ventasTotales, resumenPeriodo.anterior.ventasBrutas)} vs período anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Netas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(eerrData.ventasNetas)}</div>
            <div className="text-xs text-muted-foreground">
              Descuentos: -{formatCurrency(eerrData.descuentos)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado Bruto</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(eerrData.resultadoBruto)}</div>
            <div className="text-xs text-muted-foreground">
              Costo productos: -{formatCurrency(eerrData.costoProducto)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Plataforma</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(eerrData.totalCostosPlataforma)}
            </div>
            <div className="text-xs text-muted-foreground">
              Comisiones + Envíos + IIBB
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eerrData.roas.toFixed(2)}x</div>
            <div className="text-xs text-muted-foreground">
              Publicidad: {formatCurrency(eerrData.publicidad)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Operativo</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${eerrData.margenOperativo >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(eerrData.margenOperativo)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {resumenPeriodo.variacion.resultadoOperativo >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
              )}
              {formatPercentage(eerrData.margenOperativo, resumenPeriodo.anterior.resultadoOperativo)} vs período anterior
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Resultados detallado */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Resultados Detallado</CardTitle>
          <CardDescription>
            Período: {fechaDesde.toLocaleDateString()} - {fechaHasta.toLocaleDateString()}
            {canal && ` | Canal: ${canalLabels[canal as keyof typeof canalLabels]}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {/* Columna 1: Ingresos y Resultado Bruto */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-blue-700">📊 INGRESOS</h3>
                  <div className="space-y-2 bg-blue-50 p-3 rounded">
                    <div className="flex justify-between">
                      <span>Ventas Totales:</span>
                      <span className="font-medium">{formatCurrency(eerrData.ventasTotales)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Descuentos:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.descuentos)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>= Ventas Netas:</span>
                      <span>{formatCurrency(eerrData.ventasNetas)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">💰 RESULTADO BRUTO</h3>
                  <div className="space-y-2 bg-green-50 p-3 rounded">
                    <div className="flex justify-between">
                      <span>Ventas Netas:</span>
                      <span className="font-medium">{formatCurrency(eerrData.ventasNetas)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Costo Productos:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.costoProducto)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>= Resultado Bruto:</span>
                      <span>{formatCurrency(eerrData.resultadoBruto)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna 2: Costos y Resultado Final */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-orange-700">🏪 COSTOS DE PLATAFORMA</h3>
                  <div className="space-y-2 bg-orange-50 p-3 rounded">
                    <div className="flex justify-between text-red-600">
                      <span>(-) Comisiones:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.comisiones)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Comisiones Extra:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.comisionesExtra)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Envíos:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.envios)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) IIBB:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.iibb)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold text-red-600">
                      <span>= Total Costos Plataforma:</span>
                      <span>-{formatCurrency(eerrData.totalCostosPlataforma)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 text-purple-700">📈 PUBLICIDAD Y ROAS</h3>
                  <div className="space-y-2 bg-purple-50 p-3 rounded">
                    <div className="flex justify-between text-red-600">
                      <span>(-) Publicidad (Meta ADS):</span>
                      <span className="font-medium">-{formatCurrency(eerrData.publicidad)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ROAS:</span>
                      <span className="font-bold text-purple-700">{eerrData.roas.toFixed(2)}x</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {eerrData.roas >= 3 ? "✅ ROAS excelente" : eerrData.roas >= 2 ? "⚠️ ROAS aceptable" : "🔴 ROAS bajo"}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-700">💼 OTROS GASTOS</h3>
                  <div className="space-y-2 bg-gray-50 p-3 rounded">
                    <div className="flex justify-between text-red-600">
                      <span>(-) Otros Gastos del Canal:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.otrosGastos)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resultado Final */}
            <div className="border-t-2 pt-4">
              <div className="bg-slate-100 p-4 rounded-lg">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>💰 MARGEN OPERATIVO FINAL:</span>
                  <span className={eerrData.margenOperativo >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(eerrData.margenOperativo)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Margen sobre ventas: {eerrData.ventasNetas > 0 ? `${((eerrData.margenOperativo / eerrData.ventasNetas) * 100).toFixed(2)}%` : "0%"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tablas de detalle */}
      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ventas">Detalle de Ventas ({detalleVentas.length})</TabsTrigger>
          <TabsTrigger value="gastos">Gastos e Ingresos ({detalleGastosIngresos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Ventas</CardTitle>
              <CardDescription>Todas las ventas del período seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <EERRVentasTable data={detalleVentas} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Gastos e Ingresos</CardTitle>
              <CardDescription>Todos los movimientos del período seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <EERRGastosIngresosTable data={detalleGastosIngresos} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
