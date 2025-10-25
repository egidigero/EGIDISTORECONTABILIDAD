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
  const [advanceType, setAdvanceType] = useState<string>("")
  const [productoRecuperable, setProductoRecuperable] = useState<boolean | null>(null)
  const [mpEstado, setMpEstado] = useState<string | null>(null)
  const [fechaCompletadaLocal, setFechaCompletadaLocal] = useState<string | null>(null)
  const [fetchedDevolucion, setFetchedDevolucion] = useState<any | null>(null)
  const [loadingDevolucion, setLoadingDevolucion] = useState(false)
  const [costoEnvioOriginalLocal, setCostoEnvioOriginalLocal] = useState<number | null>(null)
  const [costoEnvioDevolucionLocal, setCostoEnvioDevolucionLocal] = useState<number | null>(null)
  const [costoProductoOriginalLocal, setCostoProductoOriginalLocal] = useState<number | null>(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
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
        'Cambio otro producto': 'Entregada - Cambio otro producto',
        'Sin reembolso': 'Entregada - Sin reembolso'
      }
      payload.estado = estadoMap[advanceType] || 'Pendiente'
      // Use user-provided fechaCompletada when available (required for Reembolso), else default to now
      if (fechaCompletadaLocal) {
        payload.fechaCompletada = new Date(fechaCompletadaLocal)
      } else {
        payload.fechaCompletada = new Date()
      }
  // Incluir indicador de recuperabilidad si el usuario lo indicó
  if (productoRecuperable !== null) payload.productoRecuperable = productoRecuperable
  // Incluir desglose de envíos y costo de producto si los tenemos localmente
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
      const result = await updateDevolucion(devolucion.id, payload)
      if (result.success) {
        toast({ title: 'Devolución actualizada', description: 'Se registró la resolución.' })
        setShowAdvance(false)
      } else {
        toast({ title: 'Error', description: result.error || 'No se pudo aplicar la resolución.', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Ocurrió un error al aplicar la resolución.', variant: 'destructive' })
    } finally {
      setIsAdvancing(false)
    }
  }

  // Fetch devolucion details when opening the advance modal
  async function loadDevolucion() {
    if (!devolucion?.id) return
    setLoadingDevolucion(true)
    try {
      const d = await getDevolucionById(devolucion.id)
      setFetchedDevolucion(d)
      // Prefill local cost fields
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
      console.warn('No se pudo obtener devolución para el modal de avance', err)
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowAdvance(true)}>
            Registrar avance
          </DropdownMenuItem>
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
              ) : (
                <DevolucionForm devolucion={fetchedDevolucion} onSubmit={async (data: any) => {
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
                }
              }} />
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
              <option value="Cambio mismo producto">Cambio mismo producto</option>
              <option value="Cambio otro producto">Cambio otro producto</option>
              <option value="Sin reembolso">Sin reembolso</option>
            </select>
            {/* Preguntar si se recupera el producto cuando se eligió una resolución */}
            {advanceType !== '' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">¿Se recupera el producto?</label>
                <div className="flex items-center gap-3">
                  <input id="recuperable" type="checkbox" checked={productoRecuperable === true} onChange={(e) => setProductoRecuperable(e.target.checked)} />
                  <span className="text-sm text-muted-foreground">Marcar si el producto será recuperado (si no, se registrará como pérdida).</span>
                </div>
              </div>
            )}

            {/* Si es Reembolso, pedir la fecha de impacto que se aplicará en liquidaciones */}
            {advanceType === 'Reembolso' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Fecha de impacto (aplica en liquidaciones)</label>
                <input type="date" className="w-full border rounded p-2" value={fechaCompletadaLocal ?? ''} onChange={(e) => setFechaCompletadaLocal(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Elige la fecha en la que quieres que se apliquen los ajustes contables en las liquidaciones.</p>
              </div>
            )}

            {/* Preguntar estado de dinero en MP (solo para ML) */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Estado del dinero en MP</label>
              <select className="w-full border rounded p-2" value={mpEstado ?? "unknown"} onChange={(e) => setMpEstado(e.target.value === 'unknown' ? null : e.target.value)}>
                <option value="unknown">No sé / No aplica</option>
                <option value="a_liquidar">A liquidar en MP</option>
                <option value="liquidado">Liquidado (dinero disponible en MP)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Indica si el dinero de la venta ya estaba disponible en Mercado Pago o aún estaba en proceso de liquidación.</p>
            </div>

            {/* Mostrar costos de envío y costo del producto (pueden editarse antes de confirmar) */}
            {fetchedDevolucion && (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {/* No pedir costo envío ida: lo tomamos automáticamente desde la devolución/venta. */}
                <div>
                  <label className="block text-sm font-medium">Costo envío vuelta (ARS)</label>
                  <input type="number" className="w-full border rounded p-2" value={costoEnvioDevolucionLocal ?? 0} onChange={(e) => setCostoEnvioDevolucionLocal(Number(e.target.value))} />
                </div>
                {/* Costo de producto se toma automáticamente desde la venta/devolución; no mostrar input */}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAdvance(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvance} disabled={isAdvancing || (advanceType === 'Reembolso' && !fechaCompletadaLocal)}>{isAdvancing ? 'Aplicando...' : 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
