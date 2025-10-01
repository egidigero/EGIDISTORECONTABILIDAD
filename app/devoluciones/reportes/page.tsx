import { getEstadisticasDevoluciones } from "@/lib/actions/devoluciones"
import { DevolucionesReporte } from "@/components/devoluciones-reporte"
import { Button } from "@/components/ui/button"
import { FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DevolucionesReportesPage() {
  const estadisticas = await getEstadisticasDevoluciones()

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/devoluciones">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Reportes de Devoluciones</h1>
          </div>
        </div>
        <p className="text-muted-foreground ml-12">
          Análisis detallado del impacto financiero y estadísticas del sistema de devoluciones
        </p>
      </div>

      {estadisticas.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">No hay devoluciones registradas</h2>
            <p className="text-muted-foreground max-w-md">
              Una vez que comiences a registrar devoluciones, aquí verás reportes detallados
              con estadísticas, gráficos y análisis de impacto financiero.
            </p>
          </div>
          <Button asChild>
            <Link href="/devoluciones/nueva">
              Registrar Primera Devolución
            </Link>
          </Button>
        </div>
      ) : (
        <DevolucionesReporte estadisticas={estadisticas} />
      )}
    </div>
  )
}
