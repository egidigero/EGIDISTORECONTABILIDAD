"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DevolucionesFiltro({ onStats }: { onStats: (stats: any) => void }) {
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function fetchStats() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaInicio) params.set('fechaInicio', fechaInicio)
      if (fechaFin) params.set('fechaFin', fechaFin)
      const res = await fetch(`/api/devoluciones/estadisticas?${params.toString()}`)
      const json = await res.json()
      if (json?.success) onStats(json.data)
    } catch (err) {
      console.error('Error fetching devoluciones stats', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Desde</span>
        <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Hasta</span>
        <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
      </label>
      <Button onClick={fetchStats} disabled={loading}>{loading ? 'Cargando...' : 'Aplicar'}</Button>
    </div>
  )
}
