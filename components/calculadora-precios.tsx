"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Calculator, TrendingUp, BarChart3, List, Activity } from "lucide-react"
import { getTarifaEspecifica } from "@/lib/actions/tarifas"
import { ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line, ReferenceLine } from "recharts"
import { getCostosEstimados30Dias } from "@/lib/actions/devoluciones"
import { getRecargoCuotasMP } from "@/lib/calculos"

interface CalculadoraPreciosProps {
  costoProducto: number
  precioVentaInicial?: number
  onPrecioCalculado?: (precio: number) => void
  trigger: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  costosEstimados?: {
    costoDevolucionesPorVenta: number
    costoGastosNegocioPorVenta: number
  }
  productoId?: string
  productoSku?: string
}

interface ParametrosCalculo {
  plataforma: "TN" | "ML"
  metodoPago: "PagoNube" | "MercadoPago"
  condicion: "Transferencia" | "Cuotas sin interés" | "Normal"
  precioVenta: number
  costoEnvio: number
  roas: number
  usarComisionManual: boolean // Habilita el campo de comisión manual
  comisionManual?: number // Valor de comisión manual
  costoDevoluciones: number // Costo estimado de devoluciones por venta
  costoGastosNegocio: number // Estructura prorrateada por unidad (costo fijo unitario)
  cuotas?: number // Cantidad de cuotas para TN + MercadoPago + Cuotas sin interés
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
  margenContribucion: number
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
  roasBE: number
  porcentajeAdsSobreContribucion: number
  margenNeto: number
  margenSobrePrecio: number
  margenSobreCosto: number
}

interface DatosReales30Dias {
  precioVentaPromedio: number
  costoPromedio: number
  envioPromedio: number
  gastosNegocioPromedio: number
  devolucionPromedio: number
  totalVentas: number
  cantidadDevoluciones: number
  roas: number
}

type RoasZona = "ganancia" | "perdida" | "equilibrio"

const ROAS_ZONE_TOLERANCE = 0.01

const ROAS_ZONE_CONFIG: Record<RoasZona, {
  cardBgClass: string
  textClass: string
  title: string
  detail: string
}> = {
  ganancia: {
    cardBgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    title: "Ganancia",
    detail: "Zona de ganancia"
  },
  perdida: {
    cardBgClass: "bg-red-50",
    textClass: "text-red-700",
    title: "Pérdida",
    detail: "Zona de pérdida"
  },
  equilibrio: {
    cardBgClass: "bg-amber-50",
    textClass: "text-amber-700",
    title: "Equilibrio",
    detail: "Zona de equilibrio"
  }
}

function getRoasZona(roas: number, roasBE: number): RoasZona {
  if (!Number.isFinite(roasBE) || roasBE <= 0) return "equilibrio"

  const diferencia = roas - roasBE
  if (diferencia > ROAS_ZONE_TOLERANCE) return "ganancia"
  if (diferencia < -ROAS_ZONE_TOLERANCE) return "perdida"
  return "equilibrio"
}

