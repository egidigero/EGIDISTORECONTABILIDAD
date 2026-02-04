import { supabase } from "./supabase"
import type { Plataforma, MetodoPago } from "./types"

export interface TarifaData {
  comisionPct: number
  comisionExtraPct?: number
  iibbPct: number
  fijoPorOperacion: number
  descuentoPct: number
}

export interface VentaCalculos {
  comision: number
  iva: number
  iibb: number
  precioNeto: number
  costoProducto: number
  ingresoMargen: number
  rentabilidadSobrePV: number
  rentabilidadSobreCosto: number
  descuentoAplicado: number
}

export async function getTarifa(plataforma: Plataforma, metodoPago: MetodoPago, condicion?: string): Promise<TarifaData | null> {
  let query = supabase
    .from("tarifas")
    .select("*")
    .eq("plataforma", plataforma)
    .eq("metodoPago", metodoPago);
  
  // Si se proporciona condicion, filtrar por ella también
  if (condicion) {
    query = query.eq("condicion", condicion);
  }
  
  const { data, error } = await query.limit(1);
  
  if (error || !data || data.length === 0) return null;
  const tarifa = data[0];
  return {
    comisionPct: Number(tarifa.comisionPct),
    comisionExtraPct: Number(tarifa.comisionExtraPct || 0),
    iibbPct: Number(tarifa.iibbPct),
    fijoPorOperacion: Number(tarifa.fijoPorOperacion),
    descuentoPct: Number(tarifa.descuentoPct || 0),
  };
}

/**
 * Calcula el recargo adicional de MercadoPago por cuotas sin interés
 * Fuente: Configuración actual de MercadoPago Argentina
 * @param cuotas - Cantidad de cuotas (1, 2, 3, 6)
 * @returns Porcentaje adicional en decimal (ej: 0.0520 para 2 cuotas)
 */
export function getRecargoCuotasMP(cuotas?: number): number {
  if (!cuotas || cuotas === 1) return 0; // Sin cuotas o pago de contado = 0% adicional
  
  switch (cuotas) {
    case 2: return 0.048;  
    case 3: return 0.069;  
    case 6: return 0.117;  
    default: return 0;
  }
}

