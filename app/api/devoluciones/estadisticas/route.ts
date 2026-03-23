import { NextResponse } from 'next/server'
import { getEstadisticasDevoluciones } from '@/lib/actions/devoluciones'

type ModoFecha = 'reclamo' | 'compra'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const modoFecha: ModoFecha = url.searchParams.get('modoFecha') === 'compra' ? 'compra' : 'reclamo'
    const fechaInicioRaw = url.searchParams.get('fechaInicio') || undefined
    const fechaFinRaw = url.searchParams.get('fechaFin') || undefined
    const fechaCompraInicio = url.searchParams.get('fechaCompraInicio') || undefined
    const fechaCompraFin = url.searchParams.get('fechaCompraFin') || undefined
    const plataforma = url.searchParams.get('plataforma') || undefined
    const estado = url.searchParams.get('estado') || undefined
    const estadoRecepcion = url.searchParams.get('estadoRecepcion') || undefined
    const estadoPrueba = url.searchParams.get('estadoPrueba') || undefined

    const fechaInicio = modoFecha === 'compra' ? (fechaCompraInicio || fechaInicioRaw) : fechaInicioRaw
    const fechaFin = modoFecha === 'compra' ? (fechaCompraFin || fechaFinRaw) : fechaFinRaw

    const stats = await getEstadisticasDevoluciones({
      modoFecha,
      fechaInicio,
      fechaFin,
      plataforma,
      estado,
      estadoRecepcion,
      estadoPrueba
    })
    return NextResponse.json({ success: true, data: stats })
  } catch (err: any) {
    console.error('API devoluciones/estadisticas error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
