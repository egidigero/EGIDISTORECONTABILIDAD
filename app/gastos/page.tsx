import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Receipt } from "lucide-react"
import { GastosIngresosTable } from "@/components/gastos-ingresos-table"
import { GastosIngresosFilters } from "@/components/gastos-ingresos-filters"
import { NewGastoIngresoModal } from "@/components/new-gasto-ingreso-modal"

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Gastos e Ingresos</h1>
            </div>
            <NewGastoIngresoModal>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </NewGastoIngresoModal>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Control de Gastos e Ingresos
              </CardTitle>
              <CardDescription>
                Registra y gestiona todos los gastos e ingresos adicionales por canal y categoría.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Suspense fallback={<div>Cargando filtros...</div>}>
                <GastosIngresosFilters />
              </Suspense>

              <Suspense fallback={<div>Cargando movimientos...</div>}>
                <GastosIngresosTable searchParams={resolvedSearchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
