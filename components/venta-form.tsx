"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { createVenta, updateVenta, calcularPreviewVenta } from "@/lib/actions/ventas"
import { getProductos } from "@/lib/actions/productos"
import { getTarifaEspecifica } from "@/lib/actions/tarifas"
import { ventaSchema, VentaFormData } from "@/lib/validations"
import { getRecargoCuotasMP } from "@/lib/calculos"
import { Calculator } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCostosEstimados30Dias } from "@/lib/actions/devoluciones"

// Schema para el formulario (con fecha como string)
const ventaFormSchema = ventaSchema.extend({
  fecha: z.string().min(1, "La fecha es requerida"),
})

type VentaFormSchema = z.infer<typeof ventaFormSchema>

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const metodoPagoOptions = [
  { value: "PagoNube", label: "Pago Nube" },
  { value: "MercadoPago", label: "Mercado Pago" },
  { value: "Transferencia", label: "Transferencia Directa" },
]

const condicionOptions = [
  { value: "Transferencia", label: "Transferencia" },
  { value: "Cuotas sin interés", label: "Cuotas sin interés" },
  { value: "Normal", label: "Normal" },
]

const estadoEnvioOptions = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "EnCamino", label: "En Camino" },
  { value: "Entregado", label: "Entregado" },
  { value: "Devuelto", label: "Devuelto" },
  { value: "Cancelado", label: "Cancelado" },
]

interface VentaFormProps {
  venta?: {
    id: string
    fecha: Date
    comprador: string
    plataforma: string
    metodoPago: string
    condicion: string
    productoId: string
    pvBruto: number
    cargoEnvioCosto: number
    comision?: number
    trackingUrl?: string | null
    estadoEnvio: string
    courier?: string | null
    externalOrderId?: string | null
  }
  onSuccess?: () => void
}

