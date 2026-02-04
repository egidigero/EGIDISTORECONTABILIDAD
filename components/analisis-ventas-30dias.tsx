"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getVentas } from "@/lib/actions/ventas"
import { getGastosIngresos } from "@/lib/actions/gastos-ingresos"
import { getDevoluciones } from "@/lib/actions/devoluciones"
import { calcularEERR } from "@/lib/actions/eerr"

interface AnalisisVentas30DiasProps {
  productos: any[]
}

export function AnalisisVentas30Dias({ productos }: AnalisisVentas30DiasProps) {
  const [eerrData, setEerrData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Calcular EERR de los últimos 30 días
        const fechaHoy = new Date()
        const fecha30DiasAtras = new Date()
        fecha30DiasAtras.setDate(fecha30DiasAtras.getDate() - 30)

        const datos = await calcularEERR(fecha30DiasAtras, fechaHoy, "General")
        setEerrData(datos)
      } catch (error) {
        console.error("Error al cargar datos EERR:", error)
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

  // ========== USAR DATOS DEL EERR DIRECTAMENTE ==========
  if (!eerrData) {
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

  // ========== MOSTRAR TODO EL EERR PARA DEBUG ==========
  console.log('🔍 EERR DATA COMPLETO:', JSON.stringify(eerrData, null, 2))
  
  // Valores del EERR que necesitamos (tomando los campos que coinciden con lo que muestra el EERR)
  const ventasTotales30d = eerrData.ventasTotales || 0
  
  // Del EERR real que me pasaste:
  // Comisiones Netas: -$1,124,926.3 (Base + IVA + IIBB)
  const comisionesNetas30d = (eerrData.comisionesBase || 0) + (eerrData.ivaComisiones || 0) + (eerrData.iibbComisiones || 0)
  
  // Envíos: -$341,637.56
  const enviosTotales30d = eerrData.enviosTotales || 0
  
  // Publicidad: -$3,570,522.65
  const publicidad30d = eerrData.publicidad || 0
  
  // Gastos del Negocio: -$363,878.21 (Total Otros Gastos)
  const gastosNegocio30d = eerrData.otrosGastos || 0
  
  // Devoluciones: -$703,475.73 (Total Pérdida por Devoluciones)
  // Usar devolucionesPerdidaTotal que es el campo correcto
  const devoluciones30d = eerrData.devolucionesPerdidaTotal || 0
  
  console.log('📊 VALORES EXTRAÍDOS DEL EERR:')
  console.log('Ventas:', ventasTotales30d)
  console.log('Comisiones Netas:', comisionesNetas30d, '(base:', eerrData.comisionesBase, 'iva:', eerrData.ivaComisiones, 'iibb:', eerrData.iibbComisiones, ')')
  console.log('Envíos:', enviosTotales30d)
  console.log('Publicidad:', publicidad30d)
  console.log('Gastos Negocio:', gastosNegocio30d)
  console.log('Devoluciones:', devoluciones30d)
  
  // Calcular porcentajes sobre ventas
  const pctComisiones = ventasTotales30d > 0 ? comisionesNetas30d / ventasTotales30d : 0
  const pctEnvio = ventasTotales30d > 0 ? enviosTotales30d / ventasTotales30d : 0
  const pctGastosNegocio = ventasTotales30d > 0 ? gastosNegocio30d / ventasTotales30d : 0
  const pctDevoluciones = ventasTotales30d > 0 ? devoluciones30d / ventasTotales30d : 0
  const pctPublicidad = ventasTotales30d > 0 ? publicidad30d / ventasTotales30d : 0
  
  console.log('📈 PORCENTAJES CALCULADOS:')
  console.log('% Comisiones:', (pctComisiones * 100).toFixed(2))
  console.log('% Envíos:', (pctEnvio * 100).toFixed(2))
  console.log('% Gastos Negocio:', (pctGastosNegocio * 100).toFixed(2))
  console.log('% Devoluciones:', (pctDevoluciones * 100).toFixed(2))
  console.log('% Publicidad:', (pctPublicidad * 100).toFixed(2))

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
  const perdidasDevolucionesFuturo = facturacionFutura * pctDevoluciones
  const publicidadFuturo = facturacionFutura * pctPublicidad

  // Resultado bruto y margen neto proyectado
  const resultadoBrutoFuturo = facturacionFutura - costoProductosFuturo
  const costosOperativosFuturo = comisionesFuturo + enviosFuturo + gastosNegocioFuturo + perdidasDevolucionesFuturo
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
                -${perdidasDevolucionesFuturo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
      </CardContent>
    </Card>
  )
}
