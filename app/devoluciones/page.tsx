import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, RotateCcw } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { DevolucionActions } from "@/components/devolucion-actions"
import { getDevoluciones } from "@/lib/actions/devoluciones"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

export default async function DevolucionesPage() {
  const devoluciones = await getDevoluciones()

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (devolucion: any) => new Date(devolucion.fecha).toLocaleDateString(),
    },
    {
      key: "venta",
      header: "Venta",
      render: (devolucion: any) => (
        <div>
          <code className="text-xs bg-muted px-2 py-1 rounded">{devolucion.venta.saleCode}</code>
          <div className="text-xs text-muted-foreground">{devolucion.venta.comprador}</div>
        </div>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (devolucion: any) => devolucion.venta.producto.modelo,
    },
    {
      key: "plataforma",
      header: "Plataforma",
      render: (devolucion: any) => (
        <Badge variant="outline">{plataformaLabels[devolucion.plataforma as keyof typeof plataformaLabels]}</Badge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
    },
    {
      key: "estado",
      header: "Estado",
      render: (devolucion: any) => <Badge variant="secondary">{devolucion.estado}</Badge>,
    },
    {
      key: "montoDevuelto",
      header: "Monto Devuelto",
      render: (devolucion: any) => `$${Number(devolucion.montoDevuelto).toLocaleString()}`,
    },
    {
      key: "recuperoProducto",
      header: "Recupero",
      render: (devolucion: any) => (
        <Badge variant={devolucion.recuperoProducto ? "default" : "destructive"}>
          {devolucion.recuperoProducto ? "Sí" : "No"}
        </Badge>
      ),
    },
  ]

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
            <Button asChild>
              <Link href="/devoluciones/nueva">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Devolución
              </Link>
            </Button>
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
              <DataTable
                data={devoluciones}
                columns={columns}
                searchable
                searchPlaceholder="Buscar por código de venta o comprador..."
                actions={(devolucion) => <DevolucionActions devolucion={devolucion} />}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
