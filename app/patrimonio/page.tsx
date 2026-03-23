import { getPatrimonioTiempoReal, registrarPatrimonioDiario, registrarPatrimonioRango } from "@/lib/actions/patrimonio"
import { PatrimonioEvolucion } from "@/components/patrimonio-evolucion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { addDaysToDateOnly, getTodayDateOnly, parseDateOnly } from "@/lib/date"
import { RefreshCw, TrendingUp, Wallet, Package } from "lucide-react"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

type PatrimonioActual = {
  fecha: string
  patrimonio_stock: number
  unidades_stock: number
  mp_disponible: number
  mp_a_liquidar: number
  mp_retenido: number
  tn_a_liquidar: number
  total_liquidaciones: number
  patrimonio_total: number
}

async function RegistrarPatrimonioButton() {
  async function registrar() {
    "use server"
    await registrarPatrimonioDiario()
    revalidatePath("/patrimonio")
  }

  return (
    <form action={registrar}>
      <Button type="submit" size="sm" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Forzar Snapshot Hoy
      </Button>
    </form>
  )
}

async function RecalcularPatrimonioButton() {
  async function recalcular() {
    "use server"

    const hoy = getTodayDateOnly()
    const fin = addDaysToDateOnly(hoy, -1)
    const inicio = addDaysToDateOnly(fin, -89)

    await registrarPatrimonioRango(inicio, fin)
    revalidatePath("/patrimonio")
  }

  return (
    <form action={recalcular}>
      <Button type="submit" size="sm" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Recalcular 90 dias
      </Button>
    </form>
  )
}

function formatearFechaLocal(fecha: string) {
  return parseDateOnly(fecha).toLocaleDateString("es-AR")
}

function PatrimonioActualCard({ patrimonioActual }: { patrimonioActual: PatrimonioActual | null | undefined }) {
  if (!patrimonioActual) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patrimonio Actual (En Vivo)</CardTitle>
          <CardDescription>No hay datos para mostrar</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verifica que existan productos o liquidaciones cargadas
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
            ${Number(patrimonioActual.patrimonio_total).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">En vivo al momento</p>
          <p className="text-xs text-muted-foreground">
            Última liquidación cargada: {formatearFechaLocal(String(patrimonioActual.fecha))}
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
            ${Number(patrimonioActual.patrimonio_stock).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {patrimonioActual.unidades_stock} unidades - {porcentajeStock.toFixed(1)}%
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
            ${Number(patrimonioActual.total_liquidaciones).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <span className="font-medium">${Number(patrimonioActual.mp_disponible).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MP A Liquidar:</span>
              <span className="font-medium">${Number(patrimonioActual.mp_a_liquidar).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TN A Liquidar:</span>
              <span className="font-medium">${Number(patrimonioActual.tn_a_liquidar).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PatrimonioPage() {
  const { data: patrimonioActual } = await getPatrimonioTiempoReal()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Patrimonio</h2>
        <div className="flex gap-2">
          <RecalcularPatrimonioButton />
          <RegistrarPatrimonioButton />
        </div>
      </div>

      <PatrimonioActualCard patrimonioActual={patrimonioActual as PatrimonioActual | null | undefined} />
      <PatrimonioEvolucion patrimonioActual={patrimonioActual as PatrimonioActual | null | undefined} />
    </div>
  )
}
