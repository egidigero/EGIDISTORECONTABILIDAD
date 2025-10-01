"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DevolucionActions } from "@/components/devolucion-actions"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const estadoColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "Pendiente": "default",
  "Aceptada en camino": "secondary",
  "Entregada - Reembolso": "outline",
  "Entregada - Cambio mismo producto": "outline",
  "Entregada - Cambio otro producto": "outline",
  "Entregada - Sin reembolso": "outline",
  "Rechazada": "destructive",
}

interface DevolucionesTableProps {
  devoluciones: any[]
}

export function DevolucionesTable({ devoluciones }: DevolucionesTableProps) {
  const columns = [
    {
      key: "id_devolucion",
      header: "ID",
      render: (devolucion: any) => (
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
          {devolucion.id_devolucion || 'Sin ID'}
        </code>
      ),
    },
    {
      key: "fecha_reclamo",
      header: "Reclamo",
      render: (devolucion: any) => new Date(devolucion.fecha_reclamo).toLocaleDateString(),
    },
    {
      key: "venta",
      header: "Venta",
      render: (devolucion: any) => (
        <div>
          <code className="text-xs bg-muted px-2 py-1 rounded">{devolucion.venta_codigo || 'N/A'}</code>
          <div className="text-xs text-muted-foreground mt-1">
            {devolucion.comprador || 'Sin comprador'}
          </div>
        </div>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (devolucion: any) => (
        <div>
          <div className="font-medium text-sm">{devolucion.producto_modelo || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">
            SKU: {devolucion.producto_sku || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      key: "plataforma",
      header: "Plataforma",
      render: (devolucion: any) => (
        <Badge variant="secondary">
          {plataformaLabels[devolucion.plataforma as keyof typeof plataformaLabels] || devolucion.plataforma}
        </Badge>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (devolucion: any) => (
        <Badge variant={estadoColors[devolucion.estado] || "default"}>
          {devolucion.estado}
        </Badge>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      render: (devolucion: any) => (
        <div className="text-sm">
          <div className="font-medium">{devolucion.nombre_contacto || 'N/A'}</div>
          {devolucion.telefono_contacto && (
            <div className="text-xs text-muted-foreground">{devolucion.telefono_contacto}</div>
          )}
        </div>
      ),
    },
    {
      key: "perdida_total",
      header: "Pérdida",
      render: (devolucion: any) => {
        const perdida = Number(devolucion.perdida_total || 0)
        return (
          <span className={perdida > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
            ${perdida.toLocaleString()}
          </span>
        )
      },
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (devolucion: any) => (
        <DevolucionActions devolucion={devolucion} />
      ),
    },
  ]

  return <DataTable data={devoluciones} columns={columns} />
}

