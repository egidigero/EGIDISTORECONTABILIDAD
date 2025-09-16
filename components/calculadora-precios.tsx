"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calculator, TrendingUp, BarChart3, List } from "lucide-react"
import { getTarifaEspecifica } from "@/lib/actions/tarifas"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, LineChart, Line, ReferenceLine } from "recharts"

interface CalculadoraPreciosProps {
  costoProducto: number
  precioVentaInicial?: number
  onPrecioCalculado?: (precio: number) => void
  trigger: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ParametrosCalculo {
  plataforma: "TN" | "ML"
  metodoPago: "PagoNube" | "MercadoPago"
  condicion: "Transferencia" | "Cuotas sin interés"
  precioVenta: number
  costoEnvio: number
  roas: number
  iibbManual?: number // IIBB individual opcional
  usarComisionManual: boolean // Habilita el campo de comisión manual
  comisionManual?: number // Valor de comisión manual
}

interface TarifaData {
  comisionPct: number
  comisionExtraPct: number
  iibbPct: number
  fijoPorOperacion: number
  descuentoPct: number
}

interface ResultadoCalculo {
  precio: number
  costo: number
  descuentoAplicado: number
  resultadoOperativo: number
  comision: number
  comisionExtra: number
  comisionSinIva?: number
  comisionExtraSinIva?: number
  envio: number
  iva: number
  iibb: number
  totalCostosPlataforma: number
  margenOperativo: number
  costoPublicidad: number
  margenNeto: number
  margenSobrePrecio: number
  margenSobreCosto: number
}

export function CalculadoraPrecios({ 
  costoProducto, 
  precioVentaInicial = 0,
  onPrecioCalculado,
  trigger,
  open: controlledOpen,
  onOpenChange
}: CalculadoraPreciosProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  
  const [parametros, setParametros] = useState<ParametrosCalculo>({
    plataforma: "ML",
    metodoPago: "MercadoPago",
    condicion: "Transferencia",
    precioVenta: precioVentaInicial,
    costoEnvio: 0,
    roas: 5,
    iibbManual: undefined,
    usarComisionManual: false,
    comisionManual: undefined
  })
  // Habilitar y forzar comisión manual para TN + MercadoPago + Transferencia
  useEffect(() => {
    if (
      parametros.plataforma === "TN" &&
      parametros.metodoPago === "MercadoPago" &&
      parametros.condicion === "Transferencia"
    ) {
      setParametros(prev => ({ ...prev, usarComisionManual: true }));
    } else {
      setParametros(prev => ({ ...prev, usarComisionManual: false }));
    }
  }, [parametros.plataforma, parametros.metodoPago, parametros.condicion]);
  
  const [tarifa, setTarifa] = useState<TarifaData | null>(null)
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)
  const [loadingTarifa, setLoadingTarifa] = useState(false)
  const [vistaGrafico, setVistaGrafico] = useState(false)
  const [showChart, setShowChart] = useState(false)

  // Cargar tarifa cuando cambien los parámetros de plataforma
  useEffect(() => {
    async function cargarTarifa() {
      if (!parametros.plataforma || !parametros.metodoPago || !parametros.condicion) return
      
      setLoadingTarifa(true)
      try {
        const tarifaData = await getTarifaEspecifica(
          parametros.plataforma, 
          parametros.metodoPago, 
          parametros.condicion
        )
        setTarifa(tarifaData)
      } catch (error) {
        console.error("Error cargando tarifa:", error)
        setTarifa(null)
      } finally {
        setLoadingTarifa(false)
      }
    }

    cargarTarifa()
  }, [parametros.plataforma, parametros.metodoPago, parametros.condicion])

  // Calcular resultado cuando cambien los parámetros
  useEffect(() => {
    if (tarifa && parametros.precioVenta > 0) {
      calcularResultado()
    }
  }, [parametros, tarifa, costoProducto])

