import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { GastoIngresoActions } from "@/components/gasto-ingreso-actions"
import { getGastosIngresos } from "@/lib/actions/gastos-ingresos"
import type { GastoIngresoFilters } from "@/lib/types"

interface GastosIngresosTableProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

const canalLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const tipoLabels = {
  Gasto: "Gasto",
  OtroIngreso: "Otro Ingreso",
}

export async function GastosIngresosTable({ searchParams }: GastosIngresosTableProps) {
  // Construir filtros desde searchParams
  const filters: GastoIngresoFilters = {}

  if (searchParams.fechaDesde) filters.fechaDesde = new Date(searchParams.fechaDesde as string)
  if (searchParams.fechaHasta) filters.fechaHasta = new Date(searchParams.fechaHasta as string)
  if (searchParams.canal && searchParams.canal !== "all") filters.canal = searchParams.canal as any
  if (searchParams.tipo && searchParams.tipo !== "all") filters.tipo = searchParams.tipo as any
  if (searchParams.categoria) filters.categoria = searchParams.categoria as string

  const gastosIngresos = await getGastosIngresos(filters)

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (item: any) => new Date(item.fecha).toLocaleDateString(),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (item: any) => (
        <Badge variant={item.tipo === "Gasto" ? "destructive" : "default"}>
          {tipoLabels[item.tipo as keyof typeof tipoLabels]}
        </Badge>
      ),
    },
    {
      key: "canal",
      header: "Canal",
      render: (item: any) => (
        <Badge variant="outline">{item.canal ? canalLabels[item.canal as keyof typeof canalLabels] : "General"}</Badge>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
    },
    {
      key: "descripcion",
      header: "Descripción",
    },
    {
      key: "montoARS",
      header: "Monto",
      render: (item: any) => {
        const monto = Number(item.montoARS)
        return (
          <span className={item.tipo === "Gasto" ? "text-red-600" : "text-green-600"}>
            {item.tipo === "Gasto" ? "-" : "+"}${monto.toLocaleString()}
          </span>
        )
      },
    },
  ]

  // Calcular totales
  const totales = gastosIngresos.reduce(
    (acc, item) => {
      const monto = Number(item.montoARS)
      if (item.tipo === "Gasto") {
        acc.gastos += monto
      } else {
        acc.ingresos += monto
      }
      return acc
    },
    { gastos: 0, ingresos: 0 },
  )

  return (
    <div className="space-y-4">
      <DataTable
        data={gastosIngresos}
        columns={columns}
        searchable
        searchPlaceholder="Buscar por descripción o categoría..."
        actions={(item) => <GastoIngresoActions gastoIngreso={item} />}
      />

      {gastosIngresos.length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Totales ({gastosIngresos.length} movimientos)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Gastos:</span>
              <div className="font-medium text-red-600">-${totales.gastos.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Total Ingresos:</span>
              <div className="font-medium text-green-600">+${totales.ingresos.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Balance Neto:</span>
              <div
                className={`font-medium ${totales.ingresos - totales.gastos >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ${(totales.ingresos - totales.gastos).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
