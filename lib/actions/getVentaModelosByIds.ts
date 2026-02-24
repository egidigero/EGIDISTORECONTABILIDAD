"use server"

import { supabase } from "@/lib/supabase"

const toModel = (value: unknown): string => {
  const model = String(value ?? "").trim()
  return model.length > 0 ? model : ""
}

export async function getVentaModelosByIds(ventaIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ventaIds) ? ventaIds : [])
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  )

  if (uniqueIds.length === 0) return {}

  const result: Record<string, string> = {}
  const chunkSize = 200

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from("ventas")
      .select("id, producto:productos(modelo), productos(modelo)")
      .in("id", chunk)

    if (error) {
      console.warn("No se pudo obtener modelo de ventas por ID (no critico)", error)
      continue
    }

    for (const row of data || []) {
      const id = String((row as any)?.id ?? "").trim()
      if (!id) continue
      const model = toModel((row as any)?.producto?.modelo) || toModel((row as any)?.productos?.modelo)
      if (model) result[id] = model
    }
  }

  return result
}
