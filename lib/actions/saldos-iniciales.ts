"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

/**
 * Función para establecer los saldos iniciales de septiembre 2025
 * Estos son los datos base desde los cuales se calculan todas las liquidaciones
 */
export async function establecerSaldosIniciales() {
  try {
    console.log('🏁 Estableciendo saldos iniciales de septiembre 2025...')
    
    // Fecha de inicio (1 de septiembre 2025)
    const fechaInicio = '2025-09-01'
    
    // Saldos iniciales proporcionados
    const saldosIniciales = {
      mp_disponible: 40976132.41,      // Dinero disponible
      mp_a_liquidar: 879742.32,        // MP a liquidar
      tn_a_liquidar: 1180104.47,       // TN a liquidar
      mp_liquidado_hoy: 0,             // No hubo liquidaciones el primer día
      tn_liquidado_hoy: 0,             // No hubo liquidaciones el primer día
      tn_iibb_descuento: 0             // No hubo descuentos el primer día
    }
    
    console.log('💰 Saldos iniciales:', saldosIniciales)
    
    // Verificar si ya existe una liquidación para esta fecha
    const { data: liquidacionExistente } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fechaInicio)
      .single()
    
    if (liquidacionExistente) {
      console.log('⚠️ Ya existe una liquidación para', fechaInicio)
      console.log('📊 Liquidación existente:', liquidacionExistente)
      
      // Actualizar la liquidación existente con los saldos iniciales
      const { data: liquidacionActualizada, error: errorUpdate } = await supabase
        .from('liquidaciones')
        .update({
          mp_disponible: saldosIniciales.mp_disponible,
          mp_a_liquidar: saldosIniciales.mp_a_liquidar,
          tn_a_liquidar: saldosIniciales.tn_a_liquidar,
          mp_liquidado_hoy: saldosIniciales.mp_liquidado_hoy,
          tn_liquidado_hoy: saldosIniciales.tn_liquidado_hoy,
          tn_iibb_descuento: saldosIniciales.tn_iibb_descuento,
          updatedAt: new Date().toISOString()
        })
        .eq('fecha', fechaInicio)
        .select()
        .single()
      
      if (errorUpdate) {
        console.error('❌ Error al actualizar liquidación inicial:', errorUpdate)
        return { success: false, error: errorUpdate.message }
      }
      
      console.log('✅ Liquidación inicial actualizada:', liquidacionActualizada)
      
    } else {
      // Crear nueva liquidación inicial
      const id = `liq_inicial_${Date.now()}`
      
      const { data: nuevaLiquidacion, error: errorCreate } = await supabase
        .from('liquidaciones')
        .insert([{
          id: id,
          fecha: fechaInicio,
          ...saldosIniciales,
          updatedAt: new Date().toISOString()
        }])
        .select()
        .single()
      
      if (errorCreate) {
        console.error('❌ Error al crear liquidación inicial:', errorCreate)
        return { success: false, error: errorCreate.message }
      }
      
      console.log('✅ Liquidación inicial creada:', nuevaLiquidacion)
    }
    
    // Ahora recalcular todas las liquidaciones posteriores desde esta fecha
    console.log('🔄 Recalculando liquidaciones desde la fecha inicial...')
    const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
    await recalcularLiquidacionesEnCascada(fechaInicio)
    
    revalidatePath("/liquidaciones")
    revalidatePath("/eerr")
    
    return {
      success: true,
      message: 'Saldos iniciales establecidos correctamente',
      saldosIniciales
    }
    
  } catch (error) {
    console.error('❌ Error al establecer saldos iniciales:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Función para obtener los saldos actuales del sistema
 */
export async function obtenerSaldosActuales() {
  try {
    // Obtener la liquidación más reciente
    const { data: liquidacionReciente, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    
    if (error || !liquidacionReciente) {
      return {
        success: false,
        error: 'No se encontraron liquidaciones'
      }
    }
    
    const saldosActuales = {
      fecha: liquidacionReciente.fecha,
      mp_disponible: liquidacionReciente.mp_disponible || 0,
      mp_a_liquidar: liquidacionReciente.mp_a_liquidar || 0,
      tn_a_liquidar: liquidacionReciente.tn_a_liquidar || 0,
      total_disponible: (liquidacionReciente.mp_disponible || 0) + 
                       (liquidacionReciente.mp_a_liquidar || 0) + 
                       (liquidacionReciente.tn_a_liquidar || 0)
    }
    
    return {
      success: true,
      saldosActuales
    }
    
  } catch (error) {
    console.error('Error al obtener saldos actuales:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Función para verificar la coherencia de los saldos
 */
export async function verificarCoherenciaSaldos() {
  try {
    // Obtener todas las liquidaciones ordenadas por fecha
    const { data: liquidaciones, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .order('fecha', { ascending: true })
    
    if (error || !liquidaciones || liquidaciones.length === 0) {
      return {
        success: false,
        error: 'No se encontraron liquidaciones para verificar'
      }
    }
    
    const verificaciones = []
    
    for (let i = 0; i < liquidaciones.length; i++) {
      const liquidacion = liquidaciones[i]
      const liquidacionAnterior = i > 0 ? liquidaciones[i - 1] : null
      
      // Verificar coherencia con liquidación anterior
      if (liquidacionAnterior) {
        const esperado_mp_disponible = liquidacionAnterior.mp_disponible + 
                                      liquidacion.mp_liquidado_hoy + 
                                      liquidacion.tn_liquidado_hoy - 
                                      liquidacion.tn_iibb_descuento
        
        const esperado_mp_a_liquidar = liquidacionAnterior.mp_a_liquidar - 
                                      liquidacion.mp_liquidado_hoy
        
        const esperado_tn_a_liquidar = liquidacionAnterior.tn_a_liquidar - 
                                      liquidacion.tn_liquidado_hoy
        
        const coherente = Math.abs(liquidacion.mp_disponible - esperado_mp_disponible) < 0.01 &&
                         Math.abs(liquidacion.mp_a_liquidar - esperado_mp_a_liquidar) < 0.01 &&
                         Math.abs(liquidacion.tn_a_liquidar - esperado_tn_a_liquidar) < 0.01
        
        verificaciones.push({
          fecha: liquidacion.fecha,
          coherente,
          diferencias: coherente ? null : {
            mp_disponible: liquidacion.mp_disponible - esperado_mp_disponible,
            mp_a_liquidar: liquidacion.mp_a_liquidar - esperado_mp_a_liquidar,
            tn_a_liquidar: liquidacion.tn_a_liquidar - esperado_tn_a_liquidar
          }
        })
      } else {
        // Primera liquidación - verificar si son los saldos iniciales esperados
        const esSaldoInicial = Math.abs(liquidacion.mp_disponible - 40976132.41) < 0.01 &&
                              Math.abs(liquidacion.mp_a_liquidar - 879742.32) < 0.01 &&
                              Math.abs(liquidacion.tn_a_liquidar - 1180104.47) < 0.01
        
        verificaciones.push({
          fecha: liquidacion.fecha,
          esPrimeraLiquidacion: true,
          tieneValoresIniciales: esSaldoInicial
        })
      }
    }
    
    return {
      success: true,
      verificaciones,
      totalLiquidaciones: liquidaciones.length,
      primeraFecha: liquidaciones[0].fecha,
      ultimaFecha: liquidaciones[liquidaciones.length - 1].fecha
    }
    
  } catch (error) {
    console.error('Error al verificar coherencia de saldos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
