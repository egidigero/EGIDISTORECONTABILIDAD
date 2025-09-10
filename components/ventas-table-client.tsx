"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
import { VentaActions } from "@/components/venta-actions"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { VentaConProducto } from "@/lib/types"

export const plataformaLabelsClient: Record<string, string> = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

export const columns = [
  {
    key: "fecha",
    header: "Fecha",
    render: (venta: VentaConProducto) => new Date(venta.fecha).toLocaleDateString(),
  },
  {
    key: "comprador",
    header: "Comprador",
  },
  {
    key: "producto",
    header: "Producto",
    render: (venta: VentaConProducto) => venta.producto?.modelo ?? "",
  },
  {
    key: "plataforma",
    header: "Plataforma",
    render: (venta: VentaConProducto) => (
      <Badge variant="outline">
        {plataformaLabelsClient[venta.plataforma as keyof typeof plataformaLabelsClient]}
      </Badge>
    ),
  },
  {
    key: "pvBruto",
    header: "PV Bruto",
    render: (venta: VentaConProducto) => `$${Number(venta.pvBruto).toLocaleString()}`,
  },
  {
    key: "costoEnvio",
    header: "Costo Envío",
    render: (venta: VentaConProducto) => `$${Number(venta.cargoEnvioCosto).toLocaleString()}`,
  },
  {
    key: "comisiones",
    header: "Comisiones",
    render: (venta: VentaConProducto) => {
      const comisionBase = Number(venta.comision || 0)
      
      // Para TN: IVA 21% + IIBB 3% sobre la comisión base
      const ivaComision = venta.plataforma === 'TN' ? comisionBase * 0.21 : 0
      const iibbComision = venta.plataforma === 'TN' ? comisionBase * 0.03 : 0
      const total = comisionBase + ivaComision + iibbComision
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-gray-400">
                ${total.toFixed(2)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1 text-xs">
                <div className="font-medium mb-2">Desglose de Comisiones:</div>
                <div className="flex justify-between">
                  <span>Comisión base:</span>
                  <span>${comisionBase.toFixed(2)}</span>
                </div>
                {venta.plataforma === 'TN' && (
                  <>
                    <div className="flex justify-between text-orange-600">
                      <span>• IVA (21%):</span>
                      <span>${ivaComision.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>• IIBB (3%):</span>
                      <span>${iibbComision.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="border-t pt-1 mt-1 flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    key: "costoUnitario",
    header: "Costo Unitario",
    render: (venta: VentaConProducto) => `$${Number(venta.producto.costoUnitarioARS).toLocaleString()}`,
  },
  {
    key: "margen",
    header: "Margen",
    render: (venta: VentaConProducto) => {
      const margen = Number(venta.ingresoMargen || 0)
      return (
        <span className={margen >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          ${margen.toLocaleString()}
        </span>
      )
    },
  },
  {
    key: "estadoEnvio",
    header: "Estado",
    render: (venta: VentaConProducto) => <EstadoEnvioBadge estado={venta.estadoEnvio} />,
  },
  {
    key: "acciones",
    header: "Acciones",
    render: (venta: VentaConProducto) => <VentaActions venta={venta} />,
  },
]

export function VentasTableClient({ ventas }: { ventas: VentaConProducto[] }) {
  const totales = ventas.reduce(
    (acc, venta) => {
      const comisionBase = Number(venta.comision || 0)
      const iibb = Number(venta.iibb || 0)
      
      // Para TN, calcular IVA adicional sobre comisiones si no está incluido
      let ivaAdicional = 0
      if (venta.plataforma === 'TN') {
        ivaAdicional = comisionBase * 0.21 // 21% IVA sobre comisiones
      }
      
      const comisionTotal = comisionBase + ivaAdicional + iibb
      
      return {
        pvBruto: acc.pvBruto + Number(venta.pvBruto),
        cargoEnvio: acc.cargoEnvio + Number(venta.cargoEnvioCosto),
        comisiones: acc.comisiones + comisionTotal,
        costoUnitario: acc.costoUnitario + Number(venta.producto.costoUnitarioARS),
        margen: acc.margen + Number(venta.ingresoMargen || 0),
      }
    },
    { pvBruto: 0, cargoEnvio: 0, comisiones: 0, costoUnitario: 0, margen: 0 },
  )

  return (
    <div className="space-y-4">
      <DataTable data={ventas} columns={columns} searchable searchPlaceholder="Buscar ventas..." />
      {ventas.length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Totales ({ventas.length} ventas)</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">PV Bruto Total:</span>
              <div className="font-medium">${totales.pvBruto.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Costo Envío Total:</span>
              <div className="font-medium">${totales.cargoEnvio.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Comisiones Total:</span>
              <div className="font-medium">${totales.comisiones.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Costo Unitario Total:</span>
              <div className="font-medium">${totales.costoUnitario.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Margen Total:</span>
              <div className={`font-medium ${totales.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totales.margen.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

