import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get("fecha")
    const fechaDesde = searchParams.get("fechaDesde")
    const fechaHasta = searchParams.get("fechaHasta")
    const canal = searchParams.get("canal")
    const tipo = searchParams.get("tipo")
    const categoria = searchParams.get("categoria")

    let query = supabase
      .from("gastos_ingresos")
      .select("id, fecha, canal, tipo, categoria, descripcion, montoARS, esPersonal, createdAt, updatedAt")
      .order("fecha", { ascending: false })

    if (fecha) {
      query = query.eq("fecha", fecha)
    } else {
      if (fechaDesde) query = query.gte("fecha", fechaDesde)
      if (fechaHasta) query = query.lte("fecha", fechaHasta)
    }
    if (canal) query = query.eq("canal", canal)
    if (tipo) query = query.eq("tipo", tipo)
    if (categoria) query = query.ilike("categoria", `%${categoria}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("/api/gastos-ingresos GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

