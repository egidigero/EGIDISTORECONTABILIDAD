"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { devolucionSchema, type DevolucionFormData } from "@/lib/validations"

// Helper: Obtener datos de la venta para auto-completar
async function obtenerDatosVenta(ventaId: string) {
  try {
    const { data: venta, error } = await supabase
      .from('ventas')
      .select('*, productos(*), tarifas(*)')
      .eq('id', ventaId)
      .single()

    if (error) throw error
    if (!venta) throw new Error("Venta no encontrada")

    // Auto-completar costos desde la venta original
    return {
      costoProductoOriginal: venta.costoProducto || 0,
      costoEnvioOriginal: venta.costoEnvio || 0,
      montoVentaOriginal: venta.montoTotal || 0,
      comisionOriginal: venta.comisionPlataforma || 0,
      plataforma: venta.plataforma,
      productoId: venta.productoId,
      comprador: venta.comprador,
      fechaCompra: venta.fecha
    }
  } catch (error) {
    console.error("Error al obtener datos de venta:", error)
    return null
  }
}

// Listar devoluciones desde la vista con cálculos automáticos
export async function getDevoluciones() {
  try {
    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .order('fecha_reclamo', { ascending: false })
    
    if (error) throw error
    return data
  } catch (error) {
    console.error("Error al obtener devoluciones:", error)
    throw new Error("Error al obtener devoluciones")
  }
}

// Crear devolución con auto-completado de datos financieros
export async function createDevolucion(data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    // Obtener datos de la venta para auto-completar
    const datosVenta = await obtenerDatosVenta(validatedData.ventaId)
    
    if (!datosVenta) {
      return { success: false, error: "No se pudo obtener los datos de la venta" }
    }

    // Combinar datos del formulario con datos auto-completados
    const devolucionCompleta = {
      ...validatedData,
      costoProductoOriginal: validatedData.costoProductoOriginal ?? datosVenta.costoProductoOriginal,
      costoEnvioOriginal: validatedData.costoEnvioOriginal ?? datosVenta.costoEnvioOriginal,
      montoVentaOriginal: validatedData.montoVentaOriginal ?? datosVenta.montoVentaOriginal,
      comisionOriginal: validatedData.comisionOriginal ?? datosVenta.comisionOriginal,
      nombreContacto: validatedData.nombreContacto ?? datosVenta.comprador,
      fechaCompra: validatedData.fechaCompra ?? datosVenta.fechaCompra,
    }

    const { data: created, error } = await supabase
      .from('devoluciones')
      .insert([devolucionCompleta])
      .select()
      .single()

    if (error) throw error

    revalidatePath("/devoluciones")
    return { success: true, data: created }
  } catch (error) {
    console.error("Error al crear devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear devolución" }
  }
}

// Actualizar devolución
export async function updateDevolucion(id: string, data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    const { data: updated, error } = await supabase
      .from('devoluciones')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/devoluciones")
    return { success: true, data: updated }
  } catch (error) {
    console.error("Error al actualizar devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar devolución" }
  }
}

// Eliminar devolución
export async function deleteDevolucion(id: string) {
  try {
    const { data: deleted, error } = await supabase
      .from('devoluciones')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/devoluciones")
    return { success: true, data: deleted }
  } catch (error) {
    console.error("Error al eliminar devolución:", error)
    return { success: false, error: "Error al eliminar devolución" }
  }
}

// Obtener devolución por ID desde la vista
export async function getDevolucionById(id: string) {
  try {
    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error al obtener devolución:", error)
    throw new Error("Error al obtener devolución")
  }
}

// Buscar ventas para el selector
export async function buscarVentas(query: string) {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, productos(*)')
      .or(`saleCode.ilike.%${query}%,externalOrderId.ilike.%${query}%,comprador.ilike.%${query}%`)
      .order('createdAt', { ascending: false })
      .limit(10)

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error al buscar ventas:", error)
    return []
  }
}

// Obtener estadísticas para reportes
export async function getEstadisticasDevoluciones(fechaInicio?: string, fechaFin?: string) {
  try {
    let query = supabase
      .from('devoluciones_resumen')
      .select('*')

    if (fechaInicio) {
      query = query.gte('fecha_reclamo', fechaInicio)
    }
    if (fechaFin) {
      query = query.lte('fecha_reclamo', fechaFin)
    }

    const { data: devoluciones, error } = await query

    if (error) throw error

    // Calcular estadísticas
    const total = devoluciones?.length || 0
    
    const porEstado = devoluciones?.reduce((acc, dev) => {
      acc[dev.estado] = (acc[dev.estado] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const porPlataforma = devoluciones?.reduce((acc, dev) => {
      acc[dev.plataforma] = (acc[dev.plataforma] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const porTipoResolucion = devoluciones?.reduce((acc, dev) => {
      if (dev.tipo_resolucion) {
        acc[dev.tipo_resolucion] = (acc[dev.tipo_resolucion] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>) || {}

    const perdidaTotal = devoluciones?.reduce((sum, dev) => sum + (dev.perdida_total || 0), 0) || 0
    const impactoVentasNetas = devoluciones?.reduce((sum, dev) => sum + (dev.impacto_ventas_netas || 0), 0) || 0

    // Top motivos
    const motivosCount = devoluciones?.reduce((acc, dev) => {
      acc[dev.motivo] = (acc[dev.motivo] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const topMotivos = Object.entries(motivosCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([motivo, count]) => ({ motivo, count: count as number }))

    // Promedio de pérdida
    const devolucionesConPerdida = devoluciones?.filter(d => (d.perdida_total || 0) > 0) || []
    const perdidaPromedio = devolucionesConPerdida.length > 0
      ? perdidaTotal / devolucionesConPerdida.length
      : 0

    return {
      total,
      porEstado,
      porPlataforma,
      porTipoResolucion,
      perdidaTotal,
      impactoVentasNetas,
      topMotivos,
      perdidaPromedio,
      devolucionesConPerdida: devolucionesConPerdida.length,
      data: devoluciones || []
    }
  } catch (error) {
    console.error("Error al obtener estadísticas:", error)
    throw new Error("Error al obtener estadísticas de devoluciones")
  }
}
