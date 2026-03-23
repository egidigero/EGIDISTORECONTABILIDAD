"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Filter, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type ModoFecha = "reclamo" | "compra"

type FiltrosReporte = {
  modoFecha: ModoFecha
  fechaInicio: string
  fechaFin: string
  plataforma: string
  estado: string
  estadoRecepcion: string
  estadoPrueba: string
}

const DEFAULT_FILTROS: FiltrosReporte = {
  modoFecha: "reclamo",
  fechaInicio: "",
  fechaFin: "",
  plataforma: "todas",
  estado: "todos",
  estadoRecepcion: "todos",
  estadoPrueba: "todos",
}

function contarFiltrosActivos(filtros: FiltrosReporte) {
  let activos = 0
  if (filtros.fechaInicio) activos++
  if (filtros.fechaFin) activos++
  if (filtros.plataforma !== "todas") activos++
  if (filtros.estado !== "todos") activos++
  if (filtros.estadoRecepcion !== "todos") activos++
  if (filtros.estadoPrueba !== "todos") activos++
  return activos
}

export default function DevolucionesFiltro({ onStats }: { onStats: (stats: any) => void }) {
  const [modoFecha, setModoFecha] = useState<ModoFecha>(DEFAULT_FILTROS.modoFecha)
  const [fechaInicio, setFechaInicio] = useState(DEFAULT_FILTROS.fechaInicio)
  const [fechaFin, setFechaFin] = useState(DEFAULT_FILTROS.fechaFin)
  const [plataforma, setPlataforma] = useState(DEFAULT_FILTROS.plataforma)
  const [estado, setEstado] = useState(DEFAULT_FILTROS.estado)
  const [estadoRecepcion, setEstadoRecepcion] = useState(DEFAULT_FILTROS.estadoRecepcion)
  const [estadoPrueba, setEstadoPrueba] = useState(DEFAULT_FILTROS.estadoPrueba)
  const [loading, setLoading] = useState(false)
  const [filtrosActivos, setFiltrosActivos] = useState(0)

  const etiquetaFecha = modoFecha === "compra" ? "Compra" : "Reclamo"
  const descripcionVista =
    modoFecha === "compra"
      ? "Cohorte por fecha de compra. Esta vista permite comparar devoluciones contra ventas del mismo periodo."
      : "Vista operativa por fecha de reclamo. Sirve para analizar el flujo y el impacto del periodo en que se reclama."

  const getFiltrosActuales = (): FiltrosReporte => ({
    modoFecha,
    fechaInicio,
    fechaFin,
    plataforma,
    estado,
    estadoRecepcion,
    estadoPrueba,
  })

  async function fetchStats(filtros = getFiltrosActuales()) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("modoFecha", filtros.modoFecha)
      if (filtros.fechaInicio) params.set("fechaInicio", filtros.fechaInicio)
      if (filtros.fechaFin) params.set("fechaFin", filtros.fechaFin)
      if (filtros.plataforma !== "todas") params.set("plataforma", filtros.plataforma)
      if (filtros.estado !== "todos") params.set("estado", filtros.estado)
      if (filtros.estadoRecepcion !== "todos") params.set("estadoRecepcion", filtros.estadoRecepcion)
      if (filtros.estadoPrueba !== "todos") params.set("estadoPrueba", filtros.estadoPrueba)

      const res = await fetch(`/api/devoluciones/estadisticas?${params.toString()}`)
      const json = await res.json()
      if (json?.success) {
        onStats(json.data)
        setFiltrosActivos(contarFiltrosActivos(filtros))
      }
    } catch (err) {
      console.error("Error fetching devoluciones stats", err)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setModoFecha(DEFAULT_FILTROS.modoFecha)
    setFechaInicio(DEFAULT_FILTROS.fechaInicio)
    setFechaFin(DEFAULT_FILTROS.fechaFin)
    setPlataforma(DEFAULT_FILTROS.plataforma)
    setEstado(DEFAULT_FILTROS.estado)
    setEstadoRecepcion(DEFAULT_FILTROS.estadoRecepcion)
    setEstadoPrueba(DEFAULT_FILTROS.estadoPrueba)
    setFiltrosActivos(0)
    void fetchStats(DEFAULT_FILTROS)
  }

  function aplicarRangoRapido(dias: number) {
    const hoy = new Date()
    const inicio = new Date()
    inicio.setDate(hoy.getDate() - dias)
    setFechaInicio(inicio.toISOString().split("T")[0])
    setFechaFin(hoy.toISOString().split("T")[0])
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Filtros</h3>
              {filtrosActivos > 0 && <Badge variant="secondary">{filtrosActivos} activos</Badge>}
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

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={modoFecha === "compra" ? "default" : "secondary"}>
                {modoFecha === "compra" ? "Vista por compra" : "Vista por reclamo"}
              </Badge>
              <span className="text-sm text-muted-foreground">{descripcionVista}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground flex items-center">
              Rapido sobre {etiquetaFecha.toLowerCase()}:
            </span>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(7)}>
              Ultimos 7 dias
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(30)}>
              Ultimos 30 dias
            </Button>
            <Button variant="outline" size="sm" onClick={() => aplicarRangoRapido(90)}>
              Ultimos 90 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoy = new Date()
                const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
                setFechaInicio(inicioMes.toISOString().split("T")[0])
                setFechaFin(hoy.toISOString().split("T")[0])
              }}
            >
              Este mes
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modoFecha">Ver por</Label>
              <Select
                value={modoFecha}
                onValueChange={(value: ModoFecha) => {
                  setModoFecha(value)
                }}
              >
                <SelectTrigger id="modoFecha">
                  <SelectValue placeholder="Seleccionar vista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reclamo">Fecha de reclamo</SelectItem>
                  <SelectItem value="compra">Fecha de compra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaInicio" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {etiquetaFecha} desde
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFin" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {etiquetaFecha} hasta
              </Label>
              <Input
                id="fechaFin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="estadoRecepcion">Recepcion</Label>
              <Select value={estadoRecepcion} onValueChange={setEstadoRecepcion}>
                <SelectTrigger id="estadoRecepcion">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente_recibir">Pendiente recibir</SelectItem>
                  <SelectItem value="recibido">Ya recibido</SelectItem>
                  <SelectItem value="no_recibido">Aun en camino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoPrueba">Prueba</Label>
              <Select value={estadoPrueba} onValueChange={setEstadoPrueba}>
                <SelectTrigger id="estadoPrueba">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente_probar">Pendiente probar</SelectItem>
                  <SelectItem value="probado">Ya probado</SelectItem>
                  <SelectItem value="no_probado">Sin probar</SelectItem>
                  <SelectItem value="funciona">Probado - Funciona</SelectItem>
                  <SelectItem value="no_funciona">Probado - No funciona</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void fetchStats()} disabled={loading}>
              {loading ? "Aplicando filtros..." : "Aplicar filtros"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
