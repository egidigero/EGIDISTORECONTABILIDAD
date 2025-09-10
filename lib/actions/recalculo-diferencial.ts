"use server"

import { supabase } from "@/lib/supabase"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"

/**
 * Sistema de recálculo diferencial para gastos/ingresos
 * Solo aplica las diferencias necesarias sin recalcular todo
 */
export async function recalculoDiferencialGastoIngreso(
  original: any,
  nuevo: any,
  operacion: 'create' | 'update' | 'delete'
) {
  try {
    const fechasAfectadas = new Set<string>()
    
    switch (operacion) {
      case 'create':
        // Nueva entrada: recalcular desde su fecha
        fechasAfectadas.add(nuevo.fecha)
        console.log('🆕 Nuevo gasto/ingreso - recalcular desde:', nuevo.fecha)
        break
        
      case 'delete':
        // Eliminación: recalcular desde la fecha del item eliminado
        fechasAfectadas.add(original.fecha)
        console.log('🗑️ Gasto/ingreso eliminado - recalcular desde:', original.fecha)
        break
        
      case 'update':
        // Analizar qué cambió específicamente
        const cambios = await analizarCambiosGastoIngreso(original, nuevo)
        
        if (!cambios.hayFinancieros) {
          console.log('ℹ️ Solo cambios cosméticos - no se recalculan liquidaciones')
          return
        }
        
        // Si cambió la fecha, afecta tanto la fecha original como la nueva
        if (cambios.fecha) {
          fechasAfectadas.add(original.fecha)
          fechasAfectadas.add(nuevo.fecha)
          console.log('📅 Cambio de fecha detectado:', original.fecha, '→', nuevo.fecha)
        } else {
          // Solo cambios de monto/tipo/personal - recalcular fecha actual
          fechasAfectadas.add(nuevo.fecha)
        }
        
        // Si solo cambió el monto, aplicar diferencia
        if (cambios.monto && !cambios.fecha && !cambios.tipo && !cambios.esPersonal) {
          const diferenciaMonto = nuevo.montoARS - original.montoARS
          console.log('💰 Aplicando diferencia de monto:', diferenciaMonto)
          await aplicarDiferenciaMonto(nuevo.fecha, diferenciaMonto, nuevo.tipo)
          return
        }
        break
    }
    
    // Recalcular todas las fechas afectadas
    const fechaMinima = Math.min(...Array.from(fechasAfectadas).map(f => new Date(f).getTime()))
    const fechaMinimaStr = new Date(fechaMinima).toISOString().split('T')[0]
    
    console.log('🔄 Recalculando liquidaciones desde:', fechaMinimaStr)
    await recalcularLiquidacionesEnCascada(fechaMinimaStr)
    
  } catch (error) {
    console.error('❌ Error en recálculo diferencial:', error)
    // Fallback: recalcular todo desde la fecha más temprana
    const fechaFallback = original?.fecha || nuevo?.fecha
    if (fechaFallback) {
      await recalcularLiquidacionesEnCascada(fechaFallback)
    }
  }
}

/**
 * Sistema de recálculo diferencial para ventas
 * Solo aplica las diferencias necesarias sin recalcular todo
 */
export async function recalculoDiferencialVenta(
  original: any,
  nuevo: any,
  operacion: 'create' | 'update' | 'delete'
) {
  try {
    const fechasAfectadas = new Set<string>()
    
    switch (operacion) {
      case 'create':
        // Nueva venta: recalcular desde su fecha
        fechasAfectadas.add(nuevo.fecha)
        console.log('🆕 Nueva venta - recalcular desde:', nuevo.fecha)
        break
        
      case 'delete':
        // Eliminación: recalcular desde la fecha de la venta eliminada
        fechasAfectadas.add(original.fecha)
        console.log('🗑️ Venta eliminada - recalcular desde:', original.fecha)
        break
        
      case 'update':
        // Analizar qué cambió específicamente
        const cambios = await analizarCambiosVenta(original, nuevo)
        
        if (!cambios.hayFinancieros) {
          console.log('ℹ️ Solo cambios cosméticos - no se recalculan liquidaciones')
          return
        }
        
        // Si cambió la fecha, afecta tanto la fecha original como la nueva
        if (cambios.fecha) {
          fechasAfectadas.add(original.fecha)
          fechasAfectadas.add(nuevo.fecha)
          console.log('📅 Cambio de fecha detectado:', original.fecha, '→', nuevo.fecha)
        } else {
          // Solo cambios financieros - recalcular fecha actual
          fechasAfectadas.add(nuevo.fecha)
        }
        break
    }
    
    // Recalcular todas las fechas afectadas
    const fechaMinima = Math.min(...Array.from(fechasAfectadas).map(f => new Date(f).getTime()))
    const fechaMinimaStr = new Date(fechaMinima).toISOString().split('T')[0]
    
    console.log('🔄 Recalculando liquidaciones desde:', fechaMinimaStr)
    await recalcularLiquidacionesEnCascada(fechaMinimaStr)
    
  } catch (error) {
    console.error('❌ Error en recálculo diferencial de venta:', error)
    // Fallback: recalcular todo desde la fecha más temprana
    const fechaFallback = original?.fecha || nuevo?.fecha
    if (fechaFallback) {
      await recalcularLiquidacionesEnCascada(fechaFallback)
    }
  }
}

