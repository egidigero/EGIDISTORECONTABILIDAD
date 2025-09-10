"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { productoSchema, type ProductoFormData } from "@/lib/validations"

export async function getProductos() {
  try {
    const { data: productos, error } = await supabase
      .from("productos")
      .select("id, modelo, sku, costoUnitarioARS, precio_venta, stockPropio, stockFull, activo, createdAt, updatedAt")
      .order("createdAt", { ascending: false })
      .limit(100) // Limitar resultados para mejor performance
    if (error) throw new Error("Error al obtener productos")
    return productos || []
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

export async function updateProducto(id: string, data: ProductoFormData) {
  try {
    const validatedData = productoSchema.parse(data)
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
    const { data: producto, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .single()
    if (error) throw new Error("Error al obtener producto")
    return producto
  } catch (error) {
    console.error("Error al obtener producto:", error)
    throw new Error("Error al obtener producto")
  }
}
