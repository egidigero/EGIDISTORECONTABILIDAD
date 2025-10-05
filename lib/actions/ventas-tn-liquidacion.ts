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
      
      return {
        ...venta,
        montoALiquidar: Math.round(montoALiquidar * 100) / 100
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
