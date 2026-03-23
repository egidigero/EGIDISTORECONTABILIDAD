"use server"

import { revalidatePath } from "next/cache"
import { addDaysToDateOnly, getTodayDateOnly, normalizeDateOnly } from "@/lib/date"
import { supabase } from "@/lib/supabase"

type SnapshotPatrimonio = {
  fecha: string
  patrimonio_stock: number
  unidades_stock: number
  mp_disponible: number
  mp_a_liquidar: number
  mp_retenido: number
  tn_a_liquidar: number
  total_liquidaciones: number
  patrimonio_total: number
}

function safeRevalidatePatrimonio() {
  try {
    revalidatePath("/patrimonio")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("static generation store missing")) {
      console.warn("revalidatePath omitido fuera del contexto de Next")
      return
    }
    throw error
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

async function calcularPatrimonio(fecha?: string): Promise<SnapshotPatrimonio> {
  const fechaCorte = normalizeDateOnly(fecha) || null
  const fechaFinExclusiva = fechaCorte ? addDaysToDateOnly(fechaCorte, 1) : null

  const productosQuery = supabase
    .from("productos")
    .select("id, costoUnitarioARS")

  let movimientosQuery = supabase
    .from("movimientos_stock")
    .select("producto_id, cantidad, tipo")

  if (fechaFinExclusiva) {
    movimientosQuery = movimientosQuery.lt("fecha", fechaFinExclusiva)
  }

  let liquidacionQuery = supabase
    .from("liquidaciones")
    .select("fecha, mp_disponible, mp_a_liquidar, mp_retenido, tn_a_liquidar, updatedAt")

  if (fechaFinExclusiva) {
    liquidacionQuery = liquidacionQuery.lt("fecha", fechaFinExclusiva)
  }

  const liquidacionResultQuery = liquidacionQuery
    .order("fecha", { ascending: false })
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle()

  const [productosResult, movimientosResult, liquidacionResult] = await Promise.all([
    productosQuery,
    movimientosQuery,
    liquidacionResultQuery,
  ])

  if (productosResult.error) throw productosResult.error
  if (movimientosResult.error) throw movimientosResult.error
  if (liquidacionResult.error) throw liquidacionResult.error

  const costoPorProducto = new Map(
    (productosResult.data || []).map((producto: any) => [
      String(producto.id),
      Number(producto.costoUnitarioARS || 0),
    ]),
  )

  const cantidadPorProducto = new Map<string, number>()

  for (const movimiento of movimientosResult.data || []) {
    const productoId = String((movimiento as any).producto_id)
    const cantidad = Number((movimiento as any).cantidad || 0)
    const signo =
      (movimiento as any).tipo === "entrada" ? 1 :
      (movimiento as any).tipo === "salida" ? -1 :
      0

    if (!productoId || !cantidad || signo === 0) continue

    cantidadPorProducto.set(
      productoId,
      (cantidadPorProducto.get(productoId) || 0) + (cantidad * signo),
    )
  }

  let patrimonioStock = 0
  let unidadesStock = 0

  for (const [productoId, cantidad] of cantidadPorProducto.entries()) {
    unidadesStock += cantidad
    patrimonioStock += cantidad * (costoPorProducto.get(productoId) || 0)
  }

  const liquidacion = liquidacionResult.data
  const mpDisponible = Number(liquidacion?.mp_disponible || 0)
  const mpALiquidar = Number(liquidacion?.mp_a_liquidar || 0)
  const mpRetenido = Number(liquidacion?.mp_retenido || 0)
  const tnALiquidar = Number(liquidacion?.tn_a_liquidar || 0)
  const totalLiquidaciones = mpDisponible + mpALiquidar + tnALiquidar

  return {
    fecha: fechaCorte || normalizeDateOnly(liquidacion?.fecha) || getTodayDateOnly(),
    patrimonio_stock: roundCurrency(patrimonioStock),
    unidades_stock: unidadesStock,
    mp_disponible: mpDisponible,
    mp_a_liquidar: mpALiquidar,
    mp_retenido: mpRetenido,
    tn_a_liquidar: tnALiquidar,
    total_liquidaciones: roundCurrency(totalLiquidaciones),
    patrimonio_total: roundCurrency(patrimonioStock + totalLiquidaciones),
  }
}

/**
 * Registra un snapshot del patrimonio para una fecha especifica
 */
export async function registrarPatrimonioDiario(fecha?: string) {
  try {
    const fechaParam = normalizeDateOnly(fecha) || getTodayDateOnly()
    const snapshot = await calcularPatrimonio(fechaParam)

    const { data, error } = await supabase
      .from("patrimonio_historico")
      .upsert([snapshot], { onConflict: "fecha" })
      .select()
      .single()

    if (error) throw error

    safeRevalidatePatrimonio()
    return { success: true, data }
  } catch (error: any) {
    console.error("Error al registrar patrimonio:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene la evolucion del patrimonio
 */
export async function getPatrimonioEvolucion(dias?: number) {
  try {
    let query = supabase
      .from("patrimonio_evolucion")
      .select("*")
      .order("fecha", { ascending: false })

    if (dias) {
      query = query.limit(dias)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error al obtener evolucion de patrimonio:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Obtiene el patrimonio actual (ultima fecha registrada)
 */
export async function getPatrimonioActual() {
  try {
    const { data, error } = await supabase
      .from("patrimonio_historico")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") throw error

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
    const data = await calcularPatrimonio()

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error("Error al obtener patrimonio en tiempo real:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Registra el patrimonio historico para un rango de fechas
 * Util para backfill de datos historicos
 */
export async function registrarPatrimonioRango(fechaInicio: string, fechaFin: string) {
  try {
    const inicio = normalizeDateOnly(fechaInicio)
    const fin = normalizeDateOnly(fechaFin)
    const resultados = []

    for (let fechaStr = inicio; fechaStr <= fin; fechaStr = addDaysToDateOnly(fechaStr, 1)) {
      const resultado = await registrarPatrimonioDiario(fechaStr)
      resultados.push({ fecha: fechaStr, ...resultado })
    }

    safeRevalidatePatrimonio()
    return { success: true, data: resultados }
  } catch (error: any) {
    console.error("Error al registrar patrimonio en rango:", error)
    return { success: false, error: error.message }
  }
}
