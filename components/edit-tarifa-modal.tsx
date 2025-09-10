"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { TarifaForm } from "@/components/tarifa-form"

interface EditTarifaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tarifa: {
    id: string
    plataforma: string
    metodoPago: string
    condicion?: string
    comisionPct: number
    comisionExtraPct?: number
    iibbPct?: number
    fijoPorOperacion?: number
    descuentoPct?: number
  }
  onUpdated?: () => void
}

export function EditTarifaModal({ open, onOpenChange, tarifa, onUpdated }: EditTarifaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-3xl w-full">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Editar Tarifa</h2>
        </div>
        <TarifaForm
          tarifa={{
            id: tarifa.id,
            plataforma: tarifa.plataforma as any,
            metodoPago: tarifa.metodoPago as any,
            condicion: (tarifa.condicion as any) || "transferencia",
            comisionPct: tarifa.comisionPct,
            comisionExtraPct: tarifa.comisionExtraPct || 0,
            iibbPct: tarifa.iibbPct || 0,
            fijoPorOperacion: tarifa.fijoPorOperacion || 0,
            descuentoPct: tarifa.descuentoPct || 0,
          }}
          onSuccess={() => {
            onOpenChange(false)
            if (onUpdated) onUpdated()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
