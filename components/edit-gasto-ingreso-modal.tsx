"use client"

import { useState, ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GastoIngresoForm } from "@/components/gasto-ingreso-form"
import type { GastoIngreso } from "@/lib/types"

interface EditGastoIngresoModalProps {
  children: ReactNode
  gastoIngreso: GastoIngreso
  onSuccess?: () => void
}

export function EditGastoIngresoModal({ children, gastoIngreso, onSuccess }: EditGastoIngresoModalProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    if (onSuccess) {
      onSuccess()
    }
  }

  const handleCancel = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Movimiento</DialogTitle>
          <DialogDescription>
            Modifica los datos del movimiento financiero.
          </DialogDescription>
        </DialogHeader>
        <GastoIngresoForm
          gastoIngreso={gastoIngreso}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          isModal={true}
        />
      </DialogContent>
    </Dialog>
  )
}
