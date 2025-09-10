"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { tarifaSchema, type TarifaFormData } from "@/lib/validations"

export async function getTarifas() {
  try {
    const { data: tarifas, error } = await supabase
      .from("tarifas")
      .select("id, plataforma, metodoPago, condicion, comisionPct, comisionExtraPct, iibbPct, fijoPorOperacion, descuentoPct, createdAt, updatedAt")
      .order("createdAt", { ascending: false })
      .limit(100) // Limitar resultados para mejor performance
    if (error) throw new Error("Error al obtener tarifas")
    
    // Convertir decimales a porcentajes para mostrar en la interfaz
    const tarifasConPorcentajes = (tarifas || []).map(tarifa => ({
      ...tarifa,
      comisionPct: Math.round(tarifa.comisionPct * 100 * 100) / 100, // Redondear a 2 decimales
      comisionExtraPct: Math.round((tarifa.comisionExtraPct || 0) * 100 * 100) / 100, // Redondear a 2 decimales
      iibbPct: Math.round(tarifa.iibbPct * 100 * 100) / 100, // Redondear a 2 decimales
      descuentoPct: Math.round((tarifa.descuentoPct || 0) * 100 * 100) / 100, // Redondear a 2 decimales
    }))
    
    return tarifasConPorcentajes
  } catch (error) {
    console.error("Error al obtener tarifas:", error)
    return [] // Retornar array vacío en lugar de throw para mejor UX
  }
}

export async function getTarifaEspecifica(plataforma: string, metodoPago: string, condicion: string) {
  try {
    const { data: tarifa, error } = await supabase
      .from("tarifas")
      .select("id, plataforma, metodoPago, condicion, comisionPct, comisionExtraPct, iibbPct, fijoPorOperacion, descuentoPct")
      .eq("plataforma", plataforma)
      .eq("metodoPago", metodoPago)
      .eq("condicion", condicion)
      .single()
    
    if (error) {
      console.error("Error al obtener tarifa específica:", error)
      return null
    }
    
    return tarifa
  } catch (error) {
    console.error("Error al obtener tarifa específica:", error)
    return null
  }
}

export async function getTarifaPorParametros(plataforma: string, metodoPago: string, condicion: string) {
  try {
    const { data: tarifa, error } = await supabase
      .from("tarifas")
      .select("id, plataforma, metodoPago, condicion, comisionPct, comisionExtraPct, iibbPct, fijoPorOperacion, descuentoPct")
      .eq("plataforma", plataforma)
      .eq("metodoPago", metodoPago)
      .eq("condicion", condicion)
      .single()
    
    if (error) {
      console.error("Error al obtener tarifa específica:", error)
      return null
    }
    
    return tarifa
  } catch (error) {
    console.error("Error al obtener tarifa específica:", error)
    return null
  }
}

export async function createTarifa(data: Omit<TarifaFormData, 'id'>) {
  try {
    const now = new Date()
    
    // Verificar si ya existe la combinación plataforma-metodoPago-condicion
    const { data: existing, error: existingError } = await supabase
      .from("tarifas")
      .select("id")
      .eq("plataforma", data.plataforma)
      .eq("metodoPago", data.metodoPago)
      .eq("condicion", data.condicion)
      .limit(1)
    
    if (existingError) {
      console.error("Error al verificar existencia:", existingError)
      return { success: false, error: "Error al verificar tarifas existentes" }
    }
    
    if (existing && existing.length > 0) {
      return { 
        success: false, 
        error: `Ya existe una tarifa para la combinación ${data.plataforma} - ${data.metodoPago} - ${data.condicion}.` 
      }
    }
    
    // Generar el siguiente ID automáticamente
    const { data: lastTarifa, error: idError } = await supabase
      .from("tarifas")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
    
    if (idError) {
      console.error("Error al obtener último ID:", idError)
      return { success: false, error: "Error al generar ID" }
    }
    
    const nextId = !lastTarifa || lastTarifa.length === 0 || isNaN(Number(lastTarifa[0].id)) 
      ? "1" 
      : String(Number(lastTarifa[0].id) + 1)
    
    const validatedData = tarifaSchema.parse({
      ...data,
      id: nextId,
      createdAt: now,
      updatedAt: now,
    })

    const { data: tarifa, error: tarifaError } = await supabase
      .from("tarifas")
      .insert([validatedData])
      .select()
    
    if (tarifaError) {
      console.error("Error al insertar tarifa:", tarifaError)
      
      // Detectar error de duplicado y dar mensaje más claro
      if (tarifaError.message.includes('duplicate key value violates unique constraint')) {
        return { 
          success: false, 
          error: `Ya existe una tarifa para la combinación ${data.plataforma} - ${data.metodoPago} - ${data.condicion}.` 
        }
      }
      
      return { success: false, error: tarifaError.message }
    }
    
    revalidatePath("/tarifas")
    return { success: true, data: tarifa?.[0] }
  } catch (error) {
    console.error("Error al crear tarifa:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear tarifa" }
  }
}

export async function updateTarifa(id: string, data: TarifaFormData) {
  try {
    const validatedData = tarifaSchema.parse({
      ...data,
      updatedAt: new Date(),
    })

    const { data: tarifa, error: tarifaError } = await supabase
      .from("tarifas")
      .update(validatedData)
      .eq("id", id)
      .select()
    if (tarifaError) return { success: false, error: tarifaError.message }
    revalidatePath("/tarifas")
    return { success: true, data: tarifa?.[0] }
  } catch (error) {
    console.error("Error al actualizar tarifa:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar tarifa" }
  }
}

export async function deleteTarifa(id: string) {
  try {
    await supabase
      .from("tarifas")
      .delete()
      .eq("id", id)
    revalidatePath("/tarifas")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar tarifa:", error)
    return { success: false, error: "Error al eliminar tarifa" }
  }
}

export async function getTarifaById(id: string) {
  try {
    const { data: tarifa, error } = await supabase
      .from("tarifas")
      .select("*")
      .eq("id", id)
      .single()
    if (error) throw new Error("Error al obtener tarifa")
    return tarifa
  } catch (error) {
    console.error("Error al obtener tarifa:", error)
    throw new Error("Error al obtener tarifa")
  }
}
