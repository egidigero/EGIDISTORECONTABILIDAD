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
import { ROASAnalysisChart } from "@/components/roas-analysis-chart"
import { TrendingUp } from "lucide-react"

interface ROASAnalysisModalProps {
  ingresosBrutos: number
  costoProductos: number
  gastosOperativos: number
  gastosADS: number
  cantidadVentas: number
}

export function ROASAnalysisModal({
  ingresosBrutos,
  costoProductos,
  gastosOperativos,
  gastosADS,
  cantidadVentas,
}: ROASAnalysisModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Análisis ROAS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análisis de Marketing - ROAS y CPA</DialogTitle>
          <DialogDescription>
            Análisis del retorno de inversión publicitaria y punto de equilibrio
          </DialogDescription>
        </DialogHeader>
        <ROASAnalysisChart
          ingresosBrutos={ingresosBrutos}
          costoProductos={costoProductos}
          gastosOperativos={gastosOperativos}
          gastosADS={gastosADS}
          cantidadVentas={cantidadVentas}
        />
      </DialogContent>
    </Dialog>
  )
}
