"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calculator, DollarSign } from "lucide-react"
import { getTarifa } from "@/lib/calculos"
import type { Plataforma, MetodoPago, Condicion } from "@/lib/types"

interface CalculadoraCostosProps {
  costoProducto: number
  precioVentaInicial?: number
  onPrecioCalculado?: (precio: number) => void
  trigger?: React.ReactNode
}

interface CalculoDetallado {
  precioVenta: number
  costoProducto: number
  margenBruto: number
  comision: number
  comisionSinIva?: number
  iibb: number
  iva: number
  envio: number
  publicidad: number
  margenNeto: number
  rentabilidadPorcentaje: number
}

export function CalculadoraCostos({ 
  costoProducto, 
  precioVentaInicial = 0, 
  onPrecioCalculado,
  trigger 
}: CalculadoraCostosProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [precioVenta, setPrecioVenta] = useState(precioVentaInicial)
  const [plataforma, setPlataforma] = useState<Plataforma>("TN")
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("PagoNube")
  const [condicion, setCondicion] = useState<Condicion>("Transferencia")
  const [envio, setEnvio] = useState(0)
  const [roas, setRoas] = useState(3) // Return on Ad Spend por defecto
  const [calculo, setCalculo] = useState<CalculoDetallado | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const calcularCostos = async () => {
    if (precioVenta <= 0) return

    setIsCalculating(true)
    try {
      // Obtener tarifa
      const tarifa = await getTarifa(plataforma, metodoPago, condicion)
      if (!tarifa) {
        console.error("No se encontró tarifa para la combinación seleccionada")
        return
      }

      // Aplicar descuento pre-comisión si existe (ej: 15% para TN + Transferencia)
      const precioConDescuento = precioVenta * (1 - (tarifa.descuentoPct || 0))
      
      // Calcular comisiones
      const comisionBase = precioConDescuento * tarifa.comisionPct + tarifa.fijoPorOperacion
      const comisionExtra = precioConDescuento * (tarifa.comisionExtraPct || 0)
      const comisionTotal = comisionBase + comisionExtra

      // Calcular IVA e IIBB según plataforma
      let iva = 0
      let iibb = 0
      let comisionSinIva = comisionTotal

      if (plataforma === "TN") {
        // TN: IVA e IIBB se agregan sobre las comisiones
        iva = comisionTotal * 0.21 // 21% IVA sobre comisiones
        iibb = comisionTotal * 0.03 // 3% IIBB sobre comisiones
      } else if (plataforma === "ML") {
        // ML: IVA está incluido en la comisión, necesitamos desglosarlo
        comisionSinIva = comisionTotal / 1.21 // Comisión sin IVA
        iva = comisionTotal - comisionSinIva // IVA incluido
        iibb = 0 // ML no tiene IIBB separado
      }

      // Costo de publicidad basado en ROAS
      const publicidad = roas > 0 ? precioVenta / roas : 0
      
      const margenBruto = precioVenta - costoProducto
      const totalCostos = comisionTotal + iva + iibb + envio + publicidad
      const margenNeto = margenBruto - totalCostos
      const rentabilidadPorcentaje = costoProducto > 0 ? (margenNeto / costoProducto) * 100 : 0

      setCalculo({
        precioVenta,
        costoProducto,
        margenBruto,
        comision: comisionTotal,
        ...(plataforma === 'ML' && {
          comisionSinIva: comisionSinIva
        }),
        iibb,
        iva,
        envio,
        publicidad,
        margenNeto,
        rentabilidadPorcentaje
      })
    } catch (error) {
      console.error("Error al calcular costos:", error)
    } finally {
      setIsCalculating(false)
    }
  }

  useEffect(() => {
    if (precioVenta > 0) {
      calcularCostos()
    }
  }, [precioVenta, plataforma, metodoPago, condicion, envio, roas])

  useEffect(() => {
    setPrecioVenta(precioVentaInicial)
  }, [precioVentaInicial])

  const handleAplicarPrecio = () => {
    if (onPrecioCalculado && precioVenta > 0) {
      onPrecioCalculado(precioVenta)
      setIsOpen(false)
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Calculator className="w-4 h-4 mr-2" />
      Calculadora
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculadora de Costos y Precios
          </DialogTitle>
          <DialogDescription>
            Calcula el precio óptimo considerando costos, comisiones y márgenes deseados
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de Inputs */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parámetros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio de Venta</Label>
                    <Input
                      type="number"
                      value={precioVenta}
                      onChange={(e) => setPrecioVenta(Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo Producto</Label>
                    <Input
                      type="number"
                      value={costoProducto}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={plataforma} onValueChange={(value) => setPlataforma(value as Plataforma)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TN">Tienda Nube</SelectItem>
                      <SelectItem value="ML">Mercado Libre</SelectItem>
                      <SelectItem value="Directo">Venta Directa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Método de Pago</Label>
                    <Select value={metodoPago} onValueChange={(value) => setMetodoPago(value as MetodoPago)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PagoNube">Pago Nube</SelectItem>
                        <SelectItem value="MercadoPago">Mercado Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Condición</Label>
                    <Select value={condicion} onValueChange={(value) => setCondicion(value as Condicion)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Cuotas sin interés">Cuotas sin interés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Costo Envío</Label>
                    <Input
                      type="number"
                      value={envio}
                      onChange={(e) => setEnvio(Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ROAS Deseado</Label>
                    <Input
                      type="number"
                      value={roas}
                      onChange={(e) => setRoas(Number(e.target.value))}
                      placeholder="3.0"
                      step="0.1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel de Resultados */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Análisis de Rentabilidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {calculo ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Precio de Venta:</span>
                      <span className="font-bold text-green-600">${calculo.precioVenta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm">- Costo Producto:</span>
                      <span className="text-red-600">-${calculo.costoProducto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t">
                      <span className="text-sm font-medium">= Margen Bruto:</span>
                      <span className="font-medium">${calculo.margenBruto.toFixed(2)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">- Comisión:</span>
                        <span className="text-red-600">-${calculo.comision.toFixed(2)}</span>
                      </div>
                      {plataforma === "ML" && calculo.comisionSinIva && (
                        <>
                          <div className="flex justify-between items-center py-1 ml-4">
                            <span className="text-xs text-blue-600">• Sin IVA:</span>
                            <span className="text-xs text-blue-600">-${calculo.comisionSinIva.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 ml-4">
                            <span className="text-xs text-blue-600">• IVA incluido:</span>
                            <span className="text-xs text-blue-600">-${(calculo.comision - calculo.comisionSinIva).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm">- IVA:</span>
                      <span className="text-red-600">-${calculo.iva.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm">- IIBB:</span>
                      <span className="text-red-600">-${calculo.iibb.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm">- Envío:</span>
                      <span className="text-red-600">-${calculo.envio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm">- Publicidad (ROAS {roas}):</span>
                      <span className="text-red-600">-${calculo.publicidad.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-double">
                      <span className="font-bold">= Margen Neto:</span>
                      <span className={`font-bold text-lg ${calculo.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${calculo.margenNeto.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 bg-gray-50 rounded px-2">
                      <span className="font-medium">Rentabilidad:</span>
                      <span className={`font-bold ${calculo.rentabilidadPorcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {calculo.rentabilidadPorcentaje.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Ingresa un precio de venta para ver el análisis
                  </div>
                )}
              </CardContent>
            </Card>

            {onPrecioCalculado && (
              <Button 
                onClick={handleAplicarPrecio} 
                className="w-full"
                disabled={!calculo || precioVenta <= 0}
              >
                Aplicar Precio Calculado
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
