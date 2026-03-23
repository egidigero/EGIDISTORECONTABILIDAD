"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  TrendingDown,
  Package,
  DollarSign,
  AlertCircle,
  RotateCcw,
  Truck,
  ShoppingCart,
  Calendar
} from "lucide-react"
import {
  calcularPerdidaTotalAjustada,
  costoEnvioDevolucionPerdido,
  costoEnvioNuevoPerdido,
  costoEnvioOriginalPerdido,
} from "@/lib/devoluciones-loss"

interface DevolucionesReporteProps {
  estadisticas: {
    modoFecha?: "reclamo" | "compra"
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

type DevolucionCasoDetalle = {
  id: string
  fechaReclamo: string | null
  fechaCompra: string | null
  comprador: string
  estado: string
  tipoResolucion: string | null
  resultadoPrueba: string | null
  productoRecuperable: boolean
  perdidaTotal: number
  detalle: string | null
  ventaReferencia: string | null
}

type MotivoDetalle = {
  cantidad: number
  recuperables: number
  noRecuperables: number
  perdidaTotal: number
  casos: DevolucionCasoDetalle[]
}

const getAlias = (row: any, keys: string[], fallback: any = null) => {
  for (const key of keys) {
    if (row == null) break
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value
    }
  }

  return fallback
}

const formatCurrency = (value: number) =>
  `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

const formatDate = (value: unknown) => {
  if (!value) return "Sin fecha"

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number)
    return `${day}/${month}/${year}`
  }

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return "Sin fecha"
  return parsed.toLocaleDateString("es-AR", { timeZone: "UTC" })
}

const parseDateValue = (value: unknown) => {
  if (!value) return 0

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T00:00:00Z`).getTime()
  }

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const buildDetalleCaso = (
  dev: any,
  perdidaTotal: number,
  productoRecuperable: boolean
): DevolucionCasoDetalle => {
  const observaciones = getAlias(dev, ["observaciones", "observacion", "notes"], null)
  const observacionesPrueba = getAlias(dev, ["observaciones_prueba", "observacionesPrueba"], null)
  const detalle = [observaciones, observacionesPrueba].filter(Boolean).join(" | ") || null

  return {
    id: String(getAlias(dev, ["id_devolucion", "numeroDevolucion", "idDevolucion", "id"], "Sin ID")),
    fechaReclamo: getAlias(dev, ["fecha_reclamo", "fechaReclamo"], null),
    fechaCompra: getAlias(dev, ["fecha_compra", "fechaCompra"], null),
    comprador: getAlias(
      dev,
      ["comprador", "buyer_name", "nombre_contacto", "nombreContacto", "displayName", "cliente", "buyer"],
      "Sin comprador"
    ),
    estado: getAlias(dev, ["estado", "status"], "Sin estado"),
    tipoResolucion: getAlias(dev, ["tipo_resolucion", "tipoResolucion"], null),
    resultadoPrueba: getAlias(dev, ["resultado_prueba", "resultadoPrueba"], null),
    productoRecuperable,
    perdidaTotal,
    detalle,
    ventaReferencia: getAlias(dev, ["saleCode", "externalOrderId", "external_order_id", "venta_id", "ventaId"], null),
  }
}

