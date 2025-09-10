"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface GastoIngreso {
  fecha: string
  tipo: "Gasto" | "Ingreso"
  categoria: string
  descripcion: string
  montoARS: number
  canal?: string
}

interface EERRGastosIngresosTableProps {
  data: GastoIngreso[]
}

const tipoLabels = {
  Gasto: "Gasto",
  Ingreso: "Ingreso",
}

const canalLabels = {
  TN: "Tienda Nube",
  ML: "Mercado Libre", 
  Directo: "Venta Directa",
}

export function EERRGastosIngresosTable({ data }: EERRGastosIngresosTableProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredData = data.filter((item) =>
    Object.values(item).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar gastos e ingresos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item, index) => (
              <TableRow key={`${item.fecha}-${index}`}>
                <TableCell>{new Date(item.fecha).toLocaleDateString()}</TableCell>
                <TableCell>
                  {item.tipo === "Gasto" ? (
                    <Badge variant="destructive">
                      {tipoLabels[item.tipo]}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      {tipoLabels[item.tipo]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{item.categoria}</TableCell>
                <TableCell>{item.descripcion}</TableCell>
                <TableCell>
                  {item.canal ? (canalLabels[item.canal as keyof typeof canalLabels] || item.canal) : "General"}
                </TableCell>
                <TableCell>
                  <span className={item.tipo === "Gasto" ? "text-red-600" : "text-green-600"}>
                    {item.tipo === "Gasto" ? "-" : "+"}${Math.abs(Number(item.montoARS || 0)).toLocaleString()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
