import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
import { VentaActions } from "@/components/venta-actions"
import { getVentas } from "@/lib/actions/ventas"
import type { VentaFilters } from "@/lib/types"

interface VentasTableProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

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

export async function VentasTable({ searchParams }: VentasTableProps) {
  // Construir filtros desde searchParams
  const filters: VentaFilters = {}

  if (searchParams.fechaDesde) filters.fechaDesde = new Date(searchParams.fechaDesde as string)
  if (searchParams.fechaHasta) filters.fechaHasta = new Date(searchParams.fechaHasta as string)
  if (searchParams.plataforma) filters.plataforma = searchParams.plataforma as any
  if (searchParams.metodoPago) filters.metodoPago = searchParams.metodoPago as any
  if (searchParams.estadoEnvio) filters.estadoEnvio = searchParams.estadoEnvio as any
  if (searchParams.comprador) filters.comprador = searchParams.comprador as string
  if (searchParams.externalOrderId) filters.externalOrderId = searchParams.externalOrderId as string

  const ventas = await getVentas(filters)

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: any) => new Date(venta.fecha).toLocaleDateString(),
    },
    {
      key: "saleCode",
      header: "Código",
      render: (venta: any) => <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>,
    },
    {
      key: "comprador",
      header: "Comprador",
    },
    {
      key: "producto",
      header: "Producto",
      render: (venta: any) => venta.producto.modelo,
    },
    {
      key: "plataforma",
      header: "Plataforma",
      render: (venta: any) => (
        <Badge variant="outline">{plataformaLabels[venta.plataforma as keyof typeof plataformaLabels]}</Badge>
      ),
    },
    {
      key: "pvBruto",
      header: "PV Bruto",
      render: (venta: any) => `$${Number(venta.pvBruto).toLocaleString()}`,
    },
    {
      key: "precioNeto",
      header: "Precio Neto",
      render: (venta: any) => `$${Number(venta.precioNeto).toLocaleString()}`,
    },
    {
      key: "ingresoMargen",
      header: "Margen",
      render: (venta: any) => {
        const margen = Number(venta.ingresoMargen)
        return <span className={margen >= 0 ? "text-green-600" : "text-red-600"}>${margen.toLocaleString()}</span>
      },
    },
    {
      key: "rentabilidadSobrePV",
      header: "Rentabilidad %",
      render: (venta: any) => {
        const rentabilidad = Number(venta.rentabilidadSobrePV) * 100
        return <span className={rentabilidad >= 0 ? "text-green-600" : "text-red-600"}>{rentabilidad.toFixed(1)}%</span>
      },
    },
    {
      key: "estadoEnvio",
      header: "Estado",
      render: (venta: any) => <EstadoEnvioBadge estado={venta.estadoEnvio} />,
    },
  ]

  // Calcular totales
  const totales = ventas.reduce(
    (acc, venta) => ({
      pvBruto: acc.pvBruto + Number(venta.pvBruto),
      precioNeto: acc.precioNeto + Number(venta.precioNeto),
      ingresoMargen: acc.ingresoMargen + Number(venta.ingresoMargen),
    }),
    { pvBruto: 0, precioNeto: 0, ingresoMargen: 0 },
  )

  return (
    <div className="space-y-4">
      <DataTable
        data={ventas}
        columns={columns}
        searchable
        searchPlaceholder="Buscar ventas..."
        actions={(venta) => <VentaActions venta={venta} />}
      />

      {ventas.length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Totales ({ventas.length} ventas)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">PV Bruto Total:</span>
              <div className="font-medium">${totales.pvBruto.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Precio Neto Total:</span>
              <div className="font-medium">${totales.precioNeto.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Margen Total:</span>
              <div className={`font-medium ${totales.ingresoMargen >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${totales.ingresoMargen.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
