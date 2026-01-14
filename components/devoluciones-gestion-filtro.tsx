"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Filter, X, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DevolucionesGestionFiltroProps {
  onFilter: (filtros: any) => void
  totalDevoluciones: number
  devolucionesFiltradas: number
}

export function DevolucionesGestionFiltro({ 
  onFilter, 
  totalDevoluciones,
  devolucionesFiltradas 
}: DevolucionesGestionFiltroProps) {
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [plataforma, setPlataforma] = useState<string>('todas')
  const [estado, setEstado] = useState<string>('todos')
  const [estadoRecepcion, setEstadoRecepcion] = useState<string>('todos')
  const [estadoPrueba, setEstadoPrueba] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [filtrosActivos, setFiltrosActivos] = useState(0)

  function aplicarFiltros() {
    const filtros = {
      fechaInicio,
      fechaFin,
      plataforma: plataforma !== 'todas' ? plataforma : undefined,
      estado: estado !== 'todos' ? estado : undefined,
      estadoRecepcion: estadoRecepcion !== 'todos' ? estadoRecepcion : undefined,
      estadoPrueba: estadoPrueba !== 'todos' ? estadoPrueba : undefined,
      busqueda: busqueda.trim() || undefined
    }
    
    // Contar filtros activos
    let activos = 0
    if (fechaInicio) activos++
    if (fechaFin) activos++
    if (plataforma !== 'todas') activos++
    if (estado !== 'todos') activos++
    if (estadoRecepcion !== 'todos') activos++
    if (estadoPrueba !== 'todos') activos++
    if (busqueda.trim()) activos++
    setFiltrosActivos(activos)
    
    onFilter(filtros)
  }

  function limpiarFiltros() {
    setFechaInicio('')
    setFechaFin('')
    setPlataforma('todas')
    setEstado('todos')
    setEstadoRecepcion('todos')
    setEstadoPrueba('todos')
    setBusqueda('')
    setFiltrosActivos(0)
    onFilter({})
  }

  function aplicarRangoRapido(dias: number) {
    const hoy = new Date()
    const inicio = new Date()
    inicio.setDate(hoy.getDate() - dias)
    setFechaInicio(inicio.toISOString().split('T')[0])
    setFechaFin(hoy.toISOString().split('T')[0])
  }

  function filtrarPendientes() {
    setEstado('En devolución')
    setTimeout(aplicarFiltros, 100)
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Encabezado con resultados */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Filtros</h3>
              {filtrosActivos > 0 && (
                <Badge variant="secondary">{filtrosActivos} activos</Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Mostrando <span className="font-semibold text-foreground">{devolucionesFiltradas}</span> de {totalDevoluciones}
              </span>
              {filtrosActivos > 0 && (
                <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Búsqueda rápida */}
          <div className="space-y-2">
            <Label htmlFor="busqueda" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              Búsqueda rápida
            </Label>
            <div className="flex gap-2">
              <Input 
                id="busqueda"
                placeholder="Buscar por ID, comprador, producto, teléfono..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
              />
              <Button onClick={aplicarFiltros}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground flex items-center">Acceso rápido:</span>
            <Button variant="outline" size="sm" onClick={() => {
              setEstadoRecepcion('no_recibido')
              setEstadoPrueba('todos')
              setEstado('todos')
              setTimeout(aplicarFiltros, 100)
            }}>
              📦 En camino
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setEstadoRecepcion('recibido')
              setEstadoPrueba('pendiente_probar')
              setEstado('todos')
              setTimeout(aplicarFiltros, 100)
            }}>
              🔍 Pendientes de probar
            </Button>
            <Button variant="outline" size="sm" onClick={filtrarPendientes}>
              En devolución
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(7)}>
              Últimos 7 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(15)}>
              Últimos 15 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(30)}>
              Últimos 30 días
            </Button>
          </div>

          {/* Filtros detallados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Fecha reclamo desde
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
                Fecha reclamo hasta
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
                  <SelectItem value="reembolso">Reembolso</SelectItem>
                  <SelectItem value="cambio">Cambio</SelectItem>
                  <SelectItem value="Entregada - Sin reembolso">Sin reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoRecepcion">📦 Recepción</Label>
              <Select value={estadoRecepcion} onValueChange={setEstadoRecepcion}>
                <SelectTrigger id="estadoRecepcion">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="recibido">✅ Recibido</SelectItem>
                  <SelectItem value="no_recibido">📦 En camino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoPrueba">🔍 Prueba</Label>
              <Select value={estadoPrueba} onValueChange={setEstadoPrueba}>
                <SelectTrigger id="estadoPrueba">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente_probar">Pendiente probar</SelectItem>
                  <SelectItem value="probado">Probado</SelectItem>
                  <SelectItem value="funciona">Probado - Funciona</SelectItem>
                  <SelectItem value="no_funciona">Probado - No funciona</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón aplicar */}
          <div className="flex justify-end">
            <Button onClick={aplicarFiltros}>
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
