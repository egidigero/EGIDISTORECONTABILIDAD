import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, CreditCard } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { getTarifas } from "@/lib/actions/tarifas"
import { TarifaActions } from "@/components/tarifa-actions"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const metodoPagoLabels = {
  PagoNube: "Pago Nube",
  MercadoPago: "Mercado Pago",
  Transferencia: "Transferencia",
  Efectivo: "Efectivo",
}

export default async function TarifasPage() {
  const tarifas = await getTarifas()

  const columns = [
    {
      key: "plataforma",
      header: "Plataforma",
      render: (tarifa: any) => (
        <Badge variant="outline">{plataformaLabels[tarifa.plataforma as keyof typeof plataformaLabels]}</Badge>
      ),
    },
    {
      key: "metodoPago",
      header: "Método de Pago",
      render: (tarifa: any) => (
        <Badge variant="secondary">{metodoPagoLabels[tarifa.metodoPago as keyof typeof metodoPagoLabels]}</Badge>
      ),
    },
    {
      key: "comisionPct",
      header: "Comisión %",
      render: (tarifa: any) => `${Number(tarifa.comisionPct).toFixed(2)}%`,
    },
    {
      key: "iibbPct",
      header: "IIBB %",
      render: (tarifa: any) => `${Number(tarifa.iibbPct).toFixed(2)}%`,
    },
    {
      key: "fijoPorOperacion",
      header: "Fijo por Operación",
      render: (tarifa: any) => `$${Number(tarifa.fijoPorOperacion).toLocaleString()}`,
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
              <h1 className="text-2xl font-bold text-foreground mt-1">Tarifas</h1>
            </div>
            <Button asChild>
              <Link href="/tarifas/nueva">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarifa
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
                <CreditCard className="h-5 w-5" />
                Configuración de Tarifas
              </CardTitle>
              <CardDescription>
                Configura las comisiones, IIBB y costos fijos por cada combinación de plataforma y método de pago.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={tarifas}
                columns={columns}
                searchable
                searchPlaceholder="Buscar tarifas..."
                actions={(tarifa) => <TarifaActions tarifa={tarifa} />}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ayuda para Configurar Tarifas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Combinaciones Recomendadas:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Tienda Nube:</strong>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Pago Nube: ~3.5% comisión + fijo</li>
                    <li>Transferencia: 0% comisión</li>
                  </ul>
                </div>
                <div>
                  <strong>Mercado Libre:</strong>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Mercado Pago: ~6.8% comisión</li>
                  </ul>
                </div>
                <div>
                  <strong>Venta Directa:</strong>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Transferencia: 0% comisión</li>
                    <li>Efectivo: 0% comisión</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              El IIBB generalmente es 2.1% para todas las plataformas. Los costos fijos son adicionales a los
              porcentuales.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
