"use server"

import { supabase } from "@/lib/supabase"
import { calcularDetalleVentasTN } from "@/lib/actions/ventas-tn-liquidacion"

export async function diagnosticarCalculoTNLiquidacion(fecha: string) {
  try {
    console.log(`🔍 Diagnosticando cálculo TN liquidación para ${fecha}`)

    // 1. Obtener liquidación del día anterior
    const { data: liquidacionAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    // 2. Obtener liquidación actual
    const { data: liquidacionActual } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()

    // 3. Calcular ventas TN del día
    const detalleVentasTN = await calcularDetalleVentasTN(fecha)

    // 4. Obtener todas las ventas TN del día para verificar
    const { data: ventasTN } = await supabase
      .from('ventas')
      .select('*')
      .eq('plataforma', 'TN')
      .eq('fecha', fecha)

    const diagnostico = {
      fecha,
      liquidacionAnterior: liquidacionAnterior ? {
        fecha: liquidacionAnterior.fecha,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar,
        mp_disponible: liquidacionAnterior.mp_disponible,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar
      } : null,
      liquidacionActual: liquidacionActual ? {
        tn_a_liquidar: liquidacionActual.tn_a_liquidar,
        tn_liquidado_hoy: liquidacionActual.tn_liquidado_hoy,
        mp_disponible: liquidacionActual.mp_disponible,
        mp_a_liquidar: liquidacionActual.mp_a_liquidar
      } : null,
      ventasTNDelDia: {
        cantidad: ventasTN?.length || 0,
        totalCalculado: detalleVentasTN.resumen.totalALiquidar,
        detalleCalculos: detalleVentasTN.resumen,
        ventasIndividuales: ventasTN?.map(venta => ({
          id: venta.id,
          pvBruto: venta.pvBruto,
          comision: venta.comision,
          iibb: venta.iibb,
          precioNeto: venta.precioNeto,
          calculadoALiquidar: Number(venta.pvBruto || 0) - Number(venta.comision || 0) - Number(venta.iibb || 0)
        })) || []
      },
      calculoEsperado: {
        base: liquidacionAnterior?.tn_a_liquidar || 0,
        masVentasDelDia: detalleVentasTN.resumen.totalALiquidar,
        menosLiquidadoHoy: liquidacionActual?.tn_liquidado_hoy || 0,
        resultadoEsperado: (liquidacionAnterior?.tn_a_liquidar || 0) + detalleVentasTN.resumen.totalALiquidar - (liquidacionActual?.tn_liquidado_hoy || 0),
        resultadoActual: liquidacionActual?.tn_a_liquidar || 0,
        diferencia: (liquidacionActual?.tn_a_liquidar || 0) - ((liquidacionAnterior?.tn_a_liquidar || 0) + detalleVentasTN.resumen.totalALiquidar - (liquidacionActual?.tn_liquidado_hoy || 0))
      }
    }

    console.log('🔍 Diagnóstico completo:', JSON.stringify(diagnostico, null, 2))
    return diagnostico

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error)
    return { error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

export async function compararVentasTNEntreFechas(fecha1: string, fecha2: string) {
  try {
    const detalle1 = await calcularDetalleVentasTN(fecha1)
    const detalle2 = await calcularDetalleVentasTN(fecha2)

    return {
      fecha1: {
        fecha: fecha1,
        ventas: detalle1.resumen.cantidadVentas,
        totalALiquidar: detalle1.resumen.totalALiquidar
      },
      fecha2: {
        fecha: fecha2,
        ventas: detalle2.resumen.cantidadVentas,
        totalALiquidar: detalle2.resumen.totalALiquidar
      },
      diferencia: {
        ventas: detalle2.resumen.cantidadVentas - detalle1.resumen.cantidadVentas,
        totalALiquidar: detalle2.resumen.totalALiquidar - detalle1.resumen.totalALiquidar
      }
    }
  } catch (error) {
    console.error('❌ Error comparando ventas TN:', error)
    return { error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
