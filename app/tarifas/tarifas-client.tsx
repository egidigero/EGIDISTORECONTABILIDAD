"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard } from "lucide-react"
import { TarifasTableClient } from "@/components/tarifas-table-client"
import { NuevaTarifaModal } from "@/components/nueva-tarifa-modal"

interface TarifasPageClientProps {
  initialTarifas: any[]
}

export function TarifasPageClient({ initialTarifas }: TarifasPageClientProps) {
  const router = useRouter()

  const handleTarifaUpdated = () => {
    // Revalidar la página para refrescar los datos del servidor
    router.refresh()
  }

  return (
    <div className="mb-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Configuración de Tarifas
              </CardTitle>
              <CardDescription>
                Configura las comisiones, IIBB y costos fijos por cada combinación de plataforma y método de pago.
              </CardDescription>
            </div>
            <NuevaTarifaModal onCreated={handleTarifaUpdated} />
          </div>
        </CardHeader>
        <CardContent>
          <TarifasTableClient 
            tarifas={initialTarifas} 
            onTarifaUpdated={handleTarifaUpdated}
          />
        </CardContent>
      </Card>
    </div>
  )
}
