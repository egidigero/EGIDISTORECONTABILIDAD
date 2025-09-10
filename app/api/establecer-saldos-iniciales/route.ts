import { NextRequest, NextResponse } from 'next/server'
import { establecerSaldosInicialesSeptiembre, diagnosticarCalculoTN, verificarSaldosFecha } from '@/lib/actions/establecer-saldos-iniciales'
import { diagnosticarCalculoTNLiquidacion } from '@/lib/actions/diagnostico-tn-liquidacion'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion, fecha } = body

    switch (accion) {
      case 'establecer':
        const resultadoEstablecer = await establecerSaldosInicialesSeptiembre()
        return NextResponse.json(resultadoEstablecer)

      case 'diagnosticar':
        if (!fecha) {
          return NextResponse.json({ success: false, error: 'Fecha requerida para diagnóstico' })
        }
        const resultadoDiagnostico = await diagnosticarCalculoTN(fecha)
        return NextResponse.json(resultadoDiagnostico)

      case 'diagnosticar-tn':
        if (!fecha) {
          return NextResponse.json({ success: false, error: 'Fecha requerida para diagnóstico TN' })
        }
        const resultadoDiagnosticoTN = await diagnosticarCalculoTNLiquidacion(fecha)
        return NextResponse.json(resultadoDiagnosticoTN)

      case 'verificar':
        if (!fecha) {
          return NextResponse.json({ success: false, error: 'Fecha requerida para verificación' })
        }
        const resultadoVerificar = await verificarSaldosFecha(fecha)
        return NextResponse.json(resultadoVerificar)

      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' })
    }
  } catch (error) {
    console.error('Error en API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    })
  }
}
