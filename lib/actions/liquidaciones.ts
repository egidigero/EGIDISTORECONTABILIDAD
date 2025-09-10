"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { liquidacionSchema, type LiquidacionFormData } from "@/lib/validations"
import { calcularImpactoEnMPDisponible } from "@/lib/actions/gastos-ingresos"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"

// Función para asegurar que existe una liquidación para una fecha específica
export async function asegurarLiquidacionParaFecha(fecha: string) {
  try {
    console.log('🔍 Verificando si existe liquidación para fecha:', fecha)
    
    // Verificar si ya existe liquidación para esa fecha
    const { data: liquidacionExistente, error: errorBusqueda } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fecha)
      .single()

    if (liquidacionExistente && !errorBusqueda) {
      console.log('✅ Liquidación ya existe para', fecha, '- ID:', liquidacionExistente.id)
      return { success: true, data: liquidacionExistente, created: false }
    }

    console.log('⚠️ No existe liquidación para', fecha, '- Creando nueva...')
    
    // Buscar la liquidación más reciente (anterior a esta fecha)
    const { data: liquidacionAnterior, error: errorAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    // Datos base para nueva liquidación (heredar de liquidación anterior)
    let datosBase = {
      mp_disponible: 0,
      mp_a_liquidar: 0,
      tn_a_liquidar: 0
    }

    if (liquidacionAnterior && !errorAnterior) {
      console.log('📋 Heredando datos de liquidación anterior:', liquidacionAnterior.fecha)
      datosBase = {
        mp_disponible: liquidacionAnterior.mp_disponible || 0,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar || 0,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar || 0
      }
    } else {
      console.log('⚠️ No se encontró liquidación anterior, usando valores en 0')
    }

    // Obtener gastos e ingresos del día
    const impactoGastosIngresos = await calcularImpactoEnMPDisponible(fecha)
    console.log('💰 Impacto gastos/ingresos del día:', impactoGastosIngresos.impactoNeto)

    // Calcular saldos finales para el día (base + gastos/ingresos)
    const saldosFinales = {
      mp_disponible: datosBase.mp_disponible + impactoGastosIngresos.impactoNeto,
      mp_a_liquidar: datosBase.mp_a_liquidar,
      tn_a_liquidar: datosBase.tn_a_liquidar,
      mp_liquidado_hoy: 0,
      tn_liquidado_hoy: 0,
      tn_iibb_descuento: 0
    }

    // Crear la nueva liquidación
    const { data: nuevaLiquidacion, error: errorCreacion } = await supabase
      .from('liquidaciones')
      .insert([{
        id: crypto.randomUUID(),
        fecha,
        ...saldosFinales,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single()

    if (errorCreacion) {
      console.error('❌ Error creando liquidación:', errorCreacion)
      return { success: false, error: errorCreacion.message }
    }

    console.log('✅ Liquidación creada exitosamente para', fecha, '- ID:', nuevaLiquidacion.id)
    return { success: true, data: nuevaLiquidacion, created: true }

  } catch (error) {
    console.error('❌ Error en asegurarLiquidacionParaFecha:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Función para obtener o crear automáticamente la liquidación del día
export async function obtenerLiquidacionHoy() {
  try {
    const hoy = new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
    console.log('Buscando liquidación para:', hoy)
    
    // Intentar obtener la liquidación de hoy
    const { data: liquidacionHoy, error: errorHoy } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', hoy)
      .single()

    // Si existe, la devolvemos
    if (liquidacionHoy && !errorHoy) {
      console.log('Liquidación de hoy encontrada:', liquidacionHoy.id)
      return { success: true, data: liquidacionHoy }
    }

    console.log('No hay liquidación para hoy, creando nueva...')
    
    // Si no existe, buscar la liquidación más reciente
    const { data: liquidacionAnterior, error: errorAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    // Datos base para nueva liquidación
    let datosBase = {
      mp_disponible: 0,
      mp_a_liquidar: 0,
      tn_a_liquidar: 0
    }

    // Si hay liquidación anterior, usar sus datos
    if (liquidacionAnterior && !errorAnterior) {
      console.log('Liquidación anterior encontrada:', liquidacionAnterior.fecha)
      datosBase = {
        mp_disponible: liquidacionAnterior.mp_disponible || 0,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar || 0,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar || 0
      }
    }

    // Obtener gastos e ingresos del día actual
    const impactoGastosIngresos = await calcularImpactoEnMPDisponible(hoy)
    
    // Aplicar gastos e ingresos solo al MP Disponible
    const mp_disponible_con_gastos = datosBase.mp_disponible + impactoGastosIngresos.impactoNeto

    console.log('Aplicando gastos e ingresos del día:', {
      mp_disponible_base: datosBase.mp_disponible,
      impacto_gastos_ingresos: impactoGastosIngresos.impactoNeto,
      mp_disponible_final: mp_disponible_con_gastos,
      detalle: impactoGastosIngresos
    })

    // Crear nueva liquidación para hoy
    const id = `liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('Creando nueva liquidación con ID:', id)
    
    const { data: nuevaLiquidacion, error: errorCreacion } = await supabase
      .from('liquidaciones')
      .insert([{
        id: id,
        fecha: hoy,
        mp_disponible: mp_disponible_con_gastos,
        mp_a_liquidar: datosBase.mp_a_liquidar,
        mp_liquidado_hoy: 0,
        tn_a_liquidar: datosBase.tn_a_liquidar,
        tn_liquidado_hoy: 0,
        tn_iibb_descuento: 0,
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single()

    if (errorCreacion) {
      console.error("Error al crear liquidación del día:", errorCreacion)
      return { success: false, error: errorCreacion.message }
    }

    revalidatePath("/liquidaciones")
    return { success: true, data: nuevaLiquidacion }
  } catch (error) {
    console.error("Error al obtener liquidación de hoy:", error)
    return { success: false, error: "Error al obtener liquidación de hoy" }
  }
}

// Función específica para inicialización automática
export async function inicializarLiquidacionHoy() {
  return await obtenerLiquidacionHoy()
}

export async function getLiquidaciones() {
  try {
    const { data, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .order('fecha', { ascending: false })

    if (error) {
      console.error("Error al obtener liquidaciones:", error)
      throw new Error("Error al obtener liquidaciones")
    }

    return data || []
  } catch (error) {
    console.error("Error al obtener liquidaciones:", error)
    return []
  }
}

export async function getLiquidacion(id: string) {
  try {
    const { data, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error al obtener liquidación:", error)
      throw new Error("Error al obtener liquidación")
    }

    return data
  } catch (error) {
    console.error("Error al obtener liquidación:", error)
    throw new Error("Error al obtener liquidación")
  }
}

export async function createLiquidacion(data: LiquidacionFormData) {
  try {
    console.log("1. Iniciando createLiquidacion con data:", data)
    const validatedData = liquidacionSchema.parse(data)
    console.log("2. Datos validados:", validatedData)
    
    // Generar ID único usando timestamp y random
    const id = `liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log("3. ID generado:", id)

    const insertData = {
      id: id,
      fecha: validatedData.fecha.toISOString().split('T')[0], // Formato YYYY-MM-DD
      mp_disponible: validatedData.mp_disponible,
      mp_a_liquidar: validatedData.mp_a_liquidar,
      mp_liquidado_hoy: validatedData.mp_liquidado_hoy,
      tn_a_liquidar: validatedData.tn_a_liquidar,
      tn_liquidado_hoy: validatedData.tn_liquidado_hoy,
      tn_iibb_descuento: validatedData.tn_iibb_descuento,
      updatedAt: new Date().toISOString()
    }
    console.log("4. Datos a insertar:", insertData)

    const { data: liquidacion, error } = await supabase
      .from('liquidaciones')
      .insert([insertData])
      .select()
      .single()

    console.log("5. Resultado supabase:", { liquidacion, error })

    if (error) {
      console.error("Error al crear liquidación:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/liquidaciones")
    console.log("6. Retornando éxito")
    return { success: true, data: liquidacion }
  } catch (error) {
    console.error("Error al crear liquidación:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear liquidación" }
  }
}

export async function updateLiquidacion(id: string, data: LiquidacionFormData) {
  try {
    const validatedData = liquidacionSchema.parse(data)

    // Primero obtener la liquidación actual para saber su fecha
    const { data: liquidacionActual, error: errorGet } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('id', id)
      .single()

    if (errorGet || !liquidacionActual) {
      return { success: false, error: "No se encontró la liquidación" }
    }

    // Obtener la liquidación anterior más reciente para los saldos base
    const fechaActual = liquidacionActual.fecha

    const { data: liquidacionAnterior, error: errorAnterior } = await supabase
      .from('liquidaciones')
      .select('*')
      .lt('fecha', fechaActual)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    console.log('Búsqueda liquidación anterior:', {
      fechaActual,
      liquidacionAnterior: liquidacionAnterior ? {
        fecha: liquidacionAnterior.fecha,
        mp_disponible: liquidacionAnterior.mp_disponible,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar
      } : null,
      errorAnterior
    })

    // Saldos base (del día anterior o valores iniciales)
    let saldosBase = {
      mp_disponible: 0,
      mp_a_liquidar: 0,
      tn_a_liquidar: 0
    }

    if (liquidacionAnterior) {
      saldosBase = {
        mp_disponible: liquidacionAnterior.mp_disponible || 0,
        mp_a_liquidar: liquidacionAnterior.mp_a_liquidar || 0,
        tn_a_liquidar: liquidacionAnterior.tn_a_liquidar || 0
      }
    }

    // Obtener gastos e ingresos del día que se está editando
    const fechaEditando = liquidacionActual.fecha
    const impactoGastosIngresos = await calcularImpactoEnMPDisponible(fechaEditando)
    
    // Aplicar gastos e ingresos del día a los saldos base
    const saldos_base_con_gastos = {
      mp_disponible: saldosBase.mp_disponible + impactoGastosIngresos.impactoNeto,
      mp_a_liquidar: saldosBase.mp_a_liquidar,
      tn_a_liquidar: saldosBase.tn_a_liquidar
    }

    // Valores originales de la liquidación que estamos editando
    const mp_liquidado_original = liquidacionActual.mp_liquidado_hoy || 0
    const tn_liquidado_original = liquidacionActual.tn_liquidado_hoy || 0
    const iibb_descuento_original = liquidacionActual.tn_iibb_descuento || 0

    // Nuevos valores que viene del formulario
    const mp_liquidado_nuevo = validatedData.mp_liquidado_hoy || 0
    const tn_liquidado_nuevo = validatedData.tn_liquidado_hoy || 0
    const iibb_descuento_nuevo = validatedData.tn_iibb_descuento || 0

    // Calcular las diferencias
    const diferencia_mp = mp_liquidado_nuevo - mp_liquidado_original
    const diferencia_tn = tn_liquidado_nuevo - tn_liquidado_original
    const diferencia_iibb = iibb_descuento_nuevo - iibb_descuento_original

    // CORRECCIÓN: Aplicar la lógica correcta = saldos base + gastos/ingresos + liquidaciones
  const nuevo_mp_disponible = saldos_base_con_gastos.mp_disponible + mp_liquidado_nuevo + tn_liquidado_nuevo - iibb_descuento_nuevo
  const nuevo_mp_a_liquidar = saldos_base_con_gastos.mp_a_liquidar - mp_liquidado_nuevo
  // Ahora: solo modificar tn_a_liquidar por la diferencia real editada
  // Ahora: modificar tn_a_liquidar por la diferencia de TN liquidado y de IIBB
  const nuevo_tn_a_liquidar = liquidacionActual.tn_a_liquidar - diferencia_tn - diferencia_iibb

    console.log('Recalculando liquidación editada:', {
      valores_originales: { mp_liquidado_original, tn_liquidado_original, iibb_descuento_original },
      valores_nuevos: { mp_liquidado_nuevo, tn_liquidado_nuevo, iibb_descuento_nuevo },
      diferencias: { diferencia_mp, diferencia_tn, diferencia_iibb },
      gastos_ingresos: impactoGastosIngresos,
      saldos_base: saldosBase,
      saldos_base_con_gastos: saldos_base_con_gastos,
      saldos_actuales: { 
        mp_disponible: liquidacionActual.mp_disponible,
        mp_a_liquidar: liquidacionActual.mp_a_liquidar,
        tn_a_liquidar: liquidacionActual.tn_a_liquidar
      },
      saldos_nuevos: { nuevo_mp_disponible, nuevo_mp_a_liquidar, nuevo_tn_a_liquidar }
    })

    const { data: liquidacion, error } = await supabase
      .from('liquidaciones')
      .update({
        fecha: validatedData.fecha.toISOString().split('T')[0],
        mp_disponible: nuevo_mp_disponible,
        mp_a_liquidar: nuevo_mp_a_liquidar,
        mp_liquidado_hoy: validatedData.mp_liquidado_hoy,
        tn_a_liquidar: nuevo_tn_a_liquidar,
        tn_liquidado_hoy: validatedData.tn_liquidado_hoy,
        tn_iibb_descuento: validatedData.tn_iibb_descuento,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error("Error al actualizar liquidación:", error)
      return { success: false, error: error.message }
    }

    // Obtener todas las liquidaciones posteriores a esta fecha para recalcularlas también
    const { data: liquidacionesPosteriores } = await supabase
      .from('liquidaciones')
      .select('*')
      .gt('fecha', liquidacionActual.fecha)
      .order('fecha', { ascending: true })

    // Recalcular liquidaciones posteriores en cascada
    if (liquidacionesPosteriores && liquidacionesPosteriores.length > 0) {
      let saldosAcumulados = {
        mp_disponible: nuevo_mp_disponible,
        mp_a_liquidar: nuevo_mp_a_liquidar,
        tn_a_liquidar: nuevo_tn_a_liquidar
      }

      for (const liqPosterior of liquidacionesPosteriores) {
        const mp_liq_post = liqPosterior.mp_liquidado_hoy || 0
        const tn_liq_post = liqPosterior.tn_liquidado_hoy || 0
        const iibb_desc_post = liqPosterior.tn_iibb_descuento || 0

        // Aplicar movimientos de la liquidación posterior
        saldosAcumulados.mp_disponible += mp_liq_post + tn_liq_post - iibb_desc_post
        saldosAcumulados.mp_a_liquidar -= mp_liq_post
        saldosAcumulados.tn_a_liquidar -= tn_liq_post

        // Actualizar la liquidación posterior
        await supabase
          .from('liquidaciones')
          .update({
            mp_disponible: saldosAcumulados.mp_disponible,
            mp_a_liquidar: saldosAcumulados.mp_a_liquidar,
            tn_a_liquidar: saldosAcumulados.tn_a_liquidar,
            updatedAt: new Date().toISOString()
          })
          .eq('id', liqPosterior.id)

        console.log(`Recalculada liquidación posterior ${liqPosterior.fecha}:`, saldosAcumulados)
      }
    }

    console.log("Liquidación actualizada con recálculo de saldos:", liquidacion)
    revalidatePath("/liquidaciones")
    return { success: true, data: liquidacion }
  } catch (error) {
    console.error("Error al actualizar liquidación:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar liquidación" }
  }
}

export async function deleteLiquidacion(id: string) {
  try {
    const { error } = await supabase
      .from('liquidaciones')
      .delete()
      .eq('id', id)

    if (error) {
      console.error("Error al eliminar liquidación:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/liquidaciones")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar liquidación:", error)
    return { success: false, error: "Error al eliminar liquidación" }
  }
}

// Función para procesar liquidación del día
export async function procesarLiquidacion(
  fecha: Date,
  mp_liquidado: number,
  tn_liquidado: number,
  iibb_descuento: number
) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0]
    console.log('Procesando liquidación para fecha:', fechaStr)
    console.log('Valores:', { mp_liquidado, tn_liquidado, iibb_descuento })
    
    // Primero obtener la liquidación existente para esa fecha
    const { data: liquidacionExistente, error: errorGet } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('fecha', fechaStr)
      .single()

    if (errorGet || !liquidacionExistente) {
      console.error('Error obteniendo liquidación:', errorGet)
      return { success: false, error: "No se encontró la liquidación para esa fecha" }
    }

    console.log('Liquidación encontrada:', liquidacionExistente.id)

    // Calcular nuevos saldos según la lógica de negocio:
    // MP Disponible = MP Disponible + MP Liquidado + TN Liquidado - IIBB
    // MP A Liquidar = MP A Liquidar - MP Liquidado  
    // TN A Liquidar = TN A Liquidar - TN Liquidado
    
    const mp_disponible_actual = liquidacionExistente.mp_disponible || 0
    const mp_a_liquidar_actual = liquidacionExistente.mp_a_liquidar || 0
    const tn_a_liquidar_actual = liquidacionExistente.tn_a_liquidar || 0
    
    // IMPORTANTE: Los campos "liquidado_hoy" deben acumularse, no sobrescribirse
    const mp_liquidado_previo = liquidacionExistente.mp_liquidado_hoy || 0
    const tn_liquidado_previo = liquidacionExistente.tn_liquidado_hoy || 0
    const iibb_descuento_previo = liquidacionExistente.tn_iibb_descuento || 0
    
    const nuevo_mp_disponible = mp_disponible_actual + mp_liquidado + tn_liquidado - iibb_descuento
    const nuevo_mp_a_liquidar = mp_a_liquidar_actual - mp_liquidado
    const nuevo_tn_a_liquidar = tn_a_liquidar_actual - tn_liquidado
    
    // Acumular los movimientos del día
    const nuevo_mp_liquidado_hoy = mp_liquidado_previo + mp_liquidado
    const nuevo_tn_liquidado_hoy = tn_liquidado_previo + tn_liquidado
    const nuevo_iibb_descuento_hoy = iibb_descuento_previo + iibb_descuento

    console.log('Cálculos de liquidación:', {
      mp_disponible: `${mp_disponible_actual} + ${mp_liquidado} + ${tn_liquidado} - ${iibb_descuento} = ${nuevo_mp_disponible}`,
      mp_a_liquidar: `${mp_a_liquidar_actual} - ${mp_liquidado} = ${nuevo_mp_a_liquidar}`,
      tn_a_liquidar: `${tn_a_liquidar_actual} - ${tn_liquidado} = ${nuevo_tn_a_liquidar}`,
      mp_liquidado_acumulado: `${mp_liquidado_previo} + ${mp_liquidado} = ${nuevo_mp_liquidado_hoy}`,
      tn_liquidado_acumulado: `${tn_liquidado_previo} + ${tn_liquidado} = ${nuevo_tn_liquidado_hoy}`,
      iibb_acumulado: `${iibb_descuento_previo} + ${iibb_descuento} = ${nuevo_iibb_descuento_hoy}`
    })

    // Actualizar todos los campos: procesamiento del día + saldos actualizados
    const { data, error } = await supabase
      .from('liquidaciones')
      .update({
        mp_liquidado_hoy: nuevo_mp_liquidado_hoy,
        tn_liquidado_hoy: nuevo_tn_liquidado_hoy,
        tn_iibb_descuento: nuevo_iibb_descuento_hoy,
        mp_disponible: nuevo_mp_disponible,
        mp_a_liquidar: nuevo_mp_a_liquidar,
        tn_a_liquidar: nuevo_tn_a_liquidar
      })
      .eq('fecha', fechaStr)
      .select()
      .single()

    if (error) {
      console.error("Error al procesar liquidación:", error)
      return { success: false, error: error.message }
    }

    console.log('Liquidación actualizada exitosamente:', data)
  // Recalcular en cascada desde la fecha procesada
  await recalcularLiquidacionesEnCascada(fechaStr)
  revalidatePath("/liquidaciones")
  return { success: true, data }
  } catch (error) {
    console.error("Error al procesar liquidación:", error)
    return { success: false, error: "Error al procesar liquidación" }
  }
}

// Función para recalcular liquidación manualmente
export async function recalcularLiquidacion(fecha: string) {
  try {
    // Por ahora, simplemente revalidamos la ruta
    // En el futuro se pueden agregar cálculos específicos aquí
    revalidatePath("/liquidaciones")
    return { success: true }
  } catch (error) {
    console.error("Error al recalcular liquidación:", error)
    return { success: false, error: "Error al recalcular liquidación" }
  }
}

// Función específica para recalcular liquidaciones cuando cambian gastos/ingresos
export async function recalcularLiquidacionesSinGastosIngresos(fechaDesde: string) {
  try {
    console.log(`Recalculando liquidaciones desde ${fechaDesde} sin asumir gastos/ingresos previos`)
    
    // Obtener todas las liquidaciones desde la fecha especificada
    const { data: liquidaciones, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .gte('fecha', fechaDesde)
      .order('fecha', { ascending: true })

    if (error) {
      console.error('Error obteniendo liquidaciones:', error)
      return { success: false, error: error.message }
    }

    if (!liquidaciones || liquidaciones.length === 0) {
      console.log('No hay liquidaciones para recalcular')
      return { success: true }
    }

    console.log(`Recalculando ${liquidaciones.length} liquidaciones`)

    // Para cada liquidación, recalcular correctamente
    for (let i = 0; i < liquidaciones.length; i++) {
      const liquidacion = liquidaciones[i]
      console.log(`Recalculando liquidación ${liquidacion.fecha}`)

      // Obtener liquidación anterior (la inmediatamente anterior en fecha)
      const { data: liquidacionAnterior } = await supabase
        .from('liquidaciones')
        .select('*')
        .lt('fecha', liquidacion.fecha)
        .order('fecha', { ascending: false })
        .limit(1)
        .single()

      // Saldos base del día anterior
      let saldosBase = {
        mp_disponible: 0,
        mp_a_liquidar: 0,
        tn_a_liquidar: 0
      }

      if (liquidacionAnterior) {
        saldosBase = {
          mp_disponible: liquidacionAnterior.mp_disponible || 0,
          mp_a_liquidar: liquidacionAnterior.mp_a_liquidar || 0,
          tn_a_liquidar: liquidacionAnterior.tn_a_liquidar || 0
        }
      }

      // Obtener gastos/ingresos del día actual
      const impactoGastosIngresos = await calcularImpactoEnMPDisponible(liquidacion.fecha)

      // Obtener ventas TN del día para calcular el impacto en tn_a_liquidar
      const { calcularDetalleVentasTN } = await import('@/lib/actions/ventas-tn-liquidacion')
      const detalleVentasTN = await calcularDetalleVentasTN(liquidacion.fecha)

      // Valores de liquidación del día (lo que realmente liquidó)
      const mp_liquidado = liquidacion.mp_liquidado_hoy || 0
      const tn_liquidado = liquidacion.tn_liquidado_hoy || 0
      const iibb_descuento = liquidacion.tn_iibb_descuento || 0

      // Calcular saldos correctos: base anterior + gastos/ingresos + liquidaciones del día + ventas TN
      const nuevo_mp_disponible = saldosBase.mp_disponible + impactoGastosIngresos.impactoNeto + mp_liquidado + tn_liquidado - iibb_descuento
      const nuevo_mp_a_liquidar = saldosBase.mp_a_liquidar - mp_liquidado
      const nuevo_tn_a_liquidar = saldosBase.tn_a_liquidar + detalleVentasTN.resumen.totalALiquidar - tn_liquidado

      console.log(`Liquidación ${liquidacion.fecha}:`, {
        saldosBase,
        impactoGastosIngresos: impactoGastosIngresos.impactoNeto,
        ventasTN: detalleVentasTN.resumen.totalALiquidar,
        liquidaciones: { mp_liquidado, tn_liquidado, iibb_descuento },
        saldosNuevos: { nuevo_mp_disponible, nuevo_mp_a_liquidar, nuevo_tn_a_liquidar }
      })

      // Actualizar la liquidación con los valores corregidos
      const { error: updateError } = await supabase
        .from('liquidaciones')
        .update({
          mp_disponible: nuevo_mp_disponible,
          mp_a_liquidar: nuevo_mp_a_liquidar,
          tn_a_liquidar: nuevo_tn_a_liquidar,
          updatedAt: new Date().toISOString()
        })
        .eq('id', liquidacion.id)

      if (updateError) {
        console.error(`Error actualizando liquidación ${liquidacion.fecha}:`, updateError)
        return { success: false, error: updateError.message }
      }

      console.log(`✓ Liquidación ${liquidacion.fecha} recalculada`)
    }

    revalidatePath("/liquidaciones")
    revalidatePath("/eerr")
    return { success: true }
  } catch (error) {
    console.error('Error en recalcularLiquidacionesSinGastosIngresos:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
