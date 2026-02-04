import { NextResponse } from 'next/server'
import { registrarPatrimonioDiario } from '@/lib/actions/patrimonio'

// Esta ruta se ejecutará automáticamente mediante cron
// Vercel Cron: Configurado en vercel.json
// O manualmente: curl https://tu-dominio.com/api/cron/patrimonio

export async function GET(request: Request) {
  // Verificar autorización (token secreto)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultado = await registrarPatrimonioDiario()
    
    return NextResponse.json({ 
      success: true, 
      mensaje: 'Patrimonio registrado correctamente',
      data: resultado 
    })
  } catch (error) {
    console.error('Error en cron patrimonio:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 })
  }
}

// Permitir POST también para mayor flexibilidad
export async function POST(request: Request) {
  return GET(request)
}
