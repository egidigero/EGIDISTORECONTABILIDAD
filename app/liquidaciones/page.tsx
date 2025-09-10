import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Banknote } from "lucide-react"
import { LiquidacionesTable } from "@/components/liquidaciones-table"
import { ProcesarLiquidacionModal } from "@/components/procesar-liquidacion-modal"

export default async function LiquidacionesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Liquidaciones</h1>
            </div>
            <div className="flex gap-2">
              <ProcesarLiquidacionModal />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Control de Liquidaciones - Flujo MP ↔ TN
              </CardTitle>
              <CardDescription>
                <div className="space-y-2">
                  <p>Sistema automático de liquidaciones diarias con flujo MP ↔ TN integrado con gastos e ingresos.</p>
                  <div className="text-sm">
                    <span className="font-medium">🔄 Auto-sincronización:</span> Las liquidaciones se recalculan automáticamente cuando se modifican gastos e ingresos
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">💰 Impacto en MP Disponible:</span> Los gastos e ingresos del día afectan directamente el saldo disponible en MercadoPago
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">⚡ Procesamiento:</span> Usa "Procesar Liquidación" para registrar movimientos de liquidaciones del día
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiquidacionesTable />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
