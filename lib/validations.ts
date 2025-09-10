import { z } from "zod"

// Validaciones para Producto
export const productoSchema = z.object({
  modelo: z.string().min(1, "El modelo es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  costoUnitarioARS: z.number().min(0, "El costo debe ser mayor a 0"),
  precio_venta: z.number().min(0, "El precio de venta debe ser mayor o igual a 0").default(0),
  stockPropio: z.number().min(0, "El stock propio debe ser mayor o igual a 0").default(0),
  stockFull: z.number().min(0, "El stock full debe ser mayor o igual a 0").default(0),
  activo: z.boolean().default(true),
})

export type ProductoFormData = z.infer<typeof productoSchema>

// Validaciones para Tarifa
export const tarifaSchema = z.object({
  id: z.string().min(1, "El id es requerido"),
  plataforma: z.enum(["TN", "ML", "Directo"], {
    required_error: "Selecciona una plataforma",
  }),
  metodoPago: z.enum(["PagoNube", "MercadoPago", "Transferencia", "Efectivo"], {
    required_error: "Selecciona un método de pago",
  }),
  condicion: z.enum(["Transferencia", "Cuotas sin interés"], {
    required_error: "Selecciona una condición de pago",
  }).default("Transferencia"),
  comisionPct: z.number().min(0).max(100, "La comisión debe estar entre 0 y 100%"),
  comisionExtraPct: z.number().min(0).max(100, "La comisión extra debe estar entre 0 y 100%").optional(),
  iibbPct: z.number().min(0).max(100, "El IIBB debe estar entre 0 y 100%"),
  fijoPorOperacion: z.number().min(0, "El monto fijo debe ser mayor o igual a 0"),
  descuentoPct: z.number().min(0).max(100, "El descuento debe estar entre 0 y 100%").default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type TarifaFormData = z.infer<typeof tarifaSchema>

export const gastoIngresoSchema = z.object({
  fecha: z.date(),
  canal: z.enum(["TN", "ML", "General"]).optional(),
  tipo: z.enum(["Gasto", "Ingreso"], {
    required_error: "Selecciona un tipo",
  }),
  categoria: z.string().min(1, "La categoría es requerida"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  montoARS: z.number().min(0, "El monto debe ser mayor a 0"),
  esPersonal: z.boolean().default(false), // Nueva opción para gastos personales
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
  fecha: z.date({
    required_error: "La fecha es obligatoria",
  }),
  // MERCADOPAGO
  mp_disponible: z.number().min(0, "El dinero disponible MP debe ser mayor o igual a 0"),
  mp_a_liquidar: z.number().min(0, "El dinero a liquidar MP debe ser mayor o igual a 0"),
  mp_liquidado_hoy: z.number().min(0, "El liquidado hoy MP debe ser mayor o igual a 0"),
  // TIENDA NUBE
  tn_a_liquidar: z.number().min(0, "El dinero a liquidar TN debe ser mayor o igual a 0"),
  tn_liquidado_hoy: z.number().min(0, "El liquidado hoy TN debe ser mayor o igual a 0"),
  tn_iibb_descuento: z.number().min(0, "El descuento IIBB debe ser mayor o igual a 0"),
})

export type LiquidacionFormData = z.infer<typeof liquidacionSchema>

// Validaciones para Venta
export const ventaSchema = z.object({
  fecha: z.date(),
  comprador: z.string().min(1, "El nombre del comprador es requerido"),
  plataforma: z.enum(["TN", "ML", "Directo"], {
    required_error: "Selecciona una plataforma",
  }),
  metodoPago: z.enum(["PagoNube", "MercadoPago"], {
    required_error: "Selecciona un método de pago",
  }),
  condicion: z.enum(["Transferencia", "Cuotas sin interés"], {
    required_error: "Selecciona una condición",
  }),
  productoId: z.string().min(1, "El producto es requerido"),
  pvBruto: z.number().min(0, "El precio de venta debe ser mayor a 0"),
  cargoEnvioCosto: z.number().min(0, "El cargo de envío debe ser mayor o igual a 0").default(0),
  usarComisionManual: z.boolean().default(false),
  comisionManual: z.number().min(0, "La comisión manual debe ser mayor o igual a 0").optional(),
  comisionExtraManual: z.number().min(0, "La comisión extra manual debe ser mayor o igual a 0").optional(),
  trackingUrl: z.string().optional().or(z.literal("")).refine(
    (value) => !value || z.string().url().safeParse(value).success,
    "URL inválida"
  ),
  estadoEnvio: z.enum(["Pendiente", "EnCamino", "Entregado", "Devuelto", "Cancelado"], {
    required_error: "Selecciona un estado de envío",
  }).default("Pendiente"),
  courier: z.string().optional(),
  externalOrderId: z.string().optional(),
})

export type VentaFormData = z.infer<typeof ventaSchema>
