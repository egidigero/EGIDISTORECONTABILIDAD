"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog"
import { TarifaForm } from "@/components/tarifa-form"
import { Plus } from "lucide-react"

export function NuevaTarifaModal({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarifa
        </Button>
      </DialogTrigger>
  <DialogContent showCloseButton className="max-w-3xl w-full">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Nueva Tarifa</h2>
        </div>
        <TarifaForm
          onSuccess={() => {
            setOpen(false)
            if (onCreated) onCreated()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