/**
 * Analiza cambios específicos en gastos/ingresos
 */
export async function analizarCambiosGastoIngreso(original: any, nuevo: any) {
  const cambios = {
    fecha: original.fecha !== nuevo.fecha,
    monto: original.montoARS !== nuevo.montoARS,
    tipo: original.tipo !== nuevo.tipo,
    esPersonal: (original.esPersonal || false) !== (nuevo.esPersonal || false),
    // Cambios cosméticos que no afectan liquidaciones
    canal: original.canal !== nuevo.canal,
    descripcion: original.descripcion !== nuevo.descripcion,
    categoria: original.categoria !== nuevo.categoria,
    // Flag para determinar si hay cambios financieros
    hayFinancieros: false,
    hayCosmeticos: false
  }
  
  // Determinar si hay cambios financieros
  cambios.hayFinancieros = cambios.fecha || cambios.monto || cambios.tipo || cambios.esPersonal
  cambios.hayCosmeticos = cambios.canal || cambios.descripcion || cambios.categoria
  
  console.log('🔍 Análisis de cambios:', {
    fecha: cambios.fecha ? `${original.fecha} → ${nuevo.fecha}` : 'sin cambios',
    monto: cambios.monto ? `${original.montoARS} → ${nuevo.montoARS}` : 'sin cambios',
    tipo: cambios.tipo ? `${original.tipo} → ${nuevo.tipo}` : 'sin cambios',
    esPersonal: cambios.esPersonal ? `${original.esPersonal} → ${nuevo.esPersonal}` : 'sin cambios',
    canal: cambios.canal ? `${original.canal} → ${nuevo.canal}` : 'sin cambios',
    descripcion: cambios.descripcion ? 'cambió' : 'sin cambios',
    categoria: cambios.categoria ? `${original.categoria} → ${nuevo.categoria}` : 'sin cambios',
    hayFinancieros: cambios.hayFinancieros,
    hayCosmeticos: cambios.hayCosmeticos
  })
  
  return cambios
}

/**
 * Analiza cambios específicos en ventas
 */
