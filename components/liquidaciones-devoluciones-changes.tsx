import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDevoluciones } from "@/lib/actions/devoluciones"

export async function LiquidacionesDevolucionesChanges(): Promise<React.ReactElement> {
  // Obtener devoluciones (recientes). Mostrar las 25 más recientes para que puedas
  // ver inmediatamente cualquier reembolso que hayas generado.
  const devoluciones = await getDevoluciones()
  const recent = (devoluciones || []).slice(0, 25)

  const formatCurrency = (v: any) => {
    const n = Number(v || 0)
    return n === 0 ? '-' : `$${n.toLocaleString()}`
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cambios por Devoluciones (impacto en liquidaciones)</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay devoluciones registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1">Fecha reclamo</th>
                  <th className="px-2 py-1">Fecha completada</th>
                  <th className="px-2 py-1">Devolución</th>
                  <th className="px-2 py-1">Venta</th>
                  <th className="px-2 py-1">Tipo</th>
                  <th className="px-2 py-1">Monto reembolsado</th>
                  <th className="px-2 py-1">Costo producto perdido</th>
                  <th className="px-2 py-1">Gasto creado</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d: any) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-2 py-1">{d.fecha_reclamo ? new Date(d.fecha_reclamo).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-1">{d.fecha_completada ? new Date(d.fecha_completada).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-1">{d.id_devolucion ?? d.numero_devolucion ?? d.id}</td>
                    <td className="px-2 py-1">{d.venta_id ?? d.venta ?? '-'}</td>
                    <td className="px-2 py-1">{d.tipo_resolucion ?? d.estado ?? '-'}</td>
                    <td className="px-2 py-1">{formatCurrency(d.monto_reembolsado)}</td>
                    {/* Monto aplicado a liquidación removido por petición */}
                    <td className="px-2 py-1">{formatCurrency(d.costo_producto_perdido ?? d.perdida_total)}</td>
                    <td className="px-2 py-1">{d.gasto_creado_id ? `${d.gasto_creado_id}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LiquidacionesDevolucionesChanges
