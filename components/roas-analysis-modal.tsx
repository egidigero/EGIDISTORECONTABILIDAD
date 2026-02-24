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

export interface ModelBreakdownRow {
  modelo: string
  ventas: number
  contribucionBruta: number
  devolucionesAsignadas: number
  contribucionNeta: number
  cpaBreakEven: number
  pctPV: number
  pctCosto: number
}

interface ROASAnalysisModalProps {
  ventasNetas: number
  margenContribucion: number
  baseNegocioAntesAds: number
  resultadoNetoSinInteresesMP: number
  resultadoNetoFinal: number
  inversionMarketing: number
  gastosAds: number
  gastosUGC: number
  cantidadVentas: number
  modelBreakdown: ModelBreakdownRow[]
  devolucionesNoAsignadas: number
}

export function ROASAnalysisModal({
  ventasNetas,
  margenContribucion,
  baseNegocioAntesAds,
  resultadoNetoSinInteresesMP,
  resultadoNetoFinal,
  inversionMarketing,
  gastosAds,
  gastosUGC,
  cantidadVentas,
  modelBreakdown,
  devolucionesNoAsignadas,
}: ROASAnalysisModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Analisis ROAS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Panel ROAS y CPA (escala, negocio y por modelo)</DialogTitle>
          <DialogDescription>
            Incluye ROAS BE de escala, ROAS BE de negocio, ACOS/CPA operativos y sensibilidad.
          </DialogDescription>
        </DialogHeader>
        <ROASAnalysisChart
          ventasNetas={ventasNetas}
          margenContribucion={margenContribucion}
          baseNegocioAntesAds={baseNegocioAntesAds}
          resultadoNetoSinInteresesMP={resultadoNetoSinInteresesMP}
          resultadoNetoFinal={resultadoNetoFinal}
          inversionMarketing={inversionMarketing}
          gastosAds={gastosAds}
          gastosUGC={gastosUGC}
          cantidadVentas={cantidadVentas}
          modelBreakdown={modelBreakdown}
          devolucionesNoAsignadas={devolucionesNoAsignadas}
        />
      </DialogContent>
    </Dialog>
  )
}
