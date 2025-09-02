import { z } from "zod"

// Validaciones para Producto
export const productoSchema = z.object({
  modelo: z.string().min(1, "El modelo es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  costoUnitarioARS: z.number().min(0, "El costo debe ser mayor a 0"),
  activo: z.boolean().default(true),
})

export type ProductoFormData = z.infer<typeof productoSchema>

// Validaciones para Tarifa
export const tarifaSchema = z.object({
  plataforma: z.enum(["TN", "ML", "Directo"], {
    required_error: "Selecciona una plataforma",
  }),
  metodoPago: z.enum(["PagoNube", "MercadoPago", "Transferencia", "Efectivo"], {
    required_error: "Selecciona un método de pago",
  }),
  comisionPct: z.number().min(0).max(100, "La comisión debe estar entre 0 y 100%"),
  iibbPct: z.number().min(0).max(100, "El IIBB debe estar entre 0 y 100%"),
  fijoPorOperacion: z.number().min(0, "El monto fijo debe ser mayor o igual a 0"),
})

export type TarifaFormData = z.infer<typeof tarifaSchema>

// Validaciones para Venta
export const ventaSchema = z.object({
  fecha: z.date(),
  comprador: z.string().min(1, "El comprador es requerido"),
  plataforma: z.enum(["TN", "ML", "Directo"]),
  metodoPago: z.enum(["PagoNube", "MercadoPago", "Transferencia", "Efectivo"]),
  productoId: z.string().min(1, "Selecciona un producto"),
  pvBruto: z.number().min(0, "El precio de venta debe ser mayor a 0"),
  cargoEnvioCosto: z.number().min(0, "El costo de envío debe ser mayor o igual a 0"),
  trackingUrl: z.string().url().optional().or(z.literal("")),
  estadoEnvio: z.enum(["Pendiente", "EnCamino", "Entregado", "Devuelto", "Cancelado"]).default("Pendiente"),
  courier: z.string().optional(),
  externalOrderId: z.string().optional(),
})

export type VentaFormData = z.infer<typeof ventaSchema>

// Validaciones para Gasto/Ingreso
export const gastoIngresoSchema = z.object({
  fecha: z.date(),
  canal: z.enum(["TN", "ML", "Directo"]).optional(),
  tipo: z.enum(["Gasto", "OtroIngreso"], {
    required_error: "Selecciona un tipo",
  }),
  categoria: z.string().min(1, "La categoría es requerida"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  montoARS: z.number().min(0, "El monto debe ser mayor a 0"),
})

export type GastoIngresoFormData = z.infer<typeof gastoIngresoSchema>

// Validaciones para Devolución
export const devolucionSchema = z.object({
  fecha: z.date(),
  ventaId: z.string().min(1, "Selecciona una venta"),
  plataforma: z.enum(["TN", "ML", "Directo"]),
  motivo: z.string().min(1, "El motivo es requerido"),
  estado: z.string().min(1, "El estado es requerido"),
  montoDevuelto: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  costoEnvioIda: z.number().min(0, "El costo debe ser mayor o igual a 0"),
  costoEnvioVuelta: z.number().min(0, "El costo debe ser mayor o igual a 0"),
  recuperoProducto: z.boolean().default(false),
  observaciones: z.string().optional(),
})

export type DevolucionFormData = z.infer<typeof devolucionSchema>

// Validaciones para Liquidación
export const liquidacionSchema = z.object({
  fecha: z.date(),
  dineroFP: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  disponibleMP_MELI: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  aLiquidarMP: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  liquidadoMP: z.number().min(0, "El monto debe ser mayor o igual a 0"),
  aLiquidarTN: z.number().min(0, "El monto debe ser mayor o igual a 0"),
})

export type LiquidacionFormData = z.infer<typeof liquidacionSchema>
