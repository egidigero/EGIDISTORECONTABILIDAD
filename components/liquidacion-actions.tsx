"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import { EditarLiquidacionModal } from "@/components/editar-liquidacion-modal"
import type { Liquidacion } from "@/lib/types"

interface LiquidacionActionsProps {
  liquidacion: Liquidacion
}

export function LiquidacionActions({ liquidacion }: LiquidacionActionsProps) {
  return (
    <EditarLiquidacionModal 
      liquidacion={liquidacion}
      trigger={
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </Button>
      }
    />
  )
}
