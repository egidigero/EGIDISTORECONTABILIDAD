import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fecha = url.searchParams.get('fecha')
    if (!fecha) return NextResponse.json({ success: false, error: 'missing fecha' }, { status: 400 })

    // Buscar devoluciones que impacten esa fecha: fecha_completada o created_at dentro del día
    const fechaInicio = `${fecha}T00:00:00.000Z`
    const fechaFin = `${fecha}T23:59:59.999Z`

    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .or(`fecha_completada.gte.${fecha} , created_at.gte.${fecha}`) // fallback: rely on fecha fields
      .order('fecha_reclamo', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('API /devoluciones/por-fecha error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
