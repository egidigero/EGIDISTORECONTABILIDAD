"use server"

import { supabase } from "@/lib/supabase"
import type { VentaConProducto } from "@/lib/types"

/**
 * Obtiene las ventas de TN de una fecha específica que contribuyen al monto "TN a Liquidar"
 * EXCLUYE las ventas TN+MercadoPago (que van a MP a liquidar)
 */
export async function getVentasTNPorFecha(fecha: string) {
  try {
    const { data: ventas, error } = await supabase
      .from('ventas')
      .select(`
        *,
        producto:productos(*)
      `)
      .eq('plataforma', 'TN')
      .neq('metodoPago', 'MercadoPago') // Excluir TN+MercadoPago
      .eq('fecha', fecha)
      .order('createdAt', { ascending: true })

    if (error) {
      console.error('Error fetching ventas TN by fecha:', error)
      return []
    }

    return (ventas || []) as VentaConProducto[]
  } catch (error) {
    console.error('Error in getVentasTNPorFecha:', error)
    return []
  }
}

/**
 * Calcula el detalle de TN a liquidar para una fecha específica
 */
export async function calcularDetalleVentasTN(fecha: string) {
  try {
    const ventas = await getVentasTNPorFecha(fecha)
    
    let totalPVBruto = 0
    let totalDescuentos = 0
    let totalComisiones = 0
    let totalIVA = 0
    let totalIIBB = 0
    let totalALiquidar = 0
    
    // Fetch devoluciones relacionadas a estas ventas y attach them server-side
    let devolucionesMap: Record<string, any[]> = {}
    try {
      const ventaIds = ventas.map(v => v.id).filter(Boolean)
      if (ventaIds.length > 0) {
        const { data: devolucionesData, error: devolError } = await supabase
          .from('devoluciones_resumen')
          .select(`id, id_devolucion, venta_id, fecha_reclamo, fecha_completada, tipo_resolucion, producto_recuperable, costo_envio_original, costo_envio_devolucion, costo_envio_nuevo, total_costos_envio, costo_producto_perdido, gasto_creado_id, perdida_total, monto_reembolsado, impacto_ventas_netas`)
          .in('venta_id', ventaIds)

        if (!devolError && Array.isArray(devolucionesData)) {
          devolucionesMap = devolucionesData.reduce((acc: Record<string, any[]>, d: any) => {
            const key = String(d.venta_id)
            acc[key] = acc[key] || []
            acc[key].push(d)
            return acc
          }, {})
        }
      }
    } catch (err) {
      console.warn('No se pudieron obtener devoluciones para ventas TN (no crítico)', err)
    }

    const ventasDetalle = ventas.map(venta => {
      const pvBruto = Number(venta.pvBruto || 0)
      const comision = Number(venta.comision || 0)
      const iva = Number(venta.iva || 0)
      const iibb = Number(venta.iibb || 0)
      
      // A Liquidar = PV Bruto - (Comisión + IVA + IIBB) - todos ya en BD
      const montoALiquidar = pvBruto - comision - iva - iibb
      
      totalPVBruto += pvBruto
      totalComisiones += comision
      totalIVA += iva
      totalIIBB += iibb
      totalALiquidar += montoALiquidar
      
      // attach devoluciones array (if any)
      const devols = devolucionesMap[String(venta.id)] || []

      return {
        ...venta,
        montoALiquidar: Math.round(montoALiquidar * 100) / 100,
        devoluciones: devols,
        devolucionesResumen: {
          envioTotal: Math.round((devols.reduce((s: number, d: any) => s + Number(d.total_costos_envio || 0), 0)) * 100) / 100,
          // montoAplicadoTotal removed: use monto_reembolsado or impacto_ventas_netas where appropriate
          montoAplicadoTotal: Math.round((devols.reduce((s: number, d: any) => s + Number(d.monto_reembolsado || d.impacto_ventas_netas || 0), 0)) * 100) / 100,
          perdidaTotal: Math.round((devols.reduce((s: number, d: any) => s + Number(d.costo_producto_perdido || d.perdida_total || 0), 0)) * 100) / 100
        }
      }
    })
    
    console.log(`Detalle ventas TN ${fecha}:`, {
      cantidadVentas: ventas.length,
      totalPVBruto: totalPVBruto.toFixed(2),
      totalComisiones: totalComisiones.toFixed(2),
      totalIVA: totalIVA.toFixed(2),
      totalIIBB: totalIIBB.toFixed(2),
      totalALiquidar: totalALiquidar.toFixed(2)
    })
    
    return {
      ventas: ventasDetalle,
      resumen: {
        cantidadVentas: ventas.length,
        totalPVBruto: Math.round(totalPVBruto * 100) / 100,
        totalDescuentos: Math.round(totalDescuentos * 100) / 100,
        totalComisiones: Math.round(totalComisiones * 100) / 100,
        totalIVA: Math.round(totalIVA * 100) / 100,
        totalIIBB: Math.round(totalIIBB * 100) / 100,
        totalALiquidar: Math.round(totalALiquidar * 100) / 100
      }
    }
  } catch (error) {
    console.error('Error calculando detalle ventas TN:', error)
    return {
      ventas: [],
      resumen: {
        cantidadVentas: 0,
        totalPVBruto: 0,
        totalDescuentos: 0,
        totalComisiones: 0,
        totalIVA: 0,
        totalIIBB: 0,
        totalALiquidar: 0
      }
    }
  }
}
