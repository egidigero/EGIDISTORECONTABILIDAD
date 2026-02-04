"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getVentas } from "@/lib/actions/ventas"
import { getGastosIngresos } from "@/lib/actions/gastos-ingresos"
import { getDevoluciones } from "@/lib/actions/devoluciones"

interface AnalisisVentas30DiasProps {
  productos: any[]
}

export function AnalisisVentas30Dias({ productos }: AnalisisVentas30DiasProps) {
  const [ventas, setVentas] = useState<any[]>([])
  const [gastosIngresos, setGastosIngresos] = useState<any[]>([])
  const [devoluciones, setDevoluciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Obtener ventas y gastos/ingresos de los últimos 30 días
        const fecha30DiasAtras = new Date()
        fecha30DiasAtras.setDate(fecha30DiasAtras.getDate() - 30)

        const [todasVentas, todosGastosIngresos, todasDevoluciones] = await Promise.all([
          getVentas({ fechaDesde: fecha30DiasAtras }),
          getGastosIngresos(),
          getDevoluciones()
        ])

        setVentas(todasVentas || [])
        
        // Filtrar gastos/ingresos de los últimos 30 días
        const gastosIngresosFiltrados = (todosGastosIngresos || []).filter((gi: any) => {
          const fechaGI = new Date(gi.fecha)
          return fechaGI >= fecha30DiasAtras
        })
        setGastosIngresos(gastosIngresosFiltrados)
        
        // Filtrar devoluciones de los últimos 30 días
        const devolucionesFiltradas = (todasDevoluciones || []).filter((dev: any) => {
          const fechaDev = new Date(dev.fecha_devolucion)
          return fechaDev >= fecha30DiasAtras
        })
        setDevoluciones(devolucionesFiltradas)
      } catch (error) {
        console.error("Error al cargar datos:", error)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📊 Proyección de Stock Futuro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando datos...</p>
        </CardContent>
      </Card>
    )
  }

  // ========== CÁLCULOS DE LOS ÚLTIMOS 30 DÍAS (para obtener porcentajes) ==========
  const ingresoTotal30Dias = ventas.reduce((sum, v) => sum + Number(v.pvBruto || 0), 0)
  const costoProductos30Dias = ventas.reduce((sum, v) => sum + Number(v.costoProducto || 0), 0)
  const comisiones30Dias = ventas.reduce((sum, v) => {
    const comision = Number(v.comision || 0)
    const iva = Number(v.iva || 0)
    const iibb = Number(v.iibb || 0)
    return sum + comision + iva + iibb
  }, 0)
  const costoEnvio30Dias = ventas.reduce((sum, v) => sum + Number(v.cargoEnvioCosto || 0), 0)

  // Calcular gastos de publicidad de los últimos 30 días
  const gastosPublicidadFiltrados = gastosIngresos.filter((gi: any) => 
    gi.tipo === "Gasto" && (gi.categoria?.toLowerCase().includes("publicidad") || gi.categoria?.toLowerCase().includes("ads") || gi.categoria?.toLowerCase().includes("meta"))
  )
  const gastosPublicidad30Dias = gastosPublicidadFiltrados.reduce((sum, gi) => sum + Number(gi.montoARS || 0), 0)
  
  console.log('🔍 DEBUG Publicidad:')
  console.log('Total gastos publicidad últimos 30 días:', gastosPublicidad30Dias)
  console.log('Cantidad de registros publicidad:', gastosPublicidadFiltrados.length)
  console.log('Categorías encontradas:', gastosPublicidadFiltrados.map(g => g.categoria))

  // Calcular gastos del negocio (excluyendo publicidad) de los últimos 30 días
  const gastosNegocioFiltrados = gastosIngresos.filter((gi: any) => 
    gi.tipo === "Gasto" && !(gi.categoria?.toLowerCase().includes("publicidad") || gi.categoria?.toLowerCase().includes("ads") || gi.categoria?.toLowerCase().includes("meta"))
  )
  const gastosNegocio30Dias = gastosNegocioFiltrados.reduce((sum, gi) => sum + Number(gi.montoARS || 0), 0)
  
  console.log('🔍 DEBUG Gastos Negocio:')
  console.log('Total gastos negocio últimos 30 días:', gastosNegocio30Dias)
  console.log('Cantidad de registros gastos negocio:', gastosNegocioFiltrados.length)

  // Calcular costo de devoluciones de los últimos 30 días
  const costoDevoluciones30Dias = devoluciones.reduce((sum, dev) => {
    const costoTotal = Number(dev.gasto_creado || 0) + Number(dev.costo_perdido || 0)
    return sum + costoTotal
  }, 0)
  
  console.log('🔍 DEBUG Devoluciones:')
  console.log('Total costo devoluciones últimos 30 días:', costoDevoluciones30Dias)
  console.log('Cantidad de devoluciones:', devoluciones.length)

  // Calcular porcentajes sobre ventas de los últimos 30 días
  const pctComisiones = ingresoTotal30Dias > 0 ? (comisiones30Dias / ingresoTotal30Dias) : 0
  const pctEnvio = ingresoTotal30Dias > 0 ? (costoEnvio30Dias / ingresoTotal30Dias) : 0
  const pctGastosNegocio = ingresoTotal30Dias > 0 ? (gastosNegocio30Dias / ingresoTotal30Dias) : 0
  const pctDevoluciones = ingresoTotal30Dias > 0 ? (costoDevoluciones30Dias / ingresoTotal30Dias) : 0
  const pctPublicidad = ingresoTotal30Dias > 0 ? (gastosPublicidad30Dias / ingresoTotal30Dias) : 0
  
  console.log('📊 DEBUG Porcentajes calculados:')
  console.log('Ventas totales 30d:', ingresoTotal30Dias)
  console.log('% Comisiones:', (pctComisiones * 100).toFixed(2) + '%')
  console.log('% Envíos:', (pctEnvio * 100).toFixed(2) + '%')
  console.log('% Gastos Negocio:', (pctGastosNegocio * 100).toFixed(2) + '%')
  console.log('% Devoluciones:', (pctDevoluciones * 100).toFixed(2) + '%')
  console.log('% Publicidad:', (pctPublicidad * 100).toFixed(2) + '%')

  // ========== PROYECCIÓN FUTURA (si vendemos todo el stock) ==========
  // Facturación futura = PV × Stock de cada producto
  const facturacionFutura = productos.reduce((total, p) => {
    const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    const precioVenta = Number(p.precio_venta || 0)
    return total + (stockTotal * precioVenta)
  }, 0)

  // Costo de productos (ya lo tenemos, es el patrimonio en stock)
  const costoProductosFuturo = productos.reduce((total, p) => {
    const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    const costoUnitario = Number(p.costoUnitarioARS || 0)
    return total + (stockTotal * costoUnitario)
  }, 0)

  // Aplicar porcentajes de los últimos 30 días a la facturación futura
  const comisionesFuturo = facturacionFutura * pctComisiones
  const enviosFuturo = facturacionFutura * pctEnvio
  const gastosNegocioFuturo = facturacionFutura * pctGastosNegocio
  const devolucionesFuturo = facturacionFutura * pctDevoluciones
  const publicidadFuturo = facturacionFutura * pctPublicidad

  // Resultado bruto y margen neto proyectado
  const resultadoBrutoFuturo = facturacionFutura - costoProductosFuturo
  const costosOperativosFuturo = comisionesFuturo + enviosFuturo + gastosNegocioFuturo + devolucionesFuturo
  const margenOperativoFuturo = resultadoBrutoFuturo - costosOperativosFuturo
  const margenNetoFuturo = margenOperativoFuturo - publicidadFuturo

  const margenNetoPorcentaje = facturacionFutura > 0 ? (margenNetoFuturo / facturacionFutura) * 100 : 0

  // Unidades totales en stock
  const unidadesTotales = productos.reduce((total, p) => {
    const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    return total + stockTotal
  }, 0)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>🚀 Proyección de Facturación Futura</CardTitle>
        <CardDescription>
          Si vendieras todo el stock actual ({unidadesTotales} unidades) - Cálculo basado en datos de últimos 30 días
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Facturación proyectada */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 text-indigo-800">💰 Facturación Proyectada</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-indigo-600">Ventas Netas Proyectadas</p>
              <p className="text-3xl font-bold text-indigo-700">
                ${facturacionFutura.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-indigo-500">{unidadesTotales} unidades × PV</p>
            </div>
            <div>
              <p className="text-sm text-indigo-600">Costo Productos</p>
              <p className="text-3xl font-bold text-orange-600">
                -${costoProductosFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-orange-500">Ya invertido en stock</p>
            </div>
          </div>
        </div>

        {/* Mini EERR Proyectado */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-3 border-b">
            <h4 className="font-semibold text-gray-800">📊 Estado de Resultados Proyectado</h4>
            <p className="text-xs text-gray-600">Basado en porcentajes de los últimos 30 días</p>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Ventas Netas */}
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-medium">Ventas Netas</span>
              <span className="text-lg font-bold text-blue-600">
                ${facturacionFutura.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Costo de Productos */}
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Costo de Productos</span>
              <span className="text-red-600">
                -${costoProductosFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Resultado Bruto */}
            <div className="flex justify-between items-center pl-4 pb-2 border-b font-medium bg-green-50 p-2 rounded">
              <span>Resultado Bruto</span>
              <span className="text-green-600">
                ${resultadoBrutoFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Costos Plataforma */}
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Comisiones ({(pctComisiones * 100).toFixed(1)}%)</span>
              <span className="text-red-600">
                -${comisionesFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Envíos ({(pctEnvio * 100).toFixed(1)}%)</span>
              <span className="text-red-600">
                -${enviosFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Gastos del Negocio ({(pctGastosNegocio * 100).toFixed(1)}%)</span>
              <span className="text-red-600">
                -${gastosNegocioFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Devoluciones ({(pctDevoluciones * 100).toFixed(1)}%)</span>
              <span className="text-red-600">
                -${devolucionesFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Margen Operativo */}
            <div className="flex justify-between items-center pl-4 pb-2 border-b font-medium bg-purple-50 p-2 rounded">
              <span>Margen Operativo</span>
              <span className="text-purple-600">
                ${margenOperativoFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Gastos */}
            <div className="flex justify-between items-center pl-4">
              <span className="text-gray-600">Publicidad ({(pctPublicidad * 100).toFixed(1)}%)</span>
              <span className="text-red-600">
                -${publicidadFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Margen Neto */}
            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
              <span className="text-lg font-bold">Margen Neto Proyectado</span>
              <div className="text-right">
                <div className={`text-2xl font-bold ${margenNetoFuturo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${margenNetoFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className={`text-sm ${margenNetoPorcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margenNetoPorcentaje.toFixed(1)}% sobre ventas
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen por modelo (top 5) */}
        {productos.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">📦 Top 5 Modelos por Valor de Stock</h4>
            <div className="space-y-2">
              {productos
                .map((p) => ({
                  ...p,
                  stockTotal: Number(p.stockPropio || 0) + Number(p.stockFull || 0),
                  valorStock: (Number(p.stockPropio || 0) + Number(p.stockFull || 0)) * Number(p.precio_venta || 0),
                }))
                .sort((a, b) => b.valorStock - a.valorStock)
                .slice(0, 5)
                .map((producto, index) => (
                  <div
                    key={producto.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{producto.modelo}</p>
                        <p className="text-xs text-muted-foreground">
                          {producto.stockTotal} unidades × ${Number(producto.precio_venta || 0).toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Facturación</p>
                      <p className="font-bold text-blue-600">
                        ${producto.valorStock.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Indicadores clave */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">💡 Indicadores Clave</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>
              🎯 <strong>ROI sobre Stock:</strong>{" "}
              {costoProductosFuturo > 0
                ? ((margenNetoFuturo / costoProductosFuturo) * 100).toFixed(1)
                : 0}%
            </li>
            <li>
              💵 <strong>Ganancia por Unidad:</strong> $
              {unidadesTotales > 0
                ? (margenNetoFuturo / unidadesTotales).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                : 0}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
