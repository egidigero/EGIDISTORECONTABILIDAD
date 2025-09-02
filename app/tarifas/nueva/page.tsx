import Link from "next/link"
import { TarifaForm } from "@/components/tarifa-form"

export default function NuevaTarifaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/tarifas" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a tarifas
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nueva Tarifa</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <TarifaForm />
        </div>
      </main>
    </div>
  )
}
