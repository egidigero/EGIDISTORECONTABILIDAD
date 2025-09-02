import Link from "next/link"
import { LiquidacionForm } from "@/components/liquidacion-form"

export default function NuevaLiquidacionPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/liquidaciones" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a liquidaciones
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nueva Liquidación</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LiquidacionForm />
      </main>
    </div>
  )
}
