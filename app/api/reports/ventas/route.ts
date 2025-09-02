import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    const ventas = await prisma.venta.findMany({
      where: whereClause,
      include: {
        producto: true,
      },
      orderBy: { fecha: "desc" },
    })

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
