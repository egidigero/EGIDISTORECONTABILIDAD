// Función para obtener el detalle de ventas por período y canal

import { supabase } from "@/lib/supabase"
import type { Plataforma } from "@/lib/types"


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

  // Usar los valores directos de la BD en lugar de recalcular
  // Los campos comision, iva, iibb, precioNeto, ingresoMargen ya están calculados y guardados
  const ventas = (data || []).map((venta: any) => {
    return {
      ...venta,
      // Usar valores de la BD directamente
      comision: Number(venta.comision || 0),
      iva: Number(venta.iva || 0),
      iibb: Number(venta.iibb || 0),
      ingresoMargen: Number(venta.ingresoMargen || 0),
      precioNeto: Number(venta.precioNeto || 0),
      rentabilidadSobrePV: Number(venta.rentabilidadSobrePV || 0),
      rentabilidadSobreCosto: Number(venta.rentabilidadSobreCosto || 0),
    };
  });
  return ventas;
}
