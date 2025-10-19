// import type { Prisma } from "@prisma/client" // Eliminado: migración a Supabase

// Tipos para los enums
export type Plataforma = "TN" | "ML" | "General" | "Directo"
export type MetodoPago = "PagoNube" | "MercadoPago" | "Transferencia" | "Efectivo"
export type Condicion = "Transferencia" | "Cuotas sin interés" | "Normal"
export type EstadoEnvio = "Pendiente" | "EnCamino" | "Entregado" | "Devuelto" | "Cancelado"
export type TipoMovimiento = "Gasto" | "Ingreso"

// Tipos para entidades de base de datos
export interface Producto {
  id: string
  modelo: string
  sku: string
  costoUnitarioARS: number
  precio_venta: number
  stockPropio: number
  stockFull: number
  activo: boolean
  createdAt: Date
    esPersonal?: boolean // Opcional para coincidir con el schema
}

// Tipos para formularios y validaciones
export interface ProductoForm {
  modelo: string
  sku: string
  costoUnitarioARS: number
  precio_venta: number
  activo: boolean
}

export interface TarifaForm {
  plataforma: Plataforma
  metodoPago: MetodoPago
  condicion: Condicion
  comisionPct: number
  iibbPct: number
  fijoPorOperacion: number
  descuentoPct: number
}

export interface GastoIngresoForm {
  fecha: Date
  canal: "TN" | "ML" | "General"
  tipo: TipoMovimiento
  categoria: string
  descripcion: string
  montoARS: number
}

// Tipos para entidades de base de datos
export interface GastoIngreso {
  id: string
  fecha: Date
  canal: "TN" | "ML" | "General"
  tipo: TipoMovimiento
  categoria: string
  descripcion: string
  montoARS: number
  esPersonal?: boolean
  roas_objetivo?: number
  ventas_periodo?: number
  gasto_calculado?: number
  calculo_automatico?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface VentaForm {
  fecha: Date
  comprador: string
  plataforma: Plataforma
  metodoPago: MetodoPago
  condicion: Condicion
  productoId: string
  pvBruto: number
  cargoEnvioCosto: number
  trackingUrl?: string
  estadoEnvio: EstadoEnvio
  courier?: string
  externalOrderId?: string
  cuotas?: number // Cantidad de cuotas sin interés (1, 2, 3, 6) para TN + MercadoPago
}

// Tipos con relaciones incluidas
// Tipos propios para relaciones
export interface VentaConProducto {
  // Campos de venta
  id: string;
  fecha: Date;
  comprador: string;
  plataforma: Plataforma;
  metodoPago: MetodoPago;
  condicion: Condicion;
  productoId: string;
  pvBruto: number;
  cargoEnvioCosto: number;
  trackingUrl?: string;
  estadoEnvio: EstadoEnvio;
  courier?: string;
  externalOrderId?: string;
  saleCode?: string;
  cuotas?: number; // Cantidad de cuotas sin interés (1, 3, 6, 12) para TN + MercadoPago
  // Campos calculados
  comision?: number;
  iva?: number;
  iibb?: number;
  precioNeto?: number;
  costoProducto?: number;
  ingresoMargen?: number;
  rentabilidadSobrePV?: number;
  rentabilidadSobreCosto?: number;
  // Relación
  producto: ProductoForm;
}

export interface DevolucionConVenta {
  // Campos de devolución
  id: string;
  ventaId: string;
  motivo: string;
  fecha: Date;
  // Relación
  venta: VentaConProducto;
}

export interface Liquidacion {
  id: string;
  fecha: Date;
  // MERCADOPAGO
  mp_disponible: number;        // Dinero disponible en MP
  mp_a_liquidar: number;        // Dinero pendiente de liberar en MP
  mp_liquidado_hoy: number;     // Lo que se liberó hoy en MP
  // TIENDA NUBE
  tn_a_liquidar: number;        // Dinero pendiente en TN
  tn_liquidado_hoy: number;     // Lo que TN liquidó hoy (va a MP)
  tn_iibb_descuento: number;    // IIBB descontado en transferencia TN→MP
  // CÁLCULOS AUTOMÁTICOS (generados por DB)
  mp_total: number;             // MP Disponible + MP A Liquidar
  total_disponible: number;     // MP Total + TN A Liquidar
  movimiento_neto_dia: number;  // MP Liquidado + TN Liquidado - IIBB
  observaciones?: string;
  created_at: Date;
  updated_at: Date;
}

export interface LiquidacionForm {
  fecha: Date;
  // MERCADOPAGO
  mp_disponible: number;
  mp_a_liquidar: number;
  mp_liquidado_hoy: number;
  // TIENDA NUBE
  tn_a_liquidar: number;
  tn_liquidado_hoy: number;
  tn_iibb_descuento: number;
  observaciones?: string;
}

// Tipos para reportes EERR
export interface EERRData {
  detalleOtrosGastos?: any[]
  detalleOtrosIngresos?: any[]
  // Devoluciones
  devolucionesTotal?: number       // Impacto en ventas netas por devoluciones (monto reembolsado / impacto)
  devolucionesPerdidaTotal?: number // Pérdida asociada a productos no recuperados / pérdida total
  devolucionesCount?: number
  porcentajeDevolucionesSobreVentas?: number
  detalleDevoluciones?: any[]
  devolucionesComisionesTotal?: number // total de comisiones que se devolvieron (para mostrar en EERR)
  comisionesDevueltas?: number // alias usado en la UI
  comisionesNetas?: number // comisiones después de descontar las devueltas
  totalCostosPlataformaAjustado?: number // total costos plataforma ajustado por devoluciones
  // Ventas
  ventasTotales: number       // Ventas brutas
  descuentos: number          // Descuentos aplicados
  ventasNetas: number         // Ventas totales - descuentos
  costoProducto: number       // Costo de productos vendidos
  resultadoBruto: number      // Ventas netas - costo productos
  
