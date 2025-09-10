"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { type Liquidacion } from "@/lib/types"
import { LiquidacionActions } from "@/components/liquidacion-actions"

interface MovimientosDetalle {
  fecha: Date
  gastos: any[]
  ingresos: any[]
  totalGastos: number
  totalIngresos: number
  movimientoNeto: number
  gastosPersonales: number
  otrosIngresos: number
}

interface VentasTNDetalle {
  ventas: any[]
  resumen: {
    cantidadVentas: number
    totalPVBruto: number
    totalDescuentos: number
    totalComisiones: number
    totalIIBB: number
    totalALiquidar: number
  }
}

export function LiquidacionesTable() {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [movimientosDetalle, setMovimientosDetalle] = useState<Record<string, MovimientosDetalle>>({})
  const [ventasTNDetalle, setVentasTNDetalle] = useState<Record<string, VentasTNDetalle>>({})
  async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json() as Promise<T>
  }

  async function fetchLiquidaciones(): Promise<Liquidacion[]> {
    return fetchJSON<Liquidacion[]>("/api/liquidaciones")
  }

  async function fetchGastosIngresosPorFecha(fechaISO: string) {
    return fetchJSON<any[]>(`/api/gastos-ingresos?fecha=${encodeURIComponent(fechaISO)}`)
  }

  function calcularImpactoLocal(items: any[]) {
    let totalIngresos = 0
    let totalGastos = 0
    let totalGastosPersonales = 0
    let totalOtrosIngresos = 0

    items.forEach((item) => {
      if (item.tipo === "Ingreso") {
        if (item.categoria === "Otros Ingresos" || item.esPersonal) {
          totalOtrosIngresos += item.montoARS || 0
        } else {
          totalIngresos += item.montoARS || 0
        }
      } else if (item.tipo === "Gasto") {
        totalGastos += item.montoARS || 0
        if (item.esPersonal) totalGastosPersonales += item.montoARS || 0
      }
    })

    return {
      totalIngresos,
      totalGastos,
      totalGastosPersonales,
      totalOtrosIngresos,
      impactoNeto: totalIngresos - totalGastos,
      items,
    }
  }

  async function fetchDetalleVentasTN(fechaISO: string): Promise<VentasTNDetalle> {
    return fetchJSON<VentasTNDetalle>(`/api/ventas/tn-detalle?fecha=${encodeURIComponent(fechaISO)}`)
  }

  useEffect(() => {
    const cargarLiquidaciones = async () => {
      try {
        const data = await fetchLiquidaciones()
        setLiquidaciones(data)
        
        // Cargar resúmenes de gastos e ingresos para cada liquidación
        const resumenesPromesas = data.map(async (liquidacion) => {
          const fechaISO = (typeof liquidacion.fecha === "string") ? liquidacion.fecha : format(new Date(liquidacion.fecha), "yyyy-MM-dd")
          const items = await fetchGastosIngresosPorFecha(fechaISO)
          const impacto = calcularImpactoLocal(items)
          return {
            liquidacionId: liquidacion.id,
            resumen: {
              fecha: new Date(liquidacion.fecha),
              gastos: impacto.items.filter(item => item.tipo === 'Gasto'), // TODOS los gastos
              ingresos: impacto.items.filter(item => item.tipo === 'Ingreso' && !item.esPersonal),
              totalGastos: impacto.totalGastos + impacto.totalGastosPersonales, // TODOS los gastos
              totalIngresos: impacto.totalIngresos,
              movimientoNeto: impacto.impactoNeto,
              gastosPersonales: impacto.totalGastosPersonales,
              otrosIngresos: impacto.totalOtrosIngresos
            }
          }
        })
        
        const resumenes = await Promise.all(resumenesPromesas)
        const nuevosMovimientos: Record<string, MovimientosDetalle> = {}
        
        resumenes.forEach(({ liquidacionId, resumen }) => {
          nuevosMovimientos[liquidacionId] = resumen
        })
        
        setMovimientosDetalle(nuevosMovimientos)
      } catch (error) {
        console.error("Error al cargar liquidaciones:", error)
      } finally {
        setLoading(false)
      }
    }

    cargarLiquidaciones()
  }, [])

  const toggleRow = async (liquidacionId: string, fecha: Date) => {
    const newExpandedRows = new Set(expandedRows)
    
    if (expandedRows.has(liquidacionId)) {
      newExpandedRows.delete(liquidacionId)
    } else {
      newExpandedRows.add(liquidacionId)
      
      // Cargar movimientos del día si no están cargados
      if (!movimientosDetalle[liquidacionId]) {
        try {
          const fechaStr = format(fecha, 'yyyy-MM-dd')
          const movimientos = await fetchGastosIngresosPorFecha(fechaStr)
          
          const gastosEmpresariales = movimientos.filter(m => m.tipo === 'Gasto' && !m.esPersonal)
          const gastosPersonales = movimientos.filter(m => m.tipo === 'Gasto' && m.esPersonal)
          const todosLosGastos = movimientos.filter(m => m.tipo === 'Gasto') // TODOS los gastos
          
          const ingresosEmpresariales = movimientos.filter(m => m.tipo === 'Ingreso' && !m.esPersonal)
          const otrosIngresos = movimientos.filter(m => m.tipo === 'Ingreso' && m.esPersonal)
          
          const totalGastosEmpresariales = gastosEmpresariales.reduce((sum, g) => sum + g.montoARS, 0)
          const totalGastosPersonales = gastosPersonales.reduce((sum, g) => sum + g.montoARS, 0)
          const totalTodosGastos = todosLosGastos.reduce((sum, g) => sum + g.montoARS, 0)
          
          const totalIngresos = ingresosEmpresariales.reduce((sum, i) => sum + i.montoARS, 0)
          const totalOtrosIngresos = otrosIngresos.reduce((sum, i) => sum + i.montoARS, 0)
          
          setMovimientosDetalle(prev => ({
            ...prev,
            [liquidacionId]: {
              fecha,
              gastos: todosLosGastos, // Mostrar TODOS los gastos
              ingresos: ingresosEmpresariales,
              totalGastos: totalTodosGastos, // Total de TODOS los gastos
              totalIngresos,
              movimientoNeto: totalIngresos - totalTodosGastos, // Usar TODOS los gastos
              gastosPersonales: totalGastosPersonales,
              otrosIngresos: totalOtrosIngresos
            }
          }))
        } catch (error) {
          console.error("Error al cargar movimientos:", error)
        }
      }

      // Cargar detalle de ventas TN si no está cargado
      if (!ventasTNDetalle[liquidacionId]) {
        try {
          const fechaStr = format(fecha, 'yyyy-MM-dd')
          const detalleVentasTN = await fetchDetalleVentasTN(fechaStr)
          
          setVentasTNDetalle(prev => ({
            ...prev,
            [liquidacionId]: detalleVentasTN
          }))
        } catch (error) {
          console.error("Error al cargar detalle ventas TN:", error)
        }
      }
    }
    
    setExpandedRows(newExpandedRows)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Cargando liquidaciones...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (liquidaciones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidaciones</CardTitle>
          <CardDescription>
            Sistema de liquidaciones con flujo MP ? TN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              No hay liquidaciones registradas
            </div>
            <div className="text-sm text-muted-foreground mb-6">
              <p className="mb-2">📊 <strong>Para comenzar:</strong></p>
              <p className="mb-1">1. Ejecuta <code>migration_liquidaciones_flujo.sql</code> en Supabase</p>
              <p className="mb-1">2. Ajusta los valores iniciales según tu situación actual</p>
              <p className="mb-1">3. Usa la función <code>actualizar_mp_liquidacion()</code> para procesar liquidaciones</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidaciones - Flujo MP ? TN</CardTitle>
        <CardDescription>
          Gestión de liquidaciones con MercadoPago y Tienda Nube
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>MP Disponible</TableHead>
                <TableHead>MP A Liquidar</TableHead>
                <TableHead>MP Total</TableHead>
                <TableHead>TN A Liquidar</TableHead>
                <TableHead>Total Disponible</TableHead>
                <TableHead>Movimiento D�a</TableHead>
                <TableHead>Gastos/Ingresos</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liquidaciones.map((liquidacion) => {
                const fecha = new Date(liquidacion.fecha)
                const isExpanded = expandedRows.has(liquidacion.id)
                const detalle = movimientosDetalle[liquidacion.id]
                const detalleVentasTN = ventasTNDetalle[liquidacion.id]
                
                return (
                  <Collapsible key={liquidacion.id} asChild>
                    <>
                      <TableRow className="group">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => toggleRow(liquidacion.id, fecha)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(fecha, "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="text-green-600 font-medium">
                            {formatCurrency(liquidacion.mp_disponible)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-orange-600">
                            {formatCurrency(liquidacion.mp_a_liquidar)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-blue-600">
                            {formatCurrency(liquidacion.mp_total)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-purple-600">
                            {formatCurrency(liquidacion.tn_a_liquidar)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-lg">
                            {formatCurrency(liquidacion.total_disponible)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 ${
                            liquidacion.movimiento_neto_dia > 0 
                              ? 'text-green-600' 
                              : liquidacion.movimiento_neto_dia < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                          }`}>
                            {liquidacion.movimiento_neto_dia > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : liquidacion.movimiento_neto_dia < 0 ? (
                              <TrendingDown className="h-4 w-4" />
                            ) : null}
                            {formatCurrency(Math.abs(liquidacion.movimiento_neto_dia))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {detalle ? (
                            <div className={`flex items-center gap-1 text-sm ${
                              detalle.movimientoNeto > 0 
                                ? 'text-green-600' 
                                : detalle.movimientoNeto < 0 
                                  ? 'text-red-600' 
                                  : 'text-gray-600'
                            }`}>
                              {detalle.movimientoNeto > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : detalle.movimientoNeto < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : null}
                              {formatCurrency(Math.abs(detalle.movimientoNeto))}
                              <div className="text-xs text-muted-foreground ml-1">
                                ({detalle.gastos.length + detalle.ingresos.length})
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">-</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <LiquidacionActions liquidacion={liquidacion} />
                        </TableCell>
                      </TableRow>
                      
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/50 p-0">
                            <div className="p-4 space-y-4">
                              {/* Detalle de liquidaciones del día */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-green-600">MP Liquidado Hoy</CardTitle>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="text-lg font-semibold text-green-600">
                                      {formatCurrency(liquidacion.mp_liquidado_hoy)}
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-purple-600">TN Liquidado Hoy</CardTitle>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="text-lg font-semibold text-purple-600">
                                      {formatCurrency(liquidacion.tn_liquidado_hoy)}
                                    </div>
                                    {liquidacion.tn_iibb_descuento > 0 && (
                                      <div className="text-xs text-red-600">
                                        - IIBB: {formatCurrency(liquidacion.tn_iibb_descuento)}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Observaciones</CardTitle>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="text-sm text-muted-foreground">
                                      {liquidacion.observaciones || "Sin observaciones"}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Movimientos del día */}
                              {detalle && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Movimientos del día:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Gastos */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="destructive">
                                          Todos los Gastos ({detalle.gastos.length})
                                        </Badge>
                                        <span className="text-sm font-medium text-red-600">
                                          {formatCurrency(detalle.totalGastos)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          Todos afectan liquidación
                                        </span>
                                      </div>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {detalle.gastos.map(gasto => (
                                          <div key={gasto.id} className={`text-xs p-2 rounded ${gasto.esPersonal ? 'bg-amber-50 border-l-2 border-amber-400' : 'bg-red-50'}`}>
                                            <div className="font-medium flex items-center gap-1">
                                              {gasto.descripcion}
                                              {gasto.esPersonal && <span className="text-xs bg-amber-200 px-1 rounded">Personal</span>}
                                            </div>
                                            <div className="text-red-600 font-semibold">                                              -{formatCurrency(gasto.montoARS)}
                                            </div>
                                          </div>
                                        ))}
                                        {detalle.gastos.length === 0 && (
                                          <div className="text-xs text-muted-foreground">Sin gastos</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Ingresos */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="default" className="bg-green-600">
                                          Ingresos ({detalle.ingresos.length})
                                        </Badge>
                                        <span className="text-sm font-medium text-green-600">
                                          {formatCurrency(detalle.totalIngresos)}
                                        </span>
                                      </div>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {detalle.ingresos.map(ingreso => (
                                          <div key={ingreso.id} className="text-xs bg-green-50 p-2 rounded">
                                            <div className="font-medium">{ingreso.descripcion}</div>
                                            <div className="text-green-600 font-semibold">
                                              +{formatCurrency(ingreso.montoARS)}
                                            </div>
                                          </div>
                                        ))}
                                        {detalle.ingresos.length === 0 && (
                                          <div className="text-xs text-muted-foreground">Sin ingresos</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Detalle de ventas TN que suman a "TN a Liquidar" */}
                              {detalleVentasTN && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Ventas TN que suman a liquidar:</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-xs">
                                      <div>
                                        <span className="font-medium text-purple-700">Ventas:</span>
                                        <div className="font-semibold">{detalleVentasTN.resumen.cantidadVentas}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-purple-700">PV Bruto:</span>
                                        <div className="font-semibold">{formatCurrency(detalleVentasTN.resumen.totalPVBruto)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-700">Comisiones:</span>
                                        <div className="font-semibold">-{formatCurrency(detalleVentasTN.resumen.totalComisiones)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-700">IIBB:</span>
                                        <div className="font-semibold">-{formatCurrency(detalleVentasTN.resumen.totalIIBB)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-green-700">A Liquidar:</span>
                                        <div className="font-semibold text-lg">{formatCurrency(detalleVentasTN.resumen.totalALiquidar)}</div>
                                      </div>
                                    </div>
                                    
                                    {detalleVentasTN.ventas.length > 0 && (
                                      <div className="space-y-1 max-h-40 overflow-y-auto">
                                        <div className="text-xs font-medium text-purple-700 mb-1">Detalle por venta:</div>
                                        {detalleVentasTN.ventas.map(venta => (
                                          <div key={venta.id} className="text-xs bg-white p-3 rounded border border-purple-100">
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                {/* Información del comprador */}
                                                <div className="font-medium text-blue-700">
                                                  👤 {venta.nombreComprador || 'Comprador no especificado'}
                                                </div>
                                                {venta.emailComprador && (
                                                  <div className="text-muted-foreground text-xs">
                                                    📧 {venta.emailComprador}
                                                  </div>
                                                )}
                                                
                                                {/* Información del producto */}
                                                <div className="mt-1">
                                                  <div className="font-medium text-purple-700">
                                                    📦 {venta.producto?.nombre || venta.producto?.modelo || 'Producto sin nombre'}
                                                  </div>
                                                  {venta.producto?.sku && (
                                                    <div className="text-xs text-muted-foreground">
                                                      SKU: {venta.producto.sku}
                                                    </div>
                                                  )}
                                                </div>
                                                
                                                {/* Detalles de la venta */}
                                                <div className="text-muted-foreground mt-1 space-y-0.5">
                                                  <div>📊 Cantidad: {venta.cantidad} • PV: {formatCurrency(venta.pvBruto)}</div>
                                                  <div>💳 Método: {venta.metodoPago} • Estado: {venta.estadoEnvio}</div>
                                                  {venta.tracking && (
                                                    <div>🚚 Tracking: {venta.tracking}</div>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {/* Monto a liquidar destacado */}
                                              <div className="text-right ml-4">
                                                <div className="bg-green-100 px-2 py-1 rounded">
                                                  <div className="font-bold text-green-700 text-sm">
                                                    💰 {formatCurrency(venta.montoALiquidar)}
                                                  </div>
                                                  <div className="text-xs text-green-600">
                                                    A Liquidar
                                                  </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  Comisiones: -{formatCurrency(Number(venta.comisionesTotales || venta.comision || 0))}
                                                </div>
                                                {venta.iibbComisiones && Number(venta.iibbComisiones) > 0 && (
                                                  <div className="text-xs text-muted-foreground">
                                                    IIBB: -{formatCurrency(Number(venta.iibbComisiones))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {detalleVentasTN.ventas.length === 0 && (
                                      <div className="text-xs text-muted-foreground text-center py-2">
                                        No hay ventas TN este d�a
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Resultado Final */}
                              <div className="space-y-2 border-t pt-4">
                                <h4 className="font-medium text-sm">Informaci�n adicional:</h4>
                                <div className="bg-slate-50 p-3 rounded-lg">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <span className="font-medium text-blue-700">Total Disponible:</span>
                                      <div className="font-bold text-lg text-blue-600">
                                        {formatCurrency(liquidacion.total_disponible)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Incluye TODOS los gastos
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-amber-700">Gastos Personales:</span>
                                      <div className="font-semibold text-amber-600">
                                        {formatCurrency(detalle?.gastosPersonales || 0)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Ya incluidos en liquidación
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-green-700">Otros Ingresos:</span>
                                      <div className="font-semibold text-green-600">
                                        +{formatCurrency(detalle?.otrosIngresos || 0)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        No incluidos en liquidación
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {(detalle?.otrosIngresos || 0) > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium text-slate-700">Total con Otros Ingresos:</span>
                                        <div className="font-bold text-xl text-green-600">
                                          {formatCurrency(
                                            liquidacion.total_disponible + (detalle?.otrosIngresos || 0)
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}









