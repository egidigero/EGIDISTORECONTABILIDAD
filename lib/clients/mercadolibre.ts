// Cliente para integración con Mercado Libre API
// TODO: Completar con credenciales reales y manejo de OAuth

interface MercadoLibreOrder {
  id: string
  status: string
  status_detail: string
  buyer: {
    id: string
    nickname: string
    email: string
  }
  order_items: Array<{
    item: {
      id: string
      title: string
      variation_id?: string
    }
    quantity: number
    unit_price: number
    full_unit_price: number
  }>
  total_amount: number
  payments: Array<{
    id: string
    status: string
    payment_method_id: string
    payment_type_id: string
  }>
  shipping: {
    id: string
    status: string
    cost: number
    tracking_number?: string
    tracking_method?: string
  }
  date_created: string
  date_closed?: string
}

interface MercadoLibreClient {
  getOrders(params: { from?: string; to?: string; sellerId?: string }): Promise<MercadoLibreOrder[]>
  getOrder(orderId: string): Promise<MercadoLibreOrder>
  getShipmentTracking(shipmentId: string): Promise<any>
}

class MercadoLibreAPI implements MercadoLibreClient {
  private baseUrl = "https://api.mercadolibre.com"
  private accessToken: string
  private sellerId: string

  constructor() {
    this.accessToken = process.env.ML_ACCESS_TOKEN || ""
    this.sellerId = process.env.ML_SELLER_ID || ""
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`MercadoLibre API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getOrders(params: { from?: string; to?: string; sellerId?: string } = {}): Promise<MercadoLibreOrder[]> {
    const sellerId = params.sellerId || this.sellerId
    const searchParams = new URLSearchParams()

    if (params.from) searchParams.set("order.date_created.from", params.from)
    if (params.to) searchParams.set("order.date_created.to", params.to)

    // Solo órdenes pagadas
    searchParams.set("order.status", "paid")

    const endpoint = `/orders/search/recent?seller=${sellerId}&${searchParams.toString()}`
    const response = await this.request<{ results: MercadoLibreOrder[] }>(endpoint)

    return response.results
  }

  async getOrder(orderId: string): Promise<MercadoLibreOrder> {
    return this.request<MercadoLibreOrder>(`/orders/${orderId}`)
  }

  async getShipmentTracking(shipmentId: string): Promise<any> {
    return this.request(`/shipments/${shipmentId}`)
  }
}

export const mercadoLibreClient = new MercadoLibreAPI()
export type { MercadoLibreOrder }
