"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DevolucionForm } from "@/components/devolucion-form"
import { Button } from "@/components/ui/button"
import { createDevolucion } from "@/lib/actions/devoluciones"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { DevolucionFormData } from "@/lib/validations"

export function NuevaDevolucionModal() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (data: DevolucionFormData) => {
    setIsLoading(true)
    try {
      const result = await createDevolucion(data)
      if (result.success) {
        toast.success("Devolución creada exitosamente")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || "Error al crear la devolución")
      }
    } catch (error) {
      console.error("Error creating devolucion:", error)
      toast.error("Error al crear la devolución")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Devolución
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Devolución</DialogTitle>
          <DialogDescription>Registra una devolución vinculada a una venta</DialogDescription>
        </DialogHeader>
        <DevolucionForm onSubmit={handleSubmit as any} isSubmitting={isLoading} />
      </DialogContent>
    </Dialog>
  )
}
