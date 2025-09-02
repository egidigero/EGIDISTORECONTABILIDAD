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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { createDevolucion, updateDevolucion, buscarVentas } from "@/lib/actions/devoluciones"
import { devolucionSchema, type DevolucionFormData } from "@/lib/validations"
import { Search } from "lucide-react"

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

interface DevolucionFormProps {
  devolucion?: {
    id: string
    fecha: Date
    ventaId: string
    plataforma: string
    motivo: string
    estado: string
    montoDevuelto: number
    costoEnvioIda: number
    costoEnvioVuelta: number
    recuperoProducto: boolean
    observaciones?: string | null
    venta: {
      saleCode: string
      comprador: string
      producto: {
        modelo: string
      }
    }
  }
}

export function DevolucionForm({ devolucion }: DevolucionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ventasBuscadas, setVentasBuscadas] = useState<any[]>([])
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any>(null)
  const [busquedaVenta, setBusquedaVenta] = useState("")
  const router = useRouter()
  const isEditing = !!devolucion

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DevolucionFormData>({
    resolver: zodResolver(devolucionSchema),
    defaultValues: devolucion
      ? {
          fecha: new Date(devolucion.fecha),
          ventaId: devolucion.ventaId,
          plataforma: devolucion.plataforma as any,
          motivo: devolucion.motivo,
          estado: devolucion.estado,
          montoDevuelto: Number(devolucion.montoDevuelto),
          costoEnvioIda: Number(devolucion.costoEnvioIda),
          costoEnvioVuelta: Number(devolucion.costoEnvioVuelta),
          recuperoProducto: devolucion.recuperoProducto,
          observaciones: devolucion.observaciones || "",
        }
      : {
          fecha: new Date(),
          montoDevuelto: 0,
          costoEnvioIda: 0,
          costoEnvioVuelta: 0,
          recuperoProducto: false,
        },
  })

  // Cargar venta si estamos editando
  useEffect(() => {
    if (devolucion) {
      setVentaSeleccionada(devolucion.venta)
      setBusquedaVenta(devolucion.venta.saleCode)
    }
  }, [devolucion])

  const buscarVentasHandler = async () => {
    if (!busquedaVenta.trim()) return

    try {
      const ventas = await buscarVentas(busquedaVenta)
      setVentasBuscadas(ventas)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron buscar las ventas.",
        variant: "destructive",
      })
    }
  }

  const seleccionarVenta = (venta: any) => {
    setVentaSeleccionada(venta)
    setValue("ventaId", venta.id)
    setValue("plataforma", venta.plataforma)
    setVentasBuscadas([])
  }

  const onSubmit = async (data: DevolucionFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing ? await updateDevolucion(devolucion.id, data) : await createDevolucion(data)

      if (result.success) {
        toast({
          title: isEditing ? "Devolución actualizada" : "Devolución creada",
          description: `La devolución ha sido ${isEditing ? "actualizada" : "creada"} correctamente.`,
        })
        router.push("/devoluciones")
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
            <CardTitle>{isEditing ? "Editar Devolución" : "Nueva Devolución"}</CardTitle>
            <CardDescription>
              {isEditing
                ? "Modifica los datos de la devolución"
                : "Registra una nueva devolución vinculada a una venta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {!isEditing && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="busquedaVenta">Buscar Venta</Label>
                    <div className="flex gap-2">
                      <Input
                        id="busquedaVenta"
                        value={busquedaVenta}
                        onChange={(e) => setBusquedaVenta(e.target.value)}
                        placeholder="Código de venta, ID externo o comprador..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarVentasHandler())}
                      />
                      <Button type="button" onClick={buscarVentasHandler}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {ventasBuscadas.length > 0 && (
                    <div className="space-y-2">
                      <Label>Ventas Encontradas</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {ventasBuscadas.map((venta) => (
                          <div
                            key={venta.id}
                            className="p-3 border rounded cursor-pointer hover:bg-muted"
                            onClick={() => seleccionarVenta(venta)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>
                                <div className="text-sm font-medium">{venta.comprador}</div>
                                <div className="text-xs text-muted-foreground">{venta.producto.modelo}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ${Number(venta.pvBruto).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" type="date" {...register("fecha", { valueAsDate: true })} />
                  {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
                </div>

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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo</Label>
                  <Input id="motivo" {...register("motivo")} placeholder="Producto defectuoso, no conforme..." />
                  {errors.motivo && <p className="text-sm text-destructive">{errors.motivo.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input id="estado" {...register("estado")} placeholder="Procesando, Completada, Rechazada..." />
                  {errors.estado && <p className="text-sm text-destructive">{errors.estado.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="montoDevuelto">Monto Devuelto (ARS)</Label>
                  <Input
                    id="montoDevuelto"
                    type="number"
                    step="0.01"
                    {...register("montoDevuelto", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.montoDevuelto && <p className="text-sm text-destructive">{errors.montoDevuelto.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costoEnvioIda">Costo Envío Ida (ARS)</Label>
                  <Input
                    id="costoEnvioIda"
                    type="number"
                    step="0.01"
                    {...register("costoEnvioIda", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.costoEnvioIda && <p className="text-sm text-destructive">{errors.costoEnvioIda.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costoEnvioVuelta">Costo Envío Vuelta (ARS)</Label>
                  <Input
                    id="costoEnvioVuelta"
                    type="number"
                    step="0.01"
                    {...register("costoEnvioVuelta", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.costoEnvioVuelta && (
                    <p className="text-sm text-destructive">{errors.costoEnvioVuelta.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="recuperoProducto"
                  checked={watch("recuperoProducto")}
                  onCheckedChange={(checked) => setValue("recuperoProducto", checked)}
                />
                <Label htmlFor="recuperoProducto">Producto recuperado</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea
                  id="observaciones"
                  {...register("observaciones")}
                  placeholder="Notas adicionales sobre la devolución..."
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting || (!isEditing && !ventaSeleccionada)}>
                  {isSubmitting
                    ? isEditing
                      ? "Actualizando..."
                      : "Creando..."
                    : isEditing
                      ? "Actualizar Devolución"
                      : "Crear Devolución"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/devoluciones")}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        {ventaSeleccionada && (
          <Card>
            <CardHeader>
              <CardTitle>Venta Seleccionada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Código:</span>
                <div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{ventaSeleccionada.saleCode}</code>
                </div>
              </div>
              <div>
                <span className="font-medium">Comprador:</span>
                <div>{ventaSeleccionada.comprador}</div>
              </div>
              <div>
                <span className="font-medium">Producto:</span>
                <div>{ventaSeleccionada.producto.modelo}</div>
              </div>
              <div>
                <span className="font-medium">Precio de Venta:</span>
                <div>${Number(ventaSeleccionada.pvBruto).toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium">Fecha:</span>
                <div>{new Date(ventaSeleccionada.fecha).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
