"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Filter, X, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DevolucionesFiltro({ onStats }: { onStats: (stats: any) => void }) {
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [plataforma, setPlataforma] = useState<string>('todas')
  const [estado, setEstado] = useState<string>('todos')
  const [loading, setLoading] = useState(false)
  const [filtrosActivos, setFiltrosActivos] = useState(0)

  async function fetchStats() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaInicio) params.set('fechaInicio', fechaInicio)
      if (fechaFin) params.set('fechaFin', fechaFin)
      if (plataforma && plataforma !== 'todas') params.set('plataforma', plataforma)
      if (estado && estado !== 'todos') params.set('estado', estado)
      
      const res = await fetch(`/api/devoluciones/estadisticas?${params.toString()}`)
      const json = await res.json()
      if (json?.success) onStats(json.data)
      
      // Actualizar contador de filtros activos
      let activos = 0
      if (fechaInicio) activos++
      if (fechaFin) activos++
      if (plataforma !== 'todas') activos++
      if (estado !== 'todos') activos++
      setFiltrosActivos(activos)
    } catch (err) {
      console.error('Error fetching devoluciones stats', err)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFechaInicio('')
    setFechaFin('')
    setPlataforma('todas')
    setEstado('todos')
    setFiltrosActivos(0)
    fetchStats()
  }

  function aplicarRangoRapido(dias: number) {
    const hoy = new Date()
    const inicio = new Date()
    inicio.setDate(hoy.getDate() - dias)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(hoy.toISOString().split('T')[0])
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Encabezado de filtros */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Filtros</h3>
              {filtrosActivos > 0 && (
                <Badge variant="secondary">{filtrosActivos} activos</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {filtrosActivos > 0 && (
                <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Rangos rápidos */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground flex items-center">Rápido:</span>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(7)}>
              Últimos 7 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(30)}>
              Últimos 30 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(90)}>
              Últimos 90 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const hoy = new Date()
              const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
              setFechaInicio(inicioMes.toISOString().split('T')[0])
              setFechaFin(hoy.toISOString().split('T')[0])
            }}>
              Este mes
            </Button>
          </div>

          {/* Filtros principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Fecha desde
              </Label>
              <Input 
                id="fechaInicio"
                type="date" 
                value={fechaInicio} 
                onChange={e => setFechaInicio(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFin" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Fecha hasta
              </Label>
              <Input 
                id="fechaFin"
                type="date" 
                value={fechaFin} 
                onChange={e => setFechaFin(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plataforma">Plataforma</Label>
              <Select value={plataforma} onValueChange={setPlataforma}>
                <SelectTrigger id="plataforma">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="TN">Tienda Nube</SelectItem>
                  <SelectItem value="ML">Mercado Libre</SelectItem>
                  <SelectItem value="Directo">Venta Directa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger id="estado">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="En devolución">En devolución</SelectItem>
                  <SelectItem value="Aceptada en camino">Aceptada en camino</SelectItem>
                  <SelectItem value="Entregada - Reembolso">Entregada - Reembolso</SelectItem>
                  <SelectItem value="Entregada - Cambio mismo producto">Entregada - Cambio</SelectItem>
                  <SelectItem value="Entregada - Sin reembolso">Entregada - Sin reembolso</SelectItem>
                  <SelectItem value="Rechazada">Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón aplicar */}
          <div className="flex justify-end">
            <Button onClick={fetchStats} disabled={loading}>
              {loading ? 'Aplicando filtros...' : 'Aplicar Filtros'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
