"use client"

import { useState } from "react"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LiquidacionForm } from "@/components/liquidacion-form"
import { updateLiquidacion } from "@/lib/actions/liquidaciones"
import { toast } from "sonner"
import type { LiquidacionFormData } from "@/lib/validations"
import type { Liquidacion } from "@/lib/types"

interface EditarLiquidacionModalProps {
  liquidacion: Liquidacion
  trigger?: React.ReactNode
}

export function EditarLiquidacionModal({ liquidacion, trigger }: EditarLiquidacionModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: LiquidacionFormData) => {
    setIsLoading(true)
    try {
      const result = await updateLiquidacion(liquidacion.id, data)
      if (result.success) {
        toast.success("Liquidación actualizada exitosamente")
        setOpen(false)
        // Recargar la página para actualizar la tabla
        window.location.reload()
      } else {
        toast.error(result.error || "Error al actualizar la liquidación")
      }
    } catch (error) {
      console.error("Error updating liquidación:", error)
      toast.error("Error al actualizar la liquidación")
    } finally {
      setIsLoading(false)
    }
  }

  const defaultValues = {
    fecha: new Date(liquidacion.fecha),
    // Solo los campos editables, los saldos se recalculan automáticamente
    mp_liquidado_hoy: liquidacion.mp_liquidado_hoy || 0,
    tn_liquidado_hoy: liquidacion.tn_liquidado_hoy || 0,
    tn_iibb_descuento: liquidacion.tn_iibb_descuento || 0,
    // Campos de solo lectura para mostrar en el formulario
    mp_disponible: liquidacion.mp_disponible || 0,
    mp_a_liquidar: liquidacion.mp_a_liquidar || 0,
    tn_a_liquidar: liquidacion.tn_a_liquidar || 0,
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Liquidación</DialogTitle>
          <DialogDescription>
            Modificar los datos de la liquidación del {new Date(liquidacion.fecha).toLocaleDateString('es-AR')}
          </DialogDescription>
        </DialogHeader>
        <LiquidacionForm 
          mode="edit"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
