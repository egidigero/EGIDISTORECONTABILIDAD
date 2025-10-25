"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DevolucionActions } from "@/components/devolucion-actions"
import { useEffect } from "react"

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
  // Helper to read several possible field aliases coming from different view shapes
  const getAlias = (row: any, keys: string[], fallback: any = null) => {
    for (const k of keys) {
      if (row == null) break
      const v = (row as any)[k]
      if (v !== undefined && v !== null && String(v) !== '') return v
    }
    return fallback
  }
  useEffect(() => {
    try {
      console.debug('[DevolucionesTable] props.devoluciones.length=', Array.isArray(devoluciones) ? devoluciones.length : 'no-array', devoluciones?.[0])
    } catch (e) {
      // ignore
    }
  }, [devoluciones])
  const columns = [
    {
      key: "id_devolucion",
      header: "ID",
      render: (devolucion: any) => {
        const id = getAlias(devolucion, ['id_devolucion', 'numeroDevolucion', 'idDevolucion', 'id'])
        const track = getAlias(devolucion, ['numero_seguimiento', 'numeroSeguimiento', 'numeroSeguimiento', 'tracking', 'tracking_number'], null)
        return (
          <div>
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
              {id || 'Sin ID'}
            </code>
            <div className="text-xs text-muted-foreground mt-1">
              {track ? `N°: ${track}` : 'Sin N°'}
            </div>
          </div>
        )
      }
    },
    {
      key: "fecha_reclamo",
      header: "Reclamo",
      render: (devolucion: any) => {
        try {
          const s = devolucion?.fecha_reclamo ?? devolucion?.fechaReclamo ?? null
          if (!s) return '-'
          const d = new Date(s)
          if (isNaN(d.getTime())) return '-'
          return d.toLocaleDateString()
        } catch (e) {
          return '-'
        }
      },
    },
    {
      key: "venta",
      header: "Venta",
      render: (devolucion: any) => {
  const ventaCode = getAlias(devolucion, ['venta_codigo', 'saleCode', 'sale_code', 'externalOrderId', 'ventaId', 'venta_id'], 'N/A')
  const comprador = getAlias(devolucion, ['comprador', 'buyer_name', 'nombre_contacto', 'nombreContacto', 'displayName', 'cliente', 'buyer'], 'Sin comprador')
        return (
          <div>
            <code className="text-xs bg-muted px-2 py-1 rounded">{ventaCode || 'N/A'}</code>
            <div className="text-xs text-muted-foreground mt-1">
              {comprador || 'Sin comprador'}
            </div>
          </div>
        )
      }
    },
    {
      key: "producto",
      header: "Producto",
      render: (devolucion: any) => {
  const modelo = getAlias(devolucion, ['producto_nombre', 'producto_title', 'title', 'name', 'producto_modelo', 'modelo', 'product_model', 'producto_model', 'producto'], null)
  const sku = getAlias(devolucion, ['producto_sku', 'sku', 'product_sku', 'codigo_sku', 'product_sku'], null)
        // Fallbacks: try nested venta/producto info if present
        const ventaProd = getAlias(devolucion, ['producto', 'producto_obj', 'productos', 'producto_ref'], null)
        let modeloFinal = modelo
        if (!modeloFinal && ventaProd) {
          if (typeof ventaProd === 'string') modeloFinal = ventaProd
          else if (ventaProd?.modelo) modeloFinal = ventaProd.modelo
          else if (Array.isArray(ventaProd) && ventaProd[0]?.modelo) modeloFinal = ventaProd[0].modelo
        }
        // If still missing, show venta id as hint
        if (!modeloFinal) modeloFinal = getAlias(devolucion, ['venta_id', 'ventaId', 'sale_code', 'saleCode'], 'N/A')
        return (
          <div>
            <div className="font-medium text-sm">{modeloFinal || 'N/A'}</div>
            <div className="text-xs text-muted-foreground">SKU: {sku || 'N/A'}</div>
          </div>
        )
      }
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
      render: (devolucion: any) => {
        const nombre = getAlias(devolucion, ['nombre_contacto', 'nombreContacto', 'comprador', 'buyer_name', 'displayName'], 'N/A')
        const telefono = getAlias(devolucion, ['telefono_contacto', 'telefonoContacto', 'phone', 'phone_number', 'buyer_phone'], null)
        return (
          <div className="text-sm">
            <div className="font-medium">{nombre || 'N/A'}</div>
            {telefono ? (
              <div className="text-xs text-muted-foreground">{telefono}</div>
            ) : null}
          </div>
        )
      },
    },
    {
      key: "perdida_total",
      header: "Pérdida",
      render: (devolucion: any) => {
        const perdidaVal = getAlias(devolucion, ['perdida_total', 'perdidaTotal', 'perdida', 'loss', 'total_perdida'], 0)
        const perdida = Number(perdidaVal || 0)
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

