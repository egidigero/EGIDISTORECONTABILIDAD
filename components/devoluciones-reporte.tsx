"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertCircle,
  RotateCcw,
  Truck,
  ShoppingCart
} from "lucide-react"

interface DevolucionesReporteProps {
  estadisticas: {
    total: number
    porEstado: Record<string, number>
    porPlataforma: Record<string, number>
    porTipoResolucion?: Record<string, number>
    perdidaTotal: number
    impactoVentasNetas: number
    topMotivos?: Array<{ motivo: string; count: number }>
    perdidaPromedio?: number
    devolucionesConPerdida?: number
    totalVentas?: number // <-- aseguramos que el tipo lo incluya
    data: any[]
  }
}

const estadoColors: Record<string, string> = {
  "En devolución": "bg-yellow-500",
  "Aceptada en camino": "bg-blue-500",
  "Entregada - Reembolso": "bg-red-500",
  "Entregada - Cambio mismo producto": "bg-green-500",
  "Entregada - Cambio otro producto": "bg-purple-500",
  "Entregada - Sin reembolso": "bg-gray-500",
  "Rechazada": "bg-orange-500",
}

const estadoLabels: Record<string, string> = {
  "En devolución": "En devolución",
  "Aceptada en camino": "En camino",
  "Entregada - Reembolso": "Reembolso",
  "Entregada - Cambio mismo producto": "Cambio",
  "Entregada - Cambio otro producto": "Cambio otro",
  "Entregada - Sin reembolso": "Sin reembolso",
  "Rechazada": "Rechazada",
}

