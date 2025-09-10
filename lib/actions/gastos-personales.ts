// Devuelve el total de gastos personales en el período y canal indicado
import { supabase } from "@/lib/supabase"

export async function getGastosPersonalesTotal(fechaDesde: Date, fechaHasta: Date, canal?: string) {
  let query = supabase
    .from("gastos_ingresos")
    .select("montoARS,esPersonal,canal")
    .gte("fecha", fechaDesde.toISOString())
    .lte("fecha", fechaHasta.toISOString())
    .eq("tipo", "Gasto")
    .eq("esPersonal", true);

  if (canal && canal !== "General") {
    query = query.or(`canal.eq.${canal},canal.is.null,canal.eq.General`)
  }
  // Si es General, no filtrar (traer todos)

  const { data, error } = await query;
  if (error) return 0;
  return data ? data.reduce((acc, g) => acc + Number(g.montoARS || 0), 0) : 0;
}