function calcularResultadoConTarifa(
  parametrosCalculo: ParametrosCalculo,
  tarifa: TarifaData,
  costoProducto: number
): ResultadoCalculo {
  const precio = parametrosCalculo.precioVenta
  const costo = costoProducto
  const metodoPago = parametrosCalculo.metodoPago
  const condicion = parametrosCalculo.condicion
  
  const precioConDescuento = precio * (1 - (tarifa.descuentoPct || 0))
  const descuentoAplicado = precio - precioConDescuento
  const resultadoOperativo = precioConDescuento - costo

  let iva = 0
  let iibb = 0
  let comisionSinIva = 0
  let comisionExtraSinIva = 0

  let comision = parametrosCalculo.usarComisionManual && parametrosCalculo.comisionManual !== undefined
    ? parametrosCalculo.comisionManual
    : precioConDescuento * tarifa.comisionPct
  
  if (parametrosCalculo.plataforma === "TN" && metodoPago === "MercadoPago" && condicion === "Cuotas sin interés") {
    const cuotasValue = parametrosCalculo.cuotas || 1
    const recargoMP = getRecargoCuotasMP(cuotasValue)
    const comisionMPAdicional = precioConDescuento * recargoMP
    comision = comision + comisionMPAdicional
  }
  
  const comisionExtra = precioConDescuento * (tarifa.comisionExtraPct || 0)
  const envio = parametrosCalculo.costoEnvio
  
  if (parametrosCalculo.plataforma === "TN" && metodoPago === "MercadoPago") {
    comisionSinIva = comision
    const ivaMP = comision * 0.21
    
    comisionExtraSinIva = comisionExtra / 1.21
    const ivaTN = comisionExtra - comisionExtraSinIva
    iva = ivaMP + ivaTN
    
    iibb = (comision + comisionExtra) * 0.03
  } else if (parametrosCalculo.plataforma === "TN") {
    iva = (comision + comisionExtra) * 0.21
    iibb = (comision + comisionExtra) * (tarifa.iibbPct || 0.03)
  } else if (parametrosCalculo.plataforma === "ML") {
    comisionSinIva = comision / 1.21
    comisionExtraSinIva = comisionExtra / 1.21
    iva = comision - comisionSinIva + comisionExtra - comisionExtraSinIva
  }
  
  const subtotalComision = parametrosCalculo.plataforma === "TN" 
    ? comision + (comision * 0.21) + (comision * (tarifa.iibbPct || 0.03))
    : comision
  const subtotalComisionExtra = parametrosCalculo.plataforma === "TN" 
    ? comisionExtra + (comisionExtra * 0.21) + (comisionExtra * (tarifa.iibbPct || 0.03))
    : comisionExtra
  
  const totalCostosPlataforma = subtotalComision + subtotalComisionExtra + envio + tarifa.fijoPorOperacion
  const margenContribucion = resultadoOperativo - totalCostosPlataforma - parametrosCalculo.costoDevoluciones
  const costoPublicidad = parametrosCalculo.roas > 0 ? precio / parametrosCalculo.roas : 0
  const margenOperativo = margenContribucion - costoPublicidad
  const margenNeto = margenOperativo - parametrosCalculo.costoGastosNegocio

  const roasBE = margenContribucion > 0 ? precio / margenContribucion : 0
  const porcentajeAdsSobreContribucion = margenContribucion > 0
    ? (costoPublicidad / margenContribucion) * 100
    : 0

  const margenSobrePrecio = (margenNeto / precio) * 100
  const margenSobreCosto = (margenNeto / costo) * 100

  return {
    precio,
    costo,
    descuentoAplicado,
    resultadoOperativo,
    margenContribucion,
    comision,
    comisionExtra,
    ...(parametrosCalculo.plataforma === "TN" && {
      comisionSinIva,
      comisionExtraSinIva
    }),
    envio,
    iva,
    iibb,
    totalCostosPlataforma,
    margenOperativo,
    costoPublicidad,
    roasBE,
    porcentajeAdsSobreContribucion,
    margenNeto,
    margenSobrePrecio,
    margenSobreCosto
  }
}

