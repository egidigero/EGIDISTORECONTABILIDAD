import { NextResponse } from 'next/server'
import { getEstadisticasDevoluciones } from '@/lib/actions/devoluciones'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const fechaInicio = url.searchParams.get('fechaInicio') || undefined
    const fechaFin = url.searchParams.get('fechaFin') || undefined
    const fechaCompraInicio = url.searchParams.get('fechaCompraInicio') || undefined
    const fechaCompraFin = url.searchParams.get('fechaCompraFin') || undefined
    const plataforma = url.searchParams.get('plataforma') || undefined
    const estado = url.searchParams.get('estado') || undefined
    const estadoRecepcion = url.searchParams.get('estadoRecepcion') || undefined
    const estadoPrueba = url.searchParams.get('estadoPrueba') || undefined
    
    const stats = await getEstadisticasDevoluciones(
      fechaInicio, 
      fechaFin, 
      fechaCompraInicio, 
      fechaCompraFin,
      plataforma,
      estado,
      estadoRecepcion,
      estadoPrueba
    )
    return NextResponse.json({ success: true, data: stats })
  } catch (err: any) {
    console.error('API devoluciones/estadisticas error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
