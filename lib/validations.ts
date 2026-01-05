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
  condicion: z.enum(["Transferencia", "Cuotas sin interés", "Normal"], {
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
    esPersonal: z.boolean().optional(), // Ahora opcional para evitar error de tipos
})

export type GastoIngresoFormData = z.infer<typeof gastoIngresoSchema>

// Validaciones para Devolución
export const devolucionSchemaBase = z.object({
  // Relaciones
  ventaId: z.string().min(1, "Selecciona una venta"),
  productoNuevoId: z.string().optional(), // Solo si es cambio de producto
  
  // Fechas
  fechaCompra: z.preprocess((arg) => {
    if (arg instanceof Date) return arg
    if (typeof arg === 'string' && arg) return new Date(arg)
    return arg
  }, z.date({ required_error: "La fecha de compra es requerida" })),
  fechaReclamo: z.preprocess((arg) => {
    if (arg instanceof Date) return arg
    if (typeof arg === 'string' && arg) return new Date(arg)
    return arg
  }, z.date({ required_error: "La fecha de reclamo es requerida" })).default(new Date()),
  fechaAccion: z.preprocess((arg) => {
    if (arg instanceof Date) return arg
    if (typeof arg === 'string' && arg.trim()) return new Date(arg)
    return new Date()
  }, z.date()).default(new Date()),
  
  // Información de contacto
  nombreContacto: z.string().min(1, "El nombre de contacto es requerido"),
  telefonoContacto: z.string().min(1, "El teléfono de contacto es requerido"),
  
  // Estado del reclamo
  estado: z.enum([
    "En devolución",
    "Aceptada en camino",
    "Entregada - Reembolso",
    "Entregada - Cambio mismo producto",
    "Entregada - Cambio otro producto",
    "Entregada - Sin reembolso",
    "Rechazada"
  ], {
    required_error: "Selecciona un estado",
  }).default("En devolución"),
  
  // Detalles
  motivo: z.string().min(1, "El motivo es requerido"),
  observaciones: z.string().optional(),
  
  // Costos de envío
  costoEnvioOriginal: z.number().min(0).default(0),
  // Al crear la devolución se solicita el costo de envío de devolución (puede ser 0 pero requerido)
  costoEnvioDevolucion: z.number({ required_error: "El costo de envío de devolución es requerido" }).min(0, "El costo de envío debe ser mayor o igual a 0"),
  costoEnvioNuevo: z.number().min(0).default(0),

  // Tracking / identificación
  numeroSeguimiento: z.string().min(1, "El número de seguimiento es requerido"),
  numeroDevolucion: z.string().optional(),
  
  // Resolución
  tipoResolucion: z.enum([
    "Reembolso",
    "Cambio mismo producto",
    "Cambio otro producto",
    "Sin reembolso"
  ]).optional(),
  
  // Costos de productos (auto-completados desde la venta)
  costoProductoOriginal: z.number().min(0).default(0),
  costoProductoNuevo: z.number().min(0).default(0),
  // Indica si el producto es recuperable (si se puede recibir de vuelta)
  productoRecuperable: z.boolean().optional(),
  
  // Impacto financiero (auto-completados desde la venta)
  montoVentaOriginal: z.number().min(0).default(0),
  montoReembolsado: z.number().min(0).default(0),
  // Estado del dinero en Mercado Pago: 'a_liquidar' | 'liquidado'
  mpEstado: z.enum(['a_liquidar', 'liquidado']).optional(),
  // Indica si se debe mover el monto a retenido en Mercado Pago al procesar la devolución
  mpRetener: z.boolean().optional(),
  // Comisión original de la venta (opcional, usada en cálculos/trazabilidad)
  comisionOriginal: z.number().min(0).default(0),
  // commission fields removed from DB; calculations derived from ventas/liquidaciones
})

// Expose a stable alias for the base schema (ZodObject) so server code can call .partial()
export const devolucionSchema = devolucionSchemaBase

// Require productoRecuperable when the resolution is Reembolso
export const devolucionSchemaWithRecoveryCheck = devolucionSchemaBase.superRefine((val, ctx) => {
  // Si se eligió cualquier resolución (es decir, el usuario avanzó la decisión),
  // requerimos explícitamente indicar si el producto es recuperable o no.
  if (typeof val.tipoResolucion !== 'undefined' && val.tipoResolucion !== null) {
    if (typeof val.productoRecuperable === 'undefined') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes indicar si el producto es recuperable cuando elegís una resolución', path: ['productoRecuperable'] })
    }
  }
})

export type DevolucionFormData = z.infer<typeof devolucionSchemaBase>

// Exportar opciones para uso en componentes cliente (evitar leer internals de Zod)
export const DEVOLUCION_ESTADOS = [
  "En devolución",
  "Aceptada en camino",
  "Entregada - Reembolso",
  "Entregada - Cambio mismo producto",
  "Entregada - Cambio otro producto",
  "Entregada - Sin reembolso",
  "Rechazada",
] as const

export const DEVOLUCION_TIPOS_RESOLUCION = [
  "Reembolso",
  "Cambio mismo producto",
  "Cambio otro producto",
  "Sin reembolso",
] as const


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
  metodoPago: z.enum(["PagoNube", "MercadoPago", "Transferencia"], {
    required_error: "Selecciona un método de pago",
  }),
  condicion: z.enum(["Transferencia", "Cuotas sin interés", "Normal"], {
    required_error: "Selecciona una condición",
  }),
  productoId: z.string().min(1, "El producto es requerido"),
  pvBruto: z.number().min(0, "El precio de venta debe ser mayor a 0"),
  cargoEnvioCosto: z.number().min(0, "El cargo de envío debe ser mayor o igual a 0").default(0),
  cuotas: z.number().int().min(1).max(6).optional(), // Cantidad de cuotas sin interés (1, 2, 3, 6) para TN + MercadoPago
  usarComisionManual: z.boolean().default(false),
  comisionManual: z.number().min(0, "La comisión manual debe ser mayor o igual a 0").optional(),
  comisionExtraManual: z.number().min(0, "La comisión extra manual debe ser mayor o igual a 0").optional(),
  iibbManual: z.number().min(0, "El IIBB manual debe ser mayor o igual a 0").optional(), // Retención IIBB para ML, TN, PN y Transferencia
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
