import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ShoppingCart, Clock } from "lucide-react"
import { VentasTable } from "@/components/ventas-table"
import { VentasFilters } from "@/components/ventas-filters"
import { NuevaVentaModal } from "@/components/nueva-venta-modal"

export default function VentasPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Ventas</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/ventas/pendientes">
                  <Clock className="h-4 w-4 mr-2" />
                  Pendientes de Envío
                </Link>
              </Button>
              <NuevaVentaModal />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Gestión de Ventas
              </CardTitle>
              <CardDescription>
                Registra y gestiona todas tus ventas con cálculos automáticos de comisiones y rentabilidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Suspense fallback={<div>Cargando filtros...</div>}>
                <VentasFilters />
              </Suspense>

              <Suspense fallback={<div>Cargando ventas...</div>}>
                <VentasTable searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
