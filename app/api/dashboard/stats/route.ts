import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const startOfToday = new Date(today.setHours(0, 0, 0, 0))
    const endOfToday = new Date(today.setHours(23, 59, 59, 999))
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0))
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999))

    // Ventas de hoy
    const ventasHoy = await prisma.venta.findMany({
      where: {
        fecha: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    })

    // Ventas de ayer
    const ventasAyer = await prisma.venta.findMany({
      where: {
        fecha: {
          gte: startOfYesterday,
          lte: endOfYesterday,
        },
      },
    })

    // Calcular totales
    const totalVentasHoy = ventasHoy.reduce((sum, venta) => sum + Number(venta.pvBruto), 0)
    const totalVentasAyer = ventasAyer.reduce((sum, venta) => sum + Number(venta.pvBruto), 0)
    const variacionVentas = totalVentasAyer > 0 ? ((totalVentasHoy - totalVentasAyer) / totalVentasAyer) * 100 : 0

    const totalMargenHoy = ventasHoy.reduce((sum, venta) => sum + Number(venta.ingresoMargen), 0)
    const totalMargenAyer = ventasAyer.reduce((sum, venta) => sum + Number(venta.ingresoMargen), 0)
    const variacionMargen = totalMargenAyer > 0 ? ((totalMargenHoy - totalMargenAyer) / totalMargenAyer) * 100 : 0

    // Envíos pendientes
    const enviosPendientes = await prisma.venta.count({
      where: {
        estadoEnvio: {
          in: ["Pendiente", "EnCamino"],
        },
      },
    })

    // Liquidaciones pendientes (simulado - en un caso real vendría de la tabla liquidaciones)
    const liquidacionesPendientes = {
      mp: Math.floor(Math.random() * 50000) + 10000,
      tn: Math.floor(Math.random() * 30000) + 5000,
    }

    const stats = {
      ventasHoy: {
        total: Math.round(totalVentasHoy),
        cantidad: ventasHoy.length,
        variacion: Math.round(variacionVentas * 100) / 100,
      },
      margenHoy: {
        total: Math.round(totalMargenHoy),
        variacion: Math.round(variacionMargen * 100) / 100,
      },
      enviosPendientes,
      liquidacionesPendientes,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
