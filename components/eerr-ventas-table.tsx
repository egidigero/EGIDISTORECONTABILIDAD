"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
import type { EstadoEnvio } from "@/lib/types"

interface Venta {
  id?: string
  fecha: string
  saleCode: string
  comprador: string
  productos?: { modelo: string }
  producto?: { modelo: string }
  pvBruto: number
  precioNeto: number
  ingresoMargen: number
  estadoEnvio: EstadoEnvio
}

interface EERRVentasTableProps {
  data: Venta[]
}

export function EERRVentasTable({ data }: EERRVentasTableProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredData = data.filter((venta) =>
    Object.values(venta).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar ventas..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>PV Bruto</TableHead>
              <TableHead>Precio Neto</TableHead>
              <TableHead>Margen</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((venta, index) => (
              <TableRow key={`${venta.saleCode}-${index}`}>
                <TableCell>{new Date(venta.fecha).toLocaleDateString()}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>
                </TableCell>
                <TableCell>{venta.comprador}</TableCell>
                <TableCell>{venta.producto?.modelo || venta.productos?.modelo || "N/A"}</TableCell>
                <TableCell>${Number(venta.pvBruto || 0).toLocaleString()}</TableCell>
                <TableCell>${Number(venta.precioNeto || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <span className={Number(venta.ingresoMargen || 0) >= 0 ? "text-green-600" : "text-red-600"}>
                    ${Number(venta.ingresoMargen || 0).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <EstadoEnvioBadge estado={venta.estadoEnvio} />
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No se encontraron resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
