"use client"

import { useState } from "react"
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
import { deleteDevolucion } from "@/lib/actions/devoluciones"
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
  const [advanceType, setAdvanceType] = useState<string>("")
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
      payload.fechaCompletada = new Date()
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
          <DropdownMenuItem onClick={() => router.push(`/devoluciones/${devolucion.id}/editar`)}>
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
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAdvance(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvance} disabled={isAdvancing}>{isAdvancing ? 'Aplicando...' : 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