  const calcularResultado = () => {
    if (!tarifa || parametros.precioVenta <= 0) return

    const precio = parametros.precioVenta
    const costo = costoProducto
    
    // 2. Aplicar descuento pre-comisión si existe (ej: 15% para TN + Transferencia)
    const precioConDescuento = precio * (1 - (tarifa.descuentoPct || 0))
    const descuentoAplicado = precio - precioConDescuento

    // 1. Precio (con descuento) - Costo = Resultado Operativo
    const resultadoOperativo = precioConDescuento - costo

    // 3. Costos de Plataforma usando tarifas reales sobre precio con descuento
    // Si usarComisionManual, usar el valor manual para la comisión base
    const comision = parametros.usarComisionManual && parametros.comisionManual !== undefined
      ? parametros.comisionManual
      : precioConDescuento * tarifa.comisionPct
    // Para TN+MercadoPago+Transferencia, la comisión extra es directa, sin IVA ni IIBB
    const comisionExtra = parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia"
      ? precioConDescuento * (tarifa.comisionExtraPct || 0)
      : (precioConDescuento * (tarifa.comisionExtraPct || 0))
    const envio = parametros.costoEnvio
    
    let iva = 0
    let iibb = 0
    let comisionSinIva = comision
    let comisionExtraSinIva = comisionExtra

    // Lógica especial TN + MercadoPago + Transferencia
    if (parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia") {
      iva = comision * 0.21; // Solo la comisión base lleva IVA
      // Comisión extra es directa, sin IVA ni IIBB
      // IIBB: usar manual si está, si no, 0
      iibb = parametros.iibbManual !== undefined && !isNaN(parametros.iibbManual)
        ? parametros.iibbManual
        : 0;
    } else if (parametros.plataforma === "TN") {
      iva = (comision + comisionExtra) * 0.21;
      iibb = parametros.iibbManual !== undefined && !isNaN(parametros.iibbManual)
        ? parametros.iibbManual
        : (comision + comisionExtra) * (tarifa.iibbPct || 0.03);
    } else if (parametros.plataforma === "ML") {
      comisionSinIva = comision / 1.21;
      comisionExtraSinIva = comisionExtra / 1.21;
      iva = comision - comisionSinIva + comisionExtra - comisionExtraSinIva;
      // ML no tiene IIBB adicional
    }
    
    // Calcular subtotales por separado para mayor claridad
    const subtotalComision = parametros.plataforma === "TN" 
      ? comision + (comision * 0.21) + (comision * 0.03)
      : comision // Para ML, la comisión ya incluye todo
    const subtotalComisionExtra = parametros.plataforma === "TN" 
      ? comisionExtra + (comisionExtra * 0.21) + (comisionExtra * 0.03)
      : comisionExtra // Para ML, la comisión extra ya incluye todo
    
    const totalCostosPlataforma = subtotalComision + subtotalComisionExtra + envio + tarifa.fijoPorOperacion

    // 4. Margen Operativo = Resultado Operativo - Costos Plataforma
    const margenOperativo = resultadoOperativo - totalCostosPlataforma

    // 5. Costo de Publicidad (calculado por ROAS)
    const costoPublicidad = parametros.roas > 0 ? precio / parametros.roas : 0

    // 6. Margen Neto = Margen Operativo - Costo Publicidad
    const margenNeto = margenOperativo - costoPublicidad

    // 7. Porcentajes
    const margenSobrePrecio = (margenNeto / precio) * 100
    const margenSobreCosto = (margenNeto / costo) * 100

    const resultado: ResultadoCalculo = {
      precio,
      costo,
      descuentoAplicado,
      resultadoOperativo,
      comision,
      comisionExtra,
      ...(parametros.plataforma === 'ML' && {
        comisionSinIva: comisionSinIva,
        comisionExtraSinIva: comisionExtraSinIva
      }),
      envio,
      iva,
      iibb,
      totalCostosPlataforma,
      margenOperativo,
      costoPublicidad,
      margenNeto,
      margenSobrePrecio,
      margenSobreCosto
    }

    setResultado(resultado)
  }

