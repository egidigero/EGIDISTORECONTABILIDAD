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
import { Plus } from "lucide-react"
import { VentaForm } from "./venta-form"

export function NuevaVentaModal() {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    // La página se recargará automáticamente por el revalidatePath en la action
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Venta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-none w-[95vw] min-w-[95vw] max-h-[95vh] overflow-y-auto !w-[95vw]" style={{ width: '95vw', maxWidth: 'none' }}>
        <DialogHeader>
          <DialogTitle>Nueva Venta</DialogTitle>
          <DialogDescription>
            Registra una nueva venta con cálculos automáticos de comisiones y rentabilidad.
          </DialogDescription>
        </DialogHeader>
        <VentaForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}