export function calcularVenta(
  pvBruto: number,
  cargoEnvioCosto: number,
  costoProducto: number,
  tarifa: TarifaData,
  plataforma?: string,
  comisionManual?: number,
  comisionExtraManual?: number,
  iibbManual?: number, // IIBB manual para ML y Transferencia
  metodoPago?: string, // Método de pago para detectar TN+MercadoPago y Transferencia
  cuotas?: number, // Cantidad de cuotas sin interés para TN+MercadoPago
): VentaCalculos {
  // 1. Aplicar descuento pre-comisión si existe (ej: 15% para TN + Transferencia)
  const pvConDescuento = pvBruto * (1 - (tarifa.descuentoPct || 0))
  
  // 2. Calcular comisiones - usar manual si está disponible, sino automática
  const comisionBase = comisionManual !== undefined && comisionManual > 0 
    ? comisionManual 
    : pvConDescuento * tarifa.comisionPct // SIN dividir por 100
  const comisionExtra = comisionExtraManual !== undefined && comisionExtraManual > 0
    ? comisionExtraManual
    : pvConDescuento * (tarifa.comisionExtraPct || 0) // Comisión extra si existe
  
  // 3. Calcular IVA e IIBB según la plataforma y método de pago
  let iva = 0
  let iibb = 0
  let comisionSinIva = comisionBase
  let comisionExtraSinIva = comisionExtra

  // Caso especial: Transferencia (Directo + Transferencia)
  if (metodoPago === "Transferencia") {
    // Sin comisiones de plataforma, solo IIBB manual (fees de MP en transferencias)
    comisionSinIva = 0
    comisionExtraSinIva = 0
    iva = 0
    iibb = iibbManual || 0
  }
  // Caso especial: TN + MercadoPago
  else if (plataforma === "TN" && metodoPago === "MercadoPago") {
    // comisionBase = Comisión MP base desde tarifa (ej: 3.99%, puede variar)
    // Si hay cuotas sin interés, se suma el recargo adicional al monto de comisión
    const recargoMP = getRecargoCuotasMP(cuotas); // 0%, 5.20%, 7.60% o 13.50%
    const comisionMPAdicional = pvConDescuento * recargoMP; // Monto adicional por cuotas
    const comisionMPTotal = comisionBase + comisionMPAdicional; // Comisión total MP
    
    // Tratamiento de IVA: La comisión MP completa (base + recargo) NO incluye IVA
    comisionSinIva = comisionMPTotal; // MP sin IVA (se agrega después)
    const ivaMP = comisionMPTotal * 0.21; // IVA 21% sobre comisión MP total
    
    // comisionExtra = Comisión TN (SÍ incluye IVA, desagregar IVA)
    comisionExtraSinIva = comisionExtra / 1.21; // TN sin IVA (desagregar)
    const ivaTN = comisionExtra - comisionExtraSinIva; // IVA incluido en TN
    iva = ivaMP + ivaTN; // IVA total
    
    // IIBB es MANUAL para TN+MercadoPago (igual que ML, se ingresa por venta si corresponde)
    iibb = iibbManual || 0;
  } else if (plataforma === "TN") {
    // TN: IVA e IIBB se agregan sobre las comisiones
    iva = (comisionBase + comisionExtra) * 0.21; // 21% IVA sobre comisiones
    // IIBB: Calculado desde tarifa + manual (retención adicional)
    const iibbCalculado = (comisionBase + comisionExtra) * (tarifa.iibbPct || 0.03);
    iibb = iibbCalculado + (iibbManual || 0); // IIBB calculado + retención manual
  } else if (plataforma === "ML") {
    // ML: La comisión ya incluye IVA, necesitamos desglosarlo
    comisionSinIva = comisionBase / 1.21; // Comisión sin IVA
    comisionExtraSinIva = comisionExtra / 1.21; // Comisión extra sin IVA
    iva = comisionBase - comisionSinIva + comisionExtra - comisionExtraSinIva; // IVA incluido
    // ML: IIBB es MANUAL por venta, se pasa desde el formulario
    iibb = iibbManual || 0;
  }
  
  // 4. Calcular comisión total a guardar en DB (SIEMPRE sin IVA)
  // Para TN+MP: comisionSinIva (MP base + recargo sin IVA) + comisionExtraSinIva (TN sin IVA desagregado)
  // Para ML: comisionBase sin IVA (ML / 1.21) + comisionExtra sin IVA
  // Para TN tradicional: comisionBase + comisionExtra (sin IVA)
  let comisionTotalSinIva = comisionBase + comisionExtra + tarifa.fijoPorOperacion
  
  // Para TN+MP: comisionSinIva ya incluye base + recargo, y comisionExtra tiene IVA que hay que quitar
  if (plataforma === "TN" && metodoPago === "MercadoPago") {
    comisionTotalSinIva = comisionSinIva + comisionExtraSinIva + tarifa.fijoPorOperacion
  }
  // Para ML, guardar solo la parte sin IVA (porque viene con IVA incluido)
  else if (plataforma === "ML") {
    // ML: Comisiones incluyen IVA, guardar sin IVA
    comisionTotalSinIva = comisionSinIva + comisionExtraSinIva + (tarifa.fijoPorOperacion / 1.21)
  }
  
  // 5. Precio neto = PV Bruto - Comisiones totales - Envíos
  // Para TN+MercadoPago NO se resta el envío (se suma a dinero a liquidar en MP)
  const precioNeto = plataforma === "TN" && metodoPago === "MercadoPago"
    ? pvConDescuento - comisionTotalSinIva - iva - iibb
    : pvConDescuento - comisionTotalSinIva - iva - iibb - cargoEnvioCosto
  // 6. Margen es precio neto menos costo del producto
  const ingresoMargen = precioNeto - costoProducto
  
  // 7. Rentabilidades calculadas sobre precio original y costo
  const rentabilidadSobrePV = pvBruto > 0 ? ingresoMargen / pvBruto : 0
  const rentabilidadSobreCosto = costoProducto > 0 ? ingresoMargen / costoProducto : 0

  return {
    comision: Number(comisionTotalSinIva.toFixed(2)), // Comisiones SIN IVA (bruto)
    iva: Number(iva.toFixed(2)), // IVA calculado según plataforma
    iibb: Number(iibb.toFixed(2)), // IIBB calculado según tarifa
    precioNeto: Number(precioNeto.toFixed(2)),
    costoProducto: Number(costoProducto.toFixed(2)),
    ingresoMargen: Number(ingresoMargen.toFixed(2)),
    rentabilidadSobrePV: Number(rentabilidadSobrePV.toFixed(4)),
    rentabilidadSobreCosto: Number(rentabilidadSobreCosto.toFixed(4)),
    descuentoAplicado: Number((pvBruto - pvConDescuento).toFixed(2)),
  }
}

export function generarSaleCode(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `EG-${timestamp}-${random}`.toUpperCase()
}
