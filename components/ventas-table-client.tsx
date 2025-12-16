"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
import { VentaActions } from "@/components/venta-actions"
import { useEffect, useState } from "react"
import { getVentas } from "@/lib/actions/ventas"
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
      // Usar los valores directos de la base de datos
      const comisionBase = Number(venta.comision || 0)
      const iva = Number(venta.iva || 0)
      const iibb = Number(venta.iibb || 0)
      const total = comisionBase + iva + iibb
      
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
                {iva > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>• IVA (21%):</span>
                    <span>${iva.toFixed(2)}</span>
                  </div>
                )}
                {iibb > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>• IIBB:</span>
                    <span>${iibb.toFixed(2)}</span>
                  </div>
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

interface VentasTableClientProps {
  ventas?: VentaConProducto[]
  productoId?: string
}

export function VentasTableClient({ ventas: ventasProp, productoId }: VentasTableClientProps) {
  const [ventas, setVentas] = useState<VentaConProducto[]>(ventasProp || [])
  const [loading, setLoading] = useState(!ventasProp)

  useEffect(() => {
    if (!ventasProp && productoId) {
      setLoading(true)
      getVentas().then((allVentas) => {
        const filtered = allVentas.filter((v: any) => v.productoId === productoId)
        setVentas(filtered)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    } else if (ventasProp) {
      setVentas(ventasProp)
    }
  }, [ventasProp, productoId])

  if (loading) {
    return <div className="text-center py-4">Cargando ventas...</div>
  }

  const totales = ventas.reduce(
    (acc, venta) => {
      const pvBruto = Number(venta.pvBruto || 0)
      const cargoEnvio = Number(venta.cargoEnvioCosto || 0)
      const comisionBase = Number(venta.comision || 0)
      const iva = Number(venta.iva || 0)
      const iibb = Number(venta.iibb || 0)
      const costoProducto = Number(venta.producto.costoUnitarioARS || 0)
      
      // Comisión total = comisión base + IVA + IIBB
      const comisionTotal = comisionBase + iva + iibb
      
      // Margen real = PV Bruto - Comisiones - Envío - Costo Producto
      const margen = pvBruto - comisionTotal - cargoEnvio - costoProducto
      
      return {
        pvBruto: acc.pvBruto + pvBruto,
        cargoEnvio: acc.cargoEnvio + cargoEnvio,
        comisiones: Number((acc.comisiones + comisionTotal).toFixed(2)),
        costoUnitario: acc.costoUnitario + costoProducto,
        margen: Number((acc.margen + margen).toFixed(2)),
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

