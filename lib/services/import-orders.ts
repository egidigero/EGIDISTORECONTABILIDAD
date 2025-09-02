import { prisma } from "@/lib/prisma"
import { tiendaNubeClient, type TiendaNubeOrder } from "@/lib/clients/tiendanube"
import { mercadoLibreClient, type MercadoLibreOrder } from "@/lib/clients/mercadolibre"
import { calcularVenta, getTarifa } from "@/lib/calculos"
import { Plataforma, MetodoPago } from "@prisma/client"

interface ImportOrdersParams {
  source: "TN" | "ML"
  from?: string
  to?: string
}

interface ImportResult {
  success: number
  errors: Array<{ orderId: string; error: string }>
  warnings: Array<{ orderId: string; warning: string }>
}

export async function importOrders(params: ImportOrdersParams): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    errors: [],
    warnings: [],
  }

  try {
    if (params.source === "TN") {
      await importTiendaNubeOrders(params, result)
    } else if (params.source === "ML") {
      await importMercadoLibreOrders(params, result)
    }
  } catch (error) {
    console.error("Error importing orders:", error)
    result.errors.push({
      orderId: "GENERAL",
      error: error instanceof Error ? error.message : "Error desconocido",
    })
  }

  return result
}

async function importTiendaNubeOrders(params: ImportOrdersParams, result: ImportResult) {
  const orders = await tiendaNubeClient.getOrders({
    from: params.from,
    to: params.to,
    status: "paid",
  })

  for (const order of orders) {
    try {
      await processTiendaNubeOrder(order)
      result.success++
    } catch (error) {
      result.errors.push({
        orderId: order.id,
        error: error instanceof Error ? error.message : "Error procesando orden",
      })
    }
  }
}

async function importMercadoLibreOrders(params: ImportOrdersParams, result: ImportResult) {
  const orders = await mercadoLibreClient.getOrders({
    from: params.from,
    to: params.to,
  })

  for (const order of orders) {
    try {
      await processMercadoLibreOrder(order)
      result.success++
    } catch (error) {
      result.errors.push({
        orderId: order.id,
        error: error instanceof Error ? error.message : "Error procesando orden",
      })
    }
  }
}

async function processTiendaNubeOrder(order: TiendaNubeOrder) {
  // Verificar si ya existe la venta
  const existingVenta = await prisma.venta.findFirst({
    where: { externalOrderId: order.id },
  })

  if (existingVenta) {
    // Actualizar tracking si cambió
    if (order.tracking_url && order.tracking_url !== existingVenta.trackingUrl) {
      await prisma.venta.update({
        where: { id: existingVenta.id },
        data: {
          trackingUrl: order.tracking_url,
          estadoEnvio: mapTiendaNubeShippingStatus(order.shipping_status),
        },
      })
    }
    return
  }

  // Procesar cada producto en la orden
  for (const product of order.products) {
    // Buscar producto por modelo/SKU
    const dbProduct = await prisma.producto.findFirst({
      where: {
        OR: [{ modelo: product.name }, { sku: product.sku }],
      },
    })

    if (!dbProduct) {
      throw new Error(`Producto no encontrado: ${product.name} (SKU: ${product.sku})`)
    }

    // Mapear método de pago
    const metodoPago = mapTiendaNubePaymentMethod(order.payment_method)

    // Obtener tarifa
    const tarifa = await getTarifa(Plataforma.TN, metodoPago)
    if (!tarifa) {
      throw new Error(`Tarifa no encontrada para TN/${metodoPago}`)
    }

    // Calcular valores
    const pvBruto = Number.parseFloat(product.price) * product.quantity
    const cargoEnvioCosto = Number.parseFloat(order.shipping_cost) / order.products.length // Prorratear envío

    const calculatedValues = calcularVenta({
      pvBruto,
      cargoEnvioCosto,
      costoProducto: dbProduct.costoUnitarioARS,
      tarifa,
    })

    // Crear venta
    await prisma.venta.create({
      data: {
        fecha: new Date(order.created_at),
        comprador: order.customer.name,
        tipoOperacion: "Venta",
        plataforma: Plataforma.TN,
        metodoPago,
        productoId: dbProduct.id,
        pvBruto,
        cargoEnvioCosto,
        externalOrderId: order.id,
        saleCode: `TN-${order.number}`,
        trackingUrl: order.tracking_url,
        estadoEnvio: mapTiendaNubeShippingStatus(order.shipping_status),
        ...calculatedValues,
      },
    })
  }
}

