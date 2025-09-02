import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { calcularEERR, getDetalleVentas, getDetalleGastosIngresos, getResumenPorPeriodo } from "@/lib/actions/eerr"
import { DataTable } from "@/components/data-table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
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

const tipoLabels = {
  Gasto: "Gasto",
  OtroIngreso: "Otro Ingreso",
}

export async function EERRReport({ searchParams }: EERRReportProps) {
  // Parsear parámetros
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

  // Columnas para tabla de ventas
  const ventasColumns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: any) => new Date(venta.fecha).toLocaleDateString(),
    },
    {
      key: "saleCode",
      header: "Código",
      render: (venta: any) => <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>,
    },
    {
      key: "comprador",
      header: "Comprador",
    },
    {
      key: "producto",
      header: "Producto",
      render: (venta: any) => venta.producto.modelo,
    },
    {
      key: "pvBruto",
      header: "PV Bruto",
      render: (venta: any) => `$${Number(venta.pvBruto).toLocaleString()}`,
    },
    {
      key: "precioNeto",
      header: "Precio Neto",
      render: (venta: any) => `$${Number(venta.precioNeto).toLocaleString()}`,
    },
    {
      key: "ingresoMargen",
      header: "Margen",
      render: (venta: any) => {
        const margen = Number(venta.ingresoMargen)
        return <span className={margen >= 0 ? "text-green-600" : "text-red-600"}>${margen.toLocaleString()}</span>
      },
    },
    {
      key: "estadoEnvio",
      header: "Estado",
      render: (venta: any) => <EstadoEnvioBadge estado={venta.estadoEnvio} />,
    },
  ]

  // Columnas para tabla de gastos e ingresos
  const gastosIngresosColumns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (item: any) => new Date(item.fecha).toLocaleDateString(),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (item: any) => (
        <Badge variant={item.tipo === "Gasto" ? "destructive" : "default"}>
          {tipoLabels[item.tipo as keyof typeof tipoLabels]}
        </Badge>
      ),
    },
    {
      key: "canal",
      header: "Canal",
      render: (item: any) => (
        <Badge variant="outline">{item.canal ? canalLabels[item.canal as keyof typeof canalLabels] : "General"}</Badge>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
    },
    {
      key: "descripcion",
      header: "Descripción",
    },
    {
      key: "montoARS",
      header: "Monto",
      render: (item: any) => {
        const monto = Number(item.montoARS)
        return (
          <span className={item.tipo === "Gasto" ? "text-red-600" : "text-green-600"}>
            {item.tipo === "Gasto" ? "-" : "+"}${monto.toLocaleString()}
          </span>
        )
      },
    },
  ]

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
  const formatPercentage = (current: number, previous: number) => {
    if (previous === 0) return "N/A"
    const percentage = ((current - previous) / Math.abs(previous)) * 100
    return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Brutas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(eerrData.ventasBrutas)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {resumenPeriodo.variacion.ventasBrutas >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
              )}
              {formatPercentage(eerrData.ventasBrutas, resumenPeriodo.anterior.ventasBrutas)} vs período anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Bruto</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(eerrData.margenBruto)}</div>
            <div className="text-xs text-muted-foreground">
              {eerrData.ventasBrutas > 0
                ? `${((eerrData.margenBruto / eerrData.ventasBrutas) * 100).toFixed(1)}% de las ventas`
                : "0% de las ventas"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(eerrData.gastosCanal + eerrData.gastosGenerales)}
            </div>
            <div className="text-xs text-muted-foreground">
              Canal: {formatCurrency(eerrData.gastosCanal)} | General: {formatCurrency(eerrData.gastosGenerales)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado Operativo</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${eerrData.resultadoOperativo >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(eerrData.resultadoOperativo)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {resumenPeriodo.variacion.resultadoOperativo >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
              )}
              {formatPercentage(eerrData.resultadoOperativo, resumenPeriodo.anterior.resultadoOperativo)} vs período
              anterior
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-lg mb-2">Ingresos</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Ventas Brutas:</span>
                    <span className="font-medium">{formatCurrency(eerrData.ventasBrutas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precio Neto:</span>
                    <span className="font-medium">{formatCurrency(eerrData.precioNeto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Otros Ingresos:</span>
                    <span className="font-medium text-green-600">+{formatCurrency(eerrData.otrosIngresos)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-medium text-lg mb-2">Costos y Gastos</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Costo de Productos:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(eerrData.costoProducto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Costo de Envío:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(eerrData.costoEnvio)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gastos del Canal:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(eerrData.gastosCanal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gastos Generales:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(eerrData.gastosGenerales)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Resultado Operativo:</span>
                <span className={eerrData.resultadoOperativo >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(eerrData.resultadoOperativo)}
                </span>
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
              <DataTable
                data={detalleVentas}
                columns={ventasColumns}
                searchable
                searchPlaceholder="Buscar por comprador o código..."
              />
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
              <DataTable
                data={detalleGastosIngresos}
                columns={gastosIngresosColumns}
                searchable
                searchPlaceholder="Buscar por descripción o categoría..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
