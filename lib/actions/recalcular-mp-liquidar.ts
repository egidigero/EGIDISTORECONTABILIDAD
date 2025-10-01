"use server"

import { supabase } from "@/lib/supabase"

/**
 * Recalcula el mp_a_liquidar de todas las liquidaciones basándose en las ventas ML existentes
 * Útil después de migraciones o cambios en la lógica de cálculo
 */
export async function recalcularMPALiquidarDesdVentas() {
  try {
    console.log('🔄 Iniciando recálculo de mp_a_liquidar desde ventas ML...')
    
    // Obtener todas las ventas ML agrupadas por fecha
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('fecha, pvBruto, comision, iva, iibb, cargoEnvioCosto')
      .eq('plataforma', 'ML')
      .order('fecha', { ascending: true })

    if (ventasError) {
      console.error('Error obteniendo ventas ML:', ventasError)
      return { success: false, error: ventasError.message }
    }

    if (!ventas || ventas.length === 0) {
      console.log('⚠️ No hay ventas ML para procesar')
      return { success: true, message: 'No hay ventas ML', totalProcesado: 0 }
    }

    // Agrupar ventas por fecha y calcular total a liquidar
    const ventasPorFecha: Record<string, number> = {}
    
    ventas.forEach(venta => {
      const fecha = venta.fecha
      const pvBruto = Number(venta.pvBruto || 0)
      const comision = Number(venta.comision || 0)
      const iva = Number(venta.iva || 0)
      const iibb = Number(venta.iibb || 0)
      const envio = Number(venta.cargoEnvioCosto || 0)
      
      // ML: PV - Comisión - IVA - IIBB - Envío
      const montoALiquidar = pvBruto - comision - iva - iibb - envio
      
      if (!ventasPorFecha[fecha]) {
        ventasPorFecha[fecha] = 0
      }
      ventasPorFecha[fecha] += montoALiquidar
    })

    console.log(`📊 Ventas ML encontradas en ${Object.keys(ventasPorFecha).length} fechas diferentes`)

    // Actualizar cada liquidación
    const resultados = []
    let totalActualizado = 0

    for (const [fecha, totalVentasML] of Object.entries(ventasPorFecha)) {
      // Obtener la liquidación de esa fecha
      const { data: liquidacion, error: liquidacionError } = await supabase
        .from('liquidaciones')
        .select('id, mp_a_liquidar')
        .eq('fecha', fecha)
        .single()

      if (liquidacionError || !liquidacion) {
        console.warn(`⚠️ No se encontró liquidación para ${fecha}, saltando...`)
        continue
      }

      const mpAnterior = liquidacion.mp_a_liquidar || 0
      
      // OPCIÓN 1: REEMPLAZAR (solo ventas del día)
      const nuevoMP = Math.round(totalVentasML * 100) / 100
      
      // OPCIÓN 2: ACUMULAR (mantener saldo anterior + ventas del día)
      // const nuevoMP = Math.round((mpAnterior + totalVentasML) * 100) / 100
      
      // Actualizar
      const { error: updateError } = await supabase
        .from('liquidaciones')
        .update({
          mp_a_liquidar: nuevoMP,
          updated_at: new Date().toISOString()
        })
        .eq('id', liquidacion.id)

      if (updateError) {
        console.error(`❌ Error actualizando liquidación ${fecha}:`, updateError)
        resultados.push({ fecha, error: updateError.message })
      } else {
        console.log(`✅ ${fecha}: ${mpAnterior.toFixed(2)} → ${nuevoMP.toFixed(2)} (ventas ML: ${totalVentasML.toFixed(2)})`)
        resultados.push({ 
          fecha, 
          anterior: mpAnterior, 
          nuevo: nuevoMP, 
          diferencia: nuevoMP - mpAnterior 
        })
        totalActualizado++
      }
    }

    console.log(`✅ Recálculo completado. ${totalActualizado} liquidaciones actualizadas.`)
    
    return { 
      success: true, 
      totalProcesado: totalActualizado,
      resultados 
    }

  } catch (error) {
    console.error('❌ Error en recalcularMPALiquidarDesdVentas:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
