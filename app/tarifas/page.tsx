import Link from "next/link"
import { CreditCard } from "lucide-react"
import { TarifasPageClient } from "./tarifas-client"
import { getTarifas } from "@/lib/actions/tarifas"

export default async function TarifasPage() {
  // Cargar datos en el servidor para renderizado más rápido
  const tarifas = await getTarifas()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Volver al inicio
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-1">Tarifas</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <TarifasPageClient initialTarifas={tarifas} />
      </main>
    </div>
  )
}