export function CalculadoraPrecios({ 
  costoProducto, 
  precioVentaInicial = 0,
  onPrecioCalculado,
  trigger,
  open: controlledOpen,
  onOpenChange,
  costosEstimados,
  productoId,
  productoSku
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
    usarComisionManual: false,
    comisionManual: undefined,
    costoDevoluciones: costosEstimados?.costoDevolucionesPorVenta || 0,
    costoGastosNegocio: costosEstimados?.costoGastosNegocioPorVenta || 0
  })
  // Sincronizar costoDevoluciones y costoGastosNegocio con costosEstimados
  useEffect(() => {
    if (costosEstimados) {
      setParametros(prev => ({
        ...prev,
        costoDevoluciones: costosEstimados.costoDevolucionesPorVenta || 0,
        costoGastosNegocio: costosEstimados.costoGastosNegocioPorVenta || 0
      }))
    }
  }, [costosEstimados])

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

  // Forzar MercadoPago y condición válida cuando se selecciona Mercado Libre
  useEffect(() => {
    if (parametros.plataforma === "ML") {
      setParametros(prev => {
        const updates: any = { metodoPago: "MercadoPago" };
        // Si la condición es Transferencia, cambiarla a Normal
        if (prev.condicion === "Transferencia") {
          updates.condicion = "Normal";
        }
        return { ...prev, ...updates };
      });
    }
  }, [parametros.plataforma]);

  // Actualizar costos estimados cuando cambien
  useEffect(() => {
    if (costosEstimados) {
      setParametros(prev => ({
        ...prev,
        costoDevoluciones: costosEstimados.costoDevolucionesPorVenta,
        costoGastosNegocio: costosEstimados.costoGastosNegocioPorVenta
      }));
    }
  }, [costosEstimados]);
  
  const [tarifa, setTarifa] = useState<TarifaData | null>(null)
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)
  const [loadingTarifa, setLoadingTarifa] = useState(false)
  const [vistaGrafico, setVistaGrafico] = useState(false)
  
  // Estado para modo análisis de últimos 30 días
  const [modoAnalisis30Dias, setModoAnalisis30Dias] = useState(false)
  const [datosReales30Dias, setDatosReales30Dias] = useState<DatosReales30Dias | null>(null)
  const [loadingDatosReales, setLoadingDatosReales] = useState(false)

  // Forzar MercadoPago y condición válida cuando se selecciona Mercado Libre
  useEffect(() => {
    if (parametros.plataforma === "ML") {
      setParametros(prev => {
        const updates: any = { metodoPago: "MercadoPago" };
        // Si la condición es Transferencia, cambiarla a Normal
        if (prev.condicion === "Transferencia") {
          updates.condicion = "Normal";
        }
        return { ...prev, ...updates };
      });
    }
  }, [parametros.plataforma]);

  // Para TN + MercadoPago: si está en Transferencia, cambiar a Normal
  useEffect(() => {
    if (parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago") {
      if (parametros.condicion === "Transferencia") {
        setParametros(prev => ({ ...prev, condicion: "Normal" }));
      }
    }
  }, [parametros.plataforma, parametros.metodoPago, parametros.condicion]);

  // Auto-establecer 1 cuota por defecto cuando se selecciona TN + MercadoPago + Cuotas sin interés
  useEffect(() => {
    if (parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && parametros.condicion === "Cuotas sin interés") {
      if (!parametros.cuotas) {
        setParametros(prev => ({ ...prev, cuotas: 1 })); // Default: 1 cuota (contado)
      }
    } else {
      // Limpiar cuotas si no aplica
      if (parametros.cuotas) {
        setParametros(prev => ({ ...prev, cuotas: undefined }));
      }
    }
  }, [parametros.plataforma, parametros.metodoPago, parametros.condicion, parametros.cuotas]);

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

  // Cargar datos reales de últimos 30 días cuando se active el modo
  useEffect(() => {
    async function cargarDatosReales() {
      if (!modoAnalisis30Dias) {
        setDatosReales30Dias(null)
        return
      }
      
      setLoadingDatosReales(true)
      try {
        const datos = await getCostosEstimados30Dias(productoId, parametros.plataforma, productoSku)
        
        // Calcular promedios basados en datos reales
        const datosCalculados: DatosReales30Dias = {
          precioVentaPromedio: datos.precioVentaPromedio || 0,
          costoPromedio: costoProducto,
          envioPromedio: datos.envioPromedio || 0,
          gastosNegocioPromedio: datos.costoGastosNegocioPorVenta || 0,
          devolucionPromedio: datos.costoDevolucionesPorVenta || 0,
          totalVentas: datos.totalVentas || 0,
          cantidadDevoluciones: datos.cantidadDevoluciones || 0,
          roas: datos.roas || 0
        }
        
        setDatosReales30Dias(datosCalculados)
        
        // Actualizar parámetros con los promedios
        setParametros(prev => ({
          ...prev,
          costoEnvio: datosCalculados.envioPromedio,
          costoDevoluciones: datosCalculados.devolucionPromedio,
          costoGastosNegocio: datosCalculados.gastosNegocioPromedio,
          roas: datosCalculados.roas > 0 ? datosCalculados.roas : prev.roas
        }))
      } catch (error) {
        console.error("Error cargando datos reales de 30 días:", error)
      } finally {
        setLoadingDatosReales(false)
      }
    }
    
    cargarDatosReales()
  }, [modoAnalisis30Dias, costoProducto, productoId, productoSku, parametros.plataforma])

  // Calcular resultado cuando cambien los parámetros
  useEffect(() => {
    if (tarifa && parametros.precioVenta > 0) {
      calcularResultado()
    }
  }, [parametros, tarifa, costoProducto])

  const calcularResultado = () => {
    if (!tarifa || parametros.precioVenta <= 0) return

    setResultado(calcularResultadoConTarifa(parametros, tarifa, costoProducto))
  }

  const handleUsarPrecio = () => {
    if (onPrecioCalculado && parametros.precioVenta > 0) {
      onPrecioCalculado(parametros.precioVenta)
    }
    setOpen(false)
  }

  const getSaludProducto = (margenNeto: number, margenSobrePrecio: number) => {
    if (margenNeto < 0) {
      return { label: "Negativo", className: "bg-red-100 text-red-700 border-red-300" }
    }
    if (Math.abs(margenNeto) <= Math.max(1, parametros.precioVenta * 0.01)) {
      return { label: "Break even", className: "bg-amber-100 text-amber-700 border-amber-300" }
    }
    if (margenSobrePrecio >= 10) {
      return { label: "Escalable", className: "bg-emerald-100 text-emerald-700 border-emerald-300" }
    }
    return { label: "Rentable", className: "bg-green-100 text-green-700 border-green-300" }
  }

  const saludProducto = resultado ? getSaludProducto(resultado.margenNeto, resultado.margenSobrePrecio) : null
  const zonaActual = resultado ? getRoasZona(parametros.roas, resultado.roasBE) : "equilibrio"
  const zonaActualConfig = ROAS_ZONE_CONFIG[zonaActual]

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
        
        {/* Toggle para modo análisis de últimos 30 días */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-600" />
                <div>
                  <Label htmlFor="modo-analisis" className="text-base font-semibold cursor-pointer">
                    Análisis con datos reales (últimos 30 días)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Usa promedios reales de ventas, comisiones, envíos, ADS y devoluciones
                  </p>
                </div>
              </div>
              <Switch
                id="modo-analisis"
                checked={modoAnalisis30Dias}
                onCheckedChange={setModoAnalisis30Dias}
              />
            </div>
            {loadingDatosReales && (
              <div className="mt-3 text-sm text-blue-600">Cargando datos reales...</div>
            )}
            {modoAnalisis30Dias && datosReales30Dias && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200 space-y-2 text-sm">
                <div className="font-semibold text-blue-900">Datos cargados de últimos 30 días:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>📊 Total ventas: <span className="font-bold">{datosReales30Dias.totalVentas}</span></div>
                  <div>📦 Devoluciones: <span className="font-bold">{datosReales30Dias.cantidadDevoluciones}</span></div>
                  <div>💰 Precio venta prom: <span className="font-bold">${datosReales30Dias.precioVentaPromedio.toFixed(2)}</span></div>
                  <div>📮 Envío prom: <span className="font-bold">${datosReales30Dias.envioPromedio.toFixed(2)}</span></div>
                  <div>� ROAS: <span className="font-bold">{datosReales30Dias.roas.toFixed(2)}x</span></div>
                  <div>↩️ Devolución prom: <span className="font-bold">${datosReales30Dias.devolucionPromedio.toFixed(2)}</span></div>
                </div>
                <div className="pt-2 border-t border-blue-200 text-blue-700">
                  💡 Las comisiones se calculan según la tarifa seleccionada. Cambia el precio de venta para ver el impacto en tu margen real
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                    disabled={parametros.plataforma === "ML"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PagoNube">Pago Nube</SelectItem>
                      <SelectItem value="MercadoPago">Mercado Pago</SelectItem>
                    </SelectContent>
                  </Select>
                  {parametros.plataforma === "ML" && (
                    <p className="text-xs text-muted-foreground">Mercado Libre solo acepta Mercado Pago</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Condición</Label>
                  <Select 
                    value={parametros.condicion} 
                    onValueChange={(value: "Transferencia" | "Cuotas sin interés" | "Normal") => 
                      setParametros(prev => ({ ...prev, condicion: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Transferencia solo para TN + PagoNube */}
                      {parametros.plataforma === "TN" && parametros.metodoPago === "PagoNube" && (
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                      )}
                      <SelectItem value="Cuotas sin interés">Cuotas sin interés</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                  {parametros.plataforma === "ML" && (
                    <p className="text-xs text-muted-foreground">Solo disponible: Cuotas sin interés y Normal</p>
                  )}
                  {parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && (
                    <p className="text-xs text-muted-foreground">Solo disponible: Cuotas sin interés y Normal</p>
                  )}
                </div>

                {/* Campo Cuotas: solo para TN + MercadoPago + "Cuotas sin interés" */}
                {parametros.plataforma === "TN" && parametros.metodoPago === "MercadoPago" && parametros.condicion === "Cuotas sin interés" && (
                  <div className="space-y-2">
                    <Label>Cantidad de Cuotas</Label>
                    <Select
                      value={parametros.cuotas?.toString() || "1"}
                      onValueChange={(value) => setParametros(prev => ({ ...prev, cuotas: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 cuota (contado) - 8.15%</SelectItem>
                        <SelectItem value="2">2 cuotas sin interés - 8.58%</SelectItem>
                        <SelectItem value="3">3 cuotas sin interés - 12.05%</SelectItem>
                        <SelectItem value="6">6 cuotas sin interés - 13.95%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                        <div className="text-red-600">+ IIBB {((tarifa.iibbPct || 0.03) * 100).toFixed(1)}% sobre comisiones</div>
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
                    disabled={modoAnalisis30Dias}
                  />
                  {modoAnalisis30Dias && datosReales30Dias && (
                    <div className="text-xs text-blue-600">
                      ✓ Usando promedio real: ${datosReales30Dias.envioPromedio.toFixed(2)}
                    </div>
                  )}
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

                <Separator />
                
                <div className="space-y-3">
                  <div className="text-sm font-medium">Costos Estimados (Últimos 30 días)</div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Costo de Devoluciones por Venta (ARS)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parametros.costoDevoluciones}
                      onChange={(e) => setParametros(prev => ({ 
                        ...prev, 
                        costoDevoluciones: parseFloat(e.target.value) || 0 
                      }))}
                      placeholder="0.00"
                      disabled={modoAnalisis30Dias}
                    />
                    {modoAnalisis30Dias && datosReales30Dias ? (
                      <div className="text-xs text-blue-600">
                        ✓ Usando promedio real: ${datosReales30Dias.devolucionPromedio.toFixed(2)}
                      </div>
                    ) : (
                      costosEstimados && costosEstimados.costoDevolucionesPorVenta > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Estimado: ${costosEstimados.costoDevolucionesPorVenta.toFixed(2)}
                        </div>
                      )
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Estructura prorrateada por unidad (ARS)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parametros.costoGastosNegocio}
                      onChange={(e) => setParametros(prev => ({ 
                        ...prev, 
                        costoGastosNegocio: parseFloat(e.target.value) || 0 
                      }))}
                      placeholder="0.00"
                      disabled={modoAnalisis30Dias}
                    />
                    <div className="text-xs text-muted-foreground">
                      Estructura total / ventas netas (sin devoluciones)
                    </div>
                    {modoAnalisis30Dias && datosReales30Dias ? (
                      <div className="text-xs text-blue-600">
                        ✓ Usando promedio real: ${datosReales30Dias.gastosNegocioPromedio.toFixed(2)}
                      </div>
                    ) : (
                      costosEstimados && costosEstimados.costoGastosNegocioPorVenta > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Estimado: ${costosEstimados.costoGastosNegocioPorVenta.toFixed(2)}
                        </div>
                      )
                    )}
                  </div>
                </div>
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
                              <div className="flex justify-between text-red-600 ml-4">
                                <span>• IIBB ({((tarifa?.iibbPct || 0.03) * 100).toFixed(1)}%):</span>
                                <span className="font-mono">${(resultado.comision * (tarifa?.iibbPct || 0.03)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                <span>Subtotal Comisión:</span>
                                <span className="font-mono">${(resultado.comision + (resultado.comision * 0.21) + (resultado.comision * (tarifa?.iibbPct || 0.03))).toFixed(2)}</span>
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
                                {/* Para TN+MercadoPago+Transferencia, comisión extra lleva solo IIBB */}
                                {(parametros.metodoPago === "MercadoPago" && parametros.condicion === "Transferencia") ? (
                                  <>
                                    <div className="flex justify-between text-red-600 ml-4">
                                      <span>• IVA (21%):</span>
                                      <span className="font-mono">${(resultado.comisionExtra * 0.21).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 ml-4">
                                      <span>• IIBB ({((tarifa?.iibbPct || 0.03) * 100).toFixed(1)}%):</span>
                                      <span className="font-mono">${(resultado.comisionExtra * (tarifa?.iibbPct || 0.03)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                      <span>Subtotal Comisión Extra:</span>
                                      <span className="font-mono">${(resultado.comisionExtra + (resultado.comisionExtra * 0.21) + (resultado.comisionExtra * (tarifa?.iibbPct || 0.03))).toFixed(2)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex justify-between text-red-600 ml-4">
                                      <span>• IVA (21%):</span>
                                      <span className="font-mono">${(resultado.comisionExtra * 0.21).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 ml-4">
                                      <span>• IIBB ({((tarifa?.iibbPct || 0.03) * 100).toFixed(1)}%):</span>
                                      <span className="font-mono">${(resultado.comisionExtra * (tarifa?.iibbPct || 0.03)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                                      <span>Subtotal Comisión Extra:</span>
                                      <span className="font-mono">${(resultado.comisionExtra + (resultado.comisionExtra * 0.21) + (resultado.comisionExtra * (tarifa?.iibbPct || 0.03))).toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
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

                    {/* Margen de Contribución */}
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2 flex items-center gap-2">
                        Margen de contribución
                        <span className="text-xs text-muted-foreground cursor-help" title="Es el dinero disponible para pagar publicidad y generar ganancia.">ⓘ</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Resultado Bruto:</span>
                          <span className="font-mono">${resultado.resultadoOperativo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costos Plataforma:</span>
                          <span className="font-mono">-${resultado.totalCostosPlataforma.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-700">
                          <span>Costo Devoluciones (30d):</span>
                          <span className="font-mono">-${parametros.costoDevoluciones.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-indigo-700">
                          <span>Margen de contribución:</span>
                          <span className="font-mono">${resultado.margenContribucion.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Es la base que financia publicidad y crecimiento.
                        </div>
                      </div>
                    </div>

                    {/* Costo de Publicidad */}
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Costo de Publicidad</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>ROAS actual ({parametros.roas.toFixed(2)}x):</span>
                          <span className="font-mono">${resultado.costoPublicidad.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>% del margen de contribución (ads):</span>
                          <span className="font-mono">
                            {resultado.porcentajeAdsSobreContribucion > 0 ? `${resultado.porcentajeAdsSobreContribucion.toFixed(1)}%` : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="flex items-center gap-2">
                            ROAS BE
                            <span className="text-xs text-muted-foreground cursor-help" title="ROAS mínimo para cubrir publicidad desde el margen de contribución.">ⓘ</span>
                          </span>
                          <span className="font-mono">{resultado.roasBE > 0 ? `${resultado.roasBE.toFixed(2)}x` : "-"}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>ROAS objetivo (futuro):</span>
                          <span className="font-mono">{resultado.roasBE > 0 ? `${(resultado.roasBE * 1.25).toFixed(2)}x` : "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Margen Operativo */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2">Margen operativo</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Margen de contribución:</span>
                          <span className="font-mono">${resultado.margenContribucion.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costo Publicidad:</span>
                          <span className="font-mono">-${resultado.costoPublicidad.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-purple-700">
                          <span>Margen operativo:</span>
                          <span className="font-mono">${resultado.margenOperativo.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Estructura prorrateada */}
                    <div className="p-4 bg-violet-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2 flex items-center gap-2">
                        Estructura prorrateada
                        <span className="text-xs text-muted-foreground cursor-help" title="Estructura total prorrateada por ventas netas sin devoluciones.">ⓘ</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Estructura prorrateada (30d):</span>
                          <span className="font-mono">-${parametros.costoGastosNegocio.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Estructura total / ventas netas (sin devoluciones).</div>
                      </div>
                    </div>

                    {/* Margen Neto Antes de Impuestos */}
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold mb-2 flex items-center justify-between">
                        <span>Margen Neto Antes de Impuestos</span>
                        {saludProducto && (
                          <span className={`text-xs border rounded-full px-2 py-1 ${saludProducto.className}`}>
                            {saludProducto.label}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Margen operativo:</span>
                          <span className="font-mono">${resultado.margenOperativo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estructura prorrateada:</span>
                          <span className="font-mono">-${parametros.costoGastosNegocio.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Margen neto:</span>
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
                      <div className="text-lg font-semibold mb-2 text-cyan-800 flex items-center gap-2">
                        Dinero Neto Recibido en Plataforma
                        <span className="text-xs text-cyan-700 cursor-help" title="Ingreso de venta menos descuentos de plataforma y comisiones.">ⓘ</span>
                      </div>
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
                        <div className="text-xs text-cyan-700 mt-2 italic">
                          Es el dinero que efectivamente recibes luego de descuentos y costos de plataforma.
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

        {resultado && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-lg font-semibold">Comparación de ROAS</div>
                  <div className="text-xs text-muted-foreground">
                    Zona de pérdida: ROAS menor al BE. Zona de equilibrio: ROAS igual al BE. Zona de ganancia: ROAS mayor al BE.
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 text-sm">
                <div className="rounded border p-2 bg-blue-50">
                  <div className="text-xs text-muted-foreground">ROAS actual</div>
                  <div className="font-semibold text-blue-700">{parametros.roas.toFixed(2)}x</div>
                </div>
                <div className="rounded border p-2 bg-amber-50">
                  <div className="text-xs text-muted-foreground">ROAS BE</div>
                  <div className="font-semibold text-amber-700">{resultado.roasBE > 0 ? `${resultado.roasBE.toFixed(2)}x` : "-"}</div>
                </div>
                <div className={`rounded border p-2 ${zonaActualConfig.cardBgClass}`}>
                  <div className="text-xs text-muted-foreground">Zona actual</div>
                  <div className={`font-semibold ${zonaActualConfig.textClass}`}>
                    {zonaActualConfig.title}
                  </div>
                </div>
              </div>

              {!vistaGrafico ? (
                <div className="space-y-2">
                  {(() => {
                    const valoresBase = [2, 3, 4, 5, 6]
                    const valoresExtra = [Number(parametros.roas.toFixed(2)), Number(resultado.roasBE.toFixed(2))]
                    const roasValues = Array.from(new Set([...valoresBase, ...valoresExtra])).filter(v => v > 0).sort((a, b) => a - b)
                    return roasValues.map(roas => {
                      const isActual = Math.abs(roas - parametros.roas) < 0.01
                      const isBE = Math.abs(roas - resultado.roasBE) < 0.01
                      const roasEscenario = isBE ? resultado.roasBE : roas
                      const costoPublicidadEscenario = parametros.precioVenta / roasEscenario
                      const margenOperativoEscenarioRaw = resultado.margenContribucion - costoPublicidadEscenario
                      const margenOperativoEscenario = Math.abs(margenOperativoEscenarioRaw) < 0.01 ? 0 : margenOperativoEscenarioRaw
                      const margenSobrePrecioEscenario = (margenOperativoEscenario / parametros.precioVenta) * 100
                      const zonaEscenario = getRoasZona(roas, resultado.roasBE)
                      const zonaEscenarioConfig = ROAS_ZONE_CONFIG[zonaEscenario]
                      const colorResultadoEscenario = margenOperativoEscenario > 0
                        ? "text-green-700"
                        : margenOperativoEscenario < 0
                          ? "text-red-700"
                          : "text-amber-700"
                      return (
                        <div
                          key={roas}
                          className={`flex justify-between items-center p-2 rounded border ${
                            isActual ? "bg-blue-50 border-blue-300" : isBE ? "bg-amber-50 border-amber-300" : "bg-gray-50"
                          }`}
                        >
                          <div>
                            <div className="font-mono">
                              ROAS {roas.toFixed(2)}x {isActual ? "(actual)" : ""} {isBE ? "(BE)" : ""}
                            </div>
                            <div className={`text-xs ${zonaEscenarioConfig.textClass}`}>
                              {zonaEscenarioConfig.detail}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-mono ${colorResultadoEscenario}`}>
                              ${margenOperativoEscenario.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">{margenSobrePrecioEscenario.toFixed(1)}% s/PV</div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(() => {
                        const roasValues = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, Number(parametros.roas.toFixed(2)), Number(resultado.roasBE.toFixed(2)), resultado.roasBE]
                        const valoresUnicos = Array.from(new Set(roasValues)).filter(v => v > 0).sort((a, b) => a - b)
                        return valoresUnicos.map(roas => {
                          const isBE = Math.abs(roas - resultado.roasBE) < 0.01
                          const roasEscenario = isBE ? resultado.roasBE : roas
                          const costoPublicidadEscenario = parametros.precioVenta / roasEscenario
                          const margenOperativoEscenarioRaw = resultado.margenContribucion - costoPublicidadEscenario
                          const margenOperativoEscenario = Math.abs(margenOperativoEscenarioRaw) < 0.01 ? 0 : margenOperativoEscenarioRaw
                          return {
                            roas,
                            margenOperativo: Number(margenOperativoEscenario.toFixed(2)),
                          }
                        })
                      })()}
                    >
                      <XAxis dataKey="roas" type="number" tickFormatter={(value) => `${value}x`} />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === "margenOperativo") return [`$${value}`, "Margen operativo"]
                          return [value, name]
                        }}
                        labelFormatter={(value) => `ROAS: ${value}x`}
                      />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                      {resultado.roasBE > 0 && (
                        <ReferenceLine
                          x={resultado.roasBE}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{ value: `ROAS BE ${resultado.roasBE.toFixed(2)}x`, position: "top" }}
                        />
                      )}
                      <ReferenceLine
                        x={parametros.roas}
                        stroke="#2563eb"
                        strokeDasharray="4 4"
                        label={{ value: "ROAS actual", position: "top" }}
                      />
                      <Line type="monotone" dataKey="margenOperativo" stroke="#16a34a" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}
