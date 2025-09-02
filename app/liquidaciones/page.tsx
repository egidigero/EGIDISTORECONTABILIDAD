import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Banknote } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { LiquidacionActions } from "@/components/liquidacion-actions"
import { getLiquidaciones } from "@/lib/actions/liquidaciones"

export default async function LiquidacionesPage() {
  const liquidaciones = await getLiquidaciones()

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (liquidacion: any) => new Date(liquidacion.fecha).toLocaleDateString(),
    },
    {
      key: "dineroFP",
      header: "Dinero FP",
      render: (liquidacion: any) => `$${Number(liquidacion.dineroFP).toLocaleString()}`,
    },
    {
      key: "disponibleMP_MELI",
      header: "Disponible MP/MELI",
      render: (liquidacion: any) => `$${Number(liquidacion.disponibleMP_MELI).toLocaleString()}`,
    },
    {
      key: "aLiquidarMP",
      header: "A Liquidar MP",
      render: (liquidacion: any) => `$${Number(liquidacion.aLiquidarMP).toLocaleString()}`,
    },
    {
      key: "liquidadoMP",
      header: "Liquidado MP",
      render: (liquidacion: any) => `$${Number(liquidacion.liquidadoMP).toLocaleString()}`,
    },
    {
      key: "aLiquidarTN",
      header: "A Liquidar TN",
      render: (liquidacion: any) => `$${Number(liquidacion.aLiquidarTN).toLocaleString()}`,
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
              <h1 className="text-2xl font-bold text-foreground mt-1">Liquidaciones</h1>
            </div>
            <Button asChild>
              <Link href="/liquidaciones/nueva">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Liquidación
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
                <Banknote className="h-5 w-5" />
                Control de Liquidaciones
              </CardTitle>
              <CardDescription>
                Registra y controla las liquidaciones diarias de fondos por plataforma (MP/MELI y Tienda Nube).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={liquidaciones}
                columns={columns}
                searchable={false}
                actions={(liquidacion) => <LiquidacionActions liquidacion={liquidacion} />}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