export async function analizarCambiosVenta(original: any, nuevo: any) {
  const cambios = {
    fecha: original.fecha !== nuevo.fecha,
    plataforma: original.plataforma !== nuevo.plataforma,
    metodoPago: original.metodoPago !== nuevo.metodoPago,
    cantidad: original.cantidad !== nuevo.cantidad,
    pvBruto: original.pvBruto !== nuevo.pvBruto,
    costoEnvio: original.cargoEnvioCosto !== nuevo.cargoEnvioCosto,
    comision: original.comision !== nuevo.comision || original.iibb !== nuevo.iibb,
    productoId: original.productoId !== nuevo.productoId,
    // Cambios cosméticos que no afectan liquidaciones
    comprador: original.comprador !== nuevo.comprador,
    direccion: original.direccionEnvio !== nuevo.direccionEnvio,
    tracking: original.codigoSeguimiento !== nuevo.codigoSeguimiento,
    estado: original.estadoEnvio !== nuevo.estadoEnvio,
    // Flags para determinar si hay cambios financieros
    hayFinancieros: false,
    hayCosmeticos: false
  }
  
  // Determinar si hay cambios financieros
  cambios.hayFinancieros = cambios.fecha || cambios.plataforma || cambios.metodoPago || 
                          cambios.cantidad || cambios.pvBruto || cambios.costoEnvio || 
                          cambios.comision || cambios.productoId
  cambios.hayCosmeticos = cambios.comprador || cambios.direccion || cambios.tracking || cambios.estado
  
  console.log('🔍 Análisis de cambios en venta:', {
    fecha: cambios.fecha ? `${original.fecha} → ${nuevo.fecha}` : 'sin cambios',
    plataforma: cambios.plataforma ? `${original.plataforma} → ${nuevo.plataforma}` : 'sin cambios',
    metodoPago: cambios.metodoPago ? `${original.metodoPago} → ${nuevo.metodoPago}` : 'sin cambios',
    cantidad: cambios.cantidad ? `${original.cantidad} → ${nuevo.cantidad}` : 'sin cambios',
    pvBruto: cambios.pvBruto ? `${original.pvBruto} → ${nuevo.pvBruto}` : 'sin cambios',
    costoEnvio: cambios.costoEnvio ? `${original.cargoEnvioCosto} → ${nuevo.cargoEnvioCosto}` : 'sin cambios',
    comision: cambios.comision ? 'cambió' : 'sin cambios',
    productoId: cambios.productoId ? `${original.productoId} → ${nuevo.productoId}` : 'sin cambios',
    comprador: cambios.comprador ? 'cambió' : 'sin cambios',
    direccion: cambios.direccion ? 'cambió' : 'sin cambios',
    tracking: cambios.tracking ? 'cambió' : 'sin cambios',
    estado: cambios.estado ? `${original.estadoEnvio} → ${nuevo.estadoEnvio}` : 'sin cambios',
    hayFinancieros: cambios.hayFinancieros,
    hayCosmeticos: cambios.hayCosmeticos
  })
  
  return cambios
}

/**
 * Aplica solo la diferencia de monto a liquidaciones específicas
 * Optimización para cambios de monto sin otros cambios financieros
 */
async function aplicarDiferenciaMonto(fecha: string, diferenciaMonto: number, tipo: 'gasto' | 'ingreso') {
  try {
    console.log(`💰 Aplicando diferencia de ${diferenciaMonto} para ${tipo} en fecha ${fecha}`)
    
    // Obtener liquidaciones que contengan esta fecha
    const { data: liquidaciones, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .gte('fechaInicio', fecha)
      .lte('fechaFin', fecha)
    
    if (error) {
      console.error('Error obteniendo liquidaciones:', error)
      throw error
    }
    
    // Aplicar diferencia a cada liquidación afectada
    for (const liquidacion of liquidaciones || []) {
      const actualizacion = tipo === 'gasto' 
        ? { 
            gastosPlataforma: (liquidacion.gastosPlataforma || 0) + diferenciaMonto,
            gastosTotales: (liquidacion.gastosTotales || 0) + diferenciaMonto,
            utilidadNeta: (liquidacion.utilidadNeta || 0) - diferenciaMonto
          }
        : { 
            otrosIngresos: (liquidacion.otrosIngresos || 0) + diferenciaMonto,
            ingresosTotales: (liquidacion.ingresosTotales || 0) + diferenciaMonto,
            utilidadNeta: (liquidacion.utilidadNeta || 0) + diferenciaMonto
          }
      
      const { error: updateError } = await supabase
        .from('liquidaciones')
        .update(actualizacion)
        .eq('id', liquidacion.id)
      
      if (updateError) {
        console.error('Error actualizando liquidación:', updateError)
        throw updateError
      }
      
      console.log(`✅ Aplicada diferencia a liquidación ${liquidacion.id}:`, actualizacion)
    }
    
    // Si no hay liquidaciones para esa fecha, recalcular desde esa fecha
    if (!liquidaciones || liquidaciones.length === 0) {
      console.log('📅 No hay liquidaciones para esa fecha - recalcular en cascada')
      await recalcularLiquidacionesEnCascada(fecha)
    }
    
  } catch (error) {
    console.error('Error en aplicarDiferenciaMonto:', error)
    // Fallback: recálculo completo
    await recalcularLiquidacionesEnCascada(fecha)
  }
}