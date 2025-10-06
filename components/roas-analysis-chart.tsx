"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, Target, DollarSign } from "lucide-react"

interface ROASAnalysisChartProps {
  ingresosBrutos: number
  costoProductos: number
  gastosOperativos: number
  gastosADS: number
  cantidadVentas: number
}

export function ROASAnalysisChart({
  ingresosBrutos,
  costoProductos,
  gastosOperativos,
  gastosADS,
  cantidadVentas
}: ROASAnalysisChartProps) {
  
  // Debug logs
  console.log('ROAS Analysis Data:', {
    ingresosBrutos,
    costoProductos,
    gastosOperativos,
    gastosADS,
    cantidadVentas
  })
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

  // Calcular métricas base
  // Ventas Netas = Ingresos Brutos (ya viene sin descuentos)
  const ventasNetas = ingresosBrutos
  
  // Resultado Parcial = Ventas Netas - Costo Productos - Gastos Operativos
  // Este es el margen disponible para cubrir ADS
  const resultadoParcial = ventasNetas - costoProductos - gastosOperativos
  
  // ROAS Break Even = Ventas Netas / Resultado Parcial
  // Es decir: cuánto debo facturar por cada peso de margen disponible
  const roasBreakEven = resultadoParcial > 0 ? ventasNetas / resultadoParcial : 0
  
  // CPA Break Even = Resultado Parcial / Cantidad Ventas
  // Es decir: cuánto margen tengo disponible por venta para invertir en ADS
  const cpaBreakEven = cantidadVentas > 0 ? resultadoParcial / cantidadVentas : 0
  
  // ROAS Actual
  const roasActual = gastosADS > 0 ? ventasNetas / gastosADS : 0
  
  // CPA Actual
  const cpaActual = cantidadVentas > 0 ? gastosADS / cantidadVentas : 0
  
  console.log('ROAS Calculations:', {
    ventasNetas,
    resultadoParcial,
    roasBreakEven,
    cpaBreakEven,
    roasActual,
    cpaActual
  })
  
  // Generar datos para el gráfico (ROAS de 0.5x a 10x)
  const chartData = []
  
  // Calcular ratios basados en las ventas actuales (para escalar proporcionalmente)
  const ratioCostoProductos = ventasNetas > 0 ? costoProductos / ventasNetas : 0.4
  const ratioGastosOperativos = ventasNetas > 0 ? gastosOperativos / ventasNetas : 0.2
  
  for (let roas = 0.5; roas <= 10; roas += 0.5) {
    // Para cada ROAS, simular ventas netas (mantener las actuales como referencia)
    const ventasNetasSimuladas = ventasNetas
    
    // Calcular publicidad necesaria para ese ROAS
    // Publicidad = Ventas Netas / ROAS
    const publicidadSimulada = ventasNetasSimuladas / roas
    
    // Calcular costos escalados proporcionalmente a las ventas
    const costoProductosSimulado = ventasNetasSimuladas * ratioCostoProductos
    const gastosOperativosSimulados = ventasNetasSimuladas * ratioGastosOperativos
    
    // Margen Neto = Ventas Netas - Publicidad - Costo Productos - Gastos Operativos
    const margenNeto = ventasNetasSimuladas - publicidadSimulada - costoProductosSimulado - gastosOperativosSimulados
    
    // Calcular porcentajes
    const porcentajeSobrePV = ventasNetasSimuladas > 0 ? (margenNeto / ventasNetasSimuladas) * 100 : 0
    const porcentajeSobreCosto = costoProductosSimulado > 0 ? (margenNeto / costoProductosSimulado) * 100 : 0
    
    chartData.push({
      roas: roas.toFixed(1),
      margenNeto: Math.round(margenNeto),
      porcentajeSobrePV: porcentajeSobrePV,
      porcentajeSobreCosto: porcentajeSobreCosto,
      publicidad: Math.round(publicidadSimulada),
      ventas: Math.round(ventasNetasSimuladas)
    })
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Cálculo */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desglose del Cálculo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ventas Netas</p>
              <p className="font-semibold">{formatCurrency(ventasNetas)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">- Costo Productos</p>
              <p className="font-semibold">{formatCurrency(costoProductos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">- Gastos Operativos</p>
              <p className="font-semibold">{formatCurrency(gastosOperativos)}</p>
            </div>
            <div className="border-l pl-4">
              <p className="text-muted-foreground">= Resultado Parcial</p>
              <p className="font-bold text-lg">{formatCurrency(resultadoParcial)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Break Even */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              ROAS Break Even
            </CardTitle>
            <CardDescription>Ventas Netas / Resultado Parcial</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {roasBreakEven.toFixed(2)}x
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Necesitás facturar ${roasBreakEven.toFixed(2)} por cada $1 invertido en ADS
                </p>
              </div>
              
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ROAS Actual:</span>
                  <span className={`font-semibold ${roasActual >= roasBreakEven ? 'text-green-600' : 'text-red-600'}`}>
                    {roasActual.toFixed(2)}x
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={`font-semibold ${roasActual >= roasBreakEven ? 'text-green-600' : 'text-red-600'}`}>
                    {roasActual >= roasBreakEven ? '✓ Rentable' : '✗ Bajo Break Even'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              CPA Break Even
            </CardTitle>
            <CardDescription>Resultado Parcial / Cantidad Ventas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(cpaBreakEven)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Margen disponible por venta para invertir en ADS
                </p>
              </div>
              
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPA Actual:</span>
                  <span className={`font-semibold ${cpaActual <= cpaBreakEven ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cpaActual)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={`font-semibold ${cpaActual <= cpaBreakEven ? 'text-green-600' : 'text-red-600'}`}>
                    {cpaActual <= cpaBreakEven ? '✓ Eficiente' : '✗ Sobre Break Even'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Análisis de Sensibilidad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análisis de Sensibilidad ROAS
          </CardTitle>
          <CardDescription>
            Cómo cambia el Margen Neto según diferentes niveles de ROAS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="roas" 
                label={{ value: 'ROAS', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Margen Neto ($)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-4 border rounded-lg shadow-lg">
                        <p className="font-bold mb-2">ROAS: {label}x</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-blue-600">
                            Ventas: {formatCurrency(data.ventas)}
                          </p>
                          <p className="text-red-600">
                            Publicidad: {formatCurrency(data.publicidad)}
                          </p>
                          <p className="font-bold text-purple-600">
                            Margen Neto: {formatCurrency(data.margenNeto)}
                          </p>
                          <div className="pt-2 border-t mt-2">
                            <p className="text-green-600">
                              % sobre PV: {data.porcentajeSobrePV.toFixed(1)}%
                            </p>
                            <p className="text-orange-600">
                              % sobre Costo: {data.porcentajeSobreCosto.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              
              {/* Línea horizontal de Break Even (margen = 0) */}
              <ReferenceLine 
                y={0} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5" 
                label={{ value: 'Break Even ($0)', position: 'right', fill: '#ef4444', fontWeight: 'bold' }}
              />
              
              {/* Línea vertical de ROAS Break Even */}
              <ReferenceLine 
                x={roasBreakEven.toFixed(1)} 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ 
                  value: `ROAS BE: ${roasBreakEven.toFixed(2)}x`, 
                  position: 'top',
                  fill: '#3b82f6',
                  fontWeight: 'bold'
                }}
              />
              
              {/* Línea vertical de ROAS Actual */}
              {gastosADS > 0 && (
                <ReferenceLine 
                  x={roasActual.toFixed(1)} 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ 
                    value: `ROAS Actual: ${roasActual.toFixed(2)}x`, 
                    position: 'top',
                    fill: '#10b981',
                    fontWeight: 'bold'
                  }}
                />
              )}
              
              <Line 
                type="monotone" 
                dataKey="margenNeto" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
                name="Margen Neto"
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Métricas actuales con porcentajes */}
          {gastosADS > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
              <h4 className="font-semibold mb-3 text-center">Rendimiento Actual (ROAS {roasActual.toFixed(2)}x)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="text-center p-3 bg-white rounded">
                  <p className="text-muted-foreground text-xs">Ventas Netas</p>
                  <p className="font-bold text-lg">{formatCurrency(ventasNetas)}</p>
                </div>
                <div className="text-center p-3 bg-white rounded">
                  <p className="text-muted-foreground text-xs">Publicidad</p>
                  <p className="font-bold text-lg text-red-600">{formatCurrency(gastosADS)}</p>
                </div>
                <div className="text-center p-3 bg-white rounded">
                  <p className="text-muted-foreground text-xs">Margen Neto</p>
                  <p className="font-bold text-lg text-purple-600">
                    {formatCurrency(ventasNetas - gastosADS - costoProductos - gastosOperativos)}
                  </p>
                </div>
                <div className="text-center p-3 bg-white rounded">
                  <p className="text-muted-foreground text-xs">Rentabilidad</p>
                  <div className="space-y-1">
                    <p className="font-bold text-green-600">
                      {((ventasNetas - gastosADS - costoProductos - gastosOperativos) / ventasNetas * 100).toFixed(1)}% s/PV
                    </p>
                    <p className="font-bold text-orange-600 text-xs">
                      {((ventasNetas - gastosADS - costoProductos - gastosOperativos) / costoProductos * 100).toFixed(1)}% s/Costo
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Resumen de métricas debajo del gráfico */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="text-xs font-medium text-blue-600 uppercase mb-1">ROAS Break Even</div>
              <div className="text-3xl font-bold text-blue-600">{roasBreakEven.toFixed(2)}x</div>
              <div className="text-xs text-muted-foreground mt-1">Punto de equilibrio</div>
            </div>
            
            <div className={`text-center p-4 border-2 rounded-lg ${
              gastosADS > 0 
                ? (roasActual >= roasBreakEven ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-xs font-medium uppercase mb-1 ${
                gastosADS > 0 
                  ? (roasActual >= roasBreakEven ? 'text-green-600' : 'text-red-600')
                  : 'text-gray-600'
              }`}>
                ROAS Actual
              </div>
              <div className={`text-3xl font-bold ${
                gastosADS > 0 
                  ? (roasActual >= roasBreakEven ? 'text-green-600' : 'text-red-600')
                  : 'text-gray-600'
              }`}>
                {gastosADS > 0 ? `${roasActual.toFixed(2)}x` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {gastosADS > 0 ? 'Performance actual' : 'Sin gastos ADS'}
              </div>
            </div>
            
            <div className={`text-center p-4 border-2 rounded-lg ${
              gastosADS > 0 
                ? (roasActual >= roasBreakEven ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200')
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-xs font-medium uppercase mb-1 ${
                gastosADS > 0 
                  ? (roasActual >= roasBreakEven ? 'text-green-600' : 'text-orange-600')
                  : 'text-gray-600'
              }`}>
                Diferencia
              </div>
              <div className={`text-3xl font-bold ${
                gastosADS > 0 
                  ? (roasActual >= roasBreakEven ? 'text-green-600' : 'text-orange-600')
                  : 'text-gray-600'
              }`}>
                {gastosADS > 0 ? `${(roasActual - roasBreakEven >= 0 ? '+' : '')}${(roasActual - roasBreakEven).toFixed(2)}x` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {gastosADS > 0 
                  ? (roasActual >= roasBreakEven ? 'Sobre break even' : 'Bajo break even')
                  : 'Sin datos'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
