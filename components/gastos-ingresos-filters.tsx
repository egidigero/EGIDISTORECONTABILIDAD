"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, X, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const canalOptions = [
  { value: "General", label: "General" },
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
]

const tipoOptions = [
  { value: "all", label: "Todos los tipos" },
  { value: "Gasto", label: "Gastos" },
  { value: "Ingreso", label: "Ingresos" },
]

export function GastosIngresosFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const today = new Date()
  
  const [filters, setFilters] = useState({
    fechaDesde: searchParams.get("fechaDesde") ? new Date(searchParams.get("fechaDesde")!) : today,
    fechaHasta: searchParams.get("fechaHasta") ? new Date(searchParams.get("fechaHasta")!) : today,
  canal: searchParams.get("canal") || "General",
    tipo: searchParams.get("tipo") || "all",
    categoria: searchParams.get("categoria") || "",
  })

  const applyFilters = () => {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'fechaDesde' || key === 'fechaHasta') {
        if (value && value instanceof Date) {
          params.set(key, format(value, 'yyyy-MM-dd'))
        }
      } else if (value !== "all" && value !== "") {
        params.set(key, value as string)
      }
    })

    router.push(`/gastos?${params.toString()}`)
  }

  const clearFilters = () => {
    const today = new Date()
    setFilters({
      fechaDesde: today,
      fechaHasta: today,
      canal: "all",
      tipo: "all",
      categoria: "",
    })
    router.push("/gastos")
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'fechaDesde' || key === 'fechaHasta') {
      return false // Las fechas siempre tienen valor por defecto, no cuentan como filtros activos
    }
    return value !== "" && value !== "all"
  })

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
                <Label>Fecha Desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaDesde && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaDesde ? (
                        format(filters.fechaDesde, "PPP", { locale: es })
                      ) : (
                        <span>Selecciona fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.fechaDesde}
                      onSelect={(date) => setFilters({ ...filters, fechaDesde: date || new Date() })}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.fechaHasta && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaHasta ? (
                        format(filters.fechaHasta, "PPP", { locale: es })
                      ) : (
                        <span>Selecciona fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.fechaHasta}
                      onSelect={(date) => setFilters({ ...filters, fechaHasta: date || new Date() })}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
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
