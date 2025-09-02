import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { EERRFilters } from "@/components/eerr-filters"
import { EERRReport } from "@/components/eerr-report"

export default function EERRPage({
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
              <h1 className="text-2xl font-bold text-foreground mt-1">Estado de Resultados</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Análisis Financiero
              </CardTitle>
              <CardDescription>
                Reportes de rentabilidad y análisis de resultados por período y canal de venta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Suspense fallback={<div>Cargando filtros...</div>}>
                <EERRFilters />
              </Suspense>

              <Suspense fallback={<div>Cargando reporte...</div>}>
                <EERRReport searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
