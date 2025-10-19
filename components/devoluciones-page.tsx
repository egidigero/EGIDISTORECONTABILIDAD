import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";

// Minimal type for the table rows (matches fields used in this component)
type DevolucionRow = {
  id: string
  fecha?: string | null
  estado?: string | null
  motivo?: string | null
  ventaId?: string | null
  plataforma?: string | null
  montoDevuelto?: number | null
}

// Dummy data for now (explicitly typed to avoid implicit any[])
const devoluciones: DevolucionRow[] = [];

export default function DevolucionesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Devoluciones y Reclamos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Link href="/devoluciones/nueva" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">+ Nueva devolución / reclamo</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Fecha</th>
                  <th className="p-2 border">Estado</th>
                  <th className="p-2 border">Motivo</th>
                  <th className="p-2 border">Venta</th>
                  <th className="p-2 border">Plataforma</th>
                  <th className="p-2 border">Monto devuelto</th>
                  <th className="p-2 border">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {devoluciones.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-4 text-gray-400">Sin devoluciones ni reclamos</td></tr>
                ) : (
                  devoluciones.map((d) => (
                    <tr key={d.id}>
                      <td className="border p-2">{d.fecha}</td>
                      <td className="border p-2">{d.estado}</td>
                      <td className="border p-2">{d.motivo}</td>
                      <td className="border p-2">{d.ventaId || '-'}</td>
                      <td className="border p-2">{d.plataforma}</td>
                      <td className="border p-2">${d.montoDevuelto}</td>
                      <td className="border p-2">
                        <Link href={`/devoluciones/${d.id}`}>Ver</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
