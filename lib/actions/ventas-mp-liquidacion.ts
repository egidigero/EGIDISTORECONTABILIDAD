"use server"

import { supabase } from "@/lib/supabase"
import type { VentaConProducto } from "@/lib/types"

/**
 * Obtiene las ventas de Directo + Transferencia de una fecha específica
 * Estas ventas van directo a MP Disponible (PV - IIBB - Envío)
 */
export async function getVentasTransferenciaPorFecha(fecha: string) {
  try {
    const { data: ventasTransferencia, error } = await supabase
      .from('ventas')
      .select(`
        *,
        producto:productos(*)
      `)
      .eq('plataforma', 'Directo')
      .eq('metodoPago', 'Transferencia')
      .eq('fecha', fecha)
      .order('createdAt', { ascending: true })

    if (error) {
      console.error('Error fetching ventas Directo+Transferencia by fecha:', error)
      return []
    }

    return (ventasTransferencia || []) as VentaConProducto[]
  } catch (error) {
    console.error('Error in getVentasTransferenciaPorFecha:', error)
    return []
  }
}

/**
 * Calcula el impacto en MP Disponible de las ventas con Directo + Transferencia
 * Fórmula: PV - IIBB (sin restar envío, ya que el cliente paga el envío por separado)
 */
export async function calcularImpactoTransferencia(fecha: string) {
  try {
    const ventas = await getVentasTransferenciaPorFecha(fecha)
    
    let totalPVBruto = 0
    let totalIIBB = 0
    let totalEnvios = 0
    let totalDisponible = 0
    
    const ventasDetalle = ventas.map(venta => {
      const pvBruto = Number(venta.pvBruto || 0)
      const iibb = Number(venta.iibb || 0)
      const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0)
      
      // Monto que va a MP Disponible: PV - IIBB (sin restar envío)
      const montoDisponible = pvBruto - iibb
      
      totalPVBruto += pvBruto
      totalIIBB += iibb
      totalEnvios += cargoEnvioCosto
      totalDisponible += montoDisponible
      
      return {
        ...venta,
        montoDisponible: Math.round(montoDisponible * 100) / 100
      }
    })
    
    return {
      ventas: ventasDetalle,
      resumen: {
        cantidadVentas: ventas.length,
        totalPVBruto: Math.round(totalPVBruto * 100) / 100,
        totalIIBB: Math.round(totalIIBB * 100) / 100,
        totalEnvios: Math.round(totalEnvios * 100) / 100,
        totalDisponible: Math.round(totalDisponible * 100) / 100
      }
    }
  } catch (error) {
    console.error('Error calculando impacto Transferencia:', error)
    return {
      ventas: [],
      resumen: {
        cantidadVentas: 0,
        totalPVBruto: 0,
        totalIIBB: 0,
        totalEnvios: 0,
        totalDisponible: 0
      }
    }
  }
}

/**
 * Obtiene las ventas de ML y TN+MercadoPago de una fecha específica que contribuyen al monto "MP a Liquidar"
 */
export async function getVentasMLPorFecha(fecha: string) {
  try {
    // Obtener ventas de Mercado Libre
    const { data: ventasML, error: errorML } = await supabase
      .from('ventas')
      .select(`
        *,
        producto:productos(*)
      `)
      .eq('plataforma', 'ML')
      .eq('fecha', fecha)
      .order('createdAt', { ascending: true })

    if (errorML) {
      console.error('Error fetching ventas ML by fecha:', errorML)
    }

    // Obtener ventas de TN + MercadoPago
    const { data: ventasTNMP, error: errorTNMP } = await supabase
      .from('ventas')
      .select(`
        *,
        producto:productos(*)
      `)
      .eq('plataforma', 'TN')
      .eq('metodoPago', 'MercadoPago')
      .eq('fecha', fecha)
      .order('createdAt', { ascending: true })

    if (errorTNMP) {
      console.error('Error fetching ventas TN+MP by fecha:', errorTNMP)
    }

    // Combinar ambas listas
    const todasLasVentas = [...(ventasML || []), ...(ventasTNMP || [])]
    
    return todasLasVentas as VentaConProducto[]
  } catch (error) {
    console.error('Error in getVentasMLPorFecha:', error)
    return []
  }
}

/**
 * Calcula el detalle de MP a liquidar para una fecha específica (ventas de ML)
 */
export async function calcularDetalleVentasMP(fecha: string) {
  try {
    const ventas = await getVentasMLPorFecha(fecha)
    
    let totalPVBruto = 0
    let totalDescuentos = 0
    let totalComisiones = 0
    let totalIVA = 0
    let totalIIBB = 0
    let totalEnvios = 0
    let totalALiquidar = 0
    
    const ventasDetalle = ventas.map(venta => {
      const pvBruto = Number(venta.pvBruto || 0)
      const comision = Number(venta.comision || 0)
      const iva = Number(venta.iva || 0)
      const iibb = Number(venta.iibb || 0)
      const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0)
      
      // Para TN+MercadoPago NO se resta el envío (se suma a dinero a liquidar en MP)
      // Para ML SÍ se resta el envío
      const montoALiquidar = venta.plataforma === 'TN' && venta.metodoPago === 'MercadoPago'
        ? pvBruto - comision - iva - iibb
        : pvBruto - comision - iva - iibb - cargoEnvioCosto
      
      totalPVBruto += pvBruto
      totalComisiones += comision
      totalIVA += iva
      totalIIBB += iibb
      totalEnvios += cargoEnvioCosto
      totalALiquidar += montoALiquidar
      
      return {
        ...venta,
        montoALiquidar: Math.round(montoALiquidar * 100) / 100
      }
    })
    
    console.log(`Detalle ventas ML + TN+MP ${fecha}:`, {
      cantidadVentas: ventas.length,
      totalPVBruto: totalPVBruto.toFixed(2),
      totalComisiones: totalComisiones.toFixed(2),
      totalIVA: totalIVA.toFixed(2),
      totalIIBB: totalIIBB.toFixed(2),
      totalEnvios: totalEnvios.toFixed(2),
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
        totalEnvios: Math.round(totalEnvios * 100) / 100,
        totalALiquidar: Math.round(totalALiquidar * 100) / 100
      }
    }
  } catch (error) {
    console.error('Error calculando detalle ventas ML:', error)
    return {
      ventas: [],
      resumen: {
        cantidadVentas: 0,
        totalPVBruto: 0,
        totalDescuentos: 0,
        totalComisiones: 0,
        totalIVA: 0,
        totalIIBB: 0,
        totalEnvios: 0,
        totalALiquidar: 0
      }
    }
  }
}
