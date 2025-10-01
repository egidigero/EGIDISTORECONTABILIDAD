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
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { createDevolucion, updateDevolucion, buscarVentas } from "@/lib/actions/devoluciones"
import { devolucionSchema, type DevolucionFormData } from "@/lib/validations"
import { Search, AlertCircle, Package, Truck, DollarSign, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const estadosOptions = [
  { value: "Pendiente", label: "Pendiente", description: "Reclamo recibido, por analizar" },
  { value: "Aceptada en camino", label: "Aceptada en camino", description: "Etiqueta generada, producto en tránsito" },
  { value: "Entregada - Reembolso", label: "Entregada - Reembolso", description: "Completada con reembolso" },
  { value: "Entregada - Cambio mismo producto", label: "Entregada - Cambio mismo producto", description: "Completada con cambio" },
  { value: "Entregada - Cambio otro producto", label: "Entregada - Cambio otro producto", description: "Completada con cambio a otro modelo" },
  { value: "Entregada - Sin reembolso", label: "Entregada - Sin reembolso", description: "Completada sin devolver dinero" },
  { value: "Rechazada", label: "Rechazada", description: "Devolución no aceptada" },
]

const tipoResolucionOptions = [
  { value: "Reembolso", label: "Reembolso" },
  { value: "Cambio mismo producto", label: "Cambio mismo producto" },
  { value: "Cambio otro producto", label: "Cambio otro producto" },
  { value: "Sin reembolso", label: "Sin reembolso" },
]

interface DevolucionFormProps {
  devolucion?: any
}

export function DevolucionFormNew({ devolucion }: DevolucionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ventasBuscadas, setVentasBuscadas] = useState<any[]>([])
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any>(null)
  const [busquedaVenta, setBusquedaVenta] = useState("")
  const [mostrarBusqueda, setMostrarBusqueda] = useState(true)
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
          ventaId: devolucion.venta_id,
          productoNuevoId: devolucion.producto_nuevo_id,
          fechaCompra: new Date(devolucion.fecha_compra),
          fechaReclamo: new Date(devolucion.fecha_reclamo),
          fechaCompletada: devolucion.fecha_completada ? new Date(devolucion.fecha_completada) : undefined,
          nombreContacto: devolucion.nombre_contacto || "",
          telefonoContacto: devolucion.telefono_contacto || "",
          motivo: devolucion.motivo,
          plataforma: devolucion.plataforma,
          estado: devolucion.estado,
          tipoResolucion: devolucion.tipo_resolucion,
          costoProductoOriginal: Number(devolucion.costo_producto_original),
          costoProductoNuevo: Number(devolucion.costo_producto_nuevo || 0),
          productoRecuperable: devolucion.producto_recuperable,
          costoEnvioOriginal: Number(devolucion.costo_envio_original),
          costoEnvioDevolucion: Number(devolucion.costo_envio_devolucion || 0),
          costoEnvioNuevo: Number(devolucion.costo_envio_nuevo || 0),
          montoVentaOriginal: Number(devolucion.monto_venta_original),
          montoReembolsado: Number(devolucion.monto_reembolsado || 0),
          comisionOriginal: Number(devolucion.comision_original),
          comisionDevuelta: devolucion.comision_devuelta,
          observaciones: devolucion.observaciones || "",
        }
      : {
          fechaReclamo: new Date(),
          estado: "Pendiente",
          costoProductoOriginal: 0,
          costoProductoNuevo: 0,
          productoRecuperable: false,
          costoEnvioOriginal: 0,
          costoEnvioDevolucion: 0,
          costoEnvioNuevo: 0,
          montoVentaOriginal: 0,
          montoReembolsado: 0,
          comisionOriginal: 0,
          comisionDevuelta: false,
        },
  })

  const estadoActual = watch("estado")
  const tipoResolucion = watch("tipoResolucion")
  const esEstadoEntregada = estadoActual?.startsWith("Entregada")
  const esReembolso = tipoResolucion === "Reembolso"
  const esCambio = tipoResolucion?.startsWith("Cambio")
  const esCambioOtroProducto = tipoResolucion === "Cambio otro producto"

  // Cargar venta si estamos editando
  useEffect(() => {
    if (devolucion?.ventas) {
      setVentaSeleccionada(devolucion.ventas)
      setBusquedaVenta(devolucion.ventas.saleCode)
      setMostrarBusqueda(false)
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
        description: "No se pudieron buscar las ventas",
        variant: "destructive",
      })
    }
  }

  const seleccionarVenta = (venta: any) => {
    setVentaSeleccionada(venta)
    setValue("ventaId", venta.id)
    setValue("plataforma", venta.plataforma)
    setValue("fechaCompra", new Date(venta.fecha))
    setValue("costoProductoOriginal", Number(venta.costoProducto || 0))
    setValue("costoEnvioOriginal", Number(venta.cargoEnvioCosto || 0))
    setValue("montoVentaOriginal", Number(venta.pvBruto || 0))
    setValue("comisionOriginal", Number(venta.comision || 0) + Number(venta.iva || 0) + Number(venta.iibb || 0))
    setMostrarBusqueda(false)
    setVentasBuscadas([])
    setBusquedaVenta(venta.saleCode)
  }

  const onSubmit = async (data: DevolucionFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing
        ? await updateDevolucion(devolucion.id, data)
        : await createDevolucion(data)

      if (result.success) {
        toast({
          title: isEditing ? "Devolución actualizada" : "Devolución creada",
          description: `La devolución ha sido ${isEditing ? "actualizada" : "creada"} correctamente.`,
        })
        router.push("/devoluciones")
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo procesar la devolución",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Búsqueda de venta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Venta a devolver
              </CardTitle>
              <CardDescription>
                Busca la venta original por código, comprador o ID externo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!ventaSeleccionada || mostrarBusqueda ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código de venta, comprador..."
                      value={busquedaVenta}
                      onChange={(e) => setBusquedaVenta(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarVentasHandler())}
                    />
                    <Button type="button" onClick={buscarVentasHandler}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>

                  {ventasBuscadas.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                      {ventasBuscadas.map((venta) => (
                        <button
                          key={venta.id}
                          type="button"
                          onClick={() => seleccionarVenta(venta)}
                          className="w-full p-3 hover:bg-accent text-left transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>
                              <div className="font-medium mt-1">{venta.comprador}</div>
                              <div className="text-sm text-muted-foreground">
                                {venta.productos?.modelo} - ${Number(venta.pvBruto).toLocaleString()}
                              </div>
                            </div>
                            <Badge variant="secondary">{venta.plataforma}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {errors.ventaId && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.ventaId.message}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="border rounded-lg p-4 bg-accent/50">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background px-2 py-1 rounded">{ventaSeleccionada.saleCode}</code>
                        <Badge variant="secondary">{ventaSeleccionada.plataforma}</Badge>
                      </div>
                      <div className="font-medium">{ventaSeleccionada.comprador}</div>
                      <div className="text-sm text-muted-foreground">
                        {ventaSeleccionada.productos?.modelo}
                      </div>
                      <div className="text-sm">
                        PV: <span className="font-semibold">${Number(ventaSeleccionada.pvBruto).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVentaSeleccionada(null)
                        setMostrarBusqueda(true)
                        setValue("ventaId", "")
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Información del reclamo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información del reclamo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaReclamo">Fecha de reclamo *</Label>
                  <Input
                    id="fechaReclamo"
                    type="date"
                    {...register("fechaReclamo", { valueAsDate: true })}
                  />
                  {errors.fechaReclamo && (
                    <p className="text-sm text-destructive">{errors.fechaReclamo.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select value={estadoActual} onValueChange={(value) => setValue("estado", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.estado && <p className="text-sm text-destructive">{errors.estado.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo *</Label>
                <Textarea
                  id="motivo"
                  {...register("motivo")}
                  placeholder="Ej: Producto defectuoso, no le gustó, error de envío..."
                  rows={2}
                />
                {errors.motivo && <p className="text-sm text-destructive">{errors.motivo.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreContacto">Nombre de contacto</Label>
                  <Input id="nombreContacto" {...register("nombreContacto")} placeholder="Nombre del cliente" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefonoContacto">Teléfono de contacto</Label>
                  <Input
                    id="telefonoContacto"
                    {...register("telefonoContacto")}
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Costos de envío */}
          {(estadoActual === "Aceptada en camino" || esEstadoEntregada) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Costos de envío
                </CardTitle>
                <CardDescription>
                  Costos de envío relacionados con la devolución
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costoEnvioOriginal">Envío original</Label>
                    <Input
                      id="costoEnvioOriginal"
                      type="number"
                      step="0.01"
                      {...register("costoEnvioOriginal", { valueAsNumber: true })}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Auto-completado de la venta</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costoEnvioDevolucion">Envío de devolución</Label>
                    <Input
                      id="costoEnvioDevolucion"
                      type="number"
                      step="0.01"
                      {...register("costoEnvioDevolucion", { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Lo que pagaste por el retorno</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costoEnvioNuevo">Envío nuevo (si cambio)</Label>
                    <Input
                      id="costoEnvioNuevo"
                      type="number"
                      step="0.01"
                      {...register("costoEnvioNuevo", { valueAsNumber: true })}
                      placeholder="0.00"
                      disabled={!esCambio}
                    />
                    <p className="text-xs text-muted-foreground">Si enviaste un producto nuevo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. Resolución */}
          {esEstadoEntregada && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Resolución de la devolución
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tipoResolucion">Tipo de resolución *</Label>
                  <Select value={tipoResolucion} onValueChange={(value) => setValue("tipoResolucion", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="¿Cómo se resolvió?" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoResolucionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipoResolucion && (
                    <p className="text-sm text-destructive">{errors.tipoResolucion.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaCompletada">Fecha de completada</Label>
                  <Input
                    id="fechaCompletada"
                    type="date"
                    {...register("fechaCompletada", { valueAsDate: true })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costoProductoOriginal">Costo producto devuelto</Label>
                    <Input
                      id="costoProductoOriginal"
                      type="number"
                      step="0.01"
                      {...register("costoProductoOriginal", { valueAsNumber: true })}
                      className="bg-muted"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">Auto-completado de la venta</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costoProductoNuevo">Costo producto nuevo (si cambio)</Label>
                    <Input
                      id="costoProductoNuevo"
                      type="number"
                      step="0.01"
                      {...register("costoProductoNuevo", { valueAsNumber: true })}
                      placeholder="0.00"
                      disabled={!esCambio}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="productoRecuperable"
                    checked={watch("productoRecuperable")}
                    onCheckedChange={(checked) => setValue("productoRecuperable", checked)}
                  />
                  <Label htmlFor="productoRecuperable">Producto devuelto es recuperable (se puede revender)</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. Impacto financiero */}
          {esEstadoEntregada && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Impacto financiero
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montoVentaOriginal">Monto venta original</Label>
                    <Input
                      id="montoVentaOriginal"
                      type="number"
                      step="0.01"
                      {...register("montoVentaOriginal", { valueAsNumber: true })}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="montoReembolsado">Monto reembolsado</Label>
                    <Input
                      id="montoReembolsado"
                      type="number"
                      step="0.01"
                      {...register("montoReembolsado", { valueAsNumber: true })}
                      placeholder="0.00"
                      disabled={!esReembolso}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comisionOriginal">Comisión original (Total)</Label>
                    <Input
                      id="comisionOriginal"
                      type="number"
                      step="0.01"
                      {...register("comisionOriginal", { valueAsNumber: true })}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Comisión + IVA + IIBB</p>
                  </div>

                  <div className="space-y-2 flex items-end">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="comisionDevuelta"
                        checked={watch("comisionDevuelta")}
                        onCheckedChange={(checked) => setValue("comisionDevuelta", checked)}
                      />
                      <Label htmlFor="comisionDevuelta">¿La plataforma devolvió la comisión?</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6. Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("observaciones")}
                placeholder="Notas adicionales sobre la devolución..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting || (!isEditing && !ventaSeleccionada)}>
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar Devolución" : "Crear Devolución"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/devoluciones")}>
              Cancelar
            </Button>
          </div>
        </div>

        {/* Sidebar con resumen */}
        <div className="space-y-4">
          {ventaSeleccionada && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen de venta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Código:</span>
                  <div className="font-mono text-xs mt-1">{ventaSeleccionada.saleCode}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Comprador:</span>
                  <div className="font-medium">{ventaSeleccionada.comprador}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Producto:</span>
                  <div>{ventaSeleccionada.productos?.modelo}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">PV Bruto:</span>
                  <div className="font-semibold">${Number(ventaSeleccionada.pvBruto).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Costo producto:</span>
                  <div>${Number(ventaSeleccionada.costoProducto).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Envío original:</span>
                  <div>${Number(ventaSeleccionada.cargoEnvioCosto).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {devolucion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ID Devolución</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{devolucion.id_devolucion}</div>
                <p className="text-xs text-muted-foreground mt-1">Usar como etiqueta en WhatsApp</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Ayuda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div>
                <strong>Pendiente:</strong> Registro inicial del reclamo
              </div>
              <div>
                <strong>Aceptada en camino:</strong> Generar etiqueta y agregar costo de devolución
              </div>
              <div>
                <strong>Entregada:</strong> Completar con tipo de resolución e impacto financiero
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
