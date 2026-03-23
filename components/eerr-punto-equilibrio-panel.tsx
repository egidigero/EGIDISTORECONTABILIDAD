"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PuntoEquilibrioAnalisis } from "@/components/punto-equilibrio-analisis"
import { Target } from "lucide-react"

interface EERRPuntoEquilibrioPanelProps {
  ventasNetas: number
  cantidadVentas: number
  margenContribucion: number
  resultadoOperativoMarketing: number
  estructuraTotal: number
  otrosIngresosOperativos: number
  roasActual: number
}

export function EERRPuntoEquilibrioPanel({
  ventasNetas,
  cantidadVentas,
  margenContribucion,
  resultadoOperativoMarketing,
  estructuraTotal,
  otrosIngresosOperativos,
  roasActual,
}: EERRPuntoEquilibrioPanelProps) {
  const [open, setOpen] = useState(false)

  const cantidadBase = Math.max(0, Math.round(cantidadVentas))
  const puedeAnalizar = cantidadBase > 0 && ventasNetas > 0
  const precioVentaUnitario = puedeAnalizar ? ventasNetas / cantidadBase : 0
  const margenContribucionUnitario = puedeAnalizar ? margenContribucion / cantidadBase : 0
  const margenOperativoUnitario = puedeAnalizar ? resultadoOperativoMarketing / cantidadBase : 0

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-sky-700" />
            Punto de Equilibrio y Volumen
          </CardTitle>
          <CardDescription>
            Proyecta el negocio por unidades usando el promedio del periodo filtrado en EERR.
          </CardDescription>
        </div>
        <Button
          variant={open ? "default" : "outline"}
          onClick={() => setOpen((prev) => !prev)}
          disabled={!puedeAnalizar}
          className="w-full md:w-auto"
        >
          {open ? "Ocultar analisis" : "Ver analisis por unidades"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {!puedeAnalizar && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Hace falta al menos una venta en el periodo para proyectar punto de equilibrio por unidades.
          </div>
        )}

        {puedeAnalizar && open && (
          <PuntoEquilibrioAnalisis
            precioVenta={precioVentaUnitario}
            margenContribucionUnitario={margenContribucionUnitario}
            margenOperativoUnitario={margenOperativoUnitario}
            roasActual={roasActual}
            costosFijosSugeridos={estructuraTotal}
            otrosIngresosOperativos={otrosIngresosOperativos}
            unidadesSugeridas={cantidadBase}
            periodoLabel="este periodo filtrado"
          />
        )}
      </CardContent>
    </Card>
  )
}
