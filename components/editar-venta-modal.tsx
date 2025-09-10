"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit } from "lucide-react"
import { VentaForm } from "./venta-form"

interface EditarVentaModalProps {
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
  }
  children?: React.ReactNode
}

export function EditarVentaModal({ venta, children }: EditarVentaModalProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    // La página se recargará automáticamente por el revalidatePath en la action
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-none w-[95vw] min-w-[95vw] max-h-[95vh] overflow-y-auto !w-[95vw]" style={{ width: '95vw', maxWidth: 'none' }}>
        <DialogHeader>
          <DialogTitle>Editar Venta</DialogTitle>
          <DialogDescription>
            Modifica los datos de la venta. Los cálculos se actualizarán automáticamente.
          </DialogDescription>
        </DialogHeader>
        <VentaForm venta={venta} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}
