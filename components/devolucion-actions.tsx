"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DevolucionForm } from "@/components/devolucion-form"
import { deleteDevolucion, getDevolucionById } from "@/lib/actions/devoluciones"
import { updateDevolucion } from "@/lib/actions/devoluciones"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface DevolucionActionsProps {
  devolucion: {
    id: string
    motivo: string
    tipoResolucion?: string
    tipo_resolucion?: string
    estado?: string
    venta?: {
      saleCode?: string
      comprador?: string
    }
  }
}

export function DevolucionActions({ devolucion }: DevolucionActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAdvance, setShowAdvance] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showRecepcion, setShowRecepcion] = useState(false)
  const [showPrueba, setShowPrueba] = useState(false)
  const [advanceType, setAdvanceType] = useState<string>("")
  const [productoRecuperable, setProductoRecuperable] = useState<boolean | null>(null)
  const [mpEstado, setMpEstado] = useState<string | null>(null)
  const [fechaCompletadaLocal, setFechaCompletadaLocal] = useState<string | null>(null)
  const [fetchedDevolucion, setFetchedDevolucion] = useState<any | null>(null)
  const [loadingDevolucion, setLoadingDevolucion] = useState(false)
  const [costoEnvioOriginalLocal, setCostoEnvioOriginalLocal] = useState<number | null>(null)
  const [costoEnvioDevolucionLocal, setCostoEnvioDevolucionLocal] = useState<number | null>(null)
  const [costoEnvioNuevoLocal, setCostoEnvioNuevoLocal] = useState<number | null>(null)
  const [costoProductoOriginalLocal, setCostoProductoOriginalLocal] = useState<number | null>(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
  
  // Estados para seguimiento de producto
  const [fechaRecepcion, setFechaRecepcion] = useState<string>('')
  const [ubicacionProducto, setUbicacionProducto] = useState<string>('')
  const [fechaPrueba, setFechaPrueba] = useState<string>('')
  const [resultadoPrueba, setResultadoPrueba] = useState<string>('')
  const [observacionesPrueba, setObservacionesPrueba] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  
  const router = useRouter()

  const handleAdvance = async () => {
    if (!advanceType) return
    setIsAdvancing(true)
    try {
  const payload: any = { tipoResolucion: advanceType }
      // marcar fecha completada y estado según tipo seleccionado
      const estadoMap: Record<string,string> = {
        'Reembolso': 'Entregada - Reembolso',
        'Cambio mismo producto': 'Entregada - Cambio mismo producto',
        'Sin reembolso': 'Entregada - Sin reembolso'
      }
      payload.estado = estadoMap[advanceType] || 'Pendiente'
      // Use user-provided fechaCompletada when available (required for both), else default to now
      if (fechaCompletadaLocal) {
        // IMPORTANTE: Agregar hora para evitar problemas de timezone (sin hora, new Date interpreta como UTC y puede cambiar el día)
        payload.fechaCompletada = new Date(fechaCompletadaLocal + 'T12:00:00')
        // Enviar fechaAccion como STRING puro para evitar conversiones de timezone
        payload.fechaAccionString = fechaCompletadaLocal // '2026-01-09' sin conversión
      } else {
        const hoy = new Date()
        payload.fechaCompletada = hoy
        payload.fechaAccion = hoy
      }
  // Incluir indicador de recuperabilidad si el usuario lo indicó
  if (productoRecuperable !== null) payload.productoRecuperable = productoRecuperable
  // Incluir desglose de envíos y costo de producto si los tenemos localmente
  if (typeof costoEnvioNuevoLocal === 'number' && costoEnvioNuevoLocal > 0) payload.costoEnvioNuevo = Number(costoEnvioNuevoLocal)
  if (typeof costoEnvioDevolucionLocal === 'number') payload.costoEnvioDevolucion = Number(costoEnvioDevolucionLocal)
  if (typeof costoProductoOriginalLocal === 'number') payload.costoProductoOriginal = Number(costoProductoOriginalLocal)
  // Ensure we persist costoEnvioOriginal: take from fetchedDevolucion or leave absent
  if (typeof costoEnvioOriginalLocal === 'number') {
    payload.costoEnvioOriginal = Number(costoEnvioOriginalLocal)
  } else if (fetchedDevolucion) {
     // Take product cost automatically from fetched devolución/venta when not provided
     payload.costoProductoOriginal = Number(fetchedDevolucion.costo_producto_original ?? fetchedDevolucion.costoProductoOriginal ?? 0)
     payload.costoEnvioOriginal = Number(fetchedDevolucion.costo_envio_original ?? fetchedDevolucion.costoEnvioOriginal ?? 0)
  }
    // Incluir estado del dinero en Mercado Pago (si el usuario lo indicó)
    if (mpEstado) payload.mpEstado = mpEstado
      
      console.log('[DevolucionActions] Enviando payload:', payload)
      console.log('[DevolucionActions] ID devolución:', devolucion.id)
      
      const result = await updateDevolucion(devolucion.id, payload)
      
      console.log('[DevolucionActions] Resultado:', result)
      
      if (result.success) {
        toast({ title: 'Devolución actualizada', description: 'Se registró la resolución.' })
        setShowAdvance(false)
        router.refresh()
      } else {
        toast({ title: 'Error', description: result.error || 'No se pudo aplicar la resolución.', variant: 'destructive' })
      }
    } catch (err) {
      console.error('[DevolucionActions] Error:', err)
      toast({ title: 'Error', description: 'Ocurrió un error al aplicar la resolución.', variant: 'destructive' })
    } finally {
      setIsAdvancing(false)
    }
  }

  const handleRecepcion = async () => {
    if (!fechaRecepcion) {
      toast({ title: 'Error', description: 'Debés ingresar la fecha de recepción', variant: 'destructive' })
      return
    }
    
    setIsProcessing(true)
    try {
      const payload: any = {
        fechaRecepcion: new Date(fechaRecepcion + 'T12:00:00'),
        ubicacionProducto: ubicacionProducto || null,
        resultadoPrueba: 'Pendiente'
      }
      
      const result = await updateDevolucion(devolucion.id, payload)
      
      if (result.success) {
        toast({ title: 'Recepción registrada', description: 'Se registró la recepción del producto.' })
        setShowRecepcion(false)
        router.refresh()
      } else {
        toast({ title: 'Error', description: result.error || 'No se pudo registrar la recepción.', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Ocurrió un error al registrar la recepción.', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrueba = async () => {
    if (!fechaPrueba || !resultadoPrueba) {
      toast({ title: 'Error', description: 'Debés completar fecha y resultado de la prueba', variant: 'destructive' })
      return
    }
    
    setIsProcessing(true)
    try {
      const payload: any = {
        fechaPrueba: new Date(fechaPrueba + 'T12:00:00'),
        resultadoPrueba,
        observacionesPrueba: observacionesPrueba || null,
        // Actualizar automáticamente producto_recuperable según el resultado
        productoRecuperable: resultadoPrueba === 'Funciona - Recuperable'
      }
      
      const result = await updateDevolucion(devolucion.id, payload)
      
      if (result.success) {
        toast({ title: 'Prueba registrada', description: 'Se registró la prueba del producto.' })
        setShowPrueba(false)
        router.refresh()
      } else {
        toast({ title: 'Error', description: result.error || 'No se pudo registrar la prueba.', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Ocurrió un error al registrar la prueba.', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  // Fetch devolucion details when opening the advance modal
  async function loadDevolucion() {
    if (!devolucion?.id) return
    setLoadingDevolucion(true)
    console.log('🔍 Cargando devolución ID:', devolucion.id)
    try {
      const d = await getDevolucionById(devolucion.id)
      console.log('✅ Devolución cargada:', d)
      setFetchedDevolucion(d)
      // Prefill local cost fields
      setCostoEnvioNuevoLocal(Number(d?.costo_envio_nuevo ?? d?.costoEnvioNuevo ?? 0))
      setCostoEnvioOriginalLocal(Number(d?.costo_envio_original ?? d?.costoEnvioOriginal ?? 0))
      setCostoEnvioDevolucionLocal(Number(d?.costo_envio_devolucion ?? d?.costoEnvioDevolucion ?? 0))
      setCostoProductoOriginalLocal(Number(d?.costo_producto_original ?? d?.costoProductoOriginal ?? 0))
      // Prefill recoverable flag
      setProductoRecuperable(typeof d?.producto_recuperable !== 'undefined' ? Boolean(d.producto_recuperable) : null)
      // Prefill fecha completada (as yyyy-mm-dd) if present
      try {
        const existingFecha = d?.fecha_completada ?? d?.fechaCompletada ?? null
        if (existingFecha) {
          const ds = new Date(existingFecha).toISOString().split('T')[0]
          setFechaCompletadaLocal(ds)
        } else {
          // default to today (not mandatory until Reembolso selected)
          const today = new Date().toISOString().split('T')[0]
          setFechaCompletadaLocal(today)
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Error al obtener devolución para edición:', err)
      toast({ 
        title: 'Error', 
        description: 'No se pudo cargar la devolución. Intenta de nuevo.',
        variant: 'destructive' 
      })
    } finally {
      setLoadingDevolucion(false)
    }
  }

  // Load data when modal opens to prefill fields
  useEffect(() => {
    if (showAdvance) {
      loadDevolucion()
    }
  }, [showAdvance])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteDevolucion(devolucion.id)
      if (result.success) {
        toast({
          title: "Devolución eliminada",
          description: "La devolución ha sido eliminada correctamente.",
        })
        setShowDeleteDialog(false)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar la devolución.",
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
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={async (open) => { if (open) await loadDevolucion(); }}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Solo mostrar 'Registrar avance' si NO tiene tipo_resolucion definido */}
          {!(devolucion.tipoResolucion || devolucion.tipo_resolucion || (devolucion.estado && (devolucion.estado.includes('Reembolso') || devolucion.estado.includes('Cambio')))) && (
            <DropdownMenuItem onClick={() => setShowAdvance(true)}>
              Registrar avance
            </DropdownMenuItem>
          )}
          
          {/* Mostrar 'Registrar Recepción' si aún no tiene fecha_recepcion (puede hacerse antes o después de completar) */}
          {!fetchedDevolucion?.fecha_recepcion && !fetchedDevolucion?.fechaRecepcion && (
            <DropdownMenuItem onClick={async () => { await loadDevolucion(); setShowRecepcion(true); }}>
              📦 Registrar Recepción
            </DropdownMenuItem>
          )}
          
          {/* Mostrar 'Registrar Prueba' si tiene recepción pero no tiene prueba (puede hacerse antes de completar) */}
          {(fetchedDevolucion?.fecha_recepcion || fetchedDevolucion?.fechaRecepcion) && (!fetchedDevolucion?.resultado_prueba || fetchedDevolucion?.resultado_prueba === 'Pendiente') && (
            <DropdownMenuItem onClick={async () => { await loadDevolucion(); setShowPrueba(true); }}>
              🔍 Registrar Prueba
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={async () => { await loadDevolucion(); setShowEditDialog(true); }}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la devolución de{" "}
              <strong>{devolucion.venta?.saleCode ?? devolucion.id}</strong> por <strong>{devolucion.motivo}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        {/* Dialog para editar devolución en modal (en lugar de navegar a página aparte) */}
        <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (open) loadDevolucion() }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Devolución</DialogTitle>
            </DialogHeader>
            {/* Pass fetchedDevolucion as the prop expected by DevolucionForm */}
            <div>
              {loadingDevolucion ? (
                <div className="p-6">Cargando...</div>
              ) : fetchedDevolucion ? (
                <DevolucionForm 
                  devolucion={fetchedDevolucion} 
                  externalIsSubmitting={isSubmittingEdit}
                  onSubmit={async (data: any) => {
                    console.log('📝 SUBMIT EXTERNO - Data recibida:', data)
                    setIsSubmittingEdit(true)
                    try {
                      const res = await updateDevolucion(devolucion.id, data)
                      if (res.success) {
                        toast({ title: 'Devolución actualizada', description: 'Cambios guardados.' })
                        setShowEditDialog(false)
                        router.refresh()
                      } else {
                        toast({ title: 'Error', description: res.error || 'No se pudo actualizar la devolución.', variant: 'destructive' })
                      }
                    } catch (err) {
                      toast({ title: 'Error', description: 'Ocurrió un error al actualizar la devolución.', variant: 'destructive' })
                    } finally {
                      setIsSubmittingEdit(false)
                    }
                  }} 
                />
              ) : (
                <div className="p-6 text-red-500">
                  Error: No se pudo cargar la devolución. ID: {devolucion.id}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      {/* Modal para registrar avance/resolución */}
      <AlertDialog open={showAdvance} onOpenChange={setShowAdvance}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar avance / Resolución</AlertDialogTitle>
            <AlertDialogDescription>Elegí la resolución y confirmá para aplicar los cambios.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4">
            <label className="block text-sm font-medium mb-2">Tipo de resolución</label>
            <select className="w-full border rounded p-2" value={advanceType} onChange={(e) => setAdvanceType(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              <option value="Reembolso">Reembolso</option>
              <option value="Cambio mismo producto">Cambio</option>
              <option value="Sin reembolso">Sin reembolso (cliente no devolvió)</option>
            </select>
            
            {/* Solo pedir envío nuevo cuando es Cambio */}
            {advanceType === 'Cambio mismo producto' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Costo envío nuevo/ida (ARS)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full border rounded p-2" 
                  value={costoEnvioNuevoLocal ?? 0} 
                  onChange={(e) => setCostoEnvioNuevoLocal(Number(e.target.value))} 
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">Costo del envío del producto nuevo/cambio (envío de ida).</p>
              </div>
            )}
            
            {/* Preguntar si se recupera el producto cuando se eligió una resolución (excepto Sin reembolso) */}
            {advanceType !== '' && advanceType !== 'Sin reembolso' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">¿Se recupera el producto?</label>
                <div className="flex items-center gap-3">
                  <input id="recuperable" type="checkbox" checked={productoRecuperable === true} onChange={(e) => setProductoRecuperable(e.target.checked)} />
                  <span className="text-sm text-muted-foreground">Marcar si el producto será recuperado (si no, se registrará como pérdida).</span>
                </div>
              </div>
            )}

            {/* Pedir la fecha de impacto para Reembolso, Cambio o Sin reembolso */}
            {(advanceType === 'Reembolso' || advanceType === 'Cambio mismo producto' || advanceType === 'Sin reembolso') && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Fecha de impacto (aplica en liquidaciones)</label>
                <input type="date" className="w-full border rounded p-2" value={fechaCompletadaLocal ?? ''} onChange={(e) => setFechaCompletadaLocal(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Fecha en la que se {advanceType === 'Sin reembolso' ? 'libera el dinero retenido (vuelve a MP disponible)' : advanceType === 'Cambio mismo producto' ? 'aplican los ajustes contables y se crea el gasto del envío nuevo' : 'aplican los ajustes contables'}.</p>
              </div>
            )}

            {/* Preguntar estado de dinero en MP: solo mostrar cuando es Reembolso y es Mercado Pago (ML o TN con MP) */}
            {advanceType === 'Reembolso' && (
              fetchedDevolucion?.plataforma === 'ML' || 
              fetchedDevolucion?.metodo_pago === 'MercadoPago' || 
              (fetchedDevolucion as any)?.metodoPago === 'MercadoPago'
            ) && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Estado del dinero en MP</label>
                <select className="w-full border rounded p-2" value={mpEstado ?? "unknown"} onChange={(e) => setMpEstado(e.target.value === 'unknown' ? null : e.target.value)}>
                  <option value="unknown">No sé / No aplica</option>
                  <option value="a_liquidar">A liquidar en MP</option>
                  <option value="liquidado">Liquidado (dinero disponible en MP)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Indica si el dinero de la venta ya estaba disponible en Mercado Pago o aún estaba en proceso de liquidación.</p>
              </div>
            )}

            {/* Los costos se toman automáticamente, no se piden en este modal */}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAdvance(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvance} disabled={isAdvancing || !fechaCompletadaLocal}>{isAdvancing ? 'Aplicando...' : 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Registrar Recepción */}
      <AlertDialog open={showRecepcion} onOpenChange={setShowRecepcion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>📦 Registrar Recepción del Producto</AlertDialogTitle>
            <AlertDialogDescription>Indicá cuándo recibiste el producto devuelto y dónde lo guardaste.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Fecha de recepción *</label>
              <input 
                type="date" 
                className="w-full border rounded p-2" 
                value={fechaRecepcion} 
                onChange={(e) => setFechaRecepcion(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground mt-1">Fecha en que recibiste físicamente el producto.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ubicación del producto</label>
              <input 
                type="text" 
                className="w-full border rounded p-2" 
                value={ubicacionProducto} 
                onChange={(e) => setUbicacionProducto(e.target.value)}
                placeholder="Ej: Estante A3, Con técnico, Depósito"
              />
              <p className="text-xs text-muted-foreground mt-1">Dónde guardaste el producto (opcional).</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRecepcion(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecepcion} disabled={isProcessing || !fechaRecepcion}>
              {isProcessing ? 'Registrando...' : 'Confirmar Recepción'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Registrar Prueba */}
      <AlertDialog open={showPrueba} onOpenChange={setShowPrueba}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🔍 Registrar Prueba del Producto</AlertDialogTitle>
            <AlertDialogDescription>Indicá el resultado de la prueba del producto devuelto.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Fecha de prueba *</label>
              <input 
                type="date" 
                className="w-full border rounded p-2" 
                value={fechaPrueba} 
                onChange={(e) => setFechaPrueba(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Resultado de la prueba *</label>
              <select 
                className="w-full border rounded p-2" 
                value={resultadoPrueba} 
                onChange={(e) => setResultadoPrueba(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                <option value="Funciona - Recuperable">✅ Funciona - Recuperable</option>
                <option value="No funciona - No recuperable">❌ No funciona - No recuperable</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">El campo producto_recuperable se actualizará automáticamente.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Observaciones de la prueba</label>
              <textarea 
                className="w-full border rounded p-2" 
                rows={3}
                value={observacionesPrueba} 
                onChange={(e) => setObservacionesPrueba(e.target.value)}
                placeholder="Detalles de qué se probó y qué se encontró..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowPrueba(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePrueba} disabled={isProcessing || !fechaPrueba || !resultadoPrueba}>
              {isProcessing ? 'Registrando...' : 'Confirmar Prueba'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
