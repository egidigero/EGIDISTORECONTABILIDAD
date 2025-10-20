"use client"

import { useEffect, useState } from 'react'
import DevolucionesFiltro from '@/components/devoluciones-filtro'
import { DevolucionesReporte } from '@/components/devoluciones-reporte'

export default function DevolucionesReportesClientWrapper({ initial }: { initial: any }) {
  const [stats, setStats] = useState<any>(initial)

  useEffect(() => {
    // no-op: initial already provided
  }, [])

  return (
    <div>
      <DevolucionesFiltro onStats={(s) => setStats(s)} />
      <div>
        <DevolucionesReporte estadisticas={stats} />
      </div>
    </div>
  )
}
