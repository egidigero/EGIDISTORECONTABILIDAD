import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { LiquidacionForm } from "@/components/liquidacion-form"
import { getLiquidacion, updateLiquidacion } from "@/lib/actions/liquidaciones"
import type { LiquidacionFormData } from "@/lib/validations"

interface EditarLiquidacionPageProps {
  params: { id: string }
}

export default async function EditarLiquidacionPage({ params }: EditarLiquidacionPageProps) {
  const liquidacion = await getLiquidacion(params.id)

  if (!liquidacion) {
    notFound()
  }

  const handleSubmit = async (data: LiquidacionFormData) => {
    "use server"
    await updateLiquidacion(params.id, data)
    redirect("/liquidaciones")
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
        <LiquidacionForm 
          defaultValues={liquidacion}
          onSubmit={handleSubmit}
          mode="edit"
        />
      </main>
    </div>
  )
}
