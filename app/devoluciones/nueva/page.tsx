import Link from "next/link"
import { DevolucionForm } from "@/components/devolucion-form"

export default function NuevaDevolucionPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/devoluciones" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a devoluciones
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Nueva Devolución</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <DevolucionForm />
        </div>
      </main>
    </div>
  )
}
