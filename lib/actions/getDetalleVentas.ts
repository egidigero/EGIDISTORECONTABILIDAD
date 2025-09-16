// Función para obtener el detalle de ventas por período y canal

import { supabase } from "@/lib/supabase"
import type { Plataforma } from "@/lib/types"
import { calcularVenta, getTarifa } from "@/lib/calculos"


export async function getDetalleVentas(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  let query = supabase
    .from("ventas")
    .select("*", { count: "exact" })
    .gte("fecha", fechaDesde.toISOString())
    .lte("fecha", fechaHasta.toISOString());
  if (canal && canal !== "General") {
    query = query.eq("plataforma", canal);
  }
  const { data, error } = await query;
  if (error) throw new Error("Error al obtener detalle de ventas");

  // Para cada venta, obtener la tarifa y calcular correctamente el margen y precio neto
  const ventas = await Promise.all((data || []).map(async (venta: any) => {
    const tarifa = await getTarifa(venta.plataforma, venta.metodoPago, venta.condicion);
    if (!tarifa) return venta;
    const calculos = calcularVenta(
      Number(venta.pvBruto || 0),
      Number(venta.cargoEnvioCosto || 0),
      Number(venta.costoProducto || 0),
      tarifa,
      venta.plataforma,
      Number(venta.comision || 0)
    );
    return {
      ...venta,
      ingresoMargen: calculos.ingresoMargen,
      precioNeto: calculos.precioNeto,
      comision: calculos.comision,
      iibb: calculos.iibb,
      rentabilidadSobrePV: calculos.rentabilidadSobrePV,
      rentabilidadSobreCosto: calculos.rentabilidadSobreCosto,
      descuentoAplicado: calculos.descuentoAplicado,
    };
  }));
  return ventas;
}
