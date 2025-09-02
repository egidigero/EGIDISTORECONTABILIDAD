import Link from "next/link"
import { ProductoForm } from "@/components/producto-form"

export default function NuevoProductoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/productos" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a productos
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nuevo Producto</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <ProductoForm />
        </div>
      </main>
    </div>
  )
}
