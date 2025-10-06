import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { calcularEERR, getResumenPorPeriodo } from "@/lib/actions/eerr"
import { getDetalleVentas } from "@/lib/actions/getDetalleVentas"
import { getDetalleGastosIngresos } from "@/lib/actions/getDetalleGastosIngresos"
import { EERRVentasTable } from "@/components/eerr-ventas-table"
import { EERRGastosIngresosTable } from "@/components/eerr-gastos-ingresos-table"
import { ROASAnalysisModal } from "@/components/roas-analysis-modal"
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

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
  const formatPercentage = (current: number, previous: number) => {
    if (previous === 0) return "N/A"
    const percentage = ((current - previous) / Math.abs(previous)) * 100
    return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`
  }

  // Categorías personales y de negocio (deben estar disponibles en todo el render)
  const categoriasPersonales = [
    'Gastos de Casa',
    'Gastos de Geronimo',
    'Gastos de Sergio',
  ];
  const categoriasNegocioExcluir = [
    'Gastos del negocio - ADS',
    // 'Gastos del negocio - Envios', // No excluir, se maneja abajo
  ];

  // Envíos pagados como gasto (solo Tienda Nube)
  const enviosPagadosGastoTN = Array.isArray(eerrData.detalleOtrosGastos)
    ? eerrData.detalleOtrosGastos.filter((g: any) =>
        g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'
      )
    : [];
  const totalEnviosPagadosGastoTN = enviosPagadosGastoTN.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);

  // Envíos en costos de plataforma (solo Tienda Nube)
  // Usar eerrData.envios, que representa los envíos de Tienda Nube en costos de plataforma
  const totalEnviosCostosPlataformaTN = typeof eerrData.envios === 'number' ? eerrData.envios : 0;

  // Datos para el análisis de ROAS
  // Usar detalleGastosIngresos si está disponible, sino eerrData.detalleOtrosGastos
  const gastosIngresosData = detalleGastosIngresos && detalleGastosIngresos.length > 0 
    ? detalleGastosIngresos 
    : (Array.isArray(eerrData.detalleOtrosGastos) ? eerrData.detalleOtrosGastos : []);
  
  const gastosADS = gastosIngresosData
    .filter((g: any) => g.categoria === 'Gastos del negocio - ADS')
    .reduce((acc: number, g: any) => acc + Math.abs(g.montoARS || 0), 0);

  console.log('EERR - Calculando gastos ADS:', {
    gastosIngresosData: gastosIngresosData.length,
    gastosADS,
    detalleOtrosGastos: eerrData.detalleOtrosGastos?.length
  });

  const gastosOperativos = eerrData.totalCostosPlataforma;
  const cantidadVentas = detalleVentas?.length || 0;

  return (
    <div className="space-y-6">
      {/* Botón de análisis ROAS */}
      <div className="flex justify-end">
        <ROASAnalysisModal
          ingresosBrutos={eerrData.ventasTotales}
          costoProductos={eerrData.costoProducto}
          gastosOperativos={gastosOperativos}
          gastosADS={gastosADS}
          cantidadVentas={cantidadVentas}
        />
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
              Comisiones Totales + Envíos + IIBB
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
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                {eerrData.ventasNetas > 0 ? ((eerrData.margenOperativo / eerrData.ventasNetas) * 100).toFixed(1) : 0}% s/Ventas
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {eerrData.costoProducto > 0 ? ((eerrData.margenOperativo / eerrData.costoProducto) * 100).toFixed(1) : 0}% s/Costo
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Neto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(() => {
              // Calcular margen neto igual que en el detalle: solo gastos del negocio
              let gastosNegocio = Array.isArray(eerrData.detalleOtrosGastos)
                ? eerrData.detalleOtrosGastos.filter((g: any) =>
                    !categoriasPersonales.includes(g.categoria) &&
                    g.categoria !== 'Gastos del negocio - ADS'
                  )
                : [];
              
              // Envíos pagados TN
              const enviosNegocioTN = gastosNegocio.filter((g: any) => g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN');
              const totalEnviosNegocioTN = enviosNegocioTN.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
              const diferenciaEnvios = totalEnviosNegocioTN - totalEnviosCostosPlataformaTN;
              
              // Otros gastos del negocio (excluyendo envíos TN que van aparte)
              const otrosGastosNegocio = gastosNegocio.filter((g: any) => !(g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'));
              const totalOtrosGastosNegocio = otrosGastosNegocio.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
              const totalNegocio = totalOtrosGastosNegocio + diferenciaEnvios;
              
              // Margen Neto = Margen Operativo - Otros Gastos Negocio + Otros Ingresos
              const margenNeto = eerrData.margenOperativo - totalNegocio + eerrData.otrosIngresos;
              
              return (
                <>
                  <div
                    className={`text-2xl font-bold ${margenNeto >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(margenNeto)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-xs px-2 py-0.5">
                      {eerrData.ventasNetas > 0 ? ((margenNeto / eerrData.ventasNetas) * 100).toFixed(1) : 0}% s/Ventas
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {eerrData.costoProducto > 0 ? ((margenNeto / eerrData.costoProducto) * 100).toFixed(1) : 0}% s/Costo
                    </Badge>
                  </div>
                </>
              );
            })()}
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
                      <span>(-) Comisiones Base:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.comisionesBase)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 ml-4">
                      <span>• IVA:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.ivaComisiones)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 ml-4">
                      <span>• IIBB:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.iibbComisiones)}</span>
                    </div>
                    {eerrData.comisionesExtra > 0 && (
                      <>
                        <div className="flex justify-between text-red-600">
                          <span>(-) Comisiones Extra:</span>
                          <span className="font-medium">-{formatCurrency(eerrData.comisionesExtra)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 ml-4">
                          <span>• IVA:</span>
                          <span className="font-medium">-{formatCurrency(eerrData.comisionesExtra * 0.21)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 ml-4">
                          <span>• IIBB:</span>
                          <span className="font-medium">-{formatCurrency(eerrData.comisionesExtra * 0.03)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-red-600 border-t pt-2">
                      <span>= Comisiones Totales:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.comisiones)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Envíos:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.enviosTotales)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold text-red-600">
                      <span>= Total Costos Plataforma:</span>
                      <span>-{formatCurrency(eerrData.totalCostosPlataforma)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 text-teal-700">💎 RESULTADO PARCIAL</h3>
                  <div className="space-y-2 bg-teal-50 p-3 rounded">
                    <div className="flex justify-between">
                      <span>Resultado Bruto:</span>
                      <span className="font-medium">{formatCurrency(eerrData.resultadoBruto)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) Costos Plataforma:</span>
                      <span className="font-medium">-{formatCurrency(eerrData.totalCostosPlataforma)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold text-teal-700">
                      <span>= Resultado Parcial:</span>
                      <span>{formatCurrency(eerrData.resultadoBruto - eerrData.totalCostosPlataforma)}</span>
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

                {/* Margen Operativo */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-blue-900">💼 Margen Operativo</h3>
                  <div className="space-y-2 bg-blue-50 p-3 rounded">
                    <div className="flex justify-between font-bold">
                      <span>Margen Operativo:</span>
                      <span className={eerrData.margenOperativo >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(eerrData.margenOperativo)}</span>
                    </div>
                  </div>
                </div>

                {/* Otros Gastos del Negocio (desglosado, solo negocio) */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-gray-700">💸 Otros Gastos del Negocio</h3>
                  <div className="space-y-2 bg-gray-50 p-3 rounded">
                    {(() => {
                      // Gastos del negocio: todos menos personales y ADS
                      let gastosNegocio = Array.isArray(eerrData.detalleOtrosGastos)
                        ? eerrData.detalleOtrosGastos.filter((g: any) =>
                            !categoriasPersonales.includes(g.categoria) &&
                            g.categoria !== 'Gastos del negocio - ADS'
                          )
                        : [];
                      // De los gastos del negocio, separar los envíos TN
                      const enviosNegocioTN = gastosNegocio.filter((g: any) => g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN');
                      const totalEnviosNegocioTN = enviosNegocioTN.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // La diferencia entre envíos pagados y los de costos de plataforma (solo TN)
                      const diferenciaEnvios = totalEnviosNegocioTN - totalEnviosCostosPlataformaTN;
                      // Otros gastos del negocio: todos menos los envíos TN (que se muestran como línea aparte)
                      const otrosGastosNegocio = gastosNegocio.filter((g: any) => !(g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'));
                      const totalOtrosGastosNegocio = otrosGastosNegocio.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // Total final de otros gastos del negocio incluye la diferencia de envíos
                      const totalNegocio = totalOtrosGastosNegocio + diferenciaEnvios;
                      return <>
                        <div className="flex justify-between text-red-600 font-semibold">
                          <span>(-) Total Otros Gastos:</span>
                          <span>-{formatCurrency(totalNegocio)}</span>
                        </div>
                        {/* Mostrar diferencia de envíos si existe */}
                        {diferenciaEnvios !== 0 && (
                          <div className="flex justify-between text-red-600 text-xs">
                            <span>Diferencia Envíos TN (pagados - en plataforma):</span>
                            <span>-{formatCurrency(diferenciaEnvios)}</span>
                          </div>
                        )}
                        {otrosGastosNegocio.length > 0 ? (
                          <div className="mt-2">
                            <ul className="text-xs text-gray-700 space-y-1">
                              {otrosGastosNegocio.map((gasto: any) => (
                                <li key={gasto.id} className="flex justify-between border-b border-gray-100 pb-1 last:border-b-0">
                                  <span>{gasto.fecha?.slice(0,10) || ''} - {gasto.categoria}{gasto.descripcion ? `: ${gasto.descripcion}` : ''}</span>
                                  <span className="text-red-600">-{formatCurrency(gasto.montoARS)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-2">Sin otros gastos en el período</div>
                        )}
                      </>;
                    })()}
                  </div>
                </div>

                {/* Otros Ingresos del Negocio (desglosado) */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-green-700">💵 Otros Ingresos del Negocio</h3>
                  <div className="space-y-2 bg-green-50 p-3 rounded">
                    <div className="flex justify-between text-green-700 font-semibold">
                      <span>+ Total Otros Ingresos:</span>
                      <span>{formatCurrency(eerrData.otrosIngresos)}</span>
                    </div>
                    {Array.isArray(eerrData.detalleOtrosIngresos) && eerrData.detalleOtrosIngresos.length > 0 ? (
                      <div className="mt-2">
                        <ul className="text-xs text-gray-700 space-y-1">
                          {eerrData.detalleOtrosIngresos.map((ingreso: any) => (
                            <li key={ingreso.id} className="flex justify-between border-b border-gray-100 pb-1 last:border-b-0">
                              <span>{ingreso.fecha?.slice(0,10) || ''} - {ingreso.categoria}{ingreso.descripcion ? `: ${ingreso.descripcion}` : ''}</span>
                              <span className="text-green-700">{formatCurrency(ingreso.montoARS)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-2">Sin otros ingresos en el período</div>
                    )}
                  </div>
                </div>

                {/* Margen Neto */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-black">🧮 Margen Neto</h3>
                  <div className="space-y-2 bg-yellow-50 p-3 rounded">
                    {(() => {
                      // Gastos del negocio: todos menos personales y ADS
                      let gastosNegocio = Array.isArray(eerrData.detalleOtrosGastos)
                        ? eerrData.detalleOtrosGastos.filter((g: any) =>
                            !categoriasPersonales.includes(g.categoria) &&
                            g.categoria !== 'Gastos del negocio - ADS'
                          )
                        : [];
                      // De los gastos del negocio, separar los envíos TN
                      const enviosNegocioTN = gastosNegocio.filter((g: any) => g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN');
                      const totalEnviosNegocioTN = enviosNegocioTN.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // La diferencia entre envíos pagados y los de costos de plataforma (solo TN)
                      const diferenciaEnvios = totalEnviosNegocioTN - totalEnviosCostosPlataformaTN;
                      // Otros gastos del negocio: todos menos los envíos TN (que se muestran como línea aparte)
                      const otrosGastosNegocio = gastosNegocio.filter((g: any) => !(g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'));
                      const totalOtrosGastosNegocio = otrosGastosNegocio.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // Total final de otros gastos del negocio incluye la diferencia de envíos
                      const totalNegocio = totalOtrosGastosNegocio + diferenciaEnvios;
                      const margenNeto = eerrData.margenOperativo - totalNegocio + eerrData.otrosIngresos;
                      return <div className="flex justify-between text-black font-bold text-lg">
                        <span>Margen Neto:</span>
                        <span className={margenNeto >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(margenNeto)}</span>
                      </div>;
                    })()}
                  </div>
                </div>
                {/* Gastos personales y margen final después de gastos personales */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-pink-700">👤 Gastos Personales</h3>
                  <div className="space-y-2 bg-pink-50 p-3 rounded">
                    {(() => {
                      const gastosPersonales = Array.isArray(eerrData.detalleOtrosGastos)
                        ? eerrData.detalleOtrosGastos.filter((g: any) => categoriasPersonales.includes(g.categoria))
                        : [];
                      const totalPersonales = gastosPersonales.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      return <>
                        <div className="flex justify-between text-pink-700 font-semibold">
                          <span>(-) Total Gastos Personales:</span>
                          <span>-{formatCurrency(totalPersonales)}</span>
                        </div>
                        {gastosPersonales.length > 0 ? (
                          <div className="mt-2">
                            <ul className="text-xs text-gray-700 space-y-1">
                              {gastosPersonales.map((gasto: any) => (
                                <li key={gasto.id} className="flex justify-between border-b border-gray-100 pb-1 last:border-b-0">
                                  <span>{gasto.fecha?.slice(0,10) || ''} - {gasto.categoria}{gasto.descripcion ? `: ${gasto.descripcion}` : ''}</span>
                                  <span className="text-pink-700">-{formatCurrency(gasto.montoARS)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-2">Sin gastos personales en el período</div>
                        )}
                      </>;
                    })()}
                  </div>
                </div>

                {/* Margen final después de gastos personales */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-black">💎 Margen Final después de Gastos Personales</h3>
                  <div className="space-y-2 bg-lime-50 p-3 rounded">
                    {(() => {
                      // Gastos del negocio: todos menos personales y ADS
                      let gastosNegocio = Array.isArray(eerrData.detalleOtrosGastos)
                        ? eerrData.detalleOtrosGastos.filter((g: any) =>
                            !categoriasPersonales.includes(g.categoria) &&
                            g.categoria !== 'Gastos del negocio - ADS'
                          )
                        : [];
                      // De los gastos del negocio, separar los envíos TN
                      const enviosNegocioTN = gastosNegocio.filter((g: any) => g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN');
                      const totalEnviosNegocioTN = enviosNegocioTN.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // La diferencia entre envíos pagados y los de costos de plataforma (solo TN)
                      const diferenciaEnvios = totalEnviosNegocioTN - totalEnviosCostosPlataformaTN;
                      // Otros gastos del negocio: todos menos los envíos TN (que se muestran como línea aparte)
                      const otrosGastosNegocio = gastosNegocio.filter((g: any) => !(g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'));
                      const totalOtrosGastosNegocio = otrosGastosNegocio.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      // Total final de otros gastos del negocio incluye la diferencia de envíos
                      const totalNegocio = totalOtrosGastosNegocio + diferenciaEnvios;
                      const gastosPersonales = Array.isArray(eerrData.detalleOtrosGastos)
                        ? eerrData.detalleOtrosGastos.filter((g: any) => categoriasPersonales.includes(g.categoria))
                        : [];
                      const totalPersonales = gastosPersonales.reduce((acc: number, g: any) => acc + (g.montoARS || 0), 0);
                      const margenNeto = eerrData.margenOperativo - totalNegocio + eerrData.otrosIngresos;
                      const margenFinal = margenNeto - totalPersonales;
                      return <div className="flex justify-between text-black font-bold text-lg">
                        <span>Margen Final:</span>
                        <span className={margenFinal >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(margenFinal)}</span>
                      </div>;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Resultado Final removido para evitar duplicidad y respetar el nuevo orden solicitado */}
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
