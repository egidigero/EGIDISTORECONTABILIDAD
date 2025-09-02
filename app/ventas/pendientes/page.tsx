import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import { VentasPendientesTable } from "@/components/ventas-pendientes-table"

export default function VentasPendientesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/ventas" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a ventas
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Pendientes de Envío</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ventas Pendientes de Envío
            </CardTitle>
            <CardDescription>
              Gestiona las ventas que están pendientes de envío o en camino. Actualiza estados y tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VentasPendientesTable />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
