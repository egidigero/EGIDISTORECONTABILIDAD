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
import { MoreHorizontal, Edit, Trash2, ExternalLink } from "lucide-react"
import { deleteVenta } from "@/lib/actions/ventas"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { EditarVentaModal } from "./editar-venta-modal"

interface VentaActionsProps {
  venta: {
    id: string
    fecha: Date
    comprador: string
    plataforma: string
    metodoPago: string
    condicion: string
    productoId: string
    pvBruto: number
    cargoEnvioCosto: number
    trackingUrl?: string | null
    estadoEnvio: string
    courier?: string | null
    externalOrderId?: string | null
    saleCode?: string
  }
}

export function VentaActions({ venta }: VentaActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteVenta(venta.id)
      if (result.success) {
        toast({
          title: "Venta eliminada",
          description: "La venta ha sido eliminada correctamente.",
        })
        setShowDeleteDialog(false)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar la venta.",
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
          <EditarVentaModal venta={venta}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </EditarVentaModal>
          {venta.trackingUrl && (
            <DropdownMenuItem onClick={() => window.open(venta.trackingUrl!, "_blank")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver Tracking
            </DropdownMenuItem>
          )}
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
              Esta acción no se puede deshacer. Se eliminará permanentemente la venta <strong>{venta.saleCode || venta.id}</strong>{" "}
              de <strong>{venta.comprador}</strong>.
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
    </>
  )
}
