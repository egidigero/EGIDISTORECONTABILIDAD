"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, TrendingUp } from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"

const canalOptions = [
  { value: "all", label: "Todos los canales" },
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
  { value: "General", label: "General" },
]

const periodosPreset = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Este mes", custom: "thisMonth" },
  { label: "Mes anterior", custom: "lastMonth" },
]

export function EERRFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState({
    fechaDesde: searchParams.get("fechaDesde") || format(subDays(new Date(), 30), "yyyy-MM-dd"),
    fechaHasta: searchParams.get("fechaHasta") || format(new Date(), "yyyy-MM-dd"),
    canal: searchParams.get("canal") || "all",
  })

  const applyFilters = () => {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "all") {
        params.set(key, value)
      }
    })

    router.push(`/eerr?${params.toString()}`)
  }

  const applyPreset = (preset: any) => {
    let fechaDesde: Date
    let fechaHasta: Date

    if (preset.custom === "thisMonth") {
      fechaDesde = startOfMonth(new Date())
      fechaHasta = endOfMonth(new Date())
    } else if (preset.custom === "lastMonth") {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      fechaDesde = startOfMonth(lastMonth)
      fechaHasta = endOfMonth(lastMonth)
    } else {
      fechaHasta = new Date()
      fechaDesde = subDays(fechaHasta, preset.days)
    }

    const newFilters = {
      ...filters,
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
    }

    setFilters(newFilters)

    // Aplicar inmediatamente
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== "all") {
        params.set(key, value)
      }
    })
    router.push(`/eerr?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Filtros de Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {periodosPreset.map((preset) => (
            <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)}>
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <SelectValue placeholder="Seleccionar canal" />
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
        </div>

        <Button onClick={applyFilters}>
          <TrendingUp className="h-4 w-4 mr-2" />
          Generar Reporte
        </Button>
      </CardContent>
    </Card>
  )
}
