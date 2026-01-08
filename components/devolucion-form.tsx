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
import { devolucionSchemaWithRecoveryCheck as devolucionSchema, type DevolucionFormData, DEVOLUCION_ESTADOS } from "@/lib/validations"
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
  type LocalDevolucionForm = Omit<DevolucionFormData, 'fechaCompra' | 'fechaReclamo' | 'fechaAccion' | 'fechaCompletada'> & {
    fechaCompra: string | Date
    fechaReclamo: string | Date
    fechaAccion: string | Date
    fechaCompletada?: string | Date
    productoRecuperable?: boolean
  }


  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
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
      fechaAccion: new Date().toISOString().split('T')[0], // Siempre hoy - fecha de ejecución de la acción
    nombreContacto: (devolucion as any)?.nombreContacto ?? (devolucion as any)?.nombre_contacto ?? "",
    telefonoContacto: (devolucion as any)?.telefonoContacto ?? (devolucion as any)?.telefono_contacto ?? "",
    estado: typeof ((devolucion as any)?.estado ?? (devolucion as any)?.estado) === "string" && ((devolucion as any)?.estado ?? (devolucion as any)?.estado) ? ((devolucion as any)?.estado ?? (devolucion as any)?.estado) : "En devolución",
    motivo: (devolucion as any)?.motivo ?? (devolucion as any)?.motivo ?? "",
    observaciones: (devolucion as any)?.observaciones ?? (devolucion as any)?.observaciones ?? "",
  costoEnvioOriginal: Number((devolucion as any)?.costoEnvioOriginal ?? (devolucion as any)?.costo_envio_original ?? 0),
  // dejar undefined para que la validación requiera el valor en creación
  costoEnvioDevolucion: typeof (devolucion as any)?.costoEnvioDevolucion !== 'undefined' ? (devolucion as any).costoEnvioDevolucion : (typeof (devolucion as any)?.costo_envio_devolucion !== 'undefined' ? (devolucion as any).costo_envio_devolucion : undefined),
    costoEnvioNuevo: Number((devolucion as any)?.costoEnvioNuevo ?? (devolucion as any)?.costo_envio_nuevo ?? 0),
  // tipoResolucion removed: resolution derived from `estado`
  costoProductoOriginal: Number((devolucion as any)?.costoProductoOriginal ?? (devolucion as any)?.costo_producto_original ?? 0),
  costoProductoNuevo: Number((devolucion as any)?.costoProductoNuevo ?? (devolucion as any)?.costo_producto_nuevo ?? 0),
  montoVentaOriginal: Number((devolucion as any)?.montoVentaOriginal ?? (devolucion as any)?.monto_venta_original ?? (devolucion as any)?.montoVenta ?? 0),
  montoReembolsado: Number((devolucion as any)?.montoReembolsado ?? (devolucion as any)?.monto_reembolsado ?? 0),
  productoRecuperable: typeof (devolucion as any)?.productoRecuperable !== 'undefined' ? (devolucion as any).productoRecuperable : typeof (devolucion as any)?.producto_recuperable !== 'undefined' ? (devolucion as any).producto_recuperable : true,
      // commission fields removed from DB; derive from venta when needed
  numeroSeguimiento: devolucion?.numeroSeguimiento || (devolucion as any)?.numero_seguimiento || "",
  numeroDevolucion: devolucion?.numeroDevolucion ?? (devolucion as any)?.numero_devolucion ?? (devolucion as any)?.id_devolucion ?? "",
      // MP-related defaults (may come from existing devolucion row or venta raw)
  mpEstado: (devolucion as any)?.mpEstado ?? (devolucion as any)?.mp_estado ?? undefined,
      mpRetener: (devolucion as any)?.mpRetener ?? (devolucion as any)?.mp_retenido ?? false,
    }
  })

  // If a `devolucion` prop arrives after mount (e.g. when opening an edit modal),
  // reset the form values so the form is properly prefilled (react-hook-form
  // only uses defaultValues on the first render).
  useEffect(() => {
    if (!devolucion) return
    try {
      const v: any = devolucion
      const toNumber = (x: any) => {
        if (x === null || typeof x === 'undefined') return 0
        if (typeof x === 'number') return x
        if (typeof x === 'string') {
          // Remove currency symbols, spaces and thousands separators, allow comma as decimal
          const cleaned = String(x).replace(/\s/g, '').replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
          const n = Number(cleaned)
          return Number.isNaN(n) ? 0 : n
        }
        const n = Number(x)
        return Number.isNaN(n) ? 0 : n
      }

      const initial: any = {
        ventaId: v.ventaId ?? v.venta_id ?? v.venta?.id ?? "",
        productoNuevoId: v.productoNuevoId ?? v.producto_nuevo_id ?? undefined,
        fechaCompra: (function(){
          const val = v.fechaCompra ?? v.fecha_compra
          if (!val) return new Date().toISOString().split('T')[0]
          const d = val instanceof Date ? val : new Date(val)
          return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
        })(),
        fechaReclamo: (function(){
          const val = v.fechaReclamo ?? v.fecha_reclamo
          if (!val) return new Date().toISOString().split('T')[0]
          const d = val instanceof Date ? val : new Date(val)
          return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
        })(),
        fechaAccion: new Date().toISOString().split('T')[0], // Siempre hoy - fecha de ejecución
        nombreContacto: v.nombreContacto ?? v.nombre_contacto ?? "",
        telefonoContacto: v.telefonoContacto ?? v.telefono_contacto ?? "",
        estado: (v.estado ?? v.estado) ?? "Pendiente",
        motivo: v.motivo ?? v.motivo ?? "",
        observaciones: v.observaciones ?? v.observaciones ?? "",
  costoEnvioOriginal: toNumber(v.costoEnvioOriginal ?? v.costo_envio_original ?? 0),
  costoEnvioDevolucion: typeof v.costoEnvioDevolucion !== 'undefined' ? toNumber(v.costoEnvioDevolucion) : (typeof v.costo_envio_devolucion !== 'undefined' ? toNumber(v.costo_envio_devolucion) : undefined),
  costoEnvioNuevo: toNumber(v.costoEnvioNuevo ?? v.costo_envio_nuevo ?? 0),
  // tipoResolucion removed: resolution derived from `estado`
  costoProductoOriginal: toNumber(v.costoProductoOriginal ?? v.costo_producto_original ?? 0),
  costoProductoNuevo: toNumber(v.costoProductoNuevo ?? v.costo_producto_nuevo ?? 0),
  montoVentaOriginal: toNumber(v.montoVentaOriginal ?? v.monto_venta_original ?? v.montoVenta ?? 0),
  montoReembolsado: toNumber(v.montoReembolsado ?? v.monto_reembolsado ?? 0),
        productoRecuperable: typeof v.productoRecuperable !== 'undefined' ? v.productoRecuperable : typeof v.producto_recuperable !== 'undefined' ? v.producto_recuperable : true,
  numeroSeguimiento: v.numeroSeguimiento ?? (v as any).numero_seguimiento ?? "",
  numeroDevolucion: v.numeroDevolucion ?? (v as any).numero_devolucion ?? (v as any).id_devolucion ?? v.id ?? "",
        mpEstado: v.mpEstado ?? v.mp_estado ?? undefined,
        mpRetener: v.mpRetener ?? v.mp_retenido ?? false,
      }
      reset(initial)
    } catch (e) {
      // ignore reset errors
    }
  }, [devolucion, reset])

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
    // Auto-popular costo de envío original desde la venta (varias posibles keys en _raw)
    const envioCandidates = [
      venta.costoEnvioOriginal,
      venta._raw?.costoEnvio,
      venta._raw?.costo_envio,
      venta._raw?.cargoEnvioCosto,
      venta._raw?.cargo_envio_costo,
      venta._raw?.shippingCost,
      venta._raw?.shipping_cost,
    ]
    const envioVal = envioCandidates.find((v) => typeof v === 'number' || (typeof v === 'string' && v !== '')) ?? 0
    setValue("costoEnvioOriginal", Number(envioVal ?? 0))
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
    // If venta raw contains MP flags, propagate to form defaults
    try {
      const raw = venta._raw || venta
      if (raw.mp_estado || raw.mpEstado) setValue('mpEstado', raw.mp_estado ?? raw.mpEstado)
      if (typeof (raw.mp_retenido) !== 'undefined' || typeof (raw.mpRetener) !== 'undefined') setValue('mpRetener', Boolean(raw.mp_retenido ?? raw.mpRetener))
    } catch (e) {
      // ignore
    }
  }

  // Handler: onSubmit
  const internalOnSubmit = async (data: LocalDevolucionForm) => {
    setIsSubmittingLocal(true)
    try {
      // Si el estado final indica reembolso/cambio, exigir fechaCompletada
      const estadoFinal = data.estado && (String(data.estado).includes('Reembolso') || String(data.estado).includes('Cambio'))
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
        fechaAccion: data.fechaAccion instanceof Date ? data.fechaAccion : new Date(String(data.fechaAccion)),
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
                  {/* Fecha de compra NO debe poder cambiarse */}
                  <Input id="fechaCompra" type="date" {...register("fechaCompra", { valueAsDate: true })} disabled />
                  {errors.fechaCompra && <p className="text-sm text-destructive">{errors.fechaCompra.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaReclamo">Fecha de reclamo</Label>
                  {/* Allow editing fechaReclamo when creating a new devolución; keep locked on edit to avoid
                      changing the original claim date for historical records. */}
                  <Input id="fechaReclamo" type="date" {...register("fechaReclamo", { valueAsDate: true })} disabled={isEditing} />
                  {errors.fechaReclamo && <p className="text-sm text-destructive">{errors.fechaReclamo.message}</p>}
                </div>
                {isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="fechaAccion">Fecha de la acción</Label>
                    <p className="text-xs text-muted-foreground mb-1">Fecha en que se ejecuta el cambio (crea gastos, impacta liquidaciones, etc.)</p>
                    <Input id="fechaAccion" type="date" {...register("fechaAccion", { valueAsDate: true })} />
                    {errors.fechaAccion && <p className="text-sm text-destructive">{errors.fechaAccion.message}</p>}
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
                  <Label htmlFor="costoEnvioNuevo">Costo envío nuevo/cambio (ARS)</Label>
                  <Input id="costoEnvioNuevo" type="number" step="0.01" {...register("costoEnvioNuevo", { valueAsNumber: true })} placeholder="0.00" />
                  {errors.costoEnvioNuevo && <p className="text-sm text-destructive">{errors.costoEnvioNuevo.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroSeguimiento">Número de seguimiento</Label>
                  <Input id="numeroSeguimiento" {...register("numeroSeguimiento")} />
                  {errors.numeroSeguimiento && <p className="text-sm text-destructive">{errors.numeroSeguimiento.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numeroDevolucion">Número de devolución</Label>
                  {/* Permitimos editar el número de devolución manualmente si fuera necesario */}
                  <Input id="numeroDevolucion" {...register("numeroDevolucion")} />
                </div>
              </div>

              {/* Campos específicos de Mercado Pago / Mercado Libre */}
              {ventaSeleccionada && ((ventaSeleccionada._raw && (ventaSeleccionada._raw.plataforma === 'ML' || ventaSeleccionada._raw.metodoPago === 'MercadoPago')) || (ventaSeleccionada.plataforma === 'ML')) && (
                <div className="mt-4 p-3 border rounded bg-muted">
                  <div className="mt-2">
                    <label className="inline-flex items-center">
                      <input type="checkbox" className="mr-2" {...register('mpRetener')} />
                      <span className="text-sm">Mover monto a dinero retenido en Mercado Pago</span>
                    </label>
                  </div>
                </div>
              )}

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
                      <Label>Estado</Label>
                      {/* Mostrar el estado pero no permitir cambiarlo desde este formulario */}
                      <div className="px-3 py-2 border rounded bg-white">{watch("estado")}</div>
                      {errors.estado && <p className="text-sm text-destructive">{errors.estado.message}</p>}
                    </div>
                    {/* tipoResolucion eliminado: la resolución se deriva del estado y de la lógica del backend */}
                </div>
              )}

              {/* Preguntar si se recupera el producto cuando se seleccionó alguna resolución */}
              {/* Mostrar opción de producto recuperable cuando corresponde (editar / finalización) */}
              {isEditing && (
                <div className="mt-4 space-y-2">
                  <Label>¿Se recupera el producto?</Label>
                  <div className="flex items-center gap-3">
                    <Switch checked={!!watch('productoRecuperable')} onCheckedChange={(checked) => setValue('productoRecuperable', checked)} />
                    <span className="text-sm text-muted-foreground">Activado = Recuperable (no es pérdida). Desactivado = No recuperable (persistir costo producto como pérdida).</span>
                  </div>
                  {errors.productoRecuperable && <p className="text-sm text-destructive">{(errors.productoRecuperable as any).message}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo del reclamo</Label>
                <Select value={watch("motivo") || ""} onValueChange={(value) => setValue("motivo", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el motivo del reclamo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No enciende">No enciende</SelectItem>
                    <SelectItem value="Duración corta de batería">Duración corta de batería</SelectItem>
                    <SelectItem value="Problemas de carga">Problemas de carga</SelectItem>
                    <SelectItem value="Pantalla defectuosa">Pantalla defectuosa</SelectItem>
                    <SelectItem value="Botones no funcionan">Botones no funcionan</SelectItem>
                    <SelectItem value="Problemas de conectividad">Problemas de conectividad</SelectItem>
                    <SelectItem value="Software/Firmware defectuoso">Software/Firmware defectuoso</SelectItem>
                    <SelectItem value="Sensor defectuoso">Sensor defectuoso</SelectItem>
                    <SelectItem value="Daño físico en envío">Daño físico en envío</SelectItem>
                    <SelectItem value="Producto incorrecto enviado">Producto incorrecto enviado</SelectItem>
                    <SelectItem value="No coincide con descripción">No coincide con descripción</SelectItem>
                    <SelectItem value="Arrepentimiento del cliente">Arrepentimiento del cliente</SelectItem>
                    <SelectItem value="Defecto de fabricación">Defecto de fabricación</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
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
                        ${(() => {
                          try {
                            const costoProductoOriginal = Number(watch("costoProductoOriginal") ?? 0)
                            const productoRecuperable = !!watch('productoRecuperable')
                            const productoNuevoId = watch('productoNuevoId')
                            // Si el producto fue cambiado por uno nuevo o se marca como recuperable,
                            // no hay pérdida por costo de producto. En caso contrario, aplicar el costo original.
                            const productLoss = (productoRecuperable || productoNuevoId) ? 0 : costoProductoOriginal
                            return Number(productLoss || 0).toLocaleString()
                          } catch (e) {
                            return '0'
                          }
                        })()}
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
