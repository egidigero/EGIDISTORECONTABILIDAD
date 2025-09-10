"use server"

import { supabase } from "@/lib/supabase"
import type { VentaConProducto } from "@/lib/types"

/**
 * Obtiene las ventas de TN de una fecha específica que contribuyen al monto "TN a Liquidar"
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
    let totalIIBB = 0
    let totalALiquidar = 0
    
    const ventasDetalle = ventas.map(venta => {
      const pvBruto = Number(venta.pvBruto || 0)
      const comisionGuardada = Number(venta.comision || 0)
      let comisionesTotales = 0
      if (venta.plataforma === 'TN') {
        comisionesTotales = Math.round((comisionGuardada * 1.24) * 100) / 100
      } else {
        comisionesTotales = Math.round(comisionGuardada * 100) / 100
      }
      const montoALiquidar = Math.round((pvBruto - comisionesTotales) * 100) / 100
      totalPVBruto = Math.round((totalPVBruto + pvBruto) * 100) / 100
      totalComisiones = Math.round((totalComisiones + comisionesTotales) * 100) / 100
      // El IIBB solo para mostrar, no suma al total de comisiones en otras plataformas
      let iibbComisiones = 0
      if (venta.plataforma === 'TN') {
        const comisionBase = comisionGuardada / 1.21
        iibbComisiones = Math.round((comisionBase * 0.03) * 100) / 100
      }
      totalIIBB = Math.round((totalIIBB + iibbComisiones) * 100) / 100
      totalALiquidar = Math.round((totalALiquidar + montoALiquidar) * 100) / 100
      return {
        ...venta,
        comisionesTotales: Math.round(comisionesTotales * 100) / 100,
        montoALiquidar: Math.round(montoALiquidar * 100) / 100,
        iibbComisiones: Math.round(iibbComisiones * 100) / 100
      }
    })
    
    console.log(`Detalle ventas TN ${fecha}:`, {
      cantidadVentas: ventas.length,
      totalPVBruto: totalPVBruto.toFixed(2),
      totalComisiones: totalComisiones.toFixed(2),
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
        totalIIBB: 0,
        totalALiquidar: 0
      }
    }
  }
}
