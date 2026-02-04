import { Suspense } from "react"
import { getPatrimonioActual, registrarPatrimonioDiario } from "@/lib/actions/patrimonio"
import { PatrimonioEvolucion } from "@/components/patrimonio-evolucion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, Wallet, Package } from "lucide-react"
import { revalidatePath } from "next/cache"

async function RegistrarPatrimonioButton() {
  async function registrar() {
    "use server"
    await registrarPatrimonioDiario()
    revalidatePath('/patrimonio')
  }

  return (
    <form action={registrar}>
      <Button type="submit" size="sm" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Registrar Snapshot Hoy
      </Button>
    </form>
  )
}

async function PatrimonioActualCard() {
  const { data: patrimonioActual } = await getPatrimonioActual()

  if (!patrimonioActual) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patrimonio Actual</CardTitle>
          <CardDescription>No hay datos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Haz clic en "Registrar Snapshot Hoy" para comenzar a rastrear tu patrimonio
          </p>
        </CardContent>
      </Card>
    )
  }

  const porcentajeStock = (Number(patrimonioActual.patrimonio_stock) / Number(patrimonioActual.patrimonio_total)) * 100
  const porcentajeLiquidaciones = (Number(patrimonioActual.total_liquidaciones) / Number(patrimonioActual.patrimonio_total)) * 100

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patrimonio Total</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${Number(patrimonioActual.patrimonio_total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Al {new Date(patrimonioActual.fecha).toLocaleDateString('es-AR')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Stock</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${Number(patrimonioActual.patrimonio_stock).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {patrimonioActual.unidades_stock} unidades • {porcentajeStock.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Liquidaciones</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${Number(patrimonioActual.total_liquidaciones).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {porcentajeLiquidaciones.toFixed(1)}% del total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Desglose Liquidaciones</CardTitle>
          <div className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">MP Disponible:</span>
              <span className="font-medium">${Number(patrimonioActual.mp_disponible).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MP A Liquidar:</span>
              <span className="font-medium">${Number(patrimonioActual.mp_a_liquidar).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TN A Liquidar:</span>
              <span className="font-medium">${Number(patrimonioActual.tn_a_liquidar).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PatrimonioPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">💰 Patrimonio</h2>
        <RegistrarPatrimonioButton />
      </div>

      <Suspense fallback={<div>Cargando patrimonio actual...</div>}>
        <PatrimonioActualCard />
      </Suspense>

      <Suspense fallback={<div>Cargando evolución...</div>}>
        <PatrimonioEvolucion />
      </Suspense>
    </div>
  )
}
