import { supabase } from "@/lib/supabase"
import { tiendaNubeClient, type TiendaNubeOrder } from "@/lib/clients/tiendanube"
import { mercadoLibreClient, type MercadoLibreOrder } from "@/lib/clients/mercadolibre"
import { calcularVenta, getTarifa } from "@/lib/calculos"
import type { Plataforma, MetodoPago } from "@/lib/types"

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
  const { data: existingVentas, error: ventaError } = await supabase
    .from("venta")
    .select("*")
    .eq("externalOrderId", order.id)
    .limit(1)
  const existingVenta = existingVentas?.[0]

  if (existingVenta) {
    // Actualizar tracking si cambió
    if (order.tracking_url && order.tracking_url !== existingVenta.trackingUrl) {
      await supabase
        .from("venta")
        .update({
          trackingUrl: order.tracking_url,
          estadoEnvio: mapTiendaNubeShippingStatus(order.shipping_status),
        })
        .eq("id", existingVenta.id)
    }
    return
  }

  // Procesar cada producto en la orden
  for (const product of order.products) {
    // Buscar producto por modelo/SKU
    const { data: productos, error: prodError } = await supabase
      .from("producto")
      .select("*")
      .or(`modelo.eq.${product.name},sku.eq.${product.sku}`)
      .limit(1)
    const dbProduct = productos?.[0]

    if (!dbProduct) {
      throw new Error(`Producto no encontrado: ${product.name} (SKU: ${product.sku})`)
    }

    // Mapear método de pago
    const metodoPago = mapTiendaNubePaymentMethod(order.payment_method)

    // Obtener tarifa
  const tarifa = await getTarifa("TN", metodoPago)
    if (!tarifa) {
      throw new Error(`Tarifa no encontrada para TN/${metodoPago}`)
    }

    // Calcular valores
    const pvBruto = Number.parseFloat(product.price) * product.quantity
    const cargoEnvioCosto = Number.parseFloat(order.shipping_cost) / order.products.length // Prorratear envío

    const calculatedValues = calcularVenta(
      pvBruto,
      cargoEnvioCosto,
      dbProduct.costoUnitarioARS,
      tarifa
    )

    // Crear venta
    await supabase
      .from("venta")
      .insert([
        {
          fecha: new Date(order.created_at).toISOString(),
          comprador: order.customer.name,
          tipoOperacion: "Venta",
          plataforma: "TN",
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
      ])
  }
}

async function processMercadoLibreOrder(order: MercadoLibreOrder) {
  // Verificar si ya existe la venta
  const { data: existingVentas, error: ventaError } = await supabase
    .from("venta")
    .select("*")
    .eq("externalOrderId", order.id)
    .limit(1)
  const existingVenta = existingVentas?.[0]

  if (existingVenta) {
    // Actualizar tracking si cambió
    if (order.shipping.tracking_number && order.shipping.tracking_number !== existingVenta.trackingUrl) {
      await supabase
        .from("venta")
        .update({
          trackingUrl: order.shipping.tracking_number,
          estadoEnvio: mapMercadoLibreShippingStatus(order.shipping.status),
        })
        .eq("id", existingVenta.id)
    }
    return
  }

  // Procesar cada item en la orden
  for (const item of order.order_items) {
    // Buscar producto por título (modelo)
    const { data: productos, error: prodError } = await supabase
      .from("producto")
      .select("*")
      .eq("modelo", item.item.title)
      .limit(1)
    const dbProduct = productos?.[0]

    if (!dbProduct) {
      throw new Error(`Producto no encontrado: ${item.item.title}`)
    }

    // Mapear método de pago
    const metodoPago = mapMercadoLibrePaymentMethod(order.payments[0]?.payment_method_id)

    // Obtener tarifa
  const tarifa = await getTarifa("ML", metodoPago)
    if (!tarifa) {
      throw new Error(`Tarifa no encontrada para ML/${metodoPago}`)
    }

    // Calcular valores
    const pvBruto = item.unit_price * item.quantity
    const cargoEnvioCosto = order.shipping.cost / order.order_items.length // Prorratear envío

    const calculatedValues = calcularVenta(
      pvBruto,
      cargoEnvioCosto,
      dbProduct.costoUnitarioARS,
      tarifa
    )

    // Crear venta
    await supabase
      .from("venta")
      .insert([
        {
          fecha: new Date(order.date_created).toISOString(),
          comprador: order.buyer.nickname,
          tipoOperacion: "Venta",
          plataforma: "ML",
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
      ])
  }
}

// Funciones de mapeo
function mapTiendaNubePaymentMethod(paymentMethod: string): MetodoPago {
  const mapping: Record<string, MetodoPago> = {
    credit_card: "PagoNube",
    debit_card: "PagoNube",
    bank_transfer: "Transferencia",
    cash: "Efectivo",
  }
  return mapping[paymentMethod] || "PagoNube"
}

function mapMercadoLibrePaymentMethod(paymentMethodId: string): MetodoPago {
  const mapping: Record<string, MetodoPago> = {
    visa: "MercadoPago",
    master: "MercadoPago",
    amex: "MercadoPago",
    account_money: "MercadoPago",
    bank_transfer: "Transferencia",
  }
  return mapping[paymentMethodId] || "MercadoPago"
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
