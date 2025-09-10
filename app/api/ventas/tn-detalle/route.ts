import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get("fecha")
    if (!fecha) {
      return NextResponse.json({ error: "Falta parámetro 'fecha'" }, { status: 400 })
    }

    const { data: ventas, error } = await supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .eq("plataforma", "TN")
      .eq("fecha", fecha)
      .order("createdAt", { ascending: true })

    if (error) throw error

    let totalPVBruto = 0
    let totalDescuentos = 0
    let totalComisiones = 0
    let totalIIBB = 0
    let totalALiquidar = 0

    const ventasDetalle = (ventas ?? []).map((venta: any) => {
      const pvBruto = Number(venta.pvBruto || 0)
      const comisionBase = Number(venta.comision || 0)
      const iibb = Number(venta.iibb || 0)
      const descuentos = 0
      const comisionesConIVA = venta.plataforma === "TN" ? comisionBase * 1.21 : comisionBase
      const montoALiquidar = pvBruto - descuentos - comisionesConIVA - iibb

      totalPVBruto += pvBruto
      totalDescuentos += descuentos
      totalComisiones += comisionesConIVA
      totalIIBB += iibb
      totalALiquidar += montoALiquidar

      return {
        ...venta,
        comisionesConIVA,
        montoALiquidar,
      }
    })

    return NextResponse.json({
      ventas: ventasDetalle,
      resumen: {
        cantidadVentas: ventasDetalle.length,
        totalPVBruto,
        totalDescuentos,
        totalComisiones,
        totalIIBB,
        totalALiquidar,
      },
    })
  } catch (error) {
    console.error("/api/ventas/tn-detalle GET error:", error)
    return NextResponse.json({ ventas: [], resumen: {
      cantidadVentas: 0,
      totalPVBruto: 0,
      totalDescuentos: 0,
      totalComisiones: 0,
      totalIIBB: 0,
      totalALiquidar: 0,
    } })
  }
}

