"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DevolucionActions } from "@/components/devolucion-actions"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const estadoColors = {
  Pendiente: "default",
  Procesada: "secondary",
  Rechazada: "destructive",
} as const

interface DevolucionesTableProps {
  devoluciones: any[]
}

export function DevolucionesTable({ devoluciones }: DevolucionesTableProps) {
  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (devolucion: any) => new Date(devolucion.fecha).toLocaleDateString(),
    },
    {
      key: "venta",
      header: "Venta",
      render: (devolucion: any) => (
        <div>
          <code className="text-xs bg-muted px-2 py-1 rounded">{devolucion.ventas?.saleCode || 'N/A'}</code>
          <div className="text-xs text-muted-foreground mt-1">
            {devolucion.ventas?.comprador || 'Sin comprador'}
          </div>
        </div>
      ),
    },
    {
      key: "plataforma",
      header: "Plataforma",
      render: (devolucion: any) => (
        <Badge variant="secondary">
          {plataformaLabels[devolucion.plataforma as keyof typeof plataformaLabels]}
        </Badge>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (devolucion: any) => (
        <div>
          <div className="font-medium">{devolucion.ventas?.productos?.modelo || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">
            SKU: {devolucion.ventas?.productos?.sku || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      render: (devolucion: any) => devolucion.motivo,
    },
    {
      key: "estado",
      header: "Estado",
      render: (devolucion: any) => (
        <Badge variant={estadoColors[devolucion.estado as keyof typeof estadoColors] || "default"}>
          {devolucion.estado}
        </Badge>
      ),
    },
    {
      key: "montoDevuelto",
      header: "Monto",
      render: (devolucion: any) => `$${Number(devolucion.montoDevuelto).toLocaleString()}`,
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