export function VentaForm({ venta, onSuccess }: VentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [productos, setProductos] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [tarifaCompleta, setTarifaCompleta] = useState<any>(null)
  const [costosEstimados, setCostosEstimados] = useState<any>(null)
  const router = useRouter()
  const isEditing = !!venta

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VentaFormSchema>({
    resolver: zodResolver(ventaFormSchema as any),
    defaultValues: venta
      ? {
          fecha: new Date(venta.fecha).toISOString().split('T')[0],
          comprador: venta.comprador,
          plataforma: venta.plataforma as any,
          metodoPago: venta.metodoPago as any,
          condicion: venta.condicion as any,
          productoId: venta.productoId,
          pvBruto: Number(venta.pvBruto),
          cargoEnvioCosto: Number(venta.cargoEnvioCosto),
          usarComisionManual: false, // Por defecto automático
          comisionManual: venta.comision ? Number(venta.comision) : undefined,
          trackingUrl: venta.trackingUrl || "",
          estadoEnvio: venta.estadoEnvio as any,
          courier: venta.courier || "",
          externalOrderId: venta.externalOrderId || "",
        }
      : {
          fecha: (() => {
            const today = new Date()
            return today.toISOString().split('T')[0]
          })(), // Función que calcula la fecha de hoy
          estadoEnvio: "Pendiente",
          cargoEnvioCosto: 0,
          usarComisionManual: false,
        },
  })

  const watchedFields = watch(["productoId", "plataforma", "metodoPago", "condicion", "pvBruto", "cargoEnvioCosto", "usarComisionManual", "comisionManual", "comisionExtraManual", "iibbManual", "cuotas"])
  
  // Variables individuales para la calculadora
  const watchPvBruto = watch("pvBruto")
  const watchCargoEnvio = watch("cargoEnvioCosto")
  const watchPlataforma = watch("plataforma")
  const watchMetodoPago = watch("metodoPago")
  const watchCondicion = watch("condicion")
  const watchCuotas = watch("cuotas")
  const watchUsarComisionManual = watch("usarComisionManual")
  const watchComisionManual = watch("comisionManual")
  const watchComisionExtraManual = watch("comisionExtraManual")
  const watchIibbManual = watch("iibbManual")

  // Cargar productos
  useEffect(() => {
    const loadProductos = async () => {
      try {
        const productosData = await getProductos()
        const productosActivos = productosData.filter((p) => p.activo)
        console.log("Productos cargados:", productosActivos)
        setProductos(productosActivos)
      } catch (error) {
        console.error("Error cargando productos:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los productos.",
          variant: "destructive",
        })
      }
    }
    loadProductos()
  }, [])

  // Establecer fecha de hoy por defecto para nuevas ventas
  useEffect(() => {
    if (!venta) {
      const today = new Date().toISOString().split('T')[0]
      setValue("fecha", today)
    }
  }, [venta, setValue])

  // Forzar MercadoPago y condición válida cuando se selecciona Mercado Libre
  useEffect(() => {
    if (watchPlataforma === "ML") {
      // Forzar MercadoPago
      if (watchMetodoPago !== "MercadoPago") {
        setValue("metodoPago", "MercadoPago")
      }
      // Si la condición es Transferencia, cambiarla a Normal
      if (watchCondicion === "Transferencia") {
        setValue("condicion", "Normal")
      }
    }
  }, [watchPlataforma, watchMetodoPago, watchCondicion, setValue])

  // Auto-establecer 1 cuota por defecto cuando se selecciona TN + MercadoPago + Cuotas sin interés
  useEffect(() => {
    if (watchPlataforma === "TN" && watchMetodoPago === "MercadoPago" && watchCondicion === "Cuotas sin interés") {
      if (!watchCuotas) {
        setValue("cuotas", 1) // Default: 1 cuota (contado)
      }
    } else {
      // Limpiar cuotas si no aplica
      if (watchCuotas) {
        setValue("cuotas", undefined)
      }
    }
  }, [watchPlataforma, watchMetodoPago, watchCondicion, watchCuotas, setValue])

  // Auto-completar precio cuando se seleccione un producto
  useEffect(() => {
    const productoSeleccionado = productos.find(p => p.id === watch("productoId"))
    if (productoSeleccionado && productoSeleccionado.precio_venta > 0 && !watch("pvBruto")) {
      setValue("pvBruto", Number(productoSeleccionado.precio_venta))
    }
  }, [watch("productoId"), productos, setValue])

  // Cargar costos estimados cuando cambie el producto o plataforma
  useEffect(() => {
    const productoId = watch("productoId")
    const plataforma = watch("plataforma")
    
    if (productoId) {
      const producto = productos.find(p => p.id === productoId)
      if (producto) {
        // getCostosEstimados30Dias solo acepta 'TN' | 'ML', usar TN como default para 'Directo'
        const plataformaParaCostos = plataforma === 'Directo' ? 'TN' : plataforma
        getCostosEstimados30Dias(Number(productoId), plataformaParaCostos, producto.sku)
          .then(datos => {
            console.log('📊 Costos estimados recibidos:', datos)
            setCostosEstimados(datos)
          })
          .catch(err => {
            console.error("Error cargando costos estimados:", err)
            setCostosEstimados(null)
          })
      }
    }
  }, [watch("productoId"), watch("plataforma"), productos])

  // Calcular preview cuando cambien los campos relevantes
  useEffect(() => {
    const [productoId, plataforma, metodoPago, condicion, pvBruto, cargoEnvioCosto, usarComisionManual, comisionManual, comisionExtraManual, iibbManual] = watchedFields

    if (productoId && plataforma && metodoPago && condicion && pvBruto > 0) {
      setIsCalculating(true)
      
      // Usar la misma lógica exacta que la calculadora de productos
      const comisionParaUsar = usarComisionManual && comisionManual ? comisionManual : undefined
      const comisionExtraParaUsar = usarComisionManual && comisionExtraManual ? comisionExtraManual : undefined
      calcularPreviewConTarifaCompleta(productoId, plataforma, metodoPago, condicion, pvBruto, cargoEnvioCosto || 0, comisionParaUsar, comisionExtraParaUsar, iibbManual)
        .then((result) => {
          console.log("Preview result:", result) // Debug
          if (result.success) {
            setPreview(result)
            setTarifaCompleta(result.tarifa || null)
          } else {
            console.log("Preview error:", result.error)
            setPreview({ success: false, error: result.error })
            setTarifaCompleta(null)
          }
        })
        .catch((error) => {
          console.error("Preview catch error:", error)
          setPreview({ success: false, error: "Error al calcular preview" })
          setTarifaCompleta(null)
        })
        .finally(() => setIsCalculating(false))
    } else {
      setPreview(null)
      setTarifaCompleta(null)
    }
  }, [...watchedFields, costosEstimados])

  // Función que replica exactamente la lógica de la calculadora de productos
  const calcularPreviewConTarifaCompleta = async (
    productoId: string,
    plataforma: string,
    metodoPago: string,
    condicion: string,
    pvBruto: number,
    cargoEnvioCosto: number,
    comisionManual?: number,
    comisionExtraManual?: number,
    iibbManual?: number
  ) => {
    try {
      // Obtener el producto para el costo
      const { data: producto, error: prodError } = await supabase
        .from("productos")
        .select("*")
        .eq("id", productoId)
        .single()
      if (prodError) throw new Error("Error al obtener producto")

      if (!producto) {
        return { success: false, error: "Producto no encontrado" }
      }

      // Obtener la tarifa completa
      const tarifa = await getTarifaEspecifica(plataforma, metodoPago, condicion)
      if (!tarifa) {
        return { success: false, error: "Tarifa no configurada para esta combinación" }
      }

      // USAR EXACTAMENTE LA MISMA LÓGICA QUE LA CALCULADORA DE PRODUCTOS
      const precio = pvBruto
      const costo = Number(producto.costoUnitarioARS)
      
      // 2. Aplicar descuento pre-comisión si existe (ej: 15% para TN + Transferencia)
      const precioConDescuento = precio * (1 - (tarifa.descuentoPct || 0))
      const descuentoAplicado = precio - precioConDescuento

      // 1. Precio (con descuento) - Costo = Resultado Operativo
      const resultadoOperativo = precioConDescuento - costo

      // 3. Costos de Plataforma usando tarifas reales sobre precio con descuento
      const comision = comisionManual !== undefined && comisionManual > 0 
        ? comisionManual 
        : precioConDescuento * tarifa.comisionPct
      const comisionExtra = comisionExtraManual !== undefined && comisionExtraManual > 0
        ? comisionExtraManual
        : precioConDescuento * (tarifa.comisionExtraPct || 0)
      const envio = cargoEnvioCosto
      
      let iva = 0
      let iibb = 0
      let comisionSinIva = comision
      let comisionExtraSinIva = comisionExtra
      
      // Caso especial: Transferencia Directa (Directo + Transferencia)
      if (metodoPago === "Transferencia") {
        // Sin comisiones de plataforma
        comisionSinIva = 0
        comisionExtraSinIva = 0
        iva = 0
        // IIBB manual (lo que cobra MP por la transferencia)
        iibb = iibbManual || 0
      }
      // Caso especial: TN + MercadoPago
      else if (plataforma === "TN" && metodoPago === "MercadoPago") {
        // comision = Comisión MP base desde tarifa (ej: 3.99%, puede variar)
        // Si hay cuotas sin interés, se suma el recargo adicional al monto de comisión
        const cuotasValue = watch("cuotas") || 1
        const recargoMP = getRecargoCuotasMP(cuotasValue)
        const comisionMPAdicional = precioConDescuento * recargoMP // Monto adicional por cuotas
        const comisionMPTotal = comision + comisionMPAdicional // Comisión total MP
        
        // Tratamiento de IVA: La comisión MP completa (base + recargo) NO incluye IVA
        comisionSinIva = comisionMPTotal // MP sin IVA (se agrega después)
        const ivaMP = comisionMPTotal * 0.21 // IVA 21% sobre comisión MP total
        
        // comisionExtra = Comisión TN (SÍ incluye IVA, necesita desglose)
        comisionExtraSinIva = comisionExtra / 1.21 // TN sin IVA
        const ivaTN = comisionExtra - comisionExtraSinIva // IVA de TN
        iva = ivaMP + ivaTN // IVA total
        
        // IIBB es MANUAL para TN+MercadoPago (no se calcula automáticamente)
        iibb = iibbManual || 0
      } else if (plataforma === "TN") {
        // TN + PagoNube: IVA e IIBB se agregan sobre las comisiones
        iva = (comision + comisionExtra) * 0.21 // 21% IVA sobre comisiones
        const iibbCalculado = (comision + comisionExtra) * (tarifa.iibbPct || 0.03) // IIBB dinámico desde tarifa
        iibb = iibbCalculado + (iibbManual || 0) // IIBB total = calculado + manual
      } else if (plataforma === "ML") {
        // ML: La comisión ya incluye IVA, necesitamos desglosarlo
        comisionSinIva = comision / 1.21 // Comisión sin IVA
        comisionExtraSinIva = comisionExtra / 1.21 // Comisión extra sin IVA
        iva = comision - comisionSinIva + comisionExtra - comisionExtraSinIva // IVA incluido
        // ML: IIBB es manual, se pasa desde el formulario
        iibb = iibbManual || 0
      }
      
      // Calcular subtotales por separado para mayor claridad
      const subtotalComision = metodoPago === "Transferencia"
        ? 0 // Transferencia: sin comisiones
        : plataforma === "TN" && metodoPago !== "MercadoPago"
          ? comision + (comision * 0.21) + (comision * (tarifa.iibbPct || 0.03)) // TN tradicional: comisión + IVA + IIBB
          : plataforma === "TN" && metodoPago === "MercadoPago"
            ? comisionSinIva + (comisionSinIva * 0.21) // TN+MP: comisión total (base + recargo) + IVA
            : comision // Para ML, la comisión ya incluye IVA
      const subtotalComisionExtra = metodoPago === "Transferencia"
        ? 0 // Transferencia: sin comisiones extra
        : plataforma === "TN" && metodoPago !== "MercadoPago"
          ? comisionExtra + (comisionExtra * 0.21) + (comisionExtra * (tarifa.iibbPct || 0.03)) // TN tradicional: comisión + IVA + IIBB
          : comisionExtra // Para ML y TN+MP, la comisión extra ya incluye IVA
      
      // Calcular total de costos según plataforma
      // Para Transferencia: IIBB manual + envío (para calcular margen operativo correcto)
      // Para TN tradicional: subtotales ya incluyen IVA e IIBB calculado, sumar envío, fijo y IIBB manual adicional
      // Para TN+MP y ML: subtotales + envío + fijo + IIBB manual
      const totalCostosPlataforma = metodoPago === "Transferencia"
        ? iibb + envio // IIBB manual + envío (para margen operativo)
        : plataforma === "TN" && metodoPago !== "MercadoPago"
          ? subtotalComision + subtotalComisionExtra + envio + (tarifa.fijoPorOperacion || 0) + (iibbManual || 0) // TN tradicional: subtotales (con IIBB calculado) + envío + fijo + IIBB manual adicional
          : subtotalComision + subtotalComisionExtra + envio + (tarifa.fijoPorOperacion || 0) + iibb

      // 4. Margen Operativo = Resultado Operativo - Costos Plataforma - Devoluciones - Gastos Negocio
      const costoDevoluciones = costosEstimados?.costoDevolucionesPorVenta || 0
      const costoGastosNegocio = costosEstimados?.costoGastosNegocioPorVenta || 0
      const margenOperativo = resultadoOperativo - totalCostosPlataforma - costoDevoluciones - costoGastosNegocio

      // 5. Costo de Publicidad (ROAS de últimos 30 días)
      const roas = costosEstimados?.roas > 0 ? costosEstimados.roas : 5
      const costoPublicidad = roas > 0 ? precio / roas : 0

      // 6. Margen Neto = Margen Operativo - Publicidad
      const margenNeto = margenOperativo - costoPublicidad

      const data = {
        precio,
        costo,
        descuentoAplicado,
        resultadoOperativo,
        comision,
        comisionExtra,
        comisionSinIva,
        comisionExtraSinIva,
        envio,
        iva,
        iibb,
        subtotalComision,
        subtotalComisionExtra,
        totalCostosPlataforma,
        costoDevoluciones,
        costoGastosNegocio,
        margenOperativo,
        costoPublicidad,
        roas,
        margenNeto,
        // Para compatibilidad con el componente actual
        costoProducto: costo,
        ingresoMargen: margenNeto, // IMPORTANTE: Ahora guardamos el margen NETO (con publicidad)
        rentabilidadSobrePV: margenNeto / precio,
        rentabilidadSobreCosto: (costo + envio) > 0 ? margenNeto / (costo + envio) : 0
      }

      return { success: true, data, tarifa }
    } catch (error) {
      console.error("Error al calcular preview:", error)
      return { success: false, error: "Error al calcular preview" }
    }
  }

  const onSubmit = async (data: VentaFormSchema) => {
    console.log("🔄 onSubmit iniciado con datos:", data)
    setIsSubmitting(true)
    try {
      // Convertir la fecha string a Date antes de enviar
      const processedData = {
        ...data,
        fecha: new Date(data.fecha)
      }
      
      console.log("📤 Enviando datos procesados:", processedData)
      console.log("🔍 Tipo de processedData:", typeof processedData)
      console.log("🔍 Claves de processedData:", Object.keys(processedData))
      console.log("🔍 isEditing:", isEditing)
      
      const result = isEditing ? await updateVenta(venta.id, processedData) : await createVenta(processedData)
      console.log("📥 Resultado recibido:", result)

      if (result.success) {
        console.log("✅ Venta creada exitosamente")
        toast({
          title: isEditing ? "Venta actualizada" : "Venta creada",
          description: `La venta ha sido ${isEditing ? "actualizada" : "creada"} correctamente.`,
        })
        
        // Forzar refresh del router para actualizar datos
        router.refresh()
        
        if (onSuccess) {
          console.log("🔄 Ejecutando onSuccess callback")
          onSuccess()
        } else {
          console.log("🔄 Redirigiendo a /ventas")
          router.push("/ventas")
        }
      } else {
        console.error("❌ Error en el resultado:", result.error)
        toast({
          title: "Error",
          description: result.error || "Ocurrió un error inesperado.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("❌ Error en catch:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Editar Venta" : "Nueva Venta"}</CardTitle>
            <CardDescription>
              {isEditing ? "Modifica los datos de la venta" : "Completa los datos de la nueva venta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((data) => {
              console.log("🔥 Formulario submiteado! Datos:", data)
              console.log("🔍 Errores de validación:", errors)
              onSubmit(data)
            })} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input 
                    id="fecha" 
                    type="date" 
                    {...register("fecha")} 
                  />
                  {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprador">Comprador</Label>
                  <Input id="comprador" {...register("comprador")} placeholder="Nombre del comprador" />
                  {errors.comprador && <p className="text-sm text-destructive">{errors.comprador.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={watch("plataforma")} onValueChange={(value) => setValue("plataforma", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {plataformaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.plataforma && <p className="text-sm text-destructive">{errors.plataforma.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select 
                    value={watch("metodoPago")} 
                    onValueChange={(value) => setValue("metodoPago", value as any)}
                    disabled={watchPlataforma === "ML"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un método" />
                    </SelectTrigger>
                    <SelectContent>
                      {metodoPagoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watchPlataforma === "ML" && (
                    <p className="text-xs text-muted-foreground">Mercado Libre solo acepta Mercado Pago</p>
                  )}
                  {errors.metodoPago && <p className="text-sm text-destructive">{errors.metodoPago.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Condición</Label>
                  <Select value={watch("condicion")} onValueChange={(value) => setValue("condicion", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una condición" />
                    </SelectTrigger>
                    <SelectContent>
                      {condicionOptions
                        .filter(option => watchPlataforma === "ML" ? option.value !== "Transferencia" : true)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {watchPlataforma === "ML" && (
                    <p className="text-xs text-muted-foreground">Solo disponible: Cuotas sin interés y Normal</p>
                  )}
                  {errors.condicion && <p className="text-sm text-destructive">{errors.condicion.message}</p>}
                </div>

                {/* Campo Cuotas: solo para TN + MercadoPago + "Cuotas sin interés" */}
                {watchPlataforma === "TN" && watchMetodoPago === "MercadoPago" && watchCondicion === "Cuotas sin interés" && (
                  <div className="space-y-2">
                    <Label htmlFor="cuotas">Cantidad de Cuotas</Label>
                    <Select 
                      value={watch("cuotas")?.toString() || "1"} 
                      onValueChange={(value) => setValue("cuotas", parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cantidad de cuotas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 cuota (contado) - 9%</SelectItem>
                        <SelectItem value="3">3 cuotas sin interés - 12.05%</SelectItem>
                        <SelectItem value="6">6 cuotas sin interés - 13.95%</SelectItem>
                        <SelectItem value="12">12 cuotas sin interés - 18.68%</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      MercadoPago cobra comisión adicional por cuotas sin interés
                    </p>
                    {errors.cuotas && <p className="text-sm text-destructive">{errors.cuotas.message}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Producto</Label>
                  <Select value={watch("productoId")} onValueChange={(value) => setValue("productoId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={productos.length > 0 ? "Selecciona un producto" : "Cargando productos..."} />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {productos.length > 0 ? productos.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.modelo} - ${Number(producto.costoUnitarioARS).toLocaleString()}
                        </SelectItem>
                      )) : null}
                    </SelectContent>
                  </Select>
                  {errors.productoId && <p className="text-sm text-destructive">{errors.productoId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pvBruto">Precio de Venta Bruto (ARS)</Label>
                  <Input
                    key="pvBruto-input"
                    id="pvBruto"
                    type="number"
                    step="0.01"
                    {...register("pvBruto", { valueAsNumber: true })}
                    placeholder="25000.00"
                  />
                  {errors.pvBruto && <p className="text-sm text-destructive">{errors.pvBruto.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargoEnvioCosto">Costo de Envío (ARS)</Label>
                  <Input
                    id="cargoEnvioCosto"
                    type="number"
                    step="0.01"
                    {...register("cargoEnvioCosto", { valueAsNumber: true })}
                    placeholder="800.00"
                  />
                  {errors.cargoEnvioCosto && (
                    <p className="text-sm text-destructive">{errors.cargoEnvioCosto.message}</p>
                  )}
                </div>

                {/* IIBB Manual para Mercado Libre, Tienda Nube (todos los métodos) y Transferencia Directa */}
                {(watchPlataforma === "ML" || watchPlataforma === "TN" || watchMetodoPago === "Transferencia") && (
                  <div className="space-y-2">
                    <Label htmlFor="iibbManual">IIBB (ARS) *Manual*</Label>
                    <Input
                      id="iibbManual"
                      type="number"
                      step="0.01"
                      {...register("iibbManual", { valueAsNumber: true })}
                      placeholder="Ej: 500.00"
                    />
                    <p className="text-xs text-gray-600">
                      {watchMetodoPago === "Transferencia"
                        ? "Para Transferencia Directa, ingresá el IIBB que cobra Mercado Pago por la transferencia bancaria."
                        : watchPlataforma === "ML" 
                          ? "Para Mercado Libre, el IIBB debe ingresarse manualmente." 
                          : watchMetodoPago === "PagoNube"
                            ? "Para TN + PagoNube, ingresá la retención adicional de IIBB si corresponde (se suma al IIBB calculado de comisiones)."
                            : "Para TN + MercadoPago, el IIBB debe ingresarse manualmente (si corresponde)."}
                    </p>
                    {errors.iibbManual && (
                      <p className="text-sm text-destructive">{errors.iibbManual.message}</p>
                    )}
                  </div>
                )}

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="usarComisionManual"
                      checked={watchUsarComisionManual}
                      onCheckedChange={(checked) => {
                        setValue("usarComisionManual", checked)
                        if (!checked) {
                          setValue("comisionManual", undefined)
                          setValue("comisionExtraManual", undefined)
                        }
                      }}
                    />
                    <Label htmlFor="usarComisionManual">Usar Comisión Manual</Label>
                  </div>
                  {watchUsarComisionManual && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="comisionManual">Comisión Base Manual (ARS)</Label>
                        <Input
                          id="comisionManual"
                          type="number"
                          step="0.01"
                          {...register("comisionManual", { valueAsNumber: true })}
                          placeholder="Ej: 1500.00"
                        />
                        {errors.comisionManual && (
                          <p className="text-sm text-destructive">{errors.comisionManual.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="comisionExtraManual">Comisión Extra Manual (ARS) - Opcional</Label>
                        <Input
                          id="comisionExtraManual"
                          type="number"
                          step="0.01"
                          {...register("comisionExtraManual", { valueAsNumber: true })}
                          placeholder="Ej: 300.00"
                        />
                        {errors.comisionExtraManual && (
                          <p className="text-sm text-destructive">{errors.comisionExtraManual.message}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Estas comisiones reemplazarán el cálculo automático. IVA e IIBB se calcularán automáticamente para TN.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingUrl">URL de Tracking (opcional)</Label>
                  <Input id="trackingUrl" {...register("trackingUrl")} placeholder="https://..." />
                  {errors.trackingUrl && <p className="text-sm text-destructive">{errors.trackingUrl.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="courier">Courier (opcional)</Label>
                  <Input id="courier" {...register("courier")} placeholder="Correo Argentino, OCA, etc." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estado de Envío</Label>
                  <Select value={watch("estadoEnvio")} onValueChange={(value) => setValue("estadoEnvio", value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {estadoEnvioOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="externalOrderId">ID de Orden Externa (opcional)</Label>
                  <Input id="externalOrderId" {...register("externalOrderId")} placeholder="ID de TN o ML" />
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  onClick={() => {
                    console.log("🔴 Botón Crear clickeado!")
                    console.log("🔍 Estado isSubmitting:", isSubmitting)
                    console.log("🔍 Errores actuales:", errors)
                  }}
                >
                  {isSubmitting
                    ? isEditing
                      ? "Actualizando..."
                      : "Creando..."
                    : isEditing
                      ? "Actualizar Venta"
                      : "Crear Venta"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/ventas")}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Vista Previa de Cálculos
            </CardTitle>
            <CardDescription>Los cálculos se actualizan automáticamente</CardDescription>
          </CardHeader>
          <CardContent>
            {isCalculating ? (
              <div className="text-center text-gray-500 py-8">
                Calculando...
              </div>
            ) : preview && preview.success && preview.data ? (
              <div className="space-y-4">
                {/* Resultado Bruto */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Resultado Bruto</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Precio de Venta:</span>
                      <span className="font-mono">${(watchPvBruto || 0).toFixed(2)}</span>
                    </div>
                    {preview.data.descuentoAplicado > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Descuento ({(((preview.data.descuentoAplicado) / (watchPvBruto || 1)) * 100).toFixed(1)}%):</span>
                        <span className="font-mono">-${preview.data.descuentoAplicado.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Costo Producto:</span>
                      <span className="font-mono">-${preview.data.costoProducto.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-semibold text-blue-700">
                        <span>Resultado Bruto:</span>
                        <span className="font-mono">${((watchPvBruto || 0) - (preview.data.descuentoAplicado || 0) - preview.data.costoProducto).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Costos de Plataforma */}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Costos de Plataforma</div>
                  <div className="space-y-2 text-sm">
                    {/* Comisión Base */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>
                          Comisión:
                          {watchUsarComisionManual && watchComisionManual && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Manual
                            </span>
                          )}
                        </span>
                        <span className="font-mono">${
                          (watchPlataforma === "TN" && watchMetodoPago === "MercadoPago" 
                            ? preview.data.comisionSinIva 
                            : preview.data.comision
                          ).toFixed(2)
                        }</span>
                      </div>
                      {watchPlataforma === "TN" && watchMetodoPago !== "MercadoPago" && (
                        <>
                          <div className="flex justify-between text-red-600 ml-4">
                            <span>• IVA (21%):</span>
                            <span className="font-mono">${(preview.data.comision * 0.21).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 ml-4">
                            <span>• IIBB ({((tarifaCompleta?.iibbPct || 0.03) * 100).toFixed(1)}%):</span>
                            <span className="font-mono">${(preview.data.comision * (tarifaCompleta?.iibbPct || 0.03)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                            <span>Subtotal Comisión:</span>
                            <span className="font-mono">${preview.data.subtotalComision.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {watchPlataforma === "TN" && watchMetodoPago === "MercadoPago" && (
                        <>
                          <div className="flex justify-between text-red-600 ml-4">
                            <span>• IVA (21%):</span>
                            <span className="font-mono">${(preview.data.comisionSinIva * 0.21).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                            <span>Subtotal Comisión:</span>
                            <span className="font-mono">${(preview.data.comisionSinIva + (preview.data.comisionSinIva * 0.21)).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {watchPlataforma === "ML" && (
                        <>
                          <div className="flex justify-between text-blue-600 ml-4">
                            <span>• Sin IVA:</span>
                            <span className="font-mono">${preview.data.comisionSinIva.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-blue-600 ml-4">
                            <span>• IVA incluido (21%):</span>
                            <span className="font-mono">${(preview.data.comision - preview.data.comisionSinIva).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                            <span>Subtotal Comisión:</span>
                            <span className="font-mono">${preview.data.subtotalComision.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {watchPlataforma !== "TN" && watchPlataforma !== "ML" && (
                        <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                          <span>Subtotal Comisión:</span>
                          <span className="font-mono">${preview.data.subtotalComision.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Comisión Extra */}
                    {preview.data.comisionExtra > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>
                            Comisión Extra:
                            {watchUsarComisionManual && watchComisionExtraManual && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                Manual
                              </span>
                            )}
                          </span>
                          <span className="font-mono">${preview.data.comisionExtra.toFixed(2)}</span>
                        </div>
                        {watchPlataforma === "TN" && watchMetodoPago !== "MercadoPago" && (
                          <>
                            <div className="flex justify-between text-red-600 ml-4">
                              <span>• IVA (21%):</span>
                              <span className="font-mono">${(preview.data.comisionExtra * 0.21).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-red-600 ml-4">
                              <span>• IIBB ({((tarifaCompleta?.iibbPct || 0.03) * 100).toFixed(1)}%):</span>
                              <span className="font-mono">${(preview.data.comisionExtra * (tarifaCompleta?.iibbPct || 0.03)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                              <span>Subtotal Comisión Extra:</span>
                              <span className="font-mono">${preview.data.subtotalComisionExtra.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {watchPlataforma === "TN" && watchMetodoPago === "MercadoPago" && (
                          <>
                            <div className="flex justify-between text-blue-600 ml-4">
                              <span>• Sin IVA:</span>
                              <span className="font-mono">${preview.data.comisionExtraSinIva.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-blue-600 ml-4">
                              <span>• IVA incluido (21%):</span>
                              <span className="font-mono">${(preview.data.comisionExtra - preview.data.comisionExtraSinIva).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                              <span>Subtotal Comisión Extra:</span>
                              <span className="font-mono">${preview.data.subtotalComisionExtra.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {watchPlataforma === "ML" && (
                          <>
                            <div className="flex justify-between text-blue-600 ml-4">
                              <span>• Sin IVA:</span>
                              <span className="font-mono">${preview.data.comisionExtraSinIva.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-blue-600 ml-4">
                              <span>• IVA incluido (21%):</span>
                              <span className="font-mono">${(preview.data.comisionExtra - preview.data.comisionExtraSinIva).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                              <span>Subtotal Comisión Extra:</span>
                              <span className="font-mono">${preview.data.subtotalComisionExtra.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {watchPlataforma !== "TN" && watchPlataforma !== "ML" && (
                          <div className="flex justify-between font-medium text-gray-700 ml-4 border-t pt-1">
                            <span>Subtotal Comisión Extra:</span>
                            <span className="font-mono">${preview.data.subtotalComisionExtra.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* IIBB Manual (para ML, TN y Transferencia Directa) */}
                    {(watchPlataforma === "ML" || watchPlataforma === "TN" || watchMetodoPago === "Transferencia") && watchIibbManual && watchIibbManual > 0 && (
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="font-medium">IIBB (Manual):</span>
                        <span className="font-mono font-medium text-orange-600">${Number(watchIibbManual).toFixed(2)}</span>
                      </div>
                    )}

                    {/* Envío */}
                    <div className="flex justify-between">
                      <span>Envío:</span>
                      <span className="font-mono">${preview.data.envio.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-semibold text-orange-700">
                        <span>Total Costos Plataforma:</span>
                        <span className="font-mono">${preview.data.totalCostosPlataforma.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Margen Operativo */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Margen Operativo</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Resultado Bruto:</span>
                      <span className="font-mono">${preview.data.resultadoOperativo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costos Plataforma:</span>
                      <span className="font-mono">-${preview.data.totalCostosPlataforma.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Devoluciones estimadas:</span>
                      <span className="font-mono">-${preview.data.costoDevoluciones.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gastos negocio estimados:</span>
                      <span className="font-mono">-${preview.data.costoGastosNegocio.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-semibold text-purple-700">
                        <span>Margen Operativo:</span>
                        <span className="font-mono">${preview.data.margenOperativo.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Publicidad y Margen Neto */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Margen Final</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Margen Operativo:</span>
                      <span className="font-mono">${preview.data.margenOperativo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Publicidad (ROAS {preview.data.roas}):</span>
                      <span className="font-mono">-${preview.data.costoPublicidad.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-semibold text-blue-700 text-base">
                        <span>Margen Neto:</span>
                        <span className={`font-mono ${preview.data.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${preview.data.margenNeto.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rentabilidades */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Rentabilidades</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>% sobre Precio:</span>
                      <span className={`font-mono ${preview.data.rentabilidadSobrePV >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(preview.data.rentabilidadSobrePV * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>% sobre Costo Total:</span>
                      <span className={`font-mono ${preview.data.rentabilidadSobreCosto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(preview.data.rentabilidadSobreCosto * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : preview && !preview.success ? (
              <div className="text-center text-red-500 py-8">
                <p className="font-medium">Error en el cálculo</p>
                <p className="text-sm mt-1">{preview.error}</p>
                {preview.error?.includes("Tarifa no configurada") && (
                  <p className="text-xs mt-2 text-gray-600">
                    Necesitas configurar una tarifa para esta combinación en la sección de Tarifas.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Completa los campos para ver el análisis
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
