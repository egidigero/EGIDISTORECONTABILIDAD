"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, TrendingUp, TrendingDown, Package, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getVentas } from "@/lib/actions/ventas"

interface Producto {
  id: string
  sku: string
  nombreProducto: string
  stockPropio: number
  stockFull: number
  precio_venta: number
  costoUnitarioARS: number
}

interface RotacionStock {
  ventasUltimoMes: { [key: string]: number }
  rotacionData: Array<{
    producto: Producto
    ventasMes: number
    stockTotal: number
    diasStock: number
    rotacionMensual: number
    necesitaRecompra: boolean
    prioridad: 'alta' | 'media' | 'baja' | 'sin-movimiento'
  }>
}

export default function RotacionStock({ productos }: { productos: Producto[] }) {
  const [rotacion, setRotacion] = useState<RotacionStock | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRotacion = async () => {
      setLoading(true)
      try {
        // Obtener ventas del último mes
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const ventas = await getVentas({
          fechaDesde: thirtyDaysAgo
        })

        // Contar ventas por producto
        const ventasUltimoMes: { [key: string]: number } = {}
        ventas.forEach((venta: any) => {
          const productoId = venta.productoId
          ventasUltimoMes[productoId] = (ventasUltimoMes[productoId] || 0) + 1
        })

        // Calcular datos de rotación por producto
        const rotacionData = productos
          .map(producto => {
            const stockTotal = Number(producto.stockPropio || 0) + Number(producto.stockFull || 0)
            const ventasMes = ventasUltimoMes[producto.id] || 0
            const ventasDiarias = ventasMes / 30
            const diasStock = ventasDiarias > 0 ? stockTotal / ventasDiarias : 999
            const rotacionMensual = stockTotal > 0 ? (ventasMes / stockTotal) * 100 : 0

            let prioridad: 'alta' | 'media' | 'baja' | 'sin-movimiento' = 'sin-movimiento'
            let necesitaRecompra = false

            if (ventasMes === 0) {
              prioridad = 'sin-movimiento'
            } else if (diasStock < 15) {
              prioridad = 'alta'
              necesitaRecompra = true
            } else if (diasStock < 30) {
              prioridad = 'media'
              necesitaRecompra = true
            } else {
              prioridad = 'baja'
            }

            return {
              producto,
              ventasMes,
              stockTotal,
              diasStock,
              rotacionMensual,
              necesitaRecompra,
              prioridad
            }
          })
          .sort((a, b) => {
            // Ordenar por prioridad: alta > media > baja > sin-movimiento
            const prioridadOrder = { alta: 0, media: 1, baja: 2, 'sin-movimiento': 3 }
            return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad]
          })

        setRotacion({ ventasUltimoMes, rotacionData })
      } catch (error) {
        console.error("Error al calcular rotación:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRotacion()
  }, [productos])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Rotación de Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Cargando datos...</p>
        </CardContent>
      </Card>
    )
  }

  if (!rotacion) return null

  const productosRecompra = rotacion.rotacionData.filter(r => r.necesitaRecompra)
  const productosSinMovimiento = rotacion.rotacionData.filter(r => r.prioridad === 'sin-movimiento')
  const productosAltaRotacion = rotacion.rotacionData.filter(r => r.ventasMes > 0 && r.rotacionMensual > 50)

  const totalVentasMes = Object.values(rotacion.ventasUltimoMes).reduce((a, b) => a + b, 0)
  const promedioVentasDiarias = totalVentasMes / 30

  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ventas Último Mes</p>
                <p className="text-2xl font-bold">{totalVentasMes}</p>
                <p className="text-xs text-gray-500">{promedioVentasDiarias.toFixed(1)} por día</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Requieren Recompra</p>
                <p className="text-2xl font-bold text-orange-600">{productosRecompra.length}</p>
                <p className="text-xs text-gray-500">Menos de 30 días</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alta Rotación</p>
                <p className="text-2xl font-bold text-green-600">{productosAltaRotacion.length}</p>
                <p className="text-xs text-gray-500">&gt;50% mensual</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sin Movimiento</p>
                <p className="text-2xl font-bold text-gray-600">{productosSinMovimiento.length}</p>
                <p className="text-xs text-gray-500">0 ventas</p>
              </div>
              <TrendingDown className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla Detallada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Análisis Detallado por Producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Ventas 30d</TableHead>
                <TableHead className="text-right">Rotación %</TableHead>
                <TableHead className="text-right">Días Stock</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rotacion.rotacionData.map((item) => (
                <TableRow key={item.producto.id}>
                  <TableCell className="font-mono text-sm">{item.producto.sku}</TableCell>
                  <TableCell>{item.producto.nombreProducto}</TableCell>
                  <TableCell className="text-right">
                    <span className={item.stockTotal === 0 ? "text-red-600 font-bold" : ""}>
                      {item.stockTotal}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{item.ventasMes}</TableCell>
                  <TableCell className="text-right">
                    <span className={item.rotacionMensual > 50 ? "text-green-600 font-semibold" : ""}>
                      {item.rotacionMensual.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span 
                      className={
                        item.diasStock < 15 ? "text-red-600 font-bold" :
                        item.diasStock < 30 ? "text-orange-600 font-semibold" :
                        item.diasStock === 999 ? "text-gray-400" : ""
                      }
                    >
                      {item.diasStock === 999 ? "∞" : Math.round(item.diasStock)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.prioridad === 'alta' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Urgente
                      </Badge>
                    )}
                    {item.prioridad === 'media' && (
                      <Badge className="bg-orange-500 hover:bg-orange-600 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Comprar Pronto
                      </Badge>
                    )}
                    {item.prioridad === 'baja' && (
                      <Badge variant="secondary" className="gap-1">
                        <Package className="h-3 w-3" />
                        Stock OK
                      </Badge>
                    )}
                    {item.prioridad === 'sin-movimiento' && (
                      <Badge variant="outline" className="text-gray-500 gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Sin Ventas
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alertas y Recomendaciones */}
      {productosRecompra.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Productos que Requieren Recompra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productosRecompra.map((item) => (
                <div 
                  key={item.producto.id} 
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div>
                    <p className="font-semibold">{item.producto.nombreProducto}</p>
                    <p className="text-sm text-gray-600">
                      SKU: {item.producto.sku} | Stock: {item.stockTotal} unidades
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">
                      {Math.round(item.diasStock)} días restantes
                    </p>
                    <p className="text-sm text-gray-600">
                      Ventas: {item.ventasMes}/mes ({(item.ventasMes/30).toFixed(1)}/día)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
