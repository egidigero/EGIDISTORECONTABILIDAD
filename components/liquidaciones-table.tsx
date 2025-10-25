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
import { calcularDetalleVentasTN } from "@/lib/actions/ventas-tn-liquidacion"
import { calcularDetalleVentasMP, calcularImpactoTransferencia } from "@/lib/actions/ventas-mp-liquidacion"

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
    totalIVA?: number
    totalIIBB: number
    totalALiquidar: number
  }
}

interface VentasMPDetalle {
  ventas: any[]
  resumen: {
    cantidadVentas: number
    totalPVBruto: number
    totalDescuentos: number
    totalComisiones: number
    totalIVA: number
    totalIIBB: number
    totalEnvios: number
    totalALiquidar: number
  }
}

interface VentasTransferenciaDetalle {
  ventas: any[]
  resumen: {
    cantidadVentas: number
    totalPVBruto: number
    totalIIBB: number
    totalEnvios: number
    totalDisponible: number
  }
}

export function LiquidacionesTable() {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [movimientosDetalle, setMovimientosDetalle] = useState<Record<string, MovimientosDetalle>>({})
  const [ventasTNDetalle, setVentasTNDetalle] = useState<Record<string, VentasTNDetalle>>({})
  const [ventasMPDetalle, setVentasMPDetalle] = useState<Record<string, VentasMPDetalle>>({})
  const [ventasTransferenciaDetalle, setVentasTransferenciaDetalle] = useState<Record<string, VentasTransferenciaDetalle>>({})
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
        // TODOS los ingresos (incluyendo "Otros Ingresos") afectan liquidaciones
        totalIngresos += item.montoARS || 0
        
        // Separar "Otros Ingresos" solo para reporting
        if (item.categoria === "Otros Ingresos") {
          totalOtrosIngresos += item.montoARS || 0
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
    // Usar la función server action en lugar del endpoint API antiguo
    const resultado = await calcularDetalleVentasTN(fechaISO)
    return resultado
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
          
          // Ingresos del negocio (incluyendo "Otros Ingresos")
          const ingresosEmpresariales = movimientos.filter(m => m.tipo === 'Ingreso' && !m.esPersonal)
          
          const totalGastosEmpresariales = gastosEmpresariales.reduce((sum, g) => sum + g.montoARS, 0)
          const totalGastosPersonales = gastosPersonales.reduce((sum, g) => sum + g.montoARS, 0)
          const totalTodosGastos = todosLosGastos.reduce((sum, g) => sum + g.montoARS, 0)
          
          const totalIngresos = ingresosEmpresariales.reduce((sum, i) => sum + i.montoARS, 0)
          
          setMovimientosDetalle(prev => ({
            ...prev,
            [liquidacionId]: {
              fecha,
              gastos: todosLosGastos, // Mostrar TODOS los gastos
              ingresos: ingresosEmpresariales, // TODOS los ingresos del negocio
              totalGastos: totalTodosGastos, // Total de TODOS los gastos
              totalIngresos, // TODOS los ingresos del negocio (incluye "Otros Ingresos")
              movimientoNeto: totalIngresos - totalTodosGastos, // Usar TODOS los gastos
              gastosPersonales: totalGastosPersonales,
              otrosIngresos: 0 // Ya no separamos "Otros Ingresos"
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

      // Cargar detalle de ventas MP (ML) si no está cargado
      if (!ventasMPDetalle[liquidacionId]) {
        try {
          const fechaStr = format(fecha, 'yyyy-MM-dd')
          const detalleVentasMP = await calcularDetalleVentasMP(fechaStr)
          
          setVentasMPDetalle(prev => ({
            ...prev,
            [liquidacionId]: detalleVentasMP
          }))
        } catch (error) {
          console.error("Error al cargar detalle ventas MP:", error)
        }
      }

      // Cargar detalle de ventas Transferencia si no está cargado
      if (!ventasTransferenciaDetalle[liquidacionId]) {
        try {
          const fechaStr = format(fecha, 'yyyy-MM-dd')
          const detalleVentasTransferencia = await calcularImpactoTransferencia(fechaStr)
          
          setVentasTransferenciaDetalle(prev => ({
            ...prev,
            [liquidacionId]: detalleVentasTransferencia
          }))
        } catch (error) {
          console.error("Error al cargar detalle ventas Transferencia:", error)
        }
      }
      // Cargar devoluciones que impactaron esta fecha
      if (!movimientosDetalle[liquidacionId] || true) {
        try {
          const fechaStr = format(fecha, 'yyyy-MM-dd')
          const res = await fetch(`/api/devoluciones/por-fecha?fecha=${encodeURIComponent(fechaStr)}`)
          if (res.ok) {
            const json = await res.json()
            const devs = json?.data ?? []
            // Añadir devoluciones al detalle de movimientos (se muestra separadamente)
            setMovimientosDetalle(prev => ({
              ...prev,
              [liquidacionId]: {
                ...(prev[liquidacionId] || { fecha, gastos: [], ingresos: [], totalGastos: 0, totalIngresos: 0, movimientoNeto: 0, gastosPersonales: 0, otrosIngresos: 0 }),
                devoluciones: devs
              }
            }))
          }
        } catch (err) {
          console.error('Error cargando devoluciones por fecha', err)
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
            Sistema de liquidaciones con flujo MP ↔ TN
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
        <CardTitle>Liquidaciones - Flujo MP ↔ TN</CardTitle>
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
                <TableHead>MP Retenido</TableHead>
                <TableHead>MP A Liquidar</TableHead>
                <TableHead>MP Total</TableHead>
                <TableHead>TN A Liquidar</TableHead>
                <TableHead>Total Disponible</TableHead>
                <TableHead>Movimiento Día</TableHead>
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
                          <div className="text-amber-700 font-medium">
                            {formatCurrency((liquidacion as any).mp_retenido ?? 0)}
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

                              {/* Devoluciones que impactaron la liquidación del día (inline) */}
                              {detalle && (detalle as any).devoluciones && (detalle as any).devoluciones.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Devoluciones que impactaron esta liquidación:</h4>
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    {(detalle as any).devoluciones.map((d: any) => (
                                      <div key={d.id} className="p-2 rounded bg-white border border-yellow-100 text-xs mb-2">
                                        <div className="font-medium">#{d.id_devolucion ?? d.numero_devolucion ?? d.id} • {d.tipo_resolucion ?? d.estado}</div>
                                        <div className="text-xs text-muted-foreground">Reclamo: {d.fecha_reclamo ? new Date(d.fecha_reclamo).toLocaleDateString() : '-'} • Completada: {d.fecha_completada ? new Date(d.fecha_completada).toLocaleDateString() : '-'}</div>
                                        <div className="text-xs mt-1">
                                          {d.monto_reembolsado ? <div>Reembolso: {formatCurrency(d.monto_reembolsado)}</div> : null}
                                          {d.monto_reembolsado ? (
                                            <div>Reembolso: {formatCurrency(Number(d.monto_reembolsado || 0))}</div>
                                          ) : null}
                                          {d.costo_producto_perdido ? <div className="text-red-600">Producto perdido: {formatCurrency(d.costo_producto_perdido)}</div> : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Detalle de ventas MP (ML) que suman a "MP a Liquidar" */}
                              {ventasMPDetalle[liquidacion.id] && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Ventas ML (MercadoPago) que suman a liquidar:</h4>
                                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-xs">
                                      <div>
                                        <span className="font-medium text-green-700">Ventas:</span>
                                        <div className="font-semibold">{ventasMPDetalle[liquidacion.id].resumen.cantidadVentas}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-green-700">PV Bruto:</span>
                                        <div className="font-semibold">{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalPVBruto)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-700">Deducciones:</span>
                                        <div className="space-y-0.5 text-xs">
                                          <div>• Com: -{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalComisiones)}</div>
                                          <div>• IVA: -{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalIVA || 0)}</div>
                                          <div>• IIBB: -{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalIIBB || 0)}</div>
                                          <div>• Envío: -{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalEnvios || 0)}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-800">Total Desc.:</span>
                                        <div className="font-semibold text-red-800">
                                          -{formatCurrency((ventasMPDetalle[liquidacion.id].resumen.totalComisiones || 0) + (ventasMPDetalle[liquidacion.id].resumen.totalIVA || 0) + (ventasMPDetalle[liquidacion.id].resumen.totalIIBB || 0) + (ventasMPDetalle[liquidacion.id].resumen.totalEnvios || 0))}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-green-700">A Liquidar:</span>
                                        <div className="font-semibold text-lg">{formatCurrency(ventasMPDetalle[liquidacion.id].resumen.totalALiquidar)}</div>
                                      </div>
                                    </div>
                                    
                                    {ventasMPDetalle[liquidacion.id].ventas.length > 0 && (
                                      <div className="space-y-1 max-h-40 overflow-y-auto">
                                        <div className="text-xs font-medium text-green-700 mb-1">Detalle por venta:</div>
                                        {ventasMPDetalle[liquidacion.id].ventas.map(venta => (
                                          <div key={venta.id} className="text-xs bg-white p-3 rounded border border-green-100">
                                            {/* Nombre del comprador arriba */}
                                            <div className="font-medium text-blue-700 mb-1.5">
                                              👤 {venta.comprador || 'Comprador no especificado'}
                                            </div>
                                            
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                {/* Información del producto */}
                                                <div>
                                                  <div className="font-medium text-green-700">
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
                                                  <div>📊 PV: {formatCurrency(venta.pvBruto)}</div>
                                                  <div>💳 Método: MercadoPago</div>
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
                                                {/* Desglose de comisiones */}
                                                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                                  <div className="font-medium text-gray-700">Deducciones:</div>
                                                  <div className="pl-2">
                                                    <div>• Comisión: -{formatCurrency(Number(venta.comision || 0))}</div>
                                                    {venta.iva && Number(venta.iva) > 0 && (
                                                      <div>• IVA (21%): -{formatCurrency(Number(venta.iva))}</div>
                                                    )}
                                                    {venta.iibb && Number(venta.iibb) > 0 && (
                                                      <div>• IIBB: -{formatCurrency(Number(venta.iibb))}</div>
                                                    )}
                                                    {venta.cargoEnvioCosto && Number(venta.cargoEnvioCosto) > 0 && (
                                                      <div>• Envío: -{formatCurrency(Number(venta.cargoEnvioCosto))}</div>
                                                    )}
                                                    <div className="border-t border-gray-300 mt-0.5 pt-0.5 font-medium">
                                                      Total: -{formatCurrency(Number(venta.comision || 0) + Number(venta.iva || 0) + Number(venta.iibb || 0) + Number(venta.cargoEnvioCosto || 0))}
                                                    </div>
                                                  </div>
                                                </div>
                                                {/* Devoluciones relacionadas (si las hay) */}
                                                {venta.devoluciones && venta.devoluciones.length > 0 && (
                                                  <div className="mt-2 text-xs">
                                                    <div className="font-medium text-gray-700">Devoluciones vinculadas:</div>
                                                    <div className="space-y-1 mt-1">
                                                      {venta.devoluciones.map((d: any) => (
                                                        <div key={d.id} className="p-2 rounded bg-yellow-50 border border-yellow-100">
                                                          <div className="font-medium">#{d.id_devolucion} • {d.tipo_resolucion}</div>
                                                          <div className="text-xs text-muted-foreground">Reclamo: {d.fecha_reclamo ? new Date(d.fecha_reclamo).toLocaleDateString() : '-' } • Completada: {d.fecha_completada ? new Date(d.fecha_completada).toLocaleDateString() : '-'}</div>
                                                          <div className="text-xs mt-1">
                                                            {d.monto_reembolsado ? <div>Reembolso: {formatCurrency(d.monto_reembolsado)}</div> : null}
                                                            {d.monto_reembolsado ? (
                                                              <div>Reembolso: {formatCurrency(Number(d.monto_reembolsado || 0))}</div>
                                                            ) : null}
                                                            {d.costo_producto_perdido ? <div className="text-red-600">Producto perdido: {formatCurrency(d.costo_producto_perdido)}</div> : null}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {ventasMPDetalle[liquidacion.id].ventas.length === 0 && (
                                      <div className="text-xs text-muted-foreground text-center py-2">
                                        No hay ventas ML este día
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Detalle de ventas Transferencia (Directo + Transferencia) que suman a "MP Disponible" */}
                              {ventasTransferenciaDetalle[liquidacion.id] && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Ventas Transferencia Directa que suman a MP Disponible:</h4>
                                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                                      <div>
                                        <span className="font-medium text-blue-700">Ventas:</span>
                                        <div className="font-semibold">{ventasTransferenciaDetalle[liquidacion.id].resumen.cantidadVentas}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-blue-700">PV Bruto:</span>
                                        <div className="font-semibold">{formatCurrency(ventasTransferenciaDetalle[liquidacion.id].resumen.totalPVBruto)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-700">IIBB (fees MP):</span>
                                        <div className="font-semibold text-red-800">-{formatCurrency(ventasTransferenciaDetalle[liquidacion.id].resumen.totalIIBB)}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">Envío: {formatCurrency(ventasTransferenciaDetalle[liquidacion.id].resumen.totalEnvios)} (cliente)</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-blue-700">MP Disponible:</span>
                                        <div className="font-semibold text-lg">{formatCurrency(ventasTransferenciaDetalle[liquidacion.id].resumen.totalDisponible)}</div>
                                      </div>
                                    </div>
                                    
                                    {ventasTransferenciaDetalle[liquidacion.id].ventas.length > 0 && (
                                      <div className="space-y-1 max-h-40 overflow-y-auto">
                                        <div className="text-xs font-medium text-blue-700 mb-1">Detalle por venta:</div>
                                        {ventasTransferenciaDetalle[liquidacion.id].ventas.map(venta => (
                                          <div key={venta.id} className="text-xs bg-white p-3 rounded border border-blue-100">
                                            {/* Nombre del comprador arriba */}
                                            <div className="font-medium text-blue-700 mb-1.5">
                                              👤 {venta.comprador || 'Comprador no especificado'}
                                            </div>
                                            
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                {/* Información del producto */}
                                                <div>
                                                  <div className="font-medium text-blue-700">
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
                                                  <div>📊 PV: {formatCurrency(venta.pvBruto)}</div>
                                                  <div>💳 Método: Transferencia Directa</div>
                                                  <div>🚚 Envío: {formatCurrency(venta.cargoEnvioCosto || 0)} (paga cliente)</div>
                                                  {venta.tracking && (
                                                    <div>📍 Tracking: {venta.tracking}</div>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {/* Monto disponible destacado */}
                                              <div className="text-right ml-4">
                                                <div className="bg-blue-100 px-2 py-1 rounded">
                                                  <div className="font-bold text-blue-700 text-sm">
                                                    💰 {formatCurrency(venta.montoDisponible)}
                                                  </div>
                                                  <div className="text-xs text-blue-600">
                                                    MP Disponible
                                                  </div>
                                                </div>
                                                {/* Desglose */}
                                                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                                  <div className="font-medium text-gray-700">Cálculo:</div>
                                                  <div className="pl-2">
                                                    <div>PV: {formatCurrency(Number(venta.pvBruto || 0))}</div>
                                                    {venta.iibb && Number(venta.iibb) > 0 && (
                                                      <div>- IIBB: {formatCurrency(Number(venta.iibb))}</div>
                                                    )}
                                                    <div className="border-t border-gray-300 mt-0.5 pt-0.5 font-medium text-blue-700">
                                                      = {formatCurrency(venta.montoDisponible)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                      (Envío no se resta, lo paga el cliente)
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {ventasTransferenciaDetalle[liquidacion.id].ventas.length === 0 && (
                                      <div className="text-xs text-muted-foreground text-center py-2">
                                        No hay ventas con Transferencia este día
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Detalle de ventas TN que suman a "TN a Liquidar" */}
                              {ventasTNDetalle[liquidacion.id] && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Ventas TN que suman a liquidar:</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-xs">
                                      <div>
                                        <span className="font-medium text-purple-700">Ventas:</span>
                                        <div className="font-semibold">{ventasTNDetalle[liquidacion.id].resumen.cantidadVentas}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-purple-700">PV Bruto:</span>
                                        <div className="font-semibold">{formatCurrency(ventasTNDetalle[liquidacion.id].resumen.totalPVBruto)}</div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-700">Deducciones:</span>
                                        <div className="space-y-0.5 text-xs">
                                          <div>• Com: -{formatCurrency(ventasTNDetalle[liquidacion.id].resumen.totalComisiones)}</div>
                                          <div>• IVA: -{formatCurrency(ventasTNDetalle[liquidacion.id].resumen.totalIVA || 0)}</div>
                                          <div>• IIBB: -{formatCurrency(ventasTNDetalle[liquidacion.id].resumen.totalIIBB || 0)}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-red-800">Total Desc.:</span>
                                        <div className="font-semibold text-red-800">
                                          -{formatCurrency((ventasTNDetalle[liquidacion.id].resumen.totalComisiones || 0) + (ventasTNDetalle[liquidacion.id].resumen.totalIVA || 0) + (ventasTNDetalle[liquidacion.id].resumen.totalIIBB || 0))}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium text-green-700">A Liquidar:</span>
                                        <div className="font-semibold text-lg">{formatCurrency(ventasTNDetalle[liquidacion.id].resumen.totalALiquidar)}</div>
                                      </div>
                                    </div>
                                    
                                    {ventasTNDetalle[liquidacion.id].ventas.length > 0 && (
                                      <div className="space-y-1 max-h-40 overflow-y-auto">
                                        <div className="text-xs font-medium text-purple-700 mb-1">Detalle por venta:</div>
                                        {ventasTNDetalle[liquidacion.id].ventas.map(venta => (
                                          <div key={venta.id} className="text-xs bg-white p-3 rounded border border-purple-100">
                                            {/* Nombre del comprador arriba */}
                                            <div className="font-medium text-blue-700 mb-1.5">
                                              👤 {venta.comprador || 'Comprador no especificado'}
                                            </div>
                                            
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                {/* Información del producto */}
                                                <div>
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
                                                  <div>📊 PV: {formatCurrency(venta.pvBruto)}</div>
                                                  <div>💳 Método: {venta.metodoPago}</div>
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
                                                {/* Desglose de comisiones */}
                                                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                                  <div className="font-medium text-gray-700">Deducciones:</div>
                                                  <div className="pl-2">
                                                    <div>• Comisión: -{formatCurrency(Number(venta.comision || 0))}</div>
                                                    {venta.iva && Number(venta.iva) > 0 && (
                                                      <div>• IVA (21%): -{formatCurrency(Number(venta.iva))}</div>
                                                    )}
                                                    {venta.iibb && Number(venta.iibb) > 0 && (
                                                      <div>• IIBB (3%): -{formatCurrency(Number(venta.iibb))}</div>
                                                    )}
                                                    <div className="border-t border-gray-300 mt-0.5 pt-0.5 font-medium">
                                                      Total: -{formatCurrency(Number(venta.comision || 0) + Number(venta.iva || 0) + Number(venta.iibb || 0))}
                                                    </div>
                                                  </div>
                                                </div>
                                                {/* Devoluciones relacionadas (si las hay) */}
                                                {venta.devoluciones && venta.devoluciones.length > 0 && (
                                                  <div className="mt-2 text-xs">
                                                    <div className="font-medium text-gray-700">Devoluciones vinculadas:</div>
                                                    <div className="space-y-1 mt-1">
                                                      {venta.devoluciones.map((d: any) => (
                                                        <div key={d.id} className="p-2 rounded bg-yellow-50 border border-yellow-100">
                                                          <div className="font-medium">#{d.id_devolucion} • {d.tipo_resolucion}</div>
                                                          <div className="text-xs text-muted-foreground">Reclamo: {d.fecha_reclamo ? new Date(d.fecha_reclamo).toLocaleDateString() : '-' } • Completada: {d.fecha_completada ? new Date(d.fecha_completada).toLocaleDateString() : '-'}</div>
                                                          <div className="text-xs mt-1">
                                                            {d.monto_reembolsado ? <div>Reembolso: {formatCurrency(d.monto_reembolsado)}</div> : null}
                                                            {d.monto_reembolsado ? (
                                                              <div>Reembolso: {formatCurrency(Number(d.monto_reembolsado || 0))}</div>
                                                            ) : null}
                                                            {d.costo_producto_perdido ? <div className="text-red-600">Producto perdido: {formatCurrency(d.costo_producto_perdido)}</div> : null}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
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









