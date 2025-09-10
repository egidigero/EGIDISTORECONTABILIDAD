import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const plataforma = searchParams.get("plataforma")

    const whereClause: any = {}

    if (from && to) {
      whereClause.fecha = {
        gte: new Date(from),
        lte: new Date(to),
      }
    }

    if (plataforma && plataforma !== "all") {
      whereClause.plataforma = plataforma
    }

    let query = supabase
      .from("venta")
      .select("*, producto(*)")
      .order("fecha", { ascending: false });

    if (whereClause.fecha) {
      query = query.gte("fecha", (whereClause.fecha.gte as Date).toISOString())
                   .lte("fecha", (whereClause.fecha.lte as Date).toISOString());
    }
    if (whereClause.plataforma) {
      query = query.eq("plataforma", whereClause.plataforma);
    }
    const { data: ventas, error } = await query;
    if (error) throw error;

    // Calcular totales
    const totales = ventas.reduce(
      (acc, venta) => ({
        pvBruto: acc.pvBruto + Number(venta.pvBruto),
        precioNeto: acc.precioNeto + Number(venta.precioNeto),
        costoProducto: acc.costoProducto + Number(venta.costoProducto),
        ingresoMargen: acc.ingresoMargen + Number(venta.ingresoMargen),
        comision: acc.comision + Number(venta.comision),
        iibb: acc.iibb + Number(venta.iibb),
        cargoEnvioCosto: acc.cargoEnvioCosto + Number(venta.cargoEnvioCosto),
      }),
      {
        pvBruto: 0,
        precioNeto: 0,
        costoProducto: 0,
        ingresoMargen: 0,
        comision: 0,
        iibb: 0,
        cargoEnvioCosto: 0,
      },
    )

    return NextResponse.json({
      ventas,
      totales,
      count: ventas.length,
    })
  } catch (error) {
    console.error("Error en reports/ventas:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
