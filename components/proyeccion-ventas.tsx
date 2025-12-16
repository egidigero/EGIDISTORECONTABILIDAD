"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProyeccionVentasProps {
  producto: {
    id: string
    modelo: string
    sku: string
    costoUnitarioARS: number
    precio_venta: number
    stockPropio: number
  }
}

export function ProyeccionVentas({ producto }: ProyeccionVentasProps) {
  const [cantidadProyectada, setCantidadProyectada] = useState(10)
  const [precioVentaProyectado, setPrecioVentaProyectado] = useState(producto.precio_venta || 0)

  // Calcular margen neto por unidad
  const costoUnitario = Number(producto.costoUnitarioARS || 0)
  const precioVenta = Number(precioVentaProyectado || 0)
  const margenNetoPorUnidad = precioVenta - costoUnitario
  const margenNetoPorcentaje = precioVenta > 0 ? ((margenNetoPorUnidad / precioVenta) * 100) : 0

  // Proyecciones
  const ingresoTotalProyectado = precioVenta * cantidadProyectada
  const costoTotalProyectado = costoUnitario * cantidadProyectada
  const gananciaTotalProyectada = margenNetoPorUnidad * cantidadProyectada

  // Escenarios
  const escenarios = [
    { nombre: "Conservador (50% del stock)", cantidad: Math.floor(producto.stockPropio * 0.5) },
    { nombre: "Moderado (75% del stock)", cantidad: Math.floor(producto.stockPropio * 0.75) },
    { nombre: "Optimista (100% del stock)", cantidad: producto.stockPropio },
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>📊 Proyección de Ventas</CardTitle>
        <CardDescription>
          Análisis de ganancias potenciales para <strong>{producto.modelo}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs de proyección */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cantidad">Cantidad a vender</Label>
            <Input
              id="cantidad"
              type="number"
              value={cantidadProyectada}
              onChange={(e) => setCantidadProyectada(Number(e.target.value))}
              min={1}
              max={producto.stockPropio}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Stock disponible: {producto.stockPropio} unidades
            </p>
          </div>
          <div>
            <Label htmlFor="precioVenta">Precio de venta proyectado</Label>
            <Input
              id="precioVenta"
              type="number"
              value={precioVentaProyectado}
              onChange={(e) => setPrecioVentaProyectado(Number(e.target.value))}
              min={0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Precio actual: ${producto.precio_venta?.toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        {/* Análisis de margen */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3">💰 Análisis de Margen</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Margen Neto/Unidad</p>
              <p className={`text-lg font-bold ${margenNetoPorUnidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${margenNetoPorUnidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Margen %</p>
              <p className={`text-lg font-bold ${margenNetoPorcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margenNetoPorcentaje.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Costo/Unidad</p>
              <p className="text-lg font-bold text-gray-700">
                ${costoUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Proyección personalizada */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3">🎯 Proyección Personalizada</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ingreso Total</p>
              <p className="text-xl font-bold text-blue-600">
                ${ingresoTotalProyectado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Costo Total</p>
              <p className="text-xl font-bold text-orange-600">
                ${costoTotalProyectado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ganancia Neta</p>
              <p className={`text-xl font-bold ${gananciaTotalProyectada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${gananciaTotalProyectada.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Escenarios */}
        <div>
          <h4 className="font-semibold mb-3">📈 Escenarios de Venta</h4>
          <div className="space-y-3">
            {escenarios.map((escenario) => {
              const ingresoEscenario = precioVenta * escenario.cantidad
              const costoEscenario = costoUnitario * escenario.cantidad
              const gananciaEscenario = margenNetoPorUnidad * escenario.cantidad

              return (
                <div
                  key={escenario.nombre}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{escenario.nombre}</span>
                    <span className="text-sm text-muted-foreground">
                      {escenario.cantidad} unidades
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Ingreso</p>
                      <p className="font-semibold text-blue-600">
                        ${ingresoEscenario.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Costo</p>
                      <p className="font-semibold text-orange-600">
                        ${costoEscenario.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ganancia</p>
                      <p className={`font-semibold ${gananciaEscenario >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${gananciaEscenario.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">💡 Recomendaciones</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {margenNetoPorcentaje < 20 && (
              <li>⚠️ El margen es bajo ({margenNetoPorcentaje.toFixed(1)}%). Considerá aumentar el precio de venta.</li>
            )}
            {margenNetoPorcentaje >= 20 && margenNetoPorcentaje < 40 && (
              <li>✅ Margen saludable ({margenNetoPorcentaje.toFixed(1)}%). Buen equilibrio precio-ganancia.</li>
            )}
            {margenNetoPorcentaje >= 40 && (
              <li>🚀 Excelente margen ({margenNetoPorcentaje.toFixed(1)}%). Alta rentabilidad por venta.</li>
            )}
            {producto.stockPropio < 5 && (
              <li>📦 Stock bajo ({producto.stockPropio} unidades). Considerá reponer inventario.</li>
            )}
            {gananciaTotalProyectada > 100000 && (
              <li>💰 Potencial de ganancia alto (${gananciaTotalProyectada.toLocaleString('es-AR', { minimumFractionDigits: 0 })}). ¡Producto estratégico!</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
