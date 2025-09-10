// Función para obtener el detalle de gastos e ingresos por período y canal
import { supabase } from "@/lib/supabase"
import type { Plataforma } from "@/lib/types"

export async function getDetalleGastosIngresos(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  let query = supabase
    .from("gastos_ingresos")
    .select("*", { count: "exact" })
    .gte("fecha", fechaDesde.toISOString())
    .lte("fecha", fechaHasta.toISOString());
  if (canal && canal !== "General") {
    query = query.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Error al obtener detalle de gastos/ingresos");
  return data || [];
}
