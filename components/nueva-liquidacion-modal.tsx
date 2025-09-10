"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
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
import { createLiquidacion } from "@/lib/actions/liquidaciones"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { LiquidacionFormData } from "@/lib/validations"

export function NuevaLiquidacionModal() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (data: LiquidacionFormData) => {
    setIsLoading(true)
    try {
      console.log("Enviando datos:", data)
      const result = await createLiquidacion(data)
      console.log("Resultado:", result)
      
      if (result.success) {
        toast.success("Liquidación creada exitosamente")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || "Error al crear la liquidación")
      }
    } catch (error) {
      console.error("Error creating liquidación:", error)
      toast.error("Error al crear la liquidación")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Liquidación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Liquidación</DialogTitle>
          <DialogDescription>
            Crear una nueva liquidación en el sistema MP ↔ TN
          </DialogDescription>
        </DialogHeader>
        <LiquidacionForm 
          onSubmit={handleSubmit}
          isLoading={isLoading}
          mode="create"
        />
      </DialogContent>
    </Dialog>
  )
}
