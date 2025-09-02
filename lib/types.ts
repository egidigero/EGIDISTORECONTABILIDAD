import type { Prisma } from "@prisma/client"

// Tipos para los enums
export type Plataforma = "TN" | "ML" | "Directo"
export type MetodoPago = "PagoNube" | "MercadoPago" | "Transferencia" | "Efectivo"
export type EstadoEnvio = "Pendiente" | "EnCamino" | "Entregado" | "Devuelto" | "Cancelado"
export type TipoMovimiento = "Gasto" | "OtroIngreso"

// Tipos para formularios y validaciones
export interface ProductoForm {
  modelo: string
  sku: string
  costoUnitarioARS: number
  activo: boolean
}

export interface TarifaForm {
  plataforma: Plataforma
  metodoPago: MetodoPago
  comisionPct: number
  iibbPct: number
  fijoPorOperacion: number
}

export interface VentaForm {
  fecha: Date
  comprador: string
  plataforma: Plataforma
  metodoPago: MetodoPago
  productoId: string
  pvBruto: number
  cargoEnvioCosto: number
  trackingUrl?: string
  estadoEnvio: EstadoEnvio
  courier?: string
  externalOrderId?: string
}

// Tipos con relaciones incluidas
export type VentaConProducto = Prisma.VentaGetPayload<{
  include: { producto: true }
}>

export type DevolucionConVenta = Prisma.DevolucionGetPayload<{
  include: { venta: { include: { producto: true } } }
}>

// Tipos para reportes EERR
export interface EERRData {
  ventasBrutas: number
  precioNeto: number
  costoProducto: number
  costoEnvio: number
  margenBruto: number
  gastosCanal: number
  gastosGenerales: number
  otrosIngresos: number
  resultadoOperativo: number
}

// Tipos para filtros
export interface VentaFilters {
  fechaDesde?: Date
  fechaHasta?: Date
  plataforma?: Plataforma
  metodoPago?: MetodoPago
  estadoEnvio?: EstadoEnvio
  comprador?: string
  externalOrderId?: string
}

export interface GastoIngresoFilters {
  fechaDesde?: Date
  fechaHasta?: Date
  canal?: Plataforma | "General"
  tipo?: TipoMovimiento
  categoria?: string
}
