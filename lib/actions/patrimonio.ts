"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { getLiquidaciones } from "@/lib/actions/liquidaciones"
import { getProductos } from "@/lib/actions/productos"

/**
 * Registra un snapshot del patrimonio para una fecha específica
 */
export async function registrarPatrimonioDiario(fecha?: string) {
  try {
    const fechaParam = fecha || new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase.rpc('registrar_patrimonio_diario', {
      p_fecha: fechaParam
    })

    if (error) throw error

    revalidatePath('/patrimonio')
    return { success: true, data }
  } catch (error: any) {
    console.error("Error al registrar patrimonio:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene la evolución del patrimonio
 */
export async function getPatrimonioEvolucion(dias?: number) {
  try {
    let query = supabase
      .from('patrimonio_evolucion')
      .select('*')
      .order('fecha', { ascending: false })

    if (dias) {
      query = query.limit(dias)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error al obtener evolución de patrimonio:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Obtiene el patrimonio actual (última fecha registrada)
 */
export async function getPatrimonioActual() {
  try {
    const { data, error } = await supabase
      .from('patrimonio_historico')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error al obtener patrimonio actual:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene patrimonio actual en tiempo real (mismo criterio que /productos)
 */
export async function getPatrimonioTiempoReal() {
  try {
    const [productos, liquidaciones] = await Promise.all([
      getProductos(),
      getLiquidaciones(),
    ])

    const patrimonioStock = (productos || []).reduce((total: number, p: any) => {
      const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
      return total + (Number(p.costoUnitarioARS || 0) * stockTotal)
    }, 0)

    const unidadesStock = (productos || []).reduce((total: number, p: any) => {
      return total + Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    }, 0)

    const ultimaLiquidacion = liquidaciones?.[0]
    const mpDisponible = Number(ultimaLiquidacion?.mp_disponible || 0)
    const mpALiquidar = Number(ultimaLiquidacion?.mp_a_liquidar || 0)
    const mpRetenido = Number(ultimaLiquidacion?.mp_retenido || 0)
    const tnALiquidar = Number(ultimaLiquidacion?.tn_a_liquidar || 0)
    const totalLiquidaciones = mpDisponible + mpALiquidar + tnALiquidar
    const patrimonioTotal = patrimonioStock + totalLiquidaciones

    return {
      success: true,
      data: {
        fecha: ultimaLiquidacion?.fecha || new Date().toISOString().split('T')[0],
        patrimonio_stock: patrimonioStock,
        unidades_stock: unidadesStock,
        mp_disponible: mpDisponible,
        mp_a_liquidar: mpALiquidar,
        mp_retenido: mpRetenido,
        tn_a_liquidar: tnALiquidar,
        total_liquidaciones: totalLiquidaciones,
        patrimonio_total: patrimonioTotal,
      },
    }
  } catch (error: any) {
    console.error("Error al obtener patrimonio en tiempo real:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Registra el patrimonio histórico para un rango de fechas
 * Útil para backfill de datos históricos
 */
export async function registrarPatrimonioRango(fechaInicio: string, fechaFin: string) {
  try {
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    const resultados = []

    // Iterar día por día
    for (let fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
      const fechaStr = fecha.toISOString().split('T')[0]
      const resultado = await registrarPatrimonioDiario(fechaStr)
      resultados.push({ fecha: fechaStr, ...resultado })
    }

    revalidatePath('/patrimonio')
    return { success: true, data: resultados }
  } catch (error: any) {
    console.error("Error al registrar patrimonio en rango:", error)
    return { success: false, error: error.message }
  }
}
