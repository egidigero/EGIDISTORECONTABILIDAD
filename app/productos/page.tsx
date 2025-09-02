import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Package } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { getProductos } from "@/lib/actions/productos"
import { ProductoActions } from "@/components/producto-actions"

export default async function ProductosPage() {
  const productos = await getProductos()

  const columns = [
    {
      key: "modelo",
      header: "Modelo",
      sortable: true,
    },
    {
      key: "sku",
      header: "SKU",
    },
    {
      key: "costoUnitarioARS",
      header: "Costo Unitario",
      render: (producto: any) => `$${Number(producto.costoUnitarioARS).toLocaleString()}`,
    },
    {
      key: "activo",
      header: "Estado",
      render: (producto: any) => (
        <Badge variant={producto.activo ? "default" : "secondary"}>{producto.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Creado",
      render: (producto: any) => new Date(producto.createdAt).toLocaleDateString(),
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
              <h1 className="text-2xl font-bold text-foreground mt-1">Productos</h1>
            </div>
            <Button asChild>
              <Link href="/productos/nuevo">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
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
                <Package className="h-5 w-5" />
                Gestión de Productos
              </CardTitle>
              <CardDescription>
                Administra tu catálogo de smartwatches y accesorios. Controla modelos, SKUs y costos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={productos}
                columns={columns}
                searchable
                searchPlaceholder="Buscar por modelo o SKU..."
                actions={(producto) => <ProductoActions producto={producto} />}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
