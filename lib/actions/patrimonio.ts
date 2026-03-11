"use server"

import { revalidatePath } from "next/cache"
import { getLiquidaciones } from "@/lib/actions/liquidaciones"
import { getProductos } from "@/lib/actions/productos"
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

function sumarUnDia(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const base = new Date(Date.UTC(anio, mes - 1, dia))
  base.setUTCDate(base.getUTCDate() + 1)
  return base.toISOString().split("T")[0]
}

async function calcularPatrimonioSnapshot(fecha: string): Promise<SnapshotPatrimonio> {
  const fechaFinExclusiva = sumarUnDia(fecha)

  const [productosResult, movimientosResult, liquidacionResult] = await Promise.all([
    supabase
      .from("productos")
      .select("id, costoUnitarioARS"),
    supabase
      .from("movimientos_stock")
      .select("producto_id, cantidad, tipo, fecha")
      .lt("fecha", fechaFinExclusiva),
    supabase
      .from("liquidaciones")
      .select("fecha, mp_disponible, mp_a_liquidar, mp_retenido, tn_a_liquidar")
      .lte("fecha", fecha)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    fecha,
    patrimonio_stock: Math.round(patrimonioStock * 100) / 100,
    unidades_stock: unidadesStock,
    mp_disponible: mpDisponible,
    mp_a_liquidar: mpALiquidar,
    mp_retenido: mpRetenido,
    tn_a_liquidar: tnALiquidar,
    total_liquidaciones: Math.round(totalLiquidaciones * 100) / 100,
    patrimonio_total: Math.round((patrimonioStock + totalLiquidaciones) * 100) / 100,
  }
}

/**
 * Registra un snapshot del patrimonio para una fecha especifica
 */
export async function registrarPatrimonioDiario(fecha?: string) {
  try {
    const fechaParam = fecha || new Date().toISOString().split("T")[0]
    const snapshot = await calcularPatrimonioSnapshot(fechaParam)

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
    const [productos, liquidaciones] = await Promise.all([
      getProductos(),
      getLiquidaciones(),
    ])

    const patrimonioStock = (productos || []).reduce((total: number, p: any) => {
      const stockTotal = Number(p.stockTotal ?? (Number(p.stockPropio || 0) + Number(p.stockFull || 0)))
      return total + (Number(p.costoUnitarioARS || 0) * stockTotal)
    }, 0)

    const unidadesStock = (productos || []).reduce((total: number, p: any) => {
      return total + Number(p.stockTotal ?? (Number(p.stockPropio || 0) + Number(p.stockFull || 0)))
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
        fecha: ultimaLiquidacion?.fecha || new Date().toISOString().split("T")[0],
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
 * Registra el patrimonio historico para un rango de fechas
 * Util para backfill de datos historicos
 */
export async function registrarPatrimonioRango(fechaInicio: string, fechaFin: string) {
  try {
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    const resultados = []

    for (let fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
      const fechaStr = fecha.toISOString().split("T")[0]
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
