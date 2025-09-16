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

export function calcularVenta(
  pvBruto: number,
  cargoEnvioCosto: number,
  costoProducto: number,
  tarifa: TarifaData,
  plataforma?: string,
  comisionManual?: number,
  comisionExtraManual?: number,
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

  // Caso especial: TN + MercadoPago
  if (plataforma === "TN" && tarifa && (tarifa as any).metodoPago === "MercadoPago") {
    // Solo la comisión base lleva IVA, la extra NO
    iva = comisionBase * 0.21;
    // IIBB según tarifa (puede ser variable)
    iibb = (comisionBase + comisionExtra) * (tarifa.iibbPct || 0);
  } else if (plataforma === "TN") {
    // TN: IVA e IIBB se agregan sobre las comisiones
    iva = (comisionBase + comisionExtra) * 0.21; // 21% IVA sobre comisiones
    iibb = (comisionBase + comisionExtra) * (tarifa.iibbPct || 0.03); // IIBB según tarifa o 3%
  } else if (plataforma === "ML") {
    // ML: La comisión ya incluye IVA, necesitamos desglosarlo
    comisionSinIva = comisionBase / 1.21; // Comisión sin IVA
    comisionExtraSinIva = comisionExtra / 1.21; // Comisión extra sin IVA
    iva = comisionBase - comisionSinIva + comisionExtra - comisionExtraSinIva; // IVA incluido
    // ML no tiene IIBB adicional
  }
  
  // 4. Agregar fijo por operación a las comisiones
  const comisionTotal = comisionBase + comisionExtra + tarifa.fijoPorOperacion
  
  // 5. Precio neto = PV Bruto - Comisiones totales - Envíos (según base de datos)
  const precioNeto = pvConDescuento - comisionTotal - iva - iibb - cargoEnvioCosto
  // 6. Margen es precio neto menos costo del producto
  const ingresoMargen = precioNeto - costoProducto
  
  // 7. Rentabilidades calculadas sobre precio original y costo
  const rentabilidadSobrePV = pvBruto > 0 ? ingresoMargen / pvBruto : 0
  const rentabilidadSobreCosto = costoProducto > 0 ? ingresoMargen / costoProducto : 0

  return {
    comision: Number(comisionTotal.toFixed(2)), // Comisión base + extra + fijo
    iibb: Number(iibb.toFixed(2)), // Solo IIBB (IVA no se guarda por separado)
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
