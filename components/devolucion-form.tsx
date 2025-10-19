"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { createDevolucion, updateDevolucion, buscarVentas } from "@/lib/actions/devoluciones"
import { devolucionSchema, type DevolucionFormData, DEVOLUCION_ESTADOS, DEVOLUCION_TIPOS_RESOLUCION } from "@/lib/validations"
import { Search } from "lucide-react"

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

interface DevolucionFormProps {
  devolucion?: DevolucionFormData & {
    venta?: {
      id: string
      saleCode: string
      comprador: string
      producto: { modelo: string }
      fechaCompra: Date
      costoProductoOriginal?: number
      montoVentaOriginal?: number
      comisionOriginal?: number
    }
  }
  // Optional external submit handler (used by modal wrapper)
  onSubmit?: (data: DevolucionFormData) => Promise<void>
  // Optional external loading flag
  isSubmitting?: boolean
}

export function DevolucionForm({ devolucion, onSubmit: externalOnSubmit, isSubmitting: externalIsSubmitting }: DevolucionFormProps) {
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false)
  const [ventasBuscadas, setVentasBuscadas] = useState<any[]>([])
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any>(null)
  const [busquedaVenta, setBusquedaVenta] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const searchTimer = (useState<number | null>(null))[0] as unknown as { current?: number } | number | null
  const [productos, setProductos] = useState<any[]>([])
  const router = useRouter()
  const isEditing = !!devolucion

  // Local form type: allow date fields to be string (YYYY-MM-DD) or Date to match how inputs provide values.
  type LocalDevolucionForm = Omit<DevolucionFormData, 'fechaCompra' | 'fechaReclamo' | 'fechaCompletada'> & {
    fechaCompra: string | Date
    fechaReclamo: string | Date
    fechaCompletada: string | Date
  }


  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LocalDevolucionForm>({
    resolver: zodResolver(devolucionSchema) as unknown as Resolver<LocalDevolucionForm>,
    defaultValues: {
      ventaId: devolucion?.ventaId || "",
      productoNuevoId: devolucion?.productoNuevoId ?? undefined,
      // Use server-provided fields if available. Cast to any to read possible snake_case fields coming from DB rows.
      fechaCompra: (function(){
        const v = (devolucion as any)?.fechaCompra ?? (devolucion as any)?.fecha_compra
        if (!v) return new Date().toISOString().split('T')[0]
        const d = v instanceof Date ? v : new Date(v)
        return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
      })(),
      fechaReclamo: (function(){
        const v = (devolucion as any)?.fechaReclamo ?? (devolucion as any)?.fecha_reclamo
        if (!v) return new Date().toISOString().split('T')[0]
        const d = v instanceof Date ? v : new Date(v)
        return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
      })(),
      fechaCompletada: (function(){
        const v = (devolucion as any)?.fechaCompletada ?? (devolucion as any)?.fecha_completada
        if (!v) return new Date().toISOString().split('T')[0]
        const d = v instanceof Date ? v : new Date(v)
        return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
      })(),
      nombreContacto: devolucion?.nombreContacto || "",
      telefonoContacto: devolucion?.telefonoContacto || "",
      estado: typeof devolucion?.estado === "string" && devolucion?.estado ? devolucion.estado : "Pendiente",
      motivo: devolucion?.motivo || "",
      observaciones: devolucion?.observaciones || "",
  costoEnvioOriginal: devolucion?.costoEnvioOriginal || 0,
  // dejar undefined para que la validación requiera el valor en creación
  costoEnvioDevolucion: devolucion?.costoEnvioDevolucion ?? undefined,
      costoEnvioNuevo: devolucion?.costoEnvioNuevo || 0,
      tipoResolucion: typeof devolucion?.tipoResolucion === "string" && devolucion?.tipoResolucion ? devolucion.tipoResolucion : undefined,
      costoProductoOriginal: devolucion?.costoProductoOriginal || 0,
      costoProductoNuevo: devolucion?.costoProductoNuevo || 0,
      montoVentaOriginal: devolucion?.montoVentaOriginal || 0,
      montoReembolsado: devolucion?.montoReembolsado || 0,
      // commission fields removed from DB; derive from venta when needed
      numeroSeguimiento: devolucion?.numeroSeguimiento || "",
      numeroDevolucion: devolucion?.numeroDevolucion || "",
    }
  })

  // Auto-set dates on create: fechaReclamo = today; fechaCompra = venta.fecha or today
  useEffect(() => {
    if (!isEditing) {
      try {
        const fc = watch("fechaCompra")
        const fr = watch("fechaReclamo")
        const today = new Date().toISOString().split('T')[0]
        // Only set if not already provided
        if (!fc) setValue("fechaCompra", today)
        if (!fr) setValue("fechaReclamo", today)
      } catch (e) {
        // ignore
      }
    }
  // run on mount and whenever ventaSeleccionada changes (if user selects a venta it will override)
  }, [isEditing, ventaSeleccionada])

  // Handler: buscarVentas
  // Debounced search: se llama mientras el usuario escribe
  useEffect(() => {
    let mounted = true
    if (!busquedaVenta || !busquedaVenta.trim() || busquedaVenta.trim().length < 1) {
      setVentasBuscadas([])
      return
    }

    setIsSearching(true)
    const handle = window.setTimeout(async () => {
      try {
        const ventas = await buscarVentas(busquedaVenta)
        if (!mounted) return
        setVentasBuscadas(ventas || [])
      } catch (err) {
        console.warn('buscarVentas (debounce) error:', err)
        if (!mounted) return
        setVentasBuscadas([])
      } finally {
        if (mounted) setIsSearching(false)
      }
    }, 350)

    return () => {
      mounted = false
      clearTimeout(handle)
    }
  }, [busquedaVenta])

  // Handler: buscarVentas (invocado por el botón de búsqueda)
  const buscarVentasHandler = async () => {
    if (!busquedaVenta || !busquedaVenta.trim() || busquedaVenta.trim().length < 2) {
      setVentasBuscadas([])
      return
    }

    setIsSearching(true)
    try {
      const ventas = await buscarVentas(busquedaVenta)
      setVentasBuscadas(ventas || [])
    } catch (err) {
      console.error('buscarVentasHandler error:', err)
      toast({
        title: 'Error',
        description: 'No se pudieron buscar las ventas.',
        variant: 'destructive',
      })
      setVentasBuscadas([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handler: seleccionarVenta
  const seleccionarVenta = (venta: any) => {
    setVentaSeleccionada(venta)
    setValue("ventaId", venta.id)
    // Prefer normalized `fecha` from the search result; fall back to venta.fechaCompra or today
  const rawFecha = venta.fecha ?? venta.fechaCompra ?? venta._raw?.fecha ?? null
  const parsed = rawFecha ? new Date(rawFecha) : null
  const fechaParaSetear = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  setValue("fechaCompra", fechaParaSetear)
    if (venta.comprador) setValue("nombreContacto", venta.comprador)
    // Auto-popular campos financieros desde la venta (no pedir manualmente)
    if (venta.costoProductoOriginal ?? venta._raw?.costoProducto) setValue("costoProductoOriginal", venta.costoProductoOriginal ?? venta._raw?.costoProducto ?? 0)
    if (venta.montoVentaOriginal ?? venta._raw?.montoTotal) setValue("montoVentaOriginal", venta.montoVentaOriginal ?? venta._raw?.montoTotal ?? venta.pvBruto ?? 0)
  // commission is no longer stored on devoluciones; derive from venta when needed
  // También setear fecha de reclamo hoy por defecto cuando se selecciona la venta
  setValue("fechaReclamo", new Date().toISOString().split('T')[0])
    // generar numero de devolucion temporal si no existe
    try {
      const actual = watch("numeroDevolucion")
      if (!actual) {
        const gen = `DEV-${Date.now().toString().slice(-6)}`
        setValue("numeroDevolucion", gen)
      }
    } catch (e) {}
    setVentasBuscadas([])
  }

  // Handler: onSubmit
  const internalOnSubmit = async (data: LocalDevolucionForm) => {
    setIsSubmittingLocal(true)
    try {
      // Si el formulario indica una resolución final, exigir fechaCompletada
      const tipoRes = data.tipoResolucion
      const estadoFinal = tipoRes && (String(tipoRes).includes('Reembolso') || String(tipoRes).includes('Cambio'))
      if (estadoFinal && (!data.fechaCompletada || String(data.fechaCompletada).trim() === '')) {
        toast({ title: 'Fecha requerida', description: 'Debes indicar la fecha contable de resolución antes de finalizar la devolución.', variant: 'destructive' })
        setIsSubmittingLocal(false)
        return
      }
      // Ensure date fields are Date objects before sending to server actions
      const payload: DevolucionFormData = {
        ...data as any,
        fechaCompra: data.fechaCompra instanceof Date ? data.fechaCompra : new Date(String(data.fechaCompra)),
        fechaReclamo: data.fechaReclamo instanceof Date ? data.fechaReclamo : new Date(String(data.fechaReclamo)),
        fechaCompletada: data.fechaCompletada instanceof Date ? data.fechaCompletada : new Date(String(data.fechaCompletada)),
      }

      const result = isEditing && devolucion && 'id' in devolucion ? await updateDevolucion((devolucion as any).id, payload) : await createDevolucion(payload)
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
      setIsSubmittingLocal(false)
    }
  }

  // choose which submit handler and loading flag to use
  const usingExternal = typeof externalOnSubmit === "function"
  const onSubmit = usingExternal ? externalOnSubmit : internalOnSubmit
  const isSubmitting = externalIsSubmitting ?? isSubmittingLocal

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
            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
              {/* Búsqueda y selección de venta */}
              {!isEditing && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="busquedaVenta">Buscar Venta</Label>
                    <div className="flex gap-2">
                      <Input
                          id="busquedaVenta"
                          value={busquedaVenta}
                          onChange={(e) => { setBusquedaVenta(e.target.value); setVentaSeleccionada(null) }}
                          placeholder="Código de venta, ID externo o comprador..."
                          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                        />
                      <Button type="button" onClick={buscarVentasHandler}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(ventasBuscadas.length > 0 || isSearching) && (
                    <div className="space-y-2">
                      <Label>Ventas Encontradas</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {isSearching && (
                          <div className="p-3 border rounded text-sm text-muted-foreground">Buscando...</div>
                        )}
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

              {/* Campos principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaCompra">Fecha de compra</Label>
                  <Input id="fechaCompra" type="date" {...register("fechaCompra", { valueAsDate: true })} disabled={!isEditing} />
                  {errors.fechaCompra && <p className="text-sm text-destructive">{errors.fechaCompra.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaReclamo">Fecha de reclamo</Label>
                  <Input id="fechaReclamo" type="date" {...register("fechaReclamo", { valueAsDate: true })} disabled={!isEditing} />
                  {errors.fechaReclamo && <p className="text-sm text-destructive">{errors.fechaReclamo.message}</p>}
                </div>
                {isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="fechaCompletada">Fecha completada</Label>
                    <Input id="fechaCompletada" type="date" {...register("fechaCompletada", { valueAsDate: true })} />
                    {errors.fechaCompletada && <p className="text-sm text-destructive">{errors.fechaCompletada.message}</p>}
                  </div>
                )}
              </div>

              {/* Datos de envío y tracking requeridos en la creación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costoEnvioDevolucion">Costo envío devolución (ARS)</Label>
                  <Input id="costoEnvioDevolucion" type="number" step="0.01" {...register("costoEnvioDevolucion", { valueAsNumber: true })} placeholder="0.00" />
                  {errors.costoEnvioDevolucion && <p className="text-sm text-destructive">{errors.costoEnvioDevolucion.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroSeguimiento">Número de seguimiento</Label>
                  <Input id="numeroSeguimiento" {...register("numeroSeguimiento")} />
                  {errors.numeroSeguimiento && <p className="text-sm text-destructive">{errors.numeroSeguimiento.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroDevolucion">Número de devolución</Label>
                  <Input id="numeroDevolucion" {...register("numeroDevolucion")} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreContacto">Nombre contacto</Label>
                  <Input id="nombreContacto" {...register("nombreContacto")} />
                  {errors.nombreContacto && <p className="text-sm text-destructive">{errors.nombreContacto.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefonoContacto">Teléfono contacto</Label>
                  <Input id="telefonoContacto" {...register("telefonoContacto")} />
                  {errors.telefonoContacto && <p className="text-sm text-destructive">{errors.telefonoContacto.message}</p>}
                </div>
              </div>

              {isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select value={watch("estado")} onValueChange={(value) => setValue("estado", value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVOLUCION_ESTADOS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.estado && <p className="text-sm text-destructive">{errors.estado.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipoResolucion">Tipo de resolución</Label>
                    <Select value={watch("tipoResolucion") ?? "__none"} onValueChange={(value) => setValue("tipoResolucion", value === "__none" ? undefined : (value as any))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona resolución" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sin resolución</SelectItem>
                        {DEVOLUCION_TIPOS_RESOLUCION.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.tipoResolucion && <p className="text-sm text-destructive">{errors.tipoResolucion.message}</p>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Input id="motivo" {...register("motivo")} placeholder="Producto defectuoso, no conforme..." />
                {errors.motivo && <p className="text-sm text-destructive">{errors.motivo.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea id="observaciones" {...register("observaciones")} placeholder="Notas adicionales sobre la devolución..." rows={3} />
              </div>

              {/* Ocultamos los campos financieros del formulario.
                  Solo se mostrará el 'dinero a liquidar' en el panel de Venta Seleccionada. */}

              {/* Selector de producto nuevo */}
              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="productoNuevoId">Producto nuevo (si corresponde)</Label>
                  <Select value={watch("productoNuevoId") ?? "__none"} onValueChange={(value) => setValue("productoNuevoId", value === "__none" ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona producto nuevo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin cambio de producto</SelectItem>
                      {productos.map((prod) => (
                        <SelectItem key={prod.id} value={prod.id}>{prod.modelo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Impacto contable visual */}
              <div className="mt-6 p-4 bg-muted rounded">
                <div className="font-semibold mb-2">Impacto contable estimado</div>
                {!isEditing ? (
                  // On create: only show the shipping cost that is immediately applied
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Gasto envío ida (no recuperable):</span>
                      <div className="text-lg font-bold text-destructive">
                        ${Number(watch("costoEnvioOriginal") ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Gasto envío vuelta (devolución):</span>
                      <div className="text-lg font-bold text-destructive">
                        ${Number(watch("costoEnvioDevolucion") ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total aplicado hoy (envío vuelta):</span>
                      <div className="text-lg font-bold text-destructive">
                        ${Number(watch("costoEnvioDevolucion") ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  // On edit/finalization: show shipping + potential product cost loss
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Gasto envío:</span>
                      <div className="text-lg font-bold text-destructive">
                        ${Number(watch("costoEnvioDevolucion") ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Costo producto (si se pierde):</span>
                      <div className="text-lg font-bold">
                        ${Number(watch("costoProductoOriginal") ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-6">
                <Button type="submit" disabled={isSubmitting || (!isEditing && (!ventaSeleccionada || typeof watch("costoEnvioDevolucion") === 'undefined' || watch("costoEnvioDevolucion") === null))}>
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
                <span className="font-medium">Dinero a liquidar (estimado):</span>
                <div className="text-lg font-bold">
                  ${(() => {
                    try {
                      const raw = ventaSeleccionada._raw || ventaSeleccionada
                      const pvBruto = Number(raw.pvBruto ?? raw.montoTotal ?? raw.pv_bruto ?? 0)
                      const comision = Number(raw.comision ?? raw.comisionPlataforma ?? 0)
                      const iva = Number(raw.iva ?? 0)
                      const iibb = Number(raw.iibb ?? 0)
                      const cargoEnvio = Number(raw.cargoEnvioCosto ?? raw.cargoEnvio ?? raw.cargo_envio_costo ?? 0)
                      const plataforma = raw.plataforma || ventaSeleccionada.plataforma || null
                      const monto = pvBruto - comision - iva - iibb - (plataforma === 'ML' ? cargoEnvio : 0)
                      return Number(monto || 0).toLocaleString()
                    } catch (e) {
                      return '0'
                    }
                  })()}
                </div>
              </div>
              <div>
                <span className="font-medium">Fecha:</span>
                <div>
                  {(() => {
                    const raw = ventaSeleccionada.fecha ?? ventaSeleccionada._raw?.fecha ?? null
                    const d = raw ? new Date(raw) : null
                    if (d && !isNaN(d.getTime())) return d.toLocaleDateString()
                    // fallback to fechaCompra field in the form
                    try {
                      const fc = watch("fechaCompra")
                      const df = fc instanceof Date ? fc : fc ? new Date(fc) : null
                      if (df && !isNaN(df.getTime())) return df.toLocaleDateString()
                    } catch (e) {}
                    return "-"
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
