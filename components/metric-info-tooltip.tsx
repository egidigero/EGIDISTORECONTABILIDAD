"use client"

import { CircleHelp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface MetricInfoTooltipProps {
  queMide: string
  paraQueSirve: string
  comoDecidir: string
}

export function MetricInfoTooltip({ queMide, paraQueSirve, comoDecidir }: MetricInfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Informacion de la metrica"
          className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-2 text-left">
        <div>
          <span className="font-semibold">Que mide:</span> {queMide}
        </div>
        <div>
          <span className="font-semibold">Para que sirve:</span> {paraQueSirve}
        </div>
        <div>
          <span className="font-semibold">Como decidir:</span> {comoDecidir}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
