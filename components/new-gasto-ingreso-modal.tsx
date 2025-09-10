"use client"

import { useState, ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GastoIngresoForm } from "@/components/gasto-ingreso-form"

interface NewGastoIngresoModalProps {
  children: ReactNode
  onSuccess?: () => void
}

export function NewGastoIngresoModal({ children, onSuccess }: NewGastoIngresoModalProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    if (onSuccess) {
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Movimiento</DialogTitle>
          <DialogDescription>
            Registra un nuevo gasto o ingreso adicional
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <GastoIngresoForm 
            onSuccess={handleSuccess}
            isModal={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