  // Costos de plataforma - Desglose detallado
  comisiones: number          // Comisiones TOTALES (base + IVA + IIBB)
  comisionesBase: number      // Comisiones base (sin IVA ni IIBB)
  comisionesExtra: number     // Comisiones extra si las hay
  ivaComisiones: number       // IVA sobre comisiones (21%)
  iibbComisiones: number      // IIBB sobre comisiones (3%)
  envios: number              // Costos de envío solo TN (para comparar con gastos)
  enviosTotales: number       // Costos de envío totales (TN + ML) para mostrar en costos plataforma
  iibb: number                // Total IIBB (para compatibilidad)
  totalCostosPlataforma: number // Total costos plataforma
  
  // Publicidad y ROAS
  publicidad: number          // Gastos en publicidad (Meta ADS)
  roas: number                // ROAS = Ventas netas / Publicidad
  
  // Otros gastos y resultado final
  otrosGastos: number         // Otros gastos del canal
  margenOperativo: number     // Resultado después de todos los gastos
  margenNetoNegocio: number   // Margen neto del negocio (sin gastos personales)
  
  // Campos legacy (mantener compatibilidad)
  ventasBrutas: number
  precioNeto: number
  costoEnvio: number
  margenBruto: number
  gastosCanal: number
  gastosGenerales: number
  otrosIngresos: number
  resultadoOperativo: number
  gastosPersonales?: number
  margenFinalConPersonales?: number
}

// Tipos para configuraciones de comisiones
export interface Configuracion {
  id: string
  plataforma: string
  tipo: 'comision' | 'envio' | 'iva' | 'iibb'
  valor: number
  descripcion: string
  esPorcentaje: boolean
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

// Tipos para filtros
export interface VentaFilters {
  fechaDesde?: Date
  fechaHasta?: Date
  plataforma?: Plataforma
  metodoPago?: MetodoPago
  condicion?: Condicion
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
