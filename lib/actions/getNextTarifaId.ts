import { supabase } from "@/lib/supabase"

export async function getNextTarifaId(): Promise<string> {
  const { data, error } = await supabase
    .from("tarifas")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)

  if (error) throw new Error("Error al obtener el último id de tarifa")

  if (!data || data.length === 0 || isNaN(Number(data[0].id))) {
    return "1"
  }

  return String(Number(data[0].id) + 1)
}
