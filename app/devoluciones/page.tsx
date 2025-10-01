import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, RotateCcw, FileText } from "lucide-react"
import { DevolucionesTable } from "@/components/devoluciones-table"
import { getDevoluciones } from "@/lib/actions/devoluciones"

export default async function DevolucionesPage() {
  const devoluciones = await getDevoluciones()

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
              <Button asChild>
                <Link href="/devoluciones/nueva">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Devolución
                </Link>
              </Button>
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
              <DevolucionesTable devoluciones={devoluciones} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
