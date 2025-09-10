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
  return data || [];
}
