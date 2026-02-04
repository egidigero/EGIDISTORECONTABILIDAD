"use server"

import { createClient } from "@/lib/supabase/server"

export async function getMovimientosStock(productoId?: string) {
  const supabase = await createClient()
  
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
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select(`
      producto_id,
      tipo,
      cantidad,
      origen_tipo,
      fecha
    `)
    .order('fecha', { ascending: false })
  
  if (error) {
    console.error('Error obteniendo movimientos:', error)
    return {}
  }
  
  // Agrupar por producto_id
  const movimientosPorProducto = data.reduce((acc: any, mov: any) => {
    const pid = mov.producto_id
    if (!acc[pid]) {
      acc[pid] = []
    }
    acc[pid].push(mov)
    return acc
  }, {})
  
  return movimientosPorProducto
}
