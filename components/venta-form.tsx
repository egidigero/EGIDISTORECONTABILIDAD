"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { createVenta, updateVenta, calcularPreviewVenta } from "@/lib/actions/ventas"
import { getProductos } from "@/lib/actions/productos"
import { ventaSchema, type VentaFormData } from "@/lib/validations"
import { Calculator } from "lucide-react"

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const metodoPagoOptions = [
  { value: "PagoNube", label: "Pago Nube" },
  { value: "MercadoPago", label: "Mercado Pago" },
  { value: "Transferencia", label: "Transferencia" },
  { value: "Efectivo", label: "Efectivo" },
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
    productoId: string
    pvBruto: number
    cargoEnvioCosto: number
    trackingUrl?: string | null
    estadoEnvio: string
    courier?: string | null
    externalOrderId?: string | null
  }
}

export function VentaForm({ venta }: VentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [productos, setProductos] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const router = useRouter()
  const isEditing = !!venta

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VentaFormData>({
    resolver: zodResolver(ventaSchema),
    defaultValues: venta
      ? {
          fecha: new Date(venta.fecha),
          comprador: venta.comprador,
          plataforma: venta.plataforma as any,
          metodoPago: venta.metodoPago as any,
          productoId: venta.productoId,
          pvBruto: Number(venta.pvBruto),
          cargoEnvioCosto: Number(venta.cargoEnvioCosto),
          trackingUrl: venta.trackingUrl || "",
          estadoEnvio: venta.estadoEnvio as any,
          courier: venta.courier || "",
          externalOrderId: venta.externalOrderId || "",
        }
      : {
          fecha: new Date(),
          estadoEnvio: "Pendiente",
          cargoEnvioCosto: 0,
        },
  })

  const watchedFields = watch(["productoId", "plataforma", "metodoPago", "pvBruto", "cargoEnvioCosto"])

  // Cargar productos
  useEffect(() => {
    const loadProductos = async () => {
      try {
        const productosData = await getProductos()
        setProductos(productosData.filter((p) => p.activo))
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los productos.",
          variant: "destructive",
        })
      }
    }
    loadProductos()
  }, [])

  // Calcular preview cuando cambien los campos relevantes
  useEffect(() => {
    const [productoId, plataforma, metodoPago, pvBruto, cargoEnvioCosto] = watchedFields

    if (productoId && plataforma && metodoPago && pvBruto > 0) {
      setIsCalculating(true)
      calcularPreviewVenta(productoId, plataforma, metodoPago, pvBruto, cargoEnvioCosto || 0)
        .then((result) => {
          if (result.success) {
            setPreview(result.data)
          } else {
            setPreview(null)
          }
        })
        .catch(() => setPreview(null))
        .finally(() => setIsCalculating(false))
    } else {
      setPreview(null)
    }
  }, watchedFields)

  const onSubmit = async (data: VentaFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing ? await updateVenta(venta.id, data) : await createVenta(data)

      if (result.success) {
        toast({
          title: isEditing ? "Venta actualizada" : "Venta creada",
          description: `La venta ha sido ${isEditing ? "actualizada" : "creada"} correctamente.`,
        })
        router.push("/ventas")
      } else {
        toast({
          title: "Error",
          description: result.error || "Ocurrió un error inesperado.",
          variant: "destructive",
        })
      }
    } catch (error) {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Editar Venta" : "Nueva Venta"}</CardTitle>
            <CardDescription>
              {isEditing ? "Modifica los datos de la venta" : "Completa los datos de la nueva venta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" type="date" {...register("fecha", { valueAsDate: true })} />
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
                  <Select value={watch("metodoPago")} onValueChange={(value) => setValue("metodoPago", value as any)}>
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
                  {errors.metodoPago && <p className="text-sm text-destructive">{errors.metodoPago.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Producto</Label>
                <Select value={watch("productoId")} onValueChange={(value) => setValue("productoId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map((producto) => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.modelo} - ${Number(producto.costoUnitarioARS).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.productoId && <p className="text-sm text-destructive">{errors.productoId.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pvBruto">Precio de Venta Bruto (ARS)</Label>
                  <Input
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trackingUrl">URL de Tracking (opcional)</Label>
                  <Input id="trackingUrl" {...register("trackingUrl")} placeholder="https://..." />
                  {errors.trackingUrl && <p className="text-sm text-destructive">{errors.trackingUrl.message}</p>}
                </div>

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
                <Button type="submit" disabled={isSubmitting}>
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
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground">Calculando...</div>
              </div>
            ) : preview ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Comisión:</span>
                  <span>${preview.comision.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>IIBB:</span>
                  <span>${preview.iibb.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Precio Neto:</span>
                  <span>${preview.precioNeto.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo Producto:</span>
                  <span>${preview.costoProducto.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Margen:</span>
                  <span className={preview.ingresoMargen >= 0 ? "text-green-600" : "text-red-600"}>
                    ${preview.ingresoMargen.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rentabilidad s/PV:</span>
                  <span className={preview.rentabilidadSobrePV >= 0 ? "text-green-600" : "text-red-600"}>
                    {(preview.rentabilidadSobrePV * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rentabilidad s/Costo:</span>
                  <span className={preview.rentabilidadSobreCosto >= 0 ? "text-green-600" : "text-red-600"}>
                    {(preview.rentabilidadSobreCosto * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground">Completa los campos para ver los cálculos</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
