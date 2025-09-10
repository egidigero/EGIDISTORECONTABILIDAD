import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("liquidaciones")
      .select("*")
      .order("fecha", { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("/api/liquidaciones GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

