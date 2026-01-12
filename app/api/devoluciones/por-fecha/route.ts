import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fecha = url.searchParams.get('fecha')
    if (!fecha) return NextResponse.json({ success: false, error: 'missing fecha' }, { status: 400 })

    // Buscar devoluciones que impacten esa fecha usando fecha_reclamo (fecha del reclamo)
    // Solo incluir devoluciones con estado completado
    const estadosCompletados = ['Entregada - Reembolso', 'Entregada - Cambio mismo producto', 'Entregada - Cambio otro producto', 'Entregada - Sin reembolso', 'Rechazada']
    
    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .gte('fecha_reclamo', `${fecha}T00:00:00.000Z`)
      .lte('fecha_reclamo', `${fecha}T23:59:59.999Z`)
      .in('estado', estadosCompletados)
      .order('fecha_reclamo', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('API /devoluciones/por-fecha error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
