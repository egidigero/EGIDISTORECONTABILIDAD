import Link from "next/link"
import NuevaDevolucionModalWrapper from "@/components/nueva-devolucion-modal-wrapper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, RotateCcw, FileText } from "lucide-react"
import { DevolucionesClientWrapper } from "@/components/devoluciones-client-wrapper"
import { getDevoluciones } from "@/lib/actions/devoluciones"

export default async function DevolucionesPage() {
  let devoluciones: any[] = []
  let loadError: string | null = null
  try {
    devoluciones = await getDevoluciones()
  } catch (err: any) {
    // Capturar el error para evitar que la página entera falle sin feedback
    console.error('Error al cargar devoluciones en page.tsx:', err)
    loadError = err?.message ?? String(err)
    devoluciones = []
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Devoluciones</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/devoluciones/reportes">
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Reportes
                </Link>
              </Button>
              {/* Client wrapper for nueva devolucion modal */}
              <NuevaDevolucionModalWrapper />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Gestión de Devoluciones
              </CardTitle>
              <CardDescription>
                Registra y gestiona las devoluciones de productos vinculadas a ventas específicas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadError ? (
                <div className="p-4 text-sm text-destructive">
                  <strong>Error al cargar devoluciones:</strong>
                  <div className="mt-2">{loadError}</div>
                  <div className="mt-2">Revisá la consola del servidor para más detalles.</div>
                </div>
              ) : (
                <DevolucionesClientWrapper devoluciones={devoluciones} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
