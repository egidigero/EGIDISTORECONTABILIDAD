import { NextResponse } from 'next/server'
import { getEstadisticasDevoluciones } from '@/lib/actions/devoluciones'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const fechaInicio = url.searchParams.get('fechaInicio') || undefined
    const fechaFin = url.searchParams.get('fechaFin') || undefined
    const stats = await getEstadisticasDevoluciones(fechaInicio, fechaFin)
    return NextResponse.json({ success: true, data: stats })
  } catch (err: any) {
    console.error('API devoluciones/estadisticas error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