  const handleUsarPrecio = () => {
    if (onPrecioCalculado && parametros.precioVenta > 0) {
      onPrecioCalculado(parametros.precioVenta)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculadora de Precios y Márgenes
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de configuración */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración</CardTitle>
                <CardDescription>Selecciona la plataforma y condiciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select 
                    value={parametros.plataforma} 
                    onValueChange={(value: "TN" | "ML") => 
                      setParametros(prev => ({ ...prev, plataforma: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TN">Tienda Nube</SelectItem>
                      <SelectItem value="ML">Mercado Libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select 
                    value={parametros.metodoPago} 
                    onValueChange={(value: "PagoNube" | "MercadoPago") => 
                      setParametros(prev => ({ ...prev, metodoPago: value }))
                    }
                  >
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
                  <Select 
                    value={parametros.condicion} 
                    onValueChange={(value: "Transferencia" | "Cuotas sin interés") => 
                      setParametros(prev => ({ ...prev, condicion: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Cuotas sin interés">Cuotas sin interés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Precio de Venta (ARS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parametros.precioVenta}
                    onChange={(e) => setParametros(prev => ({ 
                      ...prev, 
                      precioVenta: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="Ingresa el precio de venta"
                  />
                </div>

                {loadingTarifa && (
                  <div className="text-sm text-muted-foreground">
                    Cargando tarifa...
                  </div>
                )}

                {tarifa && (
                  <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
                    <div className="font-semibold">Tarifa Cargada:</div>
                    <div>Comisión: {(tarifa.comisionPct * 100).toFixed(2)}%</div>
                    <div>Comisión Extra: {(tarifa.comisionExtraPct * 100).toFixed(2)}%</div>
                    {tarifa.descuentoPct > 0 && (
                      <div className="text-green-600">Descuento: {(tarifa.descuentoPct * 100).toFixed(1)}%</div>
                    )}
                    <div>Fijo por Operación: ${tarifa.fijoPorOperacion.toFixed(2)}</div>
                    {parametros.plataforma === "TN" && (
                      <>
                        <div className="text-red-600">+ IVA 21% sobre comisiones</div>
                        <div className="text-red-600">+ IIBB 0.3% sobre comisiones</div>
                      </>
                    )}
                    {parametros.plataforma === "ML" && (
                      <div className="text-green-600">IVA incluido en comisión</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parámetros Adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Costo de Envío (ARS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parametros.costoEnvio}
                    onChange={(e) => setParametros(prev => ({ 
                      ...prev, 
                      costoEnvio: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="Costo del envío"
                  />
                </div>
                {/* Solo mostrar comisión manual si corresponde, y forzarla a obligatoria en TN+MercadoPago+Transferencia */}
                {parametros.usarComisionManual && (
                  <div className="space-y-2">
                    <Label>Comisión Base (ARS, manual) <span className="text-red-600">*</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parametros.comisionManual ?? ""}
                      onChange={(e) => setParametros(prev => ({
                        ...prev,
                        comisionManual: e.target.value === "" ? undefined : parseFloat(e.target.value)
                      }))}
                      placeholder="Ingresá la comisión base"
                      required
                      disabled={!(parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia") ? false : false}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>IIBB (ARS, individual)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parametros.iibbManual ?? ""}
                    onChange={(e) => setParametros(prev => ({
                      ...prev,
                      iibbManual: e.target.value === "" ? undefined : parseFloat(e.target.value)
                    }))}
                    placeholder="Dejar vacío para automático"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IIBB (ARS, individual)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parametros.iibbManual ?? ""}
                    onChange={(e) => setParametros(prev => ({
                      ...prev,
                      iibbManual: e.target.value === "" ? undefined : parseFloat(e.target.value)
                    }))}
                    placeholder="Dejar vacío para automático"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    ROAS Objetivo
                    <TrendingUp className="w-4 h-4" />
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={parametros.roas}
                    onChange={(e) => setParametros(prev => ({ 
                      ...prev, 
                      roas: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="Ej: 5"
                  />
                  <div className="text-xs text-muted-foreground">
                    Costo publicidad = Precio ÷ ROAS = ${parametros.precioVenta > 0 && parametros.roas > 0 ? (parametros.precioVenta / parametros.roas).toFixed(2) : '0.00'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparación de ROAS */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">📊 Comparación de ROAS</CardTitle>
                    <CardDescription>Análisis de diferentes niveles de inversión publicitaria</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={!vistaGrafico ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVistaGrafico(false)}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={vistaGrafico ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVistaGrafico(true)}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {resultado && parametros.precioVenta > 0 ? (
                  <div className="space-y-3">
                    {!vistaGrafico ? (
                      // Vista de tabla (existente)
                      <>
                        {[2, 3, 4, 5, 6].map(roas => {
                          const costoPublicidad = parametros.precioVenta / roas
                          const margenNeto = resultado.margenOperativo - costoPublicidad
                          const margenSobrePrecio = (margenNeto / parametros.precioVenta) * 100
                          const isCurrentRoas = roas === parametros.roas
                          
                          return (
                            <div 
                              key={roas}
                              className={`flex justify-between items-center p-2 rounded ${
                                isCurrentRoas ? 'bg-blue-100 border-l-4 border-blue-500' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-mono ${isCurrentRoas ? 'font-bold text-blue-700' : ''}`}>
                                  ROAS {roas}x:
                                </span>
                                <span className={`text-sm ${margenNeto > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${margenNeto.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm ${margenNeto > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {margenSobrePrecio.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  Publicidad: ${costoPublicidad.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 rounded">
                          💡 El ROAS actual está resaltado. Verde = ganancia, Rojo = pérdida
                        </div>
                      </>
                    ) : (
                      // Vista de gráfico
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(() => {
                              // Calcular el ROAS de breakeven (donde ganancia = 0)
                              const breakevenRoas = resultado.margenOperativo > 0 ? parametros.precioVenta / resultado.margenOperativo : null
                              
                              // Generar más puntos para una línea más suave, incluyendo el breakeven
                              let roasValues = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]
                              
                              // Agregar el punto de breakeven si está en el rango
                              if (breakevenRoas && breakevenRoas >= 1.5 && breakevenRoas <= 7) {
                                roasValues.push(breakevenRoas)
                                roasValues.sort((a, b) => a - b)
                              }
                              
                              return roasValues.map(roas => {
                                const costoPublicidad = parametros.precioVenta / roas
                                const margenNeto = resultado.margenOperativo - costoPublicidad
                                const margenSobrePrecio = (margenNeto / parametros.precioVenta) * 100
                                const isCurrentRoas = Math.abs(roas - parametros.roas) < 0.1
                                const isBreakeven = breakevenRoas && Math.abs(roas - breakevenRoas) < 0.01
                                
                                return {
                                  roas: roas,
                                  roasLabel: `${roas}x`,
                                  margenNeto: Number(margenNeto.toFixed(2)),
                                  margenPorcentaje: Number(margenSobrePrecio.toFixed(1)),
                                  isActual: isCurrentRoas,
                                  isBreakeven: isBreakeven
                                }
                              })
                            })()}
                          >
                            <XAxis 
                              dataKey="roas" 
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(value) => `${value}x`}
                            />
                            <YAxis 
                              tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip 
                              formatter={(value, name) => {
                                if (name === 'margenNeto') return [`$${value}`, 'Margen Neto']
                                return [value, name]
                              }}
                              labelFormatter={(value) => `ROAS: ${value}x`}
                            />
                            {/* Línea de breakeven horizontal (ganancia = 0) */}
                            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                            
                            {/* Línea de breakeven vertical (ROAS exacto donde ganancia = 0) */}
                            {(() => {
                              const breakevenRoas = resultado.margenOperativo > 0 ? parametros.precioVenta / resultado.margenOperativo : null
                              if (breakevenRoas && breakevenRoas >= 1.5 && breakevenRoas <= 7) {
                                return (
                                  <ReferenceLine 
                                    x={breakevenRoas} 
                                    stroke="#ef4444" 
                                    strokeDasharray="3 3"
                                    label={{ 
                                      value: `Breakeven: ${breakevenRoas.toFixed(2)}x`, 
                                      position: "top",
                                      style: { fill: '#ef4444', fontSize: '11px' }
                                    }}
                                  />
                                )
                              }
                              return null
                            })()}
                            
                            {/* Línea de ganancia */}
                            <Line 
                              type="monotone" 
                              dataKey="margenNeto" 
                              stroke="#22c55e" 
                              strokeWidth={3}
                              dot={(props) => {
                                const { payload } = props
                                if (payload?.isBreakeven) {
                                  return <circle {...props} fill="#ef4444" stroke="#ef4444" strokeWidth={3} r={6} />
                                }
                                return <circle {...props} fill="#22c55e" strokeWidth={2} r={4} />
                              }}
                              activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                            />
                            
                            {/* Marcar el ROAS actual */}
                            <ReferenceLine 
                              x={parametros.roas} 
                              stroke="#3b82f6" 
                              strokeDasharray="3 3"
                              label={{ value: "ROAS Actual", position: "top" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 rounded">
                          � <span className="text-green-600">Línea verde:</span> Ganancia | 
                          <span className="text-red-600"> Línea roja punteada:</span> Breakeven (ganancia = $0) | 
                          <span className="text-blue-600"> Línea azul:</span> Tu ROAS actual
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    Ingresa un precio de venta para ver la comparación
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de resultados */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Análisis de Márgenes</CardTitle>
              </CardHeader>
              <CardContent>
                {resultado ? (
                  <div className="space-y-4">
                    {/* Resultado Bruto */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Resultado Bruto</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Precio de Venta:</span>
                          <span className="font-mono">${resultado.precio.toFixed(2)}</span>
                        </div>
                        {resultado.descuentoAplicado > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Descuento ({((resultado.descuentoAplicado / resultado.precio) * 100).toFixed(1)}%):</span>
                            <span className="font-mono">-${resultado.descuentoAplicado.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Costo Producto:</span>
                          <span className="font-mono">-${resultado.costo.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-blue-700">
                          <span>Resultado Bruto:</span>
                          <span className="font-mono">${resultado.resultadoOperativo.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Costos de Plataforma */}
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Costos de Plataforma</div>
                      <div className="space-y-2 text-sm">
                        
                        {/* Comisión Principal */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-medium">
                            <span>Comisión:</span>
                            <span className="font-mono">${resultado.comision.toFixed(2)}</span>
                          </div>
                          {parametros.plataforma === "TN" && (
                            <>
                              {/* Solo IVA sobre comisión base y solo IIBB si es manual */}
                              <div className="flex justify-between text-red-600 ml-4">
                                <span>• IVA (21%):</span>
                                <span className="font-mono">${(parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia" ? (resultado.comision * 0.21) : (resultado.comision * 0.21)).toFixed(2)}</span>
                              </div>
                              {(parametros.iibbManual !== undefined && parametros.iibbManual > 0) && (
                                <div className="flex justify-between text-red-600 ml-4">
                                  <span>• IIBB (manual):</span>
                                  <span className="font-mono">${resultado.iibb.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                <span>Subtotal Comisión:</span>
                                <span className="font-mono">${(resultado.comision + (parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia" ? (resultado.comision * 0.21) : (resultado.comision * 0.21)) + (parametros.iibbManual || 0)).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          {parametros.plataforma === "ML" && (
                            <>
                              <div className="flex justify-between text-blue-600 ml-4">
                                <span>• Sin IVA:</span>
                                <span className="font-mono">${resultado.comisionSinIva?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-blue-600 ml-4">
                                <span>• IVA incluido:</span>
                                <span className="font-mono">${(resultado.comision - (resultado.comisionSinIva || 0)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                <span>Subtotal Comisión:</span>
                                <span className="font-mono">${resultado.comision.toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          {parametros.plataforma !== "TN" && parametros.plataforma !== "ML" && (
                            <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                              <span>Subtotal Comisión:</span>
                              <span className="font-mono">${resultado.comision.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* Comisión Extra */}
                        {resultado.comisionExtra > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between font-medium">
                              <span>Comisión Extra:</span>
                              <span className="font-mono">${resultado.comisionExtra.toFixed(2)}</span>
                            </div>
                            {parametros.plataforma === "TN" && (
                              <>
                                {/* Para TN+MercadoPago+Transferencia, comisión extra es directa, sin IVA ni IIBB */}
                                {(parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia") ? null : (
                                  <div className="flex justify-between text-red-600 ml-4">
                                    <span>• IVA (21%):</span>
                                    <span className="font-mono">${(resultado.comisionExtra * 0.21).toFixed(2)}</span>
                                  </div>
                                )}
                                {/* No mostrar IIBB en comisión extra para este caso */}
                                <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                  <span>Subtotal Comisión Extra:</span>
                                  <span className="font-mono">${resultado.comisionExtra.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                            {parametros.plataforma === "ML" && (
                              <>
                                <div className="flex justify-between text-blue-600 ml-4">
                                  <span>• Sin IVA:</span>
                                  <span className="font-mono">${resultado.comisionExtraSinIva?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-blue-600 ml-4">
                                  <span>• IVA incluido:</span>
                                  <span className="font-mono">${(resultado.comisionExtra - (resultado.comisionExtraSinIva || 0)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                  <span>Subtotal Comisión Extra:</span>
                                  <span className="font-mono">${resultado.comisionExtra.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                            {parametros.plataforma !== "TN" && parametros.plataforma !== "ML" && (
                              <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                <span>Subtotal Comisión Extra:</span>
                                <span className="font-mono">${resultado.comisionExtra.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Envío */}
                        <div className="flex justify-between">
                          <span>Envío:</span>
                          <span className="font-mono">${resultado.envio.toFixed(2)}</span>
                        </div>
                        
                        <Separator />
                        <div className="flex justify-between font-semibold text-orange-700">
                          <span>Total Costos Plataforma:</span>
                          <span className="font-mono">${resultado.totalCostosPlataforma.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Margen Operativo */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Margen Operativo</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Resultado Bruto:</span>
                          <span className="font-mono">${resultado.resultadoOperativo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costos Plataforma:</span>
                          <span className="font-mono">-${resultado.totalCostosPlataforma.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-purple-700">
                          <span>Margen Operativo:</span>
                          <span className="font-mono">${resultado.margenOperativo.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Costo de Publicidad */}
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Costo de Publicidad</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>ROAS {parametros.roas}x:</span>
                          <span className="font-mono">${resultado.costoPublicidad.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Margen Neto Final */}
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Margen Neto Final</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Margen Operativo:</span>
                          <span className="font-mono">${resultado.margenOperativo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costo Publicidad:</span>
                          <span className="font-mono">-${resultado.costoPublicidad.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Margen Neto:</span>
                          <span className={`font-mono ${resultado.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${resultado.margenNeto.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>% sobre Precio:</span>
                          <span className="font-mono">{resultado.margenSobrePrecio.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>% sobre Costo:</span>
                          <span className="font-mono">{resultado.margenSobreCosto.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Dinero Recibido Neto en Plataforma */}
                    <div className="p-4 bg-cyan-50 rounded-lg border-l-4 border-cyan-400">
                      <div className="text-lg font-semibold mb-2 text-cyan-800">💰 Dinero Recibido Neto en Plataforma</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Precio de Venta:</span>
                          <span className="font-mono">${(resultado.precio - resultado.descuentoAplicado).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Costos Plataforma:</span>
                          <span className="font-mono">-${resultado.totalCostosPlataforma.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg text-cyan-700">
                          <span>Dinero Neto Recibido:</span>
                          <span className="font-mono">${((resultado.precio - resultado.descuentoAplicado) - resultado.totalCostosPlataforma).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-cyan-600 mt-1">
                          <span>Dinero Neto sin Envío:</span>
                          <span className="font-mono">${((resultado.precio - resultado.descuentoAplicado) - resultado.totalCostosPlataforma + resultado.envio).toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-cyan-600 mt-2 italic">
                          Este es el dinero que efectivamente recibes en tu cuenta después de que la plataforma descuente todas sus comisiones e impuestos.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Ingresa el precio de venta para ver el análisis
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                onClick={handleUsarPrecio} 
                className="flex-1"
                disabled={!resultado || parametros.precioVenta <= 0}
              >
                Usar este precio
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

