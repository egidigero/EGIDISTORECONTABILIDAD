"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { productoSchema, type ProductoFormData } from "@/lib/validations"

export async function getProductos() {
  try {
    // Usar vista stock_calculado para obtener stock en tiempo real desde movimientos
    const { data: stockData, error: stockError } = await supabase
      .from("stock_calculado")
      .select("*")
      .order("producto_id", { ascending: false })
      .limit(100)
    
    if (stockError) throw new Error("Error al obtener stock calculado")
    
    // Obtener datos básicos de productos
    const { data: productos, error } = await supabase
      .from("productos")
      .select("id, modelo, sku, costoUnitarioARS, precio_venta, activo, createdAt, updatedAt")
      .order("createdAt", { ascending: false })
      .limit(100)
    
    if (error) throw new Error("Error al obtener productos")
    
    // Combinar productos con stock calculado
    const productosConStock = productos?.map(p => {
      const stock = stockData?.find(s => s.producto_id === p.id)
      return {
        ...p,
        stockPropio: stock?.stock_propio_calculado || 0,
        stockFull: stock?.stock_full_calculado || 0,
        stockTotal: stock?.stock_total_calculado || 0,
        ultimoMovimiento: stock?.ultimo_movimiento,
        cantidadMovimientos: stock?.cantidad_movimientos || 0
      }
    }) || []
    
    return productosConStock
  } catch (error) {
    console.error("Error al obtener productos:", error)
    return [] // Retornar array vacío en lugar de throw para mejor UX
  }
}

export async function createProducto(data: ProductoFormData) {
  try {
    const validatedData = productoSchema.parse(data)
  // Generar un id único tipo string
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const now = new Date().toISOString()
    // Buscar el id máximo numérico
    const { data: productos, error: lastError } = await supabase
      .from("productos")
      .select("id")
      .order("id", { ascending: false })
      .limit(50)
    let maxId = 0
    if (productos && productos.length > 0) {
      // Filtrar solo ids numéricos
      const numericIds = productos.map(p => Number(p.id)).filter(n => !isNaN(n))
      if (numericIds.length > 0) {
        maxId = Math.max(...numericIds)
      }
    }
    const nextId = (maxId + 1).toString()
    const insertData = { ...validatedData, id: nextId, updatedAt: now, createdAt: now }
    const { data: producto, error: productoError } = await supabase
      .from("productos")
      .insert([insertData])
      .select()
    if (productoError) return { success: false, error: productoError.message }
    revalidatePath("/productos")
    return { success: true, data: producto?.[0] }
  } catch (error) {
    console.error("Error al crear producto:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear producto" }
  }
}

export async function updateProducto(id: string, data: Partial<ProductoFormData>) {
  try {
    const validatedData = productoSchema.partial().parse(data)
    const now = new Date().toISOString()
    const updateData = { ...validatedData, updatedAt: now }
    const { data: producto, error: productoError } = await supabase
      .from("productos")
      .update(updateData)
      .eq("id", id)
      .select()
    if (productoError) return { success: false, error: productoError.message }
    revalidatePath("/productos")
    return { success: true, data: producto?.[0] }
  } catch (error) {
    console.error("Error al actualizar producto:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar producto" }
  }
}

export async function deleteProducto(id: string) {
  try {
    await supabase
      .from("productos")
      .delete()
      .eq("id", id)
    revalidatePath("/productos")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    return { success: false, error: "Error al eliminar producto" }
  }
}

export async function getProductoById(id: string) {
  try {
    // Obtener producto
    const { data: producto, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .single()
    
    if (error) throw new Error("Error al obtener producto")
    
    // Obtener stock calculado
    const { data: stock, error: stockError } = await supabase
      .from("stock_calculado")
      .select("*")
      .eq("producto_id", id)
      .single()
    
    // Combinar datos (si no hay stock, usar valores en 0)
    return {
      ...producto,
      stockPropio: stock?.stock_propio_calculado || 0,
      stockFull: stock?.stock_full_calculado || 0,
      stockTotal: stock?.stock_total_calculado || 0,
      ultimoMovimiento: stock?.ultimo_movimiento,
      cantidadMovimientos: stock?.cantidad_movimientos || 0
    }
  } catch (error) {
    console.error("Error al obtener producto:", error)
    throw new Error("Error al obtener producto")
  }
}