async function processMercadoLibreOrder(order: MercadoLibreOrder) {
  // Verificar si ya existe la venta
  const existingVenta = await prisma.venta.findFirst({
    where: { externalOrderId: order.id },
  })

  if (existingVenta) {
    // Actualizar tracking si cambió
    if (order.shipping.tracking_number && order.shipping.tracking_number !== existingVenta.trackingUrl) {
      await prisma.venta.update({
        where: { id: existingVenta.id },
        data: {
          trackingUrl: order.shipping.tracking_number,
          estadoEnvio: mapMercadoLibreShippingStatus(order.shipping.status),
        },
      })
    }
    return
  }

  // Procesar cada item en la orden
  for (const item of order.order_items) {
    // Buscar producto por título (modelo)
    const dbProduct = await prisma.producto.findFirst({
      where: { modelo: item.item.title },
    })

    if (!dbProduct) {
      throw new Error(`Producto no encontrado: ${item.item.title}`)
    }

    // Mapear método de pago
    const metodoPago = mapMercadoLibrePaymentMethod(order.payments[0]?.payment_method_id)

    // Obtener tarifa
    const tarifa = await getTarifa(Plataforma.ML, metodoPago)
    if (!tarifa) {
      throw new Error(`Tarifa no encontrada para ML/${metodoPago}`)
    }

    // Calcular valores
    const pvBruto = item.unit_price * item.quantity
    const cargoEnvioCosto = order.shipping.cost / order.order_items.length // Prorratear envío

    const calculatedValues = calcularVenta({
      pvBruto,
      cargoEnvioCosto,
      costoProducto: dbProduct.costoUnitarioARS,
      tarifa,
    })

    // Crear venta
    await prisma.venta.create({
      data: {
        fecha: new Date(order.date_created),
        comprador: order.buyer.nickname,
        tipoOperacion: "Venta",
        plataforma: Plataforma.ML,
        metodoPago,
        productoId: dbProduct.id,
        pvBruto,
        cargoEnvioCosto,
        externalOrderId: order.id,
        saleCode: `ML-${order.id}`,
        trackingUrl: order.shipping.tracking_number,
        estadoEnvio: mapMercadoLibreShippingStatus(order.shipping.status),
        ...calculatedValues,
      },
    })
  }
}

// Funciones de mapeo
function mapTiendaNubePaymentMethod(paymentMethod: string): MetodoPago {
  const mapping: Record<string, MetodoPago> = {
    credit_card: MetodoPago.PagoNube,
    debit_card: MetodoPago.PagoNube,
    bank_transfer: MetodoPago.Transferencia,
    cash: MetodoPago.Efectivo,
  }
  return mapping[paymentMethod] || MetodoPago.PagoNube
}

function mapMercadoLibrePaymentMethod(paymentMethodId: string): MetodoPago {
  const mapping: Record<string, MetodoPago> = {
    visa: MetodoPago.MercadoPago,
    master: MetodoPago.MercadoPago,
    amex: MetodoPago.MercadoPago,
    account_money: MetodoPago.MercadoPago,
    bank_transfer: MetodoPago.Transferencia,
  }
  return mapping[paymentMethodId] || MetodoPago.MercadoPago
}

function mapTiendaNubeShippingStatus(status?: string) {
  const mapping: Record<string, any> = {
    pending: "Pendiente",
    shipped: "EnCamino",
    delivered: "Entregado",
    returned: "Devuelto",
    cancelled: "Cancelado",
  }
  return mapping[status || "pending"] || "Pendiente"
}

function mapMercadoLibreShippingStatus(status: string) {
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
