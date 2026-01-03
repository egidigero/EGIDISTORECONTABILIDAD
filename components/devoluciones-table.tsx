"use client"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DevolucionActions } from "@/components/devolucion-actions"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

const plataformaLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre",
  Directo: "Venta Directa",
}

const estadoColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "En devolución": "default",
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  
  // Helper to read several possible field aliases coming from different view shapes
  const getAlias = (row: any, keys: string[], fallback: any = null) => {
    for (const k of keys) {
      if (row == null) break
      const v = (row as any)[k]
      if (v !== undefined && v !== null && String(v) !== '') return v
    }
    return fallback
  }
  
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
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
        return (
          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
            {id || 'Sin ID'}
          </code>
        )
      }
    },
    {
      key: "fecha_reclamo",
      header: "Día de reclamo",
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
        const comprador = getAlias(devolucion, ['comprador', 'buyer_name', 'nombre_contacto', 'nombreContacto', 'displayName', 'cliente', 'buyer'], 'Sin comprador')
        const telefono = getAlias(devolucion, ['telefono_contacto', 'telefonoContacto', 'phone', 'phone_number', 'buyer_phone'], null)
        return (
          <div className="text-sm">
            <div className="font-medium">{comprador || 'Sin comprador'}</div>
            {telefono && telefono !== '0' ? (
              <div className="text-xs text-muted-foreground">{telefono}</div>
            ) : null}
          </div>
        )
      }
    },
    {
      key: "producto",
      header: "Producto",
      render: (devolucion: any) => {
        const modelo = getAlias(devolucion, ['producto_modelo', 'productoModelo', 'modelo', 'producto_nombre', 'product_name'], 'N/A')
        const sku = getAlias(devolucion, ['producto_sku', 'productoSku', 'sku'], 'N/A')
        return (
          <div>
            <div className="font-medium text-sm">{modelo}</div>
            <div className="text-xs text-muted-foreground">SKU: {sku}</div>
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
      key: "perdida_total",
      header: "Pérdida",
      render: (devolucion: any) => {
        const perdidaVal = getAlias(devolucion, ['perdida_total', 'perdidaTotal', 'perdida', 'loss', 'total_perdida'], 0)
        const perdida = Number(perdidaVal || 0)
        const id = getAlias(devolucion, ['id_devolucion', 'numeroDevolucion', 'idDevolucion', 'id'])
        const isExpanded = expandedRows.has(id)
        
        return (
          <div className="flex items-center gap-2">
            <span className={perdida > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
              ${perdida.toLocaleString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleRow(id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
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

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th key={col.key} className="p-3 text-left text-sm font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devoluciones.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                No hay devoluciones registradas
              </td>
            </tr>
          ) : (
            devoluciones.map((devolucion) => {
              const id = getAlias(devolucion, ['id_devolucion', 'numeroDevolucion', 'idDevolucion', 'id'])
              const isExpanded = expandedRows.has(id)
              
              return (
                <>
                  <tr key={id} className="border-b hover:bg-muted/50">
                    {columns.map((col) => (
                      <td key={col.key} className="p-3 text-sm">
                        {col.render(devolucion)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr key={`${id}-expanded`} className="border-b bg-muted/20">
                      <td colSpan={columns.length} className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-semibold mb-2">Detalle de la pérdida</h4>
                            <div className="space-y-1 text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Costo producto:</span>
                                <span className="font-medium">${Number(getAlias(devolucion, ['total_costo_productos', 'totalCostoProductos', 'costo_producto_original', 'costoProductoOriginal'], 0)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Envío original:</span>
                                <span className="font-medium">${Number(getAlias(devolucion, ['costo_envio_original', 'costoEnvioOriginal'], 0)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Envío devolución:</span>
                                <span className="font-medium">${Number(getAlias(devolucion, ['costo_envio_devolucion', 'costoEnvioDevolucion'], 0)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Comisión:</span>
                                <span className="font-medium">${Number(getAlias(devolucion, ['comision_venta', 'comisionVenta', 'comision'], 0)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t font-semibold text-foreground">
                                <span>Total pérdida:</span>
                                <span className="text-red-600">${Number(getAlias(devolucion, ['perdida_total', 'perdidaTotal'], 0)).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Detalle del problema</h4>
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs text-muted-foreground">Motivo:</span>
                                <p className="text-sm">{getAlias(devolucion, ['motivo', 'razon', 'reason'], 'Sin especificar')}</p>
                              </div>
                              {getAlias(devolucion, ['observaciones', 'observacion', 'notes'], null) && (
                                <div>
                                  <span className="text-xs text-muted-foreground">Observaciones:</span>
                                  <p className="text-sm">{getAlias(devolucion, ['observaciones', 'observacion', 'notes'], '')}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-muted-foreground">Producto recuperable:</span>
                                <p className="text-sm font-medium">
                                  {getAlias(devolucion, ['producto_recuperable', 'productoRecuperable', 'se_recupera_producto'], false) ? '✓ Sí' : '✗ No'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

