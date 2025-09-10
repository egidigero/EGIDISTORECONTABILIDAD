import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GastoIngresoActions } from "@/components/gasto-ingreso-actions"
import { getGastosIngresos } from "@/lib/actions/gastos-ingresos"
import { Calculator, Target } from "lucide-react"
import type { GastoIngresoFilters } from "@/lib/types"

interface GastosIngresosTableProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

const canalLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  General: "General",
}

const tipoLabels = {
  Gasto: "Gasto",
  Ingreso: "Ingreso",
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>ROAS</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gastosIngresos.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.fecha).toLocaleDateString()}</TableCell>
                <TableCell>
                  {item.tipo === "Gasto" ? (
                    <Badge variant="destructive">
                      {tipoLabels[item.tipo as keyof typeof tipoLabels]}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      {tipoLabels[item.tipo as keyof typeof tipoLabels]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.canal ? canalLabels[item.canal as keyof typeof canalLabels] : "General"}
                  </Badge>
                </TableCell>
                <TableCell>{item.categoria}</TableCell>
                <TableCell>{item.descripcion}</TableCell>
                <TableCell>
                  <span className={item.tipo === "Gasto" ? "text-red-600" : "text-green-600"}>
                    {item.tipo === "Gasto" ? "-" : "+"}${Number(item.montoARS).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    {item.roas_objetivo && item.ventas_periodo ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-sm">
                            <Target className="h-3 w-3" />
                            <span className="font-medium">{item.roas_objetivo}x</span>
                            {item.calculo_automatico && (
                              <Calculator className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p><strong>ROAS Objetivo:</strong> {item.roas_objetivo}x</p>
                            <p><strong>Ventas del período:</strong> ${Number(item.ventas_periodo).toLocaleString()}</p>
                            {item.gasto_calculado && (
                              <p><strong>Gasto calculado:</strong> ${Number(item.gasto_calculado).toLocaleString()}</p>
                            )}
                            {item.calculo_automatico && (
                              <p className="text-blue-600">✓ Cálculo automático</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <GastoIngresoActions gastoIngreso={item} />
                </TableCell>
              </TableRow>
            ))}
            {gastosIngresos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No se encontraron resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
