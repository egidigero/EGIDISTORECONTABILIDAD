"use server"

import { supabase } from "@/lib/supabase"
import { calcularDetalleVentasTN } from "@/lib/actions/ventas-tn-liquidacion"
import { calcularDetalleVentasMP, calcularImpactoTransferencia } from "@/lib/actions/ventas-mp-liquidacion"
import { calcularImpactoEnMPDisponible } from "@/lib/actions/gastos-ingresos"
import { revalidatePath } from "next/cache"

/**
 * Recalcula una liquidación específica basándose en:
 * 1. Valores base del día anterior
 * 2. Ventas TN del día actual
 * 3. Gastos/ingresos del día actual
 * 4. Liquidaciones procesadas del día
 */
export async function recalcularLiquidacionCompleta(fecha: string) {
  try {
    console.log(`🔄 Recalculando liquidación completa para ${fecha}`)
    
    // 1. Obtener liquidación del día anterior para valores base
    const { data: liquidacionAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    // Valores base del día anterior (o 0 si es la primera liquidación)
    const valoresBase = {
      mp_disponible: liquidacionAnterior?.mp_disponible || 0,
      mp_a_liquidar: liquidacionAnterior?.mp_a_liquidar || 0,
      tn_a_liquidar: liquidacionAnterior?.tn_a_liquidar || 0
    }

    console.log(`📊 Recalculando liquidación ${fecha}:`, {
      liquidacionAnterior: liquidacionAnterior ? {
        fecha: liquidacionAnterior.fecha,
        mp_disponible: liquidacionAnterior.mp_disponible,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar
      } : null,
      valoresBase
    })

    // 2. Obtener liquidación actual
    const { data: liquidacionActual } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()

    if (!liquidacionActual) {
      throw new Error(`No existe liquidación para la fecha ${fecha}`)
    }

    // 3. Calcular impacto de ventas TN del día
    const detalleVentasTN = await calcularDetalleVentasTN(fecha)
    const impactoVentasTN = detalleVentasTN.resumen.totalALiquidar

  // 3d. Calcular impacto de devoluciones que aplicaron montos a liquidación en esta fecha
  // Algunas devoluciones (p. ej. reembolsos PagoNube) restan directamente de TN a liquidar.
  // En versiones anteriores registrábamos este ajuste en `monto_aplicado_liquidacion`; ahora
  // se calcula a partir de `monto_reembolsado` o, si falta, se intenta computar desde la venta.
  // Debemos incluir aquí el total de devoluciones aplicadas a la fecha en el cálculo.
    let impactoDevolucionesTN = 0
    try {
  // Normalize incoming `fecha` to a date-only string (YYYY-MM-DD) so the
  // range queries below work whether `fecha` is '2025-10-19' or
  // '2025-10-19T00:00:00'. This prevents malformed ISO strings like
  // '2025-10-19T00:00:00T00:00:00.000Z'.
  const fechaDay = new Date(fecha).toISOString().split('T')[0]
  const fechaInicio = `${fechaDay}T00:00:00.000Z`
  const nextDay = new Date(new Date(fechaInicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Obtener devoluciones que completaron en la fecha (por fecha_completada o created_at)
      // y traer la venta para conocer metodoPago (solo PagoNube afecta TN a liquidar)
      const { data: devols1, error: devErr1 } = await supabase
        .from('devoluciones')
        .select('id, monto_reembolsado, monto_venta_original, tipo_resolucion, venta:ventas(*)')
        .gte('fecha_completada', fechaInicio)
        .lt('fecha_completada', nextDay)

      const { data: devols2, error: devErr2 } = await supabase
        .from('devoluciones')
        .select('id, monto_reembolsado, monto_venta_original, tipo_resolucion, venta:ventas(*)')
        .gte('created_at', fechaInicio)
        .lt('created_at', nextDay)
        .neq('fecha_completada', null)

      const allDevols = []
      if (!devErr1 && Array.isArray(devols1)) allDevols.push(...devols1)
      if (!devErr2 && Array.isArray(devols2)) allDevols.push(...devols2)

      // Sum monto_reembolsado (or fallback computed amount) for PagoNube ventas
      impactoDevolucionesTN = 0
      for (const d of (allDevols || [])) {
        try {
          let monto = Number(d.monto_reembolsado ?? 0)
          const tipo = d.tipo_resolucion ?? (d as any)?.tipo_resolucion ?? null
          // PostgREST can return related rows as an array; normalize to a single object
          let venta: any = (d as any)?.venta ?? null
          if (Array.isArray(venta)) venta = venta[0] ?? null

          // If there's no explicit monto_reembolsado, try to compute a fallback from the venta
          if ((!monto || monto === 0) && tipo && String(tipo).includes('Reembolso')) {
            if (venta) {
              try {
                const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
                const calc = await calcularMontoVentaALiquidar(venta as any)
                monto = Number(calc ?? d.monto_reembolsado ?? d.monto_venta_original ?? 0)
              } catch (calcErr) {
                monto = Number(d.monto_reembolsado ?? d.monto_venta_original ?? 0)
              }
            } else {
              monto = Number(d.monto_reembolsado ?? d.monto_venta_original ?? 0)
            }
          }

          // Only PagoNube devoluciones affect TN a liquidar
          const metodo = venta?.metodoPago || (venta as any)?.metodo_pago || null
          if (monto > 0 && metodo === 'PagoNube') impactoDevolucionesTN += monto
        } catch (inner) {
          // ignore per-row errors
          console.warn('Error procesando devolución para impacto TN (no crítico)', inner)
        }
      }
      impactoDevolucionesTN = Math.round(impactoDevolucionesTN * 100) / 100
    } catch (err) {
      console.warn('No se pudo calcular impactoDevolucionesTN (no crítico)', err)
      impactoDevolucionesTN = 0
    }

    // 3b. Calcular impacto de ventas ML del día (va a MP A Liquidar)
    const detalleVentasML = await calcularDetalleVentasMP(fecha)
    const impactoVentasML = detalleVentasML.resumen.totalALiquidar

    // 3c. Calcular impacto de Transferencia (Directo) - va a MP Disponible
    const detalleTransferencia = await calcularImpactoTransferencia(fecha)
    const impactoTransferencia = detalleTransferencia.resumen.totalDisponible

    // 4. Calcular impacto de gastos/ingresos del día
    const impactoGastosIngresos = await calcularImpactoEnMPDisponible(fecha)

    // 5. Obtener valores de liquidaciones procesadas del día (mantener los que ya están)
    const mp_liquidado_hoy = liquidacionActual.mp_liquidado_hoy || 0
    const tn_liquidado_hoy = liquidacionActual.tn_liquidado_hoy || 0
    const tn_iibb_descuento = liquidacionActual.tn_iibb_descuento || 0

    // 6. Calcular nuevos valores (con redondeo a 2 decimales)
    const nuevosValores = {
      // MP Disponible = Base anterior + Gastos/Ingresos + Transferencia Directa + Liquidaciones recibidas
      mp_disponible: Math.round((valoresBase.mp_disponible + impactoGastosIngresos.impactoNeto + impactoTransferencia + mp_liquidado_hoy + tn_liquidado_hoy - tn_iibb_descuento) * 100) / 100,
      
      // MP A Liquidar = Base anterior + Ventas ML del día - MP liquidado hoy
      mp_a_liquidar: Math.round((valoresBase.mp_a_liquidar + impactoVentasML - mp_liquidado_hoy) * 100) / 100,
      
      // TN A Liquidar = Base anterior + Ventas TN del día - TN liquidado hoy - Devoluciones aplicadas a TN
      tn_a_liquidar: Math.round((valoresBase.tn_a_liquidar + impactoVentasTN - tn_liquidado_hoy - impactoDevolucionesTN) * 100) / 100
    }

    // Calcular totales adicionales (también redondeados)
    const mp_total = Math.round((nuevosValores.mp_disponible + nuevosValores.mp_a_liquidar) * 100) / 100
    const total_disponible = Math.round((nuevosValores.mp_disponible + nuevosValores.tn_a_liquidar) * 100) / 100
    const movimiento_neto_dia = Math.round((impactoGastosIngresos.impactoNeto + impactoVentasTN + impactoVentasML) * 100) / 100

    // 7. Actualizar liquidación
    const { error: updateError } = await supabase
      .from('liquidaciones')
      .update({
        mp_disponible: nuevosValores.mp_disponible,
        mp_a_liquidar: nuevosValores.mp_a_liquidar,
        tn_a_liquidar: nuevosValores.tn_a_liquidar,
        // mp_total, total_disponible y movimiento_neto_dia son columnas generadas, no se actualizan manualmente
        updatedAt: new Date().toISOString()
      })
      .eq('id', liquidacionActual.id)

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Liquidación ${fecha} recalculada:`, {
      valoresBase,
      impactos: {
        ventasTN: impactoVentasTN,
        ventasML: impactoVentasML,
        gastosIngresos: impactoGastosIngresos.impactoNeto
      },
      liquidacionesProcesadas: { mp_liquidado_hoy, tn_liquidado_hoy, tn_iibb_descuento },
      calculoMP: {
        base: valoresBase.mp_a_liquidar,
        masVentas: impactoVentasML,
        menosLiquidado: mp_liquidado_hoy,
        resultado: valoresBase.mp_a_liquidar + impactoVentasML - mp_liquidado_hoy,
        resultadoRedondeado: nuevosValores.mp_a_liquidar
      },
      calculoTN: {
        base: valoresBase.tn_a_liquidar,
        masVentas: impactoVentasTN,
        menosLiquidado: tn_liquidado_hoy,
        resultado: valoresBase.tn_a_liquidar + impactoVentasTN - tn_liquidado_hoy,
        resultadoRedondeado: nuevosValores.tn_a_liquidar
      },
      nuevosValores,
      totales: { mp_total, total_disponible, movimiento_neto_dia }
    })

    return { success: true, nuevosValores }

  } catch (error) {
    console.error(`❌ Error recalculando liquidación ${fecha}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

/**
 * Recalcula todas las liquidaciones desde una fecha hacia adelante (cascada)
 */
export async function recalcularLiquidacionesEnCascada(fechaDesde: string) {
  try {
    console.log(`🔄 Iniciando recálculo en cascada desde ${fechaDesde}`)
    
    // Obtener todas las liquidaciones desde la fecha especificada
    const { data: liquidaciones, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .gte('fecha', fechaDesde)
      .order('fecha', { ascending: true })

    if (error) {
      throw error
    }

    if (!liquidaciones || liquidaciones.length === 0) {
      console.log('No hay liquidaciones para recalcular')
      return { success: true }
    }

    console.log(`📊 Recalculando ${liquidaciones.length} liquidaciones`)

    // Recalcular cada liquidación en orden cronológico
    for (const liquidacion of liquidaciones) {
      const resultado = await recalcularLiquidacionCompleta(liquidacion.fecha)
      
      if (!resultado.success) {
        console.error(`❌ Error en cascada en fecha ${liquidacion.fecha}:`, resultado.error)
        return { success: false, error: `Error en fecha ${liquidacion.fecha}: ${resultado.error}` }
      }
    }

    console.log(`✅ Cascada completada exitosamente desde ${fechaDesde}`)
    revalidatePath("/liquidaciones")
    return { success: true }

  } catch (error) {
    console.error('❌ Error en recálculo en cascada:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
