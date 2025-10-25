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
    // Marker log para depuración: indica que esta función pertenece a la versión con deltas
    console.log('[DELV2] inicio recalcularLiquidacionCompleta', { fecha })
    
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
      mp_retenido: liquidacionAnterior?.mp_retenido || 0,
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
    // First, try to use the new `delta_*` columns in `devoluciones` (migration applied).
    // If deltas are present for the target date, prefer them and skip the older per-row logic
    // to avoid double-counting. This supports the new workflow where devoluciones persisten
    // los impactos contables en campos delta_* y `recalcularLiquidacionesEnCascada` los aplica.
    let impactoDevolucionesTN = 0
    let sumsDelta = {
      mp_disponible: 0,
      mp_a_liquidar: 0,
      mp_retenido: 0,
      tn_a_liquidar: 0
    }
    let useDeltas = false
    try {
      // Normalize incoming `fecha` to a date-only string (YYYY-MM-DD) so the
      // range queries below work whether `fecha` is '2025-10-19' or
      // '2025-10-19T00:00:00'. This prevents malformed ISO strings like
      // '2025-10-19T00:00:00T00:00:00.000Z'.
      const fechaDay = new Date(fecha).toISOString().split('T')[0]
      const fechaInicio = `${fechaDay}T00:00:00.000Z`
      const nextDay = new Date(new Date(fechaInicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Aggregate delta_* values for this date from the normalized table `devoluciones_deltas`.
      try {
        console.log(`🔍 Ejecutando agregación de delta_* en devoluciones_deltas para fecha: ${fechaDay}`)
        const { data: rowsDeltas, error: rowsDeltasErr } = await supabase
          .from('devoluciones_deltas')
          .select('delta_mp_disponible, delta_mp_a_liquidar, delta_mp_retenido, delta_tn_a_liquidar')
          .eq('fecha_impacto', fechaDay)

        if (rowsDeltasErr) {
          console.warn('Error al obtener filas desde devoluciones_deltas', rowsDeltasErr)
        } else {
          console.log('Filas devoluciones_deltas:', rowsDeltas)
          if (Array.isArray(rowsDeltas) && rowsDeltas.length > 0) {
            for (const row of rowsDeltas) {
              sumsDelta.mp_disponible += Number((row as any).delta_mp_disponible ?? 0)
              sumsDelta.mp_a_liquidar += Number((row as any).delta_mp_a_liquidar ?? 0)
              sumsDelta.mp_retenido += Number((row as any).delta_mp_retenido ?? 0)
              sumsDelta.tn_a_liquidar += Number((row as any).delta_tn_a_liquidar ?? 0)
            }
          }
        }

        console.log('🔢 Totales agregados de devoluciones (sumsDelta) antes de decidir useDeltas:', sumsDelta)

        // If any of the sums are non-zero, we'll use deltas path
        if (Math.abs(sumsDelta.mp_disponible) > 0.0001 || Math.abs(sumsDelta.mp_a_liquidar) > 0.0001 || Math.abs(sumsDelta.mp_retenido) > 0.0001 || Math.abs(sumsDelta.tn_a_liquidar) > 0.0001) {
          useDeltas = true
        }
        console.log('useDeltas =', useDeltas)
      } catch (sumErr) {
        console.warn('No se pudieron agregar deltas de devoluciones_deltas (no crítico)', sumErr)
      }

      // If deltas are present, we will skip the old per-row logic and rely on these sums
      if (useDeltas) {
        // impactoDevolucionesTN will be computed from deltas.tn_a_liquidar later
        impactoDevolucionesTN = 0
      } else {
        // Fallback: we'll compute impactoDevolucionesTN using the legacy per-row path below
        impactoDevolucionesTN = 0
      }
    } catch (err) {
      console.warn('No se pudo calcular impactoDevolucionesTN (no crítico)', err)
      impactoDevolucionesTN = 0
    }

    // 3b. Calcular impacto de ventas ML del día (va a MP A Liquidar)
    const detalleVentasML = await calcularDetalleVentasMP(fecha)
    const impactoVentasML = detalleVentasML.resumen.totalALiquidar

  // 3e. Calcular impacto de devoluciones ML que afectaron MP (a_liquidar / disponible) y retenido
  let impactoDevolucionesML_aLiquidar = 0
  let impactoDevolucionesML_disponible = 0
  let impactoDevolucionesML_retenido = 0
  try {
    // If we already have persisted deltas for this date, DO NOT run the legacy
    // per-row logic that reads `devoluciones` and sums monto_reembolsado. Running
    // both would double-count impacts for the same devolución (one from the
    // normalized `devoluciones_deltas` and another from the legacy per-row scan).
    if (!useDeltas) {
      const fechaDay = new Date(fecha).toISOString().split('T')[0]
      const fechaInicio = `${fechaDay}T00:00:00.000Z`
      const nextDay = new Date(new Date(fechaInicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

      const { data: devols1, error: devErr1 } = await supabase
        .from('devoluciones')
        .select('id, monto_reembolsado, monto_venta_original, tipo_resolucion, mp_estado, mp_retenido, venta:ventas(*)')
        .gte('fecha_completada', fechaInicio)
        .lt('fecha_completada', nextDay)

      const { data: devols2, error: devErr2 } = await supabase
        .from('devoluciones')
        .select('id, monto_reembolsado, monto_venta_original, tipo_resolucion, mp_estado, mp_retenido, venta:ventas(*)')
        .gte('created_at', fechaInicio)
        .lt('created_at', nextDay)
        .neq('fecha_completada', null)

      const allDevolsML: any[] = []
      if (!devErr1 && Array.isArray(devols1)) allDevolsML.push(...devols1)
      if (!devErr2 && Array.isArray(devols2)) allDevolsML.push(...devols2)

      for (const d of allDevolsML) {
        try {
          let monto = Number(d.monto_reembolsado ?? 0)
          const tipo = d.tipo_resolucion ?? (d as any)?.tipo_resolucion ?? null
          let venta: any = (d as any)?.venta ?? null
          if (Array.isArray(venta)) venta = venta[0] ?? null

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

          const metodo = venta?.metodoPago || (venta as any)?.metodo_pago || null
          const plataforma = venta?.plataforma || null
          // Only MercadoPago / ML devoluciones affect MP balances
          if (monto > 0 && (metodo === 'MercadoPago' || plataforma === 'ML')) {
            const mpEstado = (d as any).mp_estado ?? d.mp_estado ?? null
            const mpRet = Boolean((d as any).mp_retenido ?? d.mp_retenido ?? false)
            if (mpEstado === 'a_liquidar') {
              impactoDevolucionesML_aLiquidar += monto
            } else {
              // default: treat as liquidado -> reduces disponible
              impactoDevolucionesML_disponible += monto
            }
            if (mpRet) {
              impactoDevolucionesML_retenido += monto
            }
          }
        } catch (inner) {
          console.warn('Error procesando devolución ML para impacto MP (no crítico)', inner)
        }
      }

      impactoDevolucionesML_aLiquidar = Math.round(impactoDevolucionesML_aLiquidar * 100) / 100
      impactoDevolucionesML_disponible = Math.round(impactoDevolucionesML_disponible * 100) / 100
      impactoDevolucionesML_retenido = Math.round(impactoDevolucionesML_retenido * 100) / 100
    } else {
      // When using deltas the per-row legacy path is intentionally skipped to
      // avoid double-counting. impacts will be applied from `sumsDelta` later.
      impactoDevolucionesML_aLiquidar = 0
      impactoDevolucionesML_disponible = 0
      impactoDevolucionesML_retenido = 0
    }
  } catch (err) {
    console.warn('No se pudo calcular impactoDevolucionesML (no crítico)', err)
    impactoDevolucionesML_aLiquidar = 0
    impactoDevolucionesML_disponible = 0
    impactoDevolucionesML_retenido = 0
  }

  // Si tenemos deltas persistidos en `devoluciones`, aplicarlos a los impactos
  try {
    if (useDeltas) {
      const fechaDayLog = new Date(fecha).toISOString().split('T')[0]
      console.log(`🔍 Sumando deltas de devoluciones para fecha: ${fechaDayLog}`)
      console.log('🔢 Deltas devoluciones:', sumsDelta)

      // Las columnas delta_* están pensadas como el cambio directo a aplicar en la
      // liquidación. En las migraciones se definieron como: delta_mp_disponible = -monto_a_decrementar
      // y delta_mp_a_liquidar = -monto_a_decrementar. Por eso invertimos el signo cuando
      // lo convertimos al formato de "impacto" que usa el cálculo existente (positivo = reduce).
      impactoDevolucionesML_disponible += -Number(sumsDelta.mp_disponible || 0)
      impactoDevolucionesML_aLiquidar += -Number(sumsDelta.mp_a_liquidar || 0)
      impactoDevolucionesML_retenido += Number(sumsDelta.mp_retenido || 0)
      impactoDevolucionesTN += -Number(sumsDelta.tn_a_liquidar || 0)

      console.log(`➕ Aplicando deltas de devoluciones a impactos de liquidación (fecha: ${fechaDayLog})`, {
        mp_disponible: -Number(sumsDelta.mp_disponible || 0),
        mp_a_liquidar: -Number(sumsDelta.mp_a_liquidar || 0),
        mp_retenido: Number(sumsDelta.mp_retenido || 0),
        tn_a_liquidar: -Number(sumsDelta.tn_a_liquidar || 0)
      })
    } else {
      // Si no se usan deltas, dejar que el flujo legacy continúe (ya calculado arriba)
    }
  } catch (logErr) {
    console.warn('No se pudieron aplicar/loguear deltas de devoluciones (no crítico)', logErr)
  }

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
      mp_disponible: Math.round((valoresBase.mp_disponible + impactoGastosIngresos.impactoNeto + impactoTransferencia + mp_liquidado_hoy + tn_liquidado_hoy - tn_iibb_descuento - impactoDevolucionesML_disponible) * 100) / 100,

      // MP A Liquidar = Base anterior + Ventas ML del día - MP liquidado hoy - Devoluciones ML que estaban a_liquidar
      mp_a_liquidar: Math.round((valoresBase.mp_a_liquidar + impactoVentasML - mp_liquidado_hoy - impactoDevolucionesML_aLiquidar) * 100) / 100,

      // MP retenido = base anterior + devoluciones marcadas como retenido
      mp_retenido: Math.round((valoresBase.mp_retenido + impactoDevolucionesML_retenido) * 100) / 100,
      
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
        mp_retenido: nuevosValores.mp_retenido,
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
    console.log('[DELV2] inicio recalcularLiquidacionesEnCascada', { fechaDesde, env: process.env.NODE_ENV || 'unknown' })
    
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
      console.log('[DELV2] llamando recalcularLiquidacionCompleta', { id: liquidacion.id, fecha: liquidacion.fecha })
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