export function DevolucionesReporte({ estadisticas }: DevolucionesReporteProps) {
  // Calcular métricas adicionales
  const totalEntregadas = Object.entries(estadisticas.porEstado)
    .filter(([estado]) => estado.startsWith("Entregada"))
    .reduce((sum, [, count]) => sum + count, 0)

  // Prefer counting reembolsos por monto_aplicado_liquidacion cuando esté disponible
  const montoTotalReembolsos = estadisticas.data.reduce((sum, d) => {
    // d.monto_aplicado_liquidacion puede no existir en todos los rows; preferirlo sobre monto_reembolsado
    const applied = Number(d.monto_aplicado_liquidacion ?? d.monto_reembolsado ?? 0)
    return sum + applied
  }, 0)

  const totalReembolsos = estadisticas.data.filter(d => Number(d.monto_aplicado_liquidacion ?? d.monto_reembolsado ?? 0) > 0).length || (estadisticas.porEstado["Entregada - Reembolso"] || 0)
  const totalCambios = (estadisticas.porEstado["Entregada - Cambio mismo producto"] || 0) +
                       (estadisticas.porEstado["Entregada - Cambio otro producto"] || 0)

  const promedioPerdidasPorDevolucion = estadisticas.total > 0 
    ? estadisticas.perdidaTotal / estadisticas.total 
    : 0

  // Agrupar por motivo
  const porMotivo = estadisticas.data.reduce((acc: Record<string, number>, dev: any) => {
    const motivo = dev.motivo || "sin especificar"
    acc[motivo] = (acc[motivo] || 0) + 1
    return acc
  }, {})

  const motivosMasComunes = Object.entries(porMotivo)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)

  // NUEVO: Análisis por producto
  const porProducto = estadisticas.data.reduce((acc: Record<string, any>, dev: any) => {
    const producto = dev.producto_modelo || dev.productoModelo || 'Sin producto'
    if (!acc[producto]) {
      acc[producto] = {
        cantidad: 0,
        perdidaTotal: 0,
        motivos: {} as Record<string, number>,
        recuperables: 0,
        noRecuperables: 0
      }
    }
    acc[producto].cantidad++
    acc[producto].perdidaTotal += Number(dev.perdida_total || dev.perdidaTotal || 0)
    
    const motivo = dev.motivo || 'Sin especificar'
    acc[producto].motivos[motivo] = (acc[producto].motivos[motivo] || 0) + 1
    
    if (dev.producto_recuperable || dev.productoRecuperable) {
      acc[producto].recuperables++
    } else {
      acc[producto].noRecuperables++
    }
    
    return acc
  }, {})

  const productosConDevoluciones = Object.entries(porProducto)
    .map(([producto, data]: [string, any]) => ({
      producto,
      cantidad: data.cantidad,
      perdidaTotal: data.perdidaTotal,
      perdidaPromedio: data.cantidad > 0 ? data.perdidaTotal / data.cantidad : 0,
      motivos: data.motivos,
      motivoPrincipal: Object.entries(data.motivos)
        .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)[0]?.[0] || 'N/A',
      recuperables: data.recuperables,
      noRecuperables: data.noRecuperables,
      tasaNoRecuperable: data.cantidad > 0 ? (data.noRecuperables / data.cantidad) * 100 : 0
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devoluciones</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalEntregadas} completadas
              {typeof estadisticas.totalVentas === 'number' && estadisticas.totalVentas > 0 && (
                <span className="ml-2">· {((estadisticas.total / estadisticas.totalVentas) * 100).toFixed(1)}% ventas</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pérdida Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${estadisticas.perdidaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio: ${promedioPerdidasPorDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reembolsos</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReembolsos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {estadisticas.total > 0 ? ((totalReembolsos / estadisticas.total) * 100).toFixed(1) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cambios</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCambios}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {estadisticas.total > 0 ? ((totalCambios / estadisticas.total) * 100).toFixed(1) : 0}% del total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Estado */}
        <Card>
          <CardHeader>
            <CardTitle>Devoluciones por Estado</CardTitle>
            <CardDescription>Distribución actual del flujo de devoluciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(estadisticas.porEstado)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([estado, cantidad]) => {
                  const porcentaje = estadisticas.total > 0 ? ((cantidad as number) / estadisticas.total) * 100 : 0
                  return (
                    <div key={estado} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${estadoColors[estado] || 'bg-gray-500'}`} />
                          <span>{estadoLabels[estado] || estado}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cantidad}</span>
                          <span className="text-muted-foreground">({porcentaje.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${estadoColors[estado] || 'bg-gray-500'}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        {/* Por Plataforma */}
        <Card>
          <CardHeader>
            <CardTitle>Devoluciones por Plataforma</CardTitle>
            <CardDescription>Cantidad de devoluciones por canal de venta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(estadisticas.porPlataforma)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([plataforma, cantidad]) => {
                  const porcentaje = estadisticas.total > 0 ? ((cantidad as number) / estadisticas.total) * 100 : 0
                  const plataformaLabels: Record<string, string> = {
                    TN: "Tienda Nube",
                    ML: "Mercado Libre",
                    Directo: "Venta Directa"
                  }
                  return (
                    <div key={plataforma} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{plataformaLabels[plataforma] || plataforma}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{cantidad}</Badge>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {porcentaje.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              
              {Object.keys(estadisticas.porPlataforma).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay devoluciones registradas aún
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Motivos más comunes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Motivos más Comunes
          </CardTitle>
          <CardDescription>Top 5 razones de devolución</CardDescription>
        </CardHeader>
        <CardContent>
          {motivosMasComunes.length > 0 ? (
            <div className="space-y-3">
              {motivosMasComunes.map(([motivo, cantidad], index) => {
                const porcentaje = estadisticas.total > 0 ? ((cantidad as number) / estadisticas.total) * 100 : 0
                return (
                  <div key={motivo} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="capitalize">{motivo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{cantidad}</span>
                        <span className="text-muted-foreground">({porcentaje.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay datos de motivos disponibles
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detalle de costos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Costos de Envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadisticas.data.length > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">
                    ${estadisticas.data.reduce((sum, d) => sum + (Number(d.total_costos_envio) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Promedio:</span>
                  <span>
                    ${(estadisticas.data.reduce((sum, d) => sum + (Number(d.total_costos_envio) || 0), 0) / estadisticas.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Costos de Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadisticas.data.length > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">
                    ${estadisticas.data.reduce((sum, d) => sum + (Number(d.total_costo_productos) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Promedio:</span>
                  <span>
                    ${(estadisticas.data.reduce((sum, d) => sum + (Number(d.total_costo_productos) || 0), 0) / estadisticas.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Reembolsos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadisticas.data.length > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">
                    ${montoTotalReembolsos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cantidad:</span>
                  <span>
                    {totalReembolsos}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impacto en ventas */}
      {estadisticas.impactoVentasNetas !== 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TrendingDown className="h-5 w-5" />
              Impacto en Ventas Netas
            </CardTitle>
            <CardDescription>
              Reducción de ingresos por reembolsos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              ${Math.abs(estadisticas.impactoVentasNetas).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {totalReembolsos} {totalReembolsos === 1 ? 'venta anulada' : 'ventas anuladas'} por reembolso
            </p>
          </CardContent>
        </Card>
      )}

      {/* NUEVO: Análisis por Producto */}
      {productosConDevoluciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Análisis por Producto
            </CardTitle>
            <CardDescription>
              Devoluciones, pérdidas y problemas principales por modelo de producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {productosConDevoluciones.slice(0, 10).map((prod) => (
                <div key={prod.producto} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{prod.producto}</h4>
                      <p className="text-sm text-muted-foreground">
                        {prod.cantidad} {prod.cantidad === 1 ? 'devolución' : 'devoluciones'}
                      </p>
                    </div>
                    <Badge variant={prod.tasaNoRecuperable > 50 ? "destructive" : "secondary"}>
                      {prod.tasaNoRecuperable.toFixed(0)}% no recuperable
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Pérdida total</span>
                      <span className="font-semibold text-destructive">
                        ${prod.perdidaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Pérdida promedio</span>
                      <span className="font-semibold">
                        ${prod.perdidaPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Recuperables</span>
                      <span className="font-semibold text-green-600">
                        {prod.recuperables}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">No recuperables</span>
                      <span className="font-semibold text-red-600">
                        {prod.noRecuperables}
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-2">Problema principal:</div>
                    <div className="font-medium">{prod.motivoPrincipal}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(prod.motivos)
                        .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)
                        .slice(0, 3)
                        .map(([motivo, cant]: [string, any]) => (
                          <Badge key={motivo} variant="outline" className="text-xs">
                            {motivo}: {cant}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NUEVO: Resumen de costos por modelo */}
      {productosConDevoluciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resumen de Costos por Modelo
            </CardTitle>
            <CardDescription>
              Ranking de productos por pérdida total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productosConDevoluciones
                .sort((a, b) => b.perdidaTotal - a.perdidaTotal)
                .slice(0, 10)
                .map((prod, index) => {
                  const porcentaje = estadisticas.perdidaTotal > 0 
                    ? (prod.perdidaTotal / estadisticas.perdidaTotal) * 100 
                    : 0
                  return (
                    <div key={prod.producto} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                          <span className="font-medium truncate">{prod.producto}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            ({prod.cantidad} dev.)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-semibold text-destructive">
                            ${prod.perdidaTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-muted-foreground w-12 text-right">
                            {porcentaje.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-destructive"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
