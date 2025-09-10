/**
 * Script para establecer saldos iniciales de septiembre 2025 y recalcular liquidaciones
 */

import { establecerSaldosIniciales } from '@/lib/actions/saldos-iniciales'
import { recalcularLiquidacionesEnCascada } from '@/lib/actions/recalcular-liquidaciones'

async function main() {
  try {
    console.log('🚀 Iniciando configuración de saldos iniciales...')
    
    // 1. Establecer saldos iniciales de septiembre
    const resultadoSaldos = await establecerSaldosIniciales()
    
    if (!resultadoSaldos.success) {
      throw new Error(`Error estableciendo saldos: ${resultadoSaldos.error}`)
    }
    
    console.log('✅ Saldos iniciales establecidos correctamente')
    
    // 2. Recalcular todas las liquidaciones desde septiembre
    console.log('🔄 Recalculando liquidaciones desde 2025-09-01...')
    await recalcularLiquidacionesEnCascada('2025-09-01')
    
    console.log('✅ Proceso completado exitosamente')
    
  } catch (error) {
    console.error('❌ Error en el proceso:', error)
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
}

export { main as configurarSaldosIniciales }
