"use server"

import { supabase } from "@/lib/supabase"
import type { VentaConProducto } from "@/lib/types"

/**
 * Actualiza la liquidación del día cuando se crea/actualiza una venta
 * Procesa ventas de Tienda Nube (TN) y Mercado Libre (ML)
 */
export async function actualizarLiquidacionPorVenta(venta: VentaConProducto, isUpdate = false, ventaAnterior?: VentaConProducto) {
  try {
    // Solo procesar ventas de TN o ML
    if (venta.plataforma !== 'TN' && venta.plataforma !== 'ML') {
      console.log('Venta no es de TN ni ML, no afecta liquidación')
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

    // Calcular el monto a liquidar de esta venta
    const pvBruto = Number(venta.pvBruto || 0)
    const comisionBase = Number(venta.comision || 0)
    const iva = Number(venta.iva || 0)
    const iibb = Number(venta.iibb || 0)
    const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0)
    
    // Para ML: PV - Comisión - IVA - IIBB - Envío
    // Para TN: PV - Comisión - IVA - IIBB
    const montoVentaALiquidar = pvBruto - comisionBase - iva - iibb - (venta.plataforma === 'ML' ? cargoEnvioCosto : 0)
    
    let nuevoTnALiquidar = liquidacion.tn_a_liquidar
    let nuevoMpALiquidar = liquidacion.mp_a_liquidar

    if (isUpdate && ventaAnterior) {
      // Si es actualización, primero restar el valor anterior
      const pvBrutoAnterior = Number(ventaAnterior.pvBruto || 0)
      const comisionBaseAnterior = Number(ventaAnterior.comision || 0)
      const ivaAnterior = Number(ventaAnterior.iva || 0)
      const iibbAnterior = Number(ventaAnterior.iibb || 0)
      const cargoEnvioCostoAnterior = Number(ventaAnterior.cargoEnvioCosto || 0)
      
      const montoAnteriorALiquidar = pvBrutoAnterior - comisionBaseAnterior - ivaAnterior - iibbAnterior - (ventaAnterior.plataforma === 'ML' ? cargoEnvioCostoAnterior : 0)
      
      if (ventaAnterior.plataforma === 'TN') {
        nuevoTnALiquidar -= montoAnteriorALiquidar
      } else if (ventaAnterior.plataforma === 'ML') {
        nuevoMpALiquidar -= montoAnteriorALiquidar
      }
    }

    // Sumar el nuevo monto a la plataforma correspondiente
    if (venta.plataforma === 'TN') {
      nuevoTnALiquidar += montoVentaALiquidar
    } else if (venta.plataforma === 'ML') {
      nuevoMpALiquidar += montoVentaALiquidar
    }

    // Actualizar la liquidación
    const { error: errorActualizacion } = await supabase
      .from('liquidaciones')
      .update({
        tn_a_liquidar: nuevoTnALiquidar,
        mp_a_liquidar: nuevoMpALiquidar,
        updated_at: new Date().toISOString()
      })
      .eq('id', liquidacion.id)

    if (errorActualizacion) {
      console.error('Error al actualizar liquidación:', errorActualizacion)
      return { success: false, error: errorActualizacion.message }
    }

    console.log('Liquidación actualizada:', {
      fecha: fechaVenta,
      plataforma: venta.plataforma,
      montoVenta: montoVentaALiquidar,
      tn_a_liquidar_anterior: liquidacion.tn_a_liquidar,
      tn_a_liquidar_nuevo: nuevoTnALiquidar,
      mp_a_liquidar_anterior: liquidacion.mp_a_liquidar,
      mp_a_liquidar_nuevo: nuevoMpALiquidar
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
    // Solo procesar ventas de TN o ML
    if (venta.plataforma !== 'TN' && venta.plataforma !== 'ML') {
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

    // Calcular el monto a restar
    const pvBruto = Number(venta.pvBruto || 0)
    const comisionBase = Number(venta.comision || 0)
    const iva = Number(venta.iva || 0)
    const iibb = Number(venta.iibb || 0)
    const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0)
    
    const montoVentaALiquidar = pvBruto - comisionBase - iva - iibb - (venta.plataforma === 'ML' ? cargoEnvioCosto : 0)
    
    let nuevoTnALiquidar = liquidacion.tn_a_liquidar
    let nuevoMpALiquidar = liquidacion.mp_a_liquidar
    
    if (venta.plataforma === 'TN') {
      nuevoTnALiquidar -= montoVentaALiquidar
    } else if (venta.plataforma === 'ML') {
      nuevoMpALiquidar -= montoVentaALiquidar
    }

    // Actualizar la liquidación
    const { error: errorActualizacion } = await supabase
      .from('liquidaciones')
      .update({
        tn_a_liquidar: nuevoTnALiquidar,
        mp_a_liquidar: nuevoMpALiquidar,
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

/**
 * Calcula el monto que una venta aporta (o aportó) a la liquidación.
 * Este valor se usa para sumar/restar de los acumulados de liquidación (tn_a_liquidar / mp_a_liquidar).
 */
export async function calcularMontoVentaALiquidar(venta: VentaConProducto) {
  // Si la venta ya tiene precioNeto calculado, usarlo directamente
  // (es más confiable que recalcular, ya que tiene la lógica exacta de tarifas)
  if (typeof venta.precioNeto === 'number') {
    return Number(venta.precioNeto)
  }
  
  // Fallback: calcular manualmente si no está disponible
  const pvBruto = Number(venta.pvBruto || 0)
  const comisionBase = Number(venta.comision || 0)
  const iva = Number(venta.iva || 0)
  const iibb = Number(venta.iibb || 0)
  const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0)

  // Para ML: PV - Comisión - IVA - IIBB - Envío
  // Para TN: PV - Comisión - IVA - IIBB
  const montoVentaALiquidar = pvBruto - comisionBase - iva - iibb - (venta.plataforma === 'ML' ? cargoEnvioCosto : 0)
  return montoVentaALiquidar
}
