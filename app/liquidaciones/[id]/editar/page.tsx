import Link from "next/link"
import { notFound } from "next/navigation"
import { LiquidacionForm } from "@/components/liquidacion-form"
import { getLiquidacionById } from "@/lib/actions/liquidaciones"

interface EditarLiquidacionPageProps {
  params: { id: string }
}

export default async function EditarLiquidacionPage({ params }: EditarLiquidacionPageProps) {
  const liquidacion = await getLiquidacionById(params.id)

  if (!liquidacion) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/liquidaciones" className="text-sm text-muted-foreground hover:text-primary">
            ← Volver a liquidaciones
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Editar Liquidación</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LiquidacionForm liquidacion={liquidacion} />
      </main>
    </div>
  )
}
