"use server"

import { supabase } from "@/lib/supabase"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"

/**
 * Establece los saldos iniciales de septiembre 2025
 * Datos proporcionados por el usuario:
 * - Dinero disponible: $40.976.132,41
 * - MP a liquidar: $879.742,32
 * - TN a liquidar: $1.180.104,47
 */
export async function establecerSaldosInicialesSeptiembre() {
  try {
    const fechaInicial = '2025-09-01'
    
    console.log('🔧 Estableciendo saldos iniciales para septiembre 2025...')
    
    // Verificar si ya existe una liquidación para esta fecha
    const { data: liquidacionExistente } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fechaInicial)
      .single()
    
    const saldosIniciales = {
      fecha: fechaInicial,
      mp_disponible: 40976132.41,
      mp_a_liquidar: 879742.32,
      mp_liquidado_hoy: 0,
      tn_a_liquidar: 1180104.47,
      tn_liquidado_hoy: 0,
      tn_iibb_descuento: 0,
      observaciones: 'Saldos iniciales septiembre 2025 - establecidos manualmente'
    }
    
    if (liquidacionExistente) {
      console.log('📝 Actualizando liquidación existente...')
      
      const { error: updateError } = await supabase
        .from('liquidaciones')
        .update(saldosIniciales)
        .eq('fecha', fechaInicial)
      
      if (updateError) {
        console.error('Error actualizando saldos iniciales:', updateError)
        return { success: false, error: updateError.message }
      }
    } else {
      console.log('🆕 Creando nueva liquidación inicial...')
      
      const { error: insertError } = await supabase
        .from('liquidaciones')
        .insert([{
          id: `liq_inicial_sept_2025`,
          ...saldosIniciales
        }])
      
      if (insertError) {
        console.error('Error creando saldos iniciales:', insertError)
        return { success: false, error: insertError.message }
      }
    }
    
    console.log('✅ Saldos iniciales establecidos exitosamente:', saldosIniciales)
    
    // Recalcular todas las liquidaciones desde la fecha inicial
    console.log('🔄 Recalculando liquidaciones desde la fecha inicial...')
    await recalcularLiquidacionesEnCascada(fechaInicial)
    
    return { 
      success: true, 
      message: 'Saldos iniciales establecidos y liquidaciones recalculadas',
      saldosEstablecidos: saldosIniciales
    }
    
  } catch (error) {
    console.error('Error estableciendo saldos iniciales:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

/**
 * Función para verificar los saldos actuales de una fecha específica
 */
export async function verificarSaldosFecha(fecha: string) {
  try {
    const { data: liquidacion, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()
    
    if (error || !liquidacion) {
      return { 
        success: false, 
        error: `No se encontró liquidación para la fecha ${fecha}` 
      }
    }
    
    console.log(`💰 Saldos para ${fecha}:`, {
      mp_disponible: liquidacion.mp_disponible,
      mp_a_liquidar: liquidacion.mp_a_liquidar,
      mp_liquidado_hoy: liquidacion.mp_liquidado_hoy,
      tn_a_liquidar: liquidacion.tn_a_liquidar,
      tn_liquidado_hoy: liquidacion.tn_liquidado_hoy,
      observaciones: liquidacion.observaciones
    })
    
    return { success: true, liquidacion }
    
  } catch (error) {
    console.error('Error verificando saldos:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

/**
 * Función para diagnosticar problemas en el cálculo de TN a liquidar
 */
export async function diagnosticarCalculoTN(fecha: string) {
  try {
    console.log(`🔍 Diagnosticando cálculo TN para fecha: ${fecha}`)
    
    // Obtener liquidación del día
    const { data: liquidacion } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()
    
    // Obtener liquidación anterior
    const { data: liquidacionAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    
    // Obtener ventas TN del día
    const { data: ventasTN } = await supabase
      .from('ventas')
      .select('*')
      .eq('plataforma', 'TN')
      .eq('fecha', fecha)
    
    // Calcular manualmente
    let totalVentasTN = 0
    let totalComisionesBase = 0
    let totalIVA = 0
    let totalIIBB = 0
    let totalALiquidarVentas = 0
    
    if (ventasTN && ventasTN.length > 0) {
      ventasTN.forEach((venta: any) => {
        const pvBruto = Number(venta.pvBruto || 0)
        const comisionTotal = Number(venta.comision || 0)
        
        // Extraer comisión base (sin IVA)
        const comisionBase = comisionTotal / 1.21
        const iva = comisionBase * 0.21
        const iibb = comisionBase * 0.03
        
        const aLiquidar = pvBruto - comisionBase - iva - iibb
        
        totalVentasTN += pvBruto
        totalComisionesBase += comisionBase
        totalIVA += iva
        totalIIBB += iibb
        totalALiquidarVentas += aLiquidar
      })
    }
    
    const tnCalculadoManual = (liquidacionAnterior?.tn_a_liquidar || 0) + totalALiquidarVentas - (liquidacion?.tn_liquidado_hoy || 0)
    
    console.log(`📊 Diagnóstico para ${fecha}:`, {
      liquidacionAnterior: {
        fecha: liquidacionAnterior?.fecha,
        tn_a_liquidar: liquidacionAnterior?.tn_a_liquidar
      },
      ventasDelDia: {
        cantidad: ventasTN?.length || 0,
        totalVentasTN,
        totalComisionesBase: totalComisionesBase.toFixed(2),
        totalIVA: totalIVA.toFixed(2),
        totalIIBB: totalIIBB.toFixed(2),
        totalALiquidarVentas: totalALiquidarVentas.toFixed(2)
      },
      liquidacionActual: {
        tn_a_liquidar: liquidacion?.tn_a_liquidar,
        tn_liquidado_hoy: liquidacion?.tn_liquidado_hoy
      },
      calculoManual: {
        formula: `${liquidacionAnterior?.tn_a_liquidar} + ${totalALiquidarVentas.toFixed(2)} - ${liquidacion?.tn_liquidado_hoy || 0}`,
        resultado: tnCalculadoManual.toFixed(2),
        diferencia: liquidacion ? (tnCalculadoManual - liquidacion.tn_a_liquidar).toFixed(2) : 'N/A'
      }
    })
    
    return {
      success: true,
      diagnostico: {
        liquidacionAnterior,
        ventasTN,
        liquidacionActual: liquidacion,
        calculoManual: {
          tnCalculado: tnCalculadoManual,
          diferencia: liquidacion ? tnCalculadoManual - liquidacion.tn_a_liquidar : 0
        }
      }
    }
    
  } catch (error) {
    console.error('Error en diagnóstico:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
