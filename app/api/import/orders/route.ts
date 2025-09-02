import { type NextRequest, NextResponse } from "next/server"
import { importOrders } from "@/lib/services/import-orders"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, from, to } = body

    if (!source || !["TN", "ML"].includes(source)) {
      return NextResponse.json({ error: "Source debe ser TN o ML" }, { status: 400 })
    }

    const result = await importOrders({ source, from, to })

    return NextResponse.json({
      message: `Importación completada: ${result.success} órdenes procesadas`,
      result,
    })
  } catch (error) {
    console.error("Error en import/orders:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
