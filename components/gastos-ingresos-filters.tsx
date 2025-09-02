"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, X } from "lucide-react"

const canalOptions = [
  { value: "all", label: "Todos los canales" },
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
  { value: "General", label: "General" },
]

const tipoOptions = [
  { value: "all", label: "Todos los tipos" },
  { value: "Gasto", label: "Gastos" },
  { value: "OtroIngreso", label: "Otros Ingresos" },
]

export function GastosIngresosFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    fechaDesde: searchParams.get("fechaDesde") || "",
    fechaHasta: searchParams.get("fechaHasta") || "",
    canal: searchParams.get("canal") || "all",
    tipo: searchParams.get("tipo") || "all",
    categoria: searchParams.get("categoria") || "",
  })

  const applyFilters = () => {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "all" && value !== "") {
        params.set(key, value)
      }
    })

    router.push(`/gastos?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilters({
      fechaDesde: "",
      fechaHasta: "",
      canal: "all",
      tipo: "all",
      categoria: "",
    })
    router.push("/gastos")
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== "" && value !== "all")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaDesde">Fecha Desde</Label>
                <Input
                  id="fechaDesde"
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaHasta">Fecha Hasta</Label>
                <Input
                  id="fechaHasta"
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={filters.canal} onValueChange={(value) => setFilters({ ...filters, canal: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los canales" />
                  </SelectTrigger>
                  <SelectContent>
                    {canalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={filters.tipo} onValueChange={(value) => setFilters({ ...filters, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  placeholder="Buscar por categoría..."
                  value={filters.categoria}
                  onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFilters}>
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
