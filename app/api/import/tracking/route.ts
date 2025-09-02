import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { tiendaNubeClient } from "@/lib/clients/tiendanube"
import { mercadoLibreClient } from "@/lib/clients/mercadolibre"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, orderIds } = body

    if (!source || !["TN", "ML"].includes(source)) {
      return NextResponse.json({ error: "Source debe ser TN o ML" }, { status: 400 })
    }

    let updated = 0
    const errors: Array<{ orderId: string; error: string }> = []

    // Obtener ventas a actualizar
    const ventas = await prisma.venta.findMany({
      where: {
        plataforma: source === "TN" ? "TN" : "ML",
        ...(orderIds && { externalOrderId: { in: orderIds } }),
      },
    })

    for (const venta of ventas) {
      try {
        if (source === "TN") {
          const order = await tiendaNubeClient.getOrder(venta.externalOrderId)

          await prisma.venta.update({
            where: { id: venta.id },
            data: {
              trackingUrl: order.tracking_url,
              estadoEnvio: mapShippingStatus(order.shipping_status, "TN"),
            },
          })
        } else if (source === "ML") {
          const order = await mercadoLibreClient.getOrder(venta.externalOrderId)

          await prisma.venta.update({
            where: { id: venta.id },
            data: {
              trackingUrl: order.shipping.tracking_number,
              estadoEnvio: mapShippingStatus(order.shipping.status, "ML"),
            },
          })
        }

        updated++
      } catch (error) {
        errors.push({
          orderId: venta.externalOrderId,
          error: error instanceof Error ? error.message : "Error desconocido",
        })
      }
    }

    return NextResponse.json({
      message: `Tracking actualizado: ${updated} ventas procesadas`,
      updated,
      errors,
    })
  } catch (error) {
    console.error("Error en import/tracking:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

function mapShippingStatus(status: string | undefined, source: "TN" | "ML") {
  if (source === "TN") {
    const mapping: Record<string, any> = {
      pending: "Pendiente",
      shipped: "EnCamino",
      delivered: "Entregado",
      returned: "Devuelto",
      cancelled: "Cancelado",
    }
    return mapping[status || "pending"] || "Pendiente"
  } else {
    const mapping: Record<string, any> = {
      pending: "Pendiente",
      ready_to_ship: "Pendiente",
      shipped: "EnCamino",
      delivered: "Entregado",
      not_delivered: "Devuelto",
      cancelled: "Cancelado",
    }
    return mapping[status] || "Pendiente"
  }
}
