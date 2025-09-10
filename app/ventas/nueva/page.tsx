import Link from "next/link"
import { VentaForm } from "@/components/venta-form"

export default function NuevaVentaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/ventas" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a ventas
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nueva Venta</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <VentaForm key="nueva-venta-form" />
        </div>
      </main>
    </div>
  )
}
