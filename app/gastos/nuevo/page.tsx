import Link from "next/link"
import { GastoIngresoForm } from "@/components/gasto-ingreso-form"

export default function NuevoGastoIngresoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/gastos" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a gastos e ingresos
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nuevo Movimiento</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <GastoIngresoForm />
        </div>
      </main>
    </div>
  )
}
