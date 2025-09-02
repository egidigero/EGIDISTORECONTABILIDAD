// Cliente para integración con Tienda Nube API
// TODO: Completar con credenciales reales y scopes necesarios

interface TiendaNubeOrder {
  id: string
  number: string
  status: string
  payment_status: string
  customer: {
    name: string
    email: string
  }
  products: Array<{
    name: string
    sku: string
    quantity: number
    price: string
  }>
  total: string
  shipping_cost: string
  payment_method: string
  created_at: string
  updated_at: string
  tracking_number?: string
  tracking_url?: string
  shipping_status?: string
}

interface TiendaNubeClient {
  getOrders(params: { from?: string; to?: string; status?: string }): Promise<TiendaNubeOrder[]>
  getOrder(orderId: string): Promise<TiendaNubeOrder>
  updateOrderTracking(orderId: string, tracking: { number: string; url: string }): Promise<void>
}

class TiendaNubeAPI implements TiendaNubeClient {
  private baseUrl = "https://api.tiendanube.com/v1"
  private accessToken: string
  private storeId: string

  constructor() {
    this.accessToken = process.env.TN_ACCESS_TOKEN || ""
    this.storeId = process.env.TN_STORE_ID || ""
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${this.storeId}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "EGIDI-Store/1.0",
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`TiendaNube API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getOrders(params: { from?: string; to?: string; status?: string } = {}): Promise<TiendaNubeOrder[]> {
    const searchParams = new URLSearchParams()

    if (params.from) searchParams.set("created_at_min", params.from)
    if (params.to) searchParams.set("created_at_max", params.to)
    if (params.status) searchParams.set("status", params.status)

    // Solo órdenes aprobadas/pagadas
    searchParams.set("payment_status", "paid")

    const endpoint = `/orders?${searchParams.toString()}`
    return this.request<TiendaNubeOrder[]>(endpoint)
  }

  async getOrder(orderId: string): Promise<TiendaNubeOrder> {
    return this.request<TiendaNubeOrder>(`/orders/${orderId}`)
  }

  async updateOrderTracking(orderId: string, tracking: { number: string; url: string }): Promise<void> {
    await this.request(`/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({
        tracking_number: tracking.number,
        tracking_url: tracking.url,
        shipping_status: "shipped",
      }),
    })
  }
}

export const tiendaNubeClient = new TiendaNubeAPI()
export type { TiendaNubeOrder }
