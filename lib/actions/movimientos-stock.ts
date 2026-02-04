"use server"

import { supabase } from "@/lib/supabase"

export async function getMovimientosStock(productoId?: string) {
  let query = supabase
    .from('movimientos_stock')
    .select(`
      *,
      producto:productos!movimientos_stock_producto_id_fkey(
        id,
        modelo,
        sku
      )
    `)
    .order('fecha', { ascending: false })
  
  if (productoId) {
    query = query.eq('producto_id', productoId)
  }
  
  const { data, error } = await query.limit(100)
  
  if (error) {
    console.error('Error obteniendo movimientos stock:', error)
    return []
  }
  
  return data || []
}

export async function getMovimientosStockPorProducto() {
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select(`
      producto_id,
      tipo,
      cantidad,
      origen_tipo,
      fecha,
      deposito_origen,
      deposito_destino,
      observaciones
    `)
    .order('fecha', { ascending: false })
  
  if (error) {
    console.error('Error obteniendo movimientos:', error)
    return {}
  }
  
  // Agrupar por producto_id (convertir a string para comparación)
  const movimientosPorProducto = (data || []).reduce((acc: any, mov: any) => {
    const pid = String(mov.producto_id) // Asegurar que es string
    if (!acc[pid]) {
      acc[pid] = []
    }
    acc[pid].push(mov)
    return acc
  }, {})
  
  return movimientosPorProducto
}