export function DevolucionesReporte({ estadisticas }: DevolucionesReporteProps) {
  const modoFecha = estadisticas.modoFecha === "compra" ? "compra" : "reclamo"
  const esVistaCompra = modoFecha === "compra"
  const etiquetaFecha = esVistaCompra ? "compra" : "reclamo"
  const badgeVista = esVistaCompra ? "Cohorte por compra" : "Operativa por reclamo"
  const descripcionVista = esVistaCompra
    ? "Estas metricas muestran devoluciones asociadas a compras del periodo seleccionado y permiten compararlas contra ventas del mismo periodo."
    : "Estas metricas muestran el flujo operativo segun cuando entra el reclamo. El impacto contable sigue esta misma fecha."
  // Calcular métricas adicionales
  const totalEntregadas = Object.entries(estadisticas.porEstado)
    .filter(([estado]) => estado.startsWith("Entregada"))
    .reduce((sum, [, count]) => sum + count, 0)

  const mostrarMetricasSobreVentas =
    esVistaCompra && typeof estadisticas.totalVentas === "number" && estadisticas.totalVentas > 0
  const porcentajeSobreVentas = mostrarMetricasSobreVentas
    ? (estadisticas.total / Number(estadisticas.totalVentas || 0)) * 100
    : 0
  const ventasSinDevolucion = mostrarMetricasSobreVentas
    ? Math.max(Number(estadisticas.totalVentas || 0) - estadisticas.total, 0)
    : 0

  // Calcular reembolsos reales (solo reembolsos completados)
  const devolucionesReembolso = estadisticas.data.filter(d => d.tipo_resolucion === 'Reembolso')
  const montoTotalReembolsos = devolucionesReembolso.reduce((sum, d) => {
    return sum + Number(d.monto_reembolsado ?? 0)
  }, 0)
  const totalReembolsos = devolucionesReembolso.length
  const totalCambios = (estadisticas.porEstado["Entregada - Cambio mismo producto"] || 0) +
                       (estadisticas.porEstado["Entregada - Cambio otro producto"] || 0)

  const promedioPerdidasPorDevolucion = estadisticas.total > 0 
    ? estadisticas.perdidaTotal / estadisticas.total 
    : 0

  // Calcular detalle de pérdidas por tipo (usar MISMA lógica que columna generada en DB)
  const detallePerdidas = estadisticas.data.reduce((acc, dev) => {
    const esRecuperable = dev.producto_recuperable === true
    
    // Ajuste negocio: en Sin reembolso y ML sin reclamo, envío original no se pierde.
    acc.envioOriginal += costoEnvioOriginalPerdido(dev)
    
    // Envío de devolución (vuelta): siempre es pérdida
    acc.envioDevolucion += costoEnvioDevolucionPerdido(dev)
    
    // Envío nuevo (ida del cambio): siempre es pérdida
    acc.envioNuevo += costoEnvioNuevoPerdido(dev)
    
    // Productos perdidos: depende si es recuperable
    if (esRecuperable) {
      // Si es recuperable, solo se pierde el producto nuevo (si hay)
      acc.productos += Number(dev.costo_producto_nuevo ?? 0)
    } else {
      // Si NO es recuperable, se pierden ambos (original + nuevo)
      acc.productos += Number(dev.costo_producto_original ?? 0)
      acc.productos += Number(dev.costo_producto_nuevo ?? 0)
    }
    
    // Reembolsos
    acc.reembolsos += Number(dev.monto_reembolsado ?? 0)
    
    return acc
  }, {
    envioOriginal: 0,
    envioDevolucion: 0,
    envioNuevo: 0,
    productos: 0,
    reembolsos: 0
  })

  // Calcular pérdida total (la DB ya tiene la lógica de no incluir envío original en cambios)
  const perdidaTotalAjustada = estadisticas.data.reduce((sum, dev) => {
    return sum + calcularPerdidaTotalAjustada(dev)
  }, 0)

  // Agrupar por motivo
  const porMotivo = estadisticas.data.reduce((acc: Record<string, number>, dev: any) => {
    const motivo = dev.motivo || "sin especificar"
    acc[motivo] = (acc[motivo] || 0) + 1
    return acc
  }, {})

  const motivosMasComunes = Object.entries(porMotivo)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)

  // NUEVO: Análisis por producto con detalle de pérdidas
  const porProducto = estadisticas.data.reduce((acc: Record<string, any>, dev: any) => {
    const producto = dev.producto_modelo || dev.productoModelo || 'Sin producto'
    if (!acc[producto]) {
      acc[producto] = {
        cantidad: 0,
        perdidaTotal: 0,
        motivos: {} as Record<string, number>,
        recuperables: 0,
        noRecuperables: 0,
        // Detalle de pérdidas por tipo
        perdidaEnvioOriginal: 0,
        perdidaEnvioDevolucion: 0,
        perdidaEnvioNuevo: 0,
        perdidaProductos: 0,
        perdidaReembolsos: 0,
        motivosDetalle: {} as Record<string, MotivoDetalle>
      }
    }
    acc[producto].cantidad++
    
    // Pérdida ajustada a reglas de negocio.
    const perdidaTotal = calcularPerdidaTotalAjustada(dev)
    acc[producto].perdidaTotal += perdidaTotal
    
    const esRecuperable = dev.producto_recuperable === true
    
    const motivo = dev.motivo || 'Sin especificar'
    acc[producto].motivos[motivo] = (acc[producto].motivos[motivo] || 0) + 1
    if (!acc[producto].motivosDetalle[motivo]) {
      acc[producto].motivosDetalle[motivo] = {
        cantidad: 0,
        recuperables: 0,
        noRecuperables: 0,
        perdidaTotal: 0,
        casos: []
      }
    }
    
    if (esRecuperable) {
      acc[producto].recuperables++
      acc[producto].motivosDetalle[motivo].recuperables++
    } else {
      acc[producto].noRecuperables++
      acc[producto].motivosDetalle[motivo].noRecuperables++
    }

    acc[producto].motivosDetalle[motivo].cantidad++
    acc[producto].motivosDetalle[motivo].perdidaTotal += perdidaTotal
    acc[producto].motivosDetalle[motivo].casos.push(
      buildDetalleCaso(dev, perdidaTotal, esRecuperable)
    )
    
    // Calcular detalle de pérdidas (mismo criterio ajustado).
    acc[producto].perdidaEnvioOriginal += costoEnvioOriginalPerdido(dev)
    acc[producto].perdidaEnvioDevolucion += costoEnvioDevolucionPerdido(dev)
    acc[producto].perdidaEnvioNuevo += costoEnvioNuevoPerdido(dev)
    
    // Productos: si es recuperable, solo el nuevo; si no, ambos
    if (esRecuperable) {
      acc[producto].perdidaProductos += Number(dev.costo_producto_nuevo ?? 0)
    } else {
      acc[producto].perdidaProductos += Number(dev.costo_producto_original ?? 0)
      acc[producto].perdidaProductos += Number(dev.costo_producto_nuevo ?? 0)
    }
    
    acc[producto].perdidaReembolsos += Number(dev.monto_reembolsado ?? 0)
    
    return acc
  }, {})

  const productosConDevoluciones = Object.entries(porProducto)
    .map(([producto, data]: [string, any]) => ({
      producto,
      cantidad: data.cantidad,
      perdidaTotal: data.perdidaTotal,
      motivos: data.motivos,
      motivoPrincipal: Object.entries(data.motivos)
        .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)[0]?.[0] || 'N/A',
      recuperables: data.recuperables,
      noRecuperables: data.noRecuperables,
      tasaNoRecuperable: data.cantidad > 0 ? (data.noRecuperables / data.cantidad) * 100 : 0,
      // Detalle de pérdidas
      perdidaEnvioOriginal: data.perdidaEnvioOriginal,
      perdidaEnvioDevolucion: data.perdidaEnvioDevolucion,
      perdidaEnvioNuevo: data.perdidaEnvioNuevo,
      perdidaProductos: data.perdidaProductos,
      perdidaReembolsos: data.perdidaReembolsos,
      motivosDetalle: Object.entries(data.motivosDetalle)
        .map(([motivo, detalle]: [string, any]) => ({
          motivo,
          cantidad: detalle.cantidad,
          recuperables: detalle.recuperables,
          noRecuperables: detalle.noRecuperables,
          perdidaTotal: detalle.perdidaTotal,
          casos: [...detalle.casos].sort((a: DevolucionCasoDetalle, b: DevolucionCasoDetalle) => {
            const fechaA = esVistaCompra ? a.fechaCompra : a.fechaReclamo
            const fechaB = esVistaCompra ? b.fechaCompra : b.fechaReclamo
            const diffFecha = parseDateValue(fechaB) - parseDateValue(fechaA)
            if (diffFecha !== 0) return diffFecha
            return b.perdidaTotal - a.perdidaTotal
          })
        }))
        .sort((a, b) => {
          if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad
          return b.perdidaTotal - a.perdidaTotal
        })
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Vista temporal</span>
            <Badge variant={esVistaCompra ? "default" : "secondary"}>{badgeVista}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{descripcionVista}</p>
        </div>
      </div>

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
              {mostrarMetricasSobreVentas && (
                <span className="ml-2">· {porcentajeSobreVentas.toFixed(1)}% ventas del periodo</span>
              )}
              {!mostrarMetricasSobreVentas && (
                <span className="ml-2">· vista por {etiquetaFecha}</span>
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
              ${perdidaTotalAjustada.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio: ${(estadisticas.total > 0 ? perdidaTotalAjustada / estadisticas.total : 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              <span className="ml-2">· {esVistaCompra ? "compras del periodo" : "reclamos del periodo"}</span>
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

      {/* Detalle de pérdidas por tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Detalle de Pérdidas por Tipo
          </CardTitle>
          <CardDescription>
            Desglose de costos y pérdidas del sistema de devoluciones para la vista por {etiquetaFecha}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estadisticas.data.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Costos de Envío</div>
                  <div className="space-y-2 pl-3 border-l-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Envío original (perdido):</span>
                      <span className="font-medium text-destructive">
                        ${detallePerdidas.envioOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Envío de devolución:</span>
                      <span className="font-medium text-destructive">
                        ${detallePerdidas.envioDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Envío nuevo (cambios):</span>
                      <span className="font-medium text-destructive">
                        ${detallePerdidas.envioNuevo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Otros Costos</div>
                  <div className="space-y-2 pl-3 border-l-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Productos perdidos:</span>
                      <span className="font-medium text-destructive">
                        ${detallePerdidas.productos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reembolsos pagados:</span>
                      <span className="font-medium text-destructive">
                        ${detallePerdidas.reembolsos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-base font-semibold">
                  <span>Pérdida Total:</span>
                  <span className="text-destructive">
                    ${perdidaTotalAjustada.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {mostrarMetricasSobreVentas ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Costo de incidencia por venta: {ventasSinDevolucion > 0
                      ? `$${(perdidaTotalAjustada / ventasSinDevolucion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      : 'No aplica'} (sobre ventas del periodo sin devolucion)
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    En vista por reclamo no se compara contra ventas del periodo, porque la base temporal es operativa y no de compra.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay datos de pérdidas disponibles
            </p>
          )}
        </CardContent>
      </Card>

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

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
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

                    <div className="border-t pt-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Detalle de Pérdidas:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {prod.perdidaEnvioOriginal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío original:</span>
                            <span className="text-destructive font-medium">
                              ${prod.perdidaEnvioOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {prod.perdidaEnvioDevolucion > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío devolución:</span>
                            <span className="text-destructive font-medium">
                              ${prod.perdidaEnvioDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {prod.perdidaEnvioNuevo > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío nuevo:</span>
                            <span className="text-destructive font-medium">
                              ${prod.perdidaEnvioNuevo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {prod.perdidaProductos > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Productos:</span>
                            <span className="text-destructive font-medium">
                              ${prod.perdidaProductos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {prod.perdidaReembolsos > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reembolsos:</span>
                            <span className="text-destructive font-medium">
                              ${prod.perdidaReembolsos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-destructive">
                          ${prod.perdidaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Problema principal:</div>
                        <div className="font-medium">{prod.motivoPrincipal}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {prod.motivosDetalle.length} {prod.motivosDetalle.length === 1 ? 'motivo' : 'motivos'}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {prod.motivosDetalle.slice(0, 4).map((motivoDetalle: any) => (
                        <Badge key={motivoDetalle.motivo} variant="outline" className="text-xs">
                          {motivoDetalle.motivo}: {motivoDetalle.cantidad}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-4 border-t pt-3">
                      <div className="text-xs text-muted-foreground mb-2">Detalle de casos por motivo:</div>
                      <Accordion type="multiple" className="space-y-2">
                        {prod.motivosDetalle.map((motivoDetalle: any, index: number) => (
                          <AccordionItem
                            key={`${prod.producto}-${motivoDetalle.motivo}`}
                            value={`${prod.producto}-${index}`}
                            className="border rounded-md bg-background px-3"
                          >
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex flex-1 items-start justify-between gap-3 pr-3 text-left">
                                <div className="min-w-0">
                                  <div className="font-medium">{motivoDetalle.motivo}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {motivoDetalle.cantidad} {motivoDetalle.cantidad === 1 ? 'devolucion' : 'devoluciones'}
                                    {' - '}
                                    {motivoDetalle.recuperables} recuperables
                                    {' - '}
                                    {motivoDetalle.noRecuperables} no recuperables
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  {motivoDetalle.motivo === prod.motivoPrincipal && (
                                    <Badge variant="secondary" className="mb-1 text-xs">
                                      Principal
                                    </Badge>
                                  )}
                                  <div className="text-xs text-muted-foreground">Perdida</div>
                                  <div className="font-semibold text-destructive">
                                    {formatCurrency(motivoDetalle.perdidaTotal)}
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-3">
                              <div className="space-y-2">
                                {motivoDetalle.casos.map((caso: DevolucionCasoDetalle, casoIndex: number) => (
                                  <div
                                    key={`${caso.id}-${casoIndex}`}
                                    className="rounded-md border bg-muted/30 p-3"
                                  >
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                      <div>
                                        <div className="font-medium text-sm">{caso.comprador}</div>
                                        <div className="text-xs text-muted-foreground break-words">
                                          {caso.id}
                                          {caso.ventaReferencia ? ` - Venta ${caso.ventaReferencia}` : ''}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {esVistaCompra ? "Compra" : "Reclamo"}: {formatDate(esVistaCompra ? caso.fechaCompra : caso.fechaReclamo)}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        <Badge variant="outline" className="text-xs">
                                          {caso.estado}
                                        </Badge>
                                        {caso.tipoResolucion && (
                                          <Badge variant="outline" className="text-xs">
                                            {caso.tipoResolucion}
                                          </Badge>
                                        )}
                                        <Badge
                                          variant={caso.productoRecuperable ? "secondary" : "destructive"}
                                          className="text-xs"
                                        >
                                          {caso.productoRecuperable ? 'Recuperable' : 'No recuperable'}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-3">
                                      <div>
                                        <span className="text-muted-foreground block">Perdida</span>
                                        <span className="font-semibold text-destructive">
                                          {formatCurrency(caso.perdidaTotal)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground block">Resultado prueba</span>
                                        <span className="break-words">{caso.resultadoPrueba || 'Sin prueba cargada'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground block">Detalle cargado</span>
                                        <span className="break-words">{caso.detalle || 'Sin detalle cargado'}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
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
                  const porcentaje = perdidaTotalAjustada > 0 
                    ? (prod.perdidaTotal / perdidaTotalAjustada) * 100 
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
