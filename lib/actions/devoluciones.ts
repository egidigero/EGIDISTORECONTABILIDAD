"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { devolucionSchema, type DevolucionFormData } from "@/lib/validations"

export async function getDevoluciones() {
  try {
    const { data, error } = await supabase
      .from('devoluciones')
      .select('*, ventas(*, productos(*))')
      .order('createdAt', { ascending: false })
    if (error) throw error
    return data
  } catch (error) {
    console.error("Error al obtener devoluciones:", error)
    throw new Error("Error al obtener devoluciones")
  }
}

export async function createDevolucion(data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    const { data: created, error } = await supabase
      .from('devoluciones')
      .insert([validatedData])
      .select('*, ventas(*, productos(*))')
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

export async function updateDevolucion(id: string, data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    const { data: updated, error } = await supabase
      .from('devoluciones')
      .update(validatedData)
      .eq('id', id)
      .select('*, ventas(*, productos(*))')
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

export async function getDevolucionById(id: string) {
  try {
    const { data, error } = await supabase
      .from('devoluciones')
      .select('*, ventas(*, productos(*))')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  } catch (error) {
    console.error("Error al obtener devolución:", error)
    throw new Error("Error al obtener devolución")
  }
}

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
