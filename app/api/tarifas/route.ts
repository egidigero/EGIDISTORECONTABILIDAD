import { NextResponse } from "next/server";
import { tarifaSchema } from "@/lib/validations";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = tarifaSchema.parse(body);
    const key = `${validatedData.plataforma}|${validatedData.metodoPago}`;
    const { data, error } = await supabase
      .from("tarifas")
      .insert([{ ...validatedData, key }])
      .select()
      .single();
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Error al crear tarifa" }, { status: 400 });
  }
}
