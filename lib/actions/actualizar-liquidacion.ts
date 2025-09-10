"use server"

import { supabase } from "@/lib/supabase"
import type { VentaConProducto } from "@/lib/types"

/**
 * Actualiza la liquidación del día cuando se crea/actualiza una venta
 * Solo procesa ventas de Tienda Nube (TN)
 */
export async function actualizarLiquidacionPorVenta(venta: VentaConProducto, isUpdate = false, ventaAnterior?: VentaConProducto) {
  try {
    // Solo procesar ventas de Tienda Nube
    if (venta.plataforma !== 'TN') {
      console.log('Venta no es de TN, no afecta liquidación')
      return { success: true }
    }

    const fechaVenta = new Date(venta.fecha).toISOString().split('T')[0]
    
    // Obtener liquidación del día
    const { data: liquidacion, error: errorLiquidacion } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fechaVenta)
      .single()

    if (errorLiquidacion || !liquidacion) {
      console.error('No se encontró liquidación para la fecha:', fechaVenta)
      return { success: false, error: 'Liquidación no encontrada' }
    }

    // Calcular el monto a liquidar de esta venta: PV - Descuento - Comisiones (con IVA) - IIBB
    // Para TN: el descuentoAplicado ya está incluido en el cálculo del precio
    const pvBruto = Number(venta.pvBruto || 0)
    const comisionBase = Number(venta.comision || 0)
    const iibb = Number(venta.iibb || 0)
    
    // Para TN, incluir IVA sobre comisiones (21%)
    const comisionesConIVA = venta.plataforma === 'TN' 
      ? comisionBase * 1.21 
      : comisionBase
    
    // Si hay descuentos aplicados (diferencia entre PV bruto y lo que realmente se cobra)
    const descuentosAplicados = 0 // Por ahora asumimos 0, se puede calcular si es necesario
    
    // Fórmula: PV Bruto - Descuentos - Comisiones (con IVA) - IIBB = Monto neto a liquidar
    const montoVentaALiquidar = pvBruto - descuentosAplicados - comisionesConIVA - iibb
    
    let nuevoTnALiquidar = liquidacion.tn_a_liquidar

    if (isUpdate && ventaAnterior) {
      // Si es actualización, primero restar el valor anterior
      const pvBrutoAnterior = Number(ventaAnterior.pvBruto || 0)
      const comisionBaseAnterior = Number(ventaAnterior.comision || 0)
      const iibbAnterior = Number(ventaAnterior.iibb || 0)
      
      // Para TN, incluir IVA sobre comisiones anteriores también
      const comisionesConIVAAnterior = ventaAnterior.plataforma === 'TN' 
        ? comisionBaseAnterior * 1.21 
        : comisionBaseAnterior
      
      const montoAnteriorALiquidar = pvBrutoAnterior - comisionesConIVAAnterior - iibbAnterior
      
      nuevoTnALiquidar -= montoAnteriorALiquidar
    }

    // Sumar el nuevo monto
    nuevoTnALiquidar += montoVentaALiquidar

    // Actualizar la liquidación
    const { error: errorActualizacion } = await supabase
      .from('liquidaciones')
      .update({
        tn_a_liquidar: nuevoTnALiquidar,
        updated_at: new Date().toISOString()
      })
      .eq('id', liquidacion.id)

    if (errorActualizacion) {
      console.error('Error al actualizar liquidación:', errorActualizacion)
      return { success: false, error: errorActualizacion.message }
    }

    console.log('Liquidación actualizada:', {
      fecha: fechaVenta,
      montoVenta: montoVentaALiquidar,
      tn_a_liquidar_anterior: liquidacion.tn_a_liquidar,
      tn_a_liquidar_nuevo: nuevoTnALiquidar,
      diferencia: nuevoTnALiquidar - liquidacion.tn_a_liquidar
    })

    return { success: true }

  } catch (error) {
    console.error('Error al actualizar liquidación por venta:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Elimina el impacto de una venta en la liquidación
 */
export async function eliminarVentaDeLiquidacion(venta: VentaConProducto) {
  try {
    // Solo procesar ventas de Tienda Nube
    if (venta.plataforma !== 'TN') {
      return { success: true }
    }

    const fechaVenta = new Date(venta.fecha).toISOString().split('T')[0]
    
    // Obtener liquidación del día
    const { data: liquidacion, error: errorLiquidacion } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fechaVenta)
      .single()

    if (errorLiquidacion || !liquidacion) {
      console.error('No se encontró liquidación para la fecha:', fechaVenta)
      return { success: false, error: 'Liquidación no encontrada' }
    }

    // Calcular el monto a restar: PV - Descuento - Comisiones (con IVA) - IIBB
    const pvBruto = Number(venta.pvBruto || 0)
    const comisionBase = Number(venta.comision || 0)
    const iibb = Number(venta.iibb || 0)
    const descuentosAplicados = 0 // Por ahora asumimos 0
    
    // Para TN, incluir IVA sobre comisiones (21%)
    const comisionesConIVA = venta.plataforma === 'TN' 
      ? comisionBase * 1.21 
      : comisionBase
    
    const montoVentaALiquidar = pvBruto - descuentosAplicados - comisionesConIVA - iibb
    const nuevoTnALiquidar = liquidacion.tn_a_liquidar - montoVentaALiquidar

    // Actualizar la liquidación
    const { error: errorActualizacion } = await supabase
      .from('liquidaciones')
      .update({
        tn_a_liquidar: nuevoTnALiquidar,
        updated_at: new Date().toISOString()
      })
      .eq('id', liquidacion.id)

    if (errorActualizacion) {
      console.error('Error al actualizar liquidación:', errorActualizacion)
      return { success: false, error: errorActualizacion.message }
    }

    return { success: true }

  } catch (error) {
    console.error('Error al eliminar venta de liquidación:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
