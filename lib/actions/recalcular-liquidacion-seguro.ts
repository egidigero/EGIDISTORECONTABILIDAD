"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

/**
 * Recalcula SOLO el impacto incremental de ventas TN en una liquidación
 * SIN afectar los valores base de MP disponible, MP a liquidar
 */
export async function recalcularImpactoVentasTN(fecha: string) {
  try {
    console.log(`Recalculando impacto ventas TN para ${fecha}`)
    
    // Obtener liquidación actual
    const { data: liquidacion, error: liquidacionError } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()

    if (liquidacionError || !liquidacion) {
      console.error('No se encontró liquidación para la fecha:', fecha)
      return { success: false, error: 'Liquidación no encontrada' }
    }

    // Obtener ventas TN del día
    const { calcularDetalleVentasTN } = await import('@/lib/actions/ventas-tn-liquidacion')
    const detalleVentasTN = await calcularDetalleVentasTN(fecha)

    // SOLO actualizar el campo tn_a_liquidar SUMANDO las ventas del día a los valores base
    // Los valores base de mp_disponible y mp_a_liquidar NO se tocan
    
    // Valor base del TN a liquidar (sin incluir ventas del día)
    const tnBaseLiquidar = Number(liquidacion.tn_a_liquidar) || 0
    
    // Calcular nuevo TN a liquidar = Base + Ventas del día
    const nuevoTnALiquidar = tnBaseLiquidar + detalleVentasTN.resumen.totalALiquidar

    // Solo actualizar tn_a_liquidar, dejando el resto intacto
    const { error: updateError } = await supabase
      .from('liquidaciones')
      .update({
        tn_a_liquidar: nuevoTnALiquidar,
        updatedAt: new Date().toISOString()
      })
      .eq('id', liquidacion.id)

    if (updateError) {
      console.error('Error actualizando liquidación:', updateError)
      return { success: false, error: updateError.message }
    }

    console.log(`✓ Impacto ventas TN recalculado para ${fecha}:`, {
      tnBaseLiquidar,
      ventasDelDia: detalleVentasTN.resumen.totalALiquidar,
      nuevoTotal: nuevoTnALiquidar
    })

    revalidatePath("/liquidaciones")
    return { success: true }

  } catch (error) {
    console.error('Error recalculando impacto ventas TN:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Recalcula SOLO el impacto de gastos/ingresos en MP disponible
 * SIN afectar los otros valores
 */
export async function recalcularImpactoGastosIngresos(fecha: string) {
  try {
    console.log(`Recalculando impacto gastos/ingresos para ${fecha}`)
    
    // Obtener liquidación actual
    const { data: liquidacion, error: liquidacionError } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()

    if (liquidacionError || !liquidacion) {
      console.error('No se encontró liquidación para la fecha:', fecha)
      return { success: false, error: 'Liquidación no encontrada' }
    }

    // Obtener gastos/ingresos del día
    const { calcularImpactoEnMPDisponible } = await import('@/lib/actions/gastos-ingresos')
    const impacto = await calcularImpactoEnMPDisponible(fecha)

    // SOLO actualizar MP disponible con el impacto de gastos/ingresos
    // Los valores de MP a liquidar y TN a liquidar NO se tocan
    
    // Valor base del MP disponible (sin incluir gastos/ingresos del día)
    const mpBaseDisponible = Number(liquidacion.mp_disponible) || 0
    
    // Calcular nuevo MP disponible = Base + Impacto gastos/ingresos
    const nuevoMpDisponible = mpBaseDisponible + impacto.impactoNeto

    // Solo actualizar mp_disponible, dejando el resto intacto
    const { error: updateError } = await supabase
      .from('liquidaciones')
      .update({
        mp_disponible: nuevoMpDisponible,
        updatedAt: new Date().toISOString()
      })
      .eq('id', liquidacion.id)

    if (updateError) {
      console.error('Error actualizando liquidación:', updateError)
      return { success: false, error: updateError.message }
    }

    console.log(`✓ Impacto gastos/ingresos recalculado para ${fecha}:`, {
      mpBaseDisponible,
      impactoDelDia: impacto.impactoNeto,
      nuevoTotal: nuevoMpDisponible
    })

    revalidatePath("/liquidaciones")
    return { success: true }

  } catch (error) {
    console.error('Error recalculando impacto gastos/ingresos:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
