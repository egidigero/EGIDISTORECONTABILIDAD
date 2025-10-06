"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { ventaSchema, type VentaFormData } from "@/lib/validations"
import { calcularVenta, getTarifa, generarSaleCode } from "@/lib/calculos"
import { getTarifaEspecifica } from "@/lib/actions/tarifas"
import { actualizarLiquidacionPorVenta, eliminarVentaDeLiquidacion } from "@/lib/actions/actualizar-liquidacion"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"
import type { VentaFilters, EstadoEnvio, Plataforma, MetodoPago } from "@/lib/types"

export async function getVentas(filters?: VentaFilters) {
  try {
    let query = supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .order("fecha", { ascending: false });

    if (filters?.fechaDesde) query = query.gte("fecha", filters.fechaDesde.toISOString().split('T')[0]);
    if (filters?.fechaHasta) query = query.lte("fecha", filters.fechaHasta.toISOString().split('T')[0]);
    if (filters?.plataforma) query = query.eq("plataforma", filters.plataforma);
    if (filters?.metodoPago) query = query.eq("metodoPago", filters.metodoPago);
    if (filters?.estadoEnvio) query = query.eq("estadoEnvio", filters.estadoEnvio);
    if (filters?.comprador) query = query.ilike("comprador", `%${filters.comprador}%`);
    if (filters?.externalOrderId) query = query.or(`externalOrderId.ilike.%${filters.externalOrderId}%,saleCode.ilike.%${filters.externalOrderId}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message || "Error al obtener ventas");
    return data;
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    throw error;
  }
}

export async function createVenta(data: VentaFormData) {
  console.log("🚀🚀🚀 INICIO createVenta - Datos recibidos:", JSON.stringify(data, null, 2))
  console.log("🚀🚀🚀 TIMESTAMP:", new Date().toISOString())
  try {
    console.log("🔍 Datos recibidos en createVenta:", data)
    const validatedData = ventaSchema.parse(data)
    console.log("🔍 Datos validados:", validatedData)

    // Obtener el producto para el costo
    const { data: producto, error: prodError } = await supabase
      .from("productos")
      .select("*")
      .eq("id", validatedData.productoId)
      .single()
    if (prodError) throw new Error("Error al obtener producto")

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa con condicion
    const tarifa = await getTarifa(validatedData.plataforma, validatedData.metodoPago, validatedData.condicion)

    if (!tarifa) {
      return { success: false, error: "Tarifa no configurada para esta combinación de plataforma y método de pago" }
    }

    // Aplicar descuento directamente al pvBruto si existe
    const pvBrutoConDescuento = validatedData.pvBruto * (1 - (tarifa.descuentoPct || 0))

    // Calcular todos los campos automáticamente usando el precio con descuento
    const comisionManualParaUsar = (validatedData as any).usarComisionManual && (validatedData as any).comisionManual 
      ? (validatedData as any).comisionManual 
      : undefined
    const comisionExtraManualParaUsar = (validatedData as any).usarComisionManual && (validatedData as any).comisionExtraManual 
      ? (validatedData as any).comisionExtraManual 
      : undefined
    const iibbManualParaUsar = (validatedData as any).iibbManual || undefined
    const cuotasParaUsar = (validatedData as any).cuotas || undefined
    const calculos = calcularVenta(
      pvBrutoConDescuento, // Usar el precio ya con descuento aplicado
      validatedData.cargoEnvioCosto,
      Number(producto.costoUnitarioARS),
      { ...tarifa, descuentoPct: 0 }, // No aplicar descuento nuevamente en calculos
      validatedData.plataforma, // Agregar plataforma para cálculos específicos
      comisionManualParaUsar, // Pasar comisión manual solo si está habilitada
      comisionExtraManualParaUsar, // Pasar comisión extra manual solo si está habilitada
      iibbManualParaUsar, // Pasar IIBB manual para ML y TN+MP
      validatedData.metodoPago, // Pasar método de pago para detectar TN+MercadoPago
      cuotasParaUsar, // Pasar cantidad de cuotas para TN+MercadoPago
    )

    // Generar código de venta único
    const saleCode = generarSaleCode()

    // Filtrar campos que no existen en la base de datos o que no deben incluirse en INSERT
    const { courier, externalOrderId, usarComisionManual, comisionManual, comisionExtraManual, iibbManual, ...ventaDataParaInsertar } = validatedData

    // Filtrar también descuentoAplicado de los cálculos
    const { descuentoAplicado, ...calculosSinDescuento } = calculos

    const datosParaInsertar = {
      id: crypto.randomUUID(), // Generar ID único
      ...ventaDataParaInsertar,
      pvBruto: pvBrutoConDescuento, // Guardar el precio con descuento ya aplicado
      ...calculosSinDescuento,
      saleCode,
      cuotas: cuotasParaUsar || null, // Agregar cuotas (NULL si no aplica)
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    console.log("🔍 Datos para insertar en Supabase:", datosParaInsertar)

    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .insert([datosParaInsertar])
      .select("*, producto:productos(*)")
    if (ventaError) return { success: false, error: ventaError.message }

    // Actualizar liquidación si la venta fue creada exitosamente
    if (venta?.[0]) {
      // Asegurar que existe liquidación para esa fecha antes de recalcular
      const fechaVenta = new Date(venta[0].fecha).toISOString().split('T')[0]
      
      // Importar función para asegurar liquidación
      const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
      await asegurarLiquidacionParaFecha(fechaVenta)
      
      // Ahora recalcular en cascada
      await recalcularLiquidacionesEnCascada(fechaVenta)
    }

    revalidatePath("/ventas")
    revalidatePath("/liquidaciones")
    return { success: true, data: venta?.[0] }
  } catch (error) {
    console.error("Error al crear venta:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear venta" }
  }
}

export async function updateVenta(id: string, data: VentaFormData) {
  console.log("🚀🚀🚀 INICIO updateVenta - ID:", id, "Datos recibidos:", JSON.stringify(data, null, 2))
  console.log("🚀🚀🚀 TIMESTAMP:", new Date().toISOString())
  try {
    console.log("🔍 Datos recibidos en updateVenta:", data)
    const validatedData = ventaSchema.parse(data)
    console.log("🔍 Datos validados:", validatedData)

    // Obtener la venta anterior para comparar cambios
    const { data: ventaAnterior, error: ventaAnteriorError } = await supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .eq("id", id)
      .single()
    
    if (ventaAnteriorError || !ventaAnterior) {
      return { success: false, error: "Venta no encontrada" }
    }

    // Obtener el producto para el costo
    const { data: producto, error: prodError } = await supabase
      .from("productos")
      .select("*")
      .eq("id", validatedData.productoId)
      .single()
    if (prodError) throw new Error("Error al obtener producto")

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa con condicion
    const tarifa = await getTarifa(validatedData.plataforma, validatedData.metodoPago, validatedData.condicion)

    if (!tarifa) {
      return { success: false, error: "Tarifa no configurada para esta combinación de plataforma y método de pago" }
    }

    // Aplicar descuento directamente al pvBruto si existe
    const pvBrutoConDescuento = validatedData.pvBruto * (1 - (tarifa.descuentoPct || 0))

    // Recalcular todos los campos usando el precio con descuento
    const comisionManualParaUsar = (validatedData as any).usarComisionManual && (validatedData as any).comisionManual 
      ? (validatedData as any).comisionManual 
      : undefined
    const comisionExtraManualParaUsar = (validatedData as any).usarComisionManual && (validatedData as any).comisionExtraManual 
      ? (validatedData as any).comisionExtraManual 
      : undefined
    const iibbManualParaUsar = (validatedData as any).iibbManual || undefined
    const cuotasParaUsar = (validatedData as any).cuotas || undefined
    const calculos = calcularVenta(
      pvBrutoConDescuento, // Usar el precio ya con descuento aplicado
      validatedData.cargoEnvioCosto,
      Number(producto.costoUnitarioARS),
      { ...tarifa, descuentoPct: 0 }, // No aplicar descuento nuevamente en calculos
      validatedData.plataforma, // Agregar plataforma para cálculos específicos
      comisionManualParaUsar, // Pasar comisión manual solo si está habilitada
      comisionExtraManualParaUsar, // Pasar comisión extra manual solo si está habilitada
      iibbManualParaUsar, // Pasar IIBB manual para ML y TN+MP
      validatedData.metodoPago, // Pasar método de pago para detectar TN+MercadoPago
      cuotasParaUsar, // Pasar cantidad de cuotas para TN+MercadoPago
    )

    // Filtrar campos que no existen en la base de datos o que no deben incluirse en UPDATE  
    const { courier, externalOrderId, usarComisionManual, comisionManual, comisionExtraManual, iibbManual, ...ventaDataParaActualizar } = validatedData

    // Filtrar también descuentoAplicado de los cálculos
    const { descuentoAplicado, ...calculosSinDescuento } = calculos

    const datosParaActualizar = {
      ...ventaDataParaActualizar,
      pvBruto: pvBrutoConDescuento, // Guardar el precio con descuento ya aplicado
      ...calculosSinDescuento,
      cuotas: cuotasParaUsar || null, // Agregar cuotas (NULL si no aplica)
      updatedAt: new Date(),
    }
    
    console.log("🔍 Datos para actualizar en Supabase:", datosParaActualizar)

    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .update(datosParaActualizar)
      .eq("id", id)
      .select("*, producto:productos(*)")
    if (ventaError) return { success: false, error: ventaError.message }

    // Actualizar liquidación si la venta fue actualizada exitosamente
    if (venta?.[0]) {
      // Usar el nuevo sistema de recálculo en cascada desde la fecha más antigua afectada
      const fechaVentaNueva = new Date(venta[0].fecha).toISOString().split('T')[0]
      const fechaVentaAnterior = new Date(ventaAnterior.fecha).toISOString().split('T')[0]
      const fechaMasAntigua = fechaVentaNueva < fechaVentaAnterior ? fechaVentaNueva : fechaVentaAnterior
      
      // Asegurar que existen liquidaciones para ambas fechas antes de recalcular
      const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
      await asegurarLiquidacionParaFecha(fechaVentaNueva)
      if (fechaVentaAnterior !== fechaVentaNueva) {
        await asegurarLiquidacionParaFecha(fechaVentaAnterior)
      }
      
      await recalcularLiquidacionesEnCascada(fechaMasAntigua)
    }

    revalidatePath("/ventas")
    revalidatePath("/liquidaciones")
    return { success: true, data: venta?.[0] }
  } catch (error) {
    console.error("Error al actualizar venta:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar venta" }
  }
}

export async function deleteVenta(id: string) {
  try {
    // Obtener la venta antes de eliminarla para actualizar liquidación
    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .eq("id", id)
      .single()

    if (ventaError || !venta) {
      return { success: false, error: "Venta no encontrada" }
    }

    // Eliminar la venta
    const { error: deleteError } = await supabase
      .from("ventas")
      .delete()
      .eq("id", id)

    if (deleteError) {
      throw deleteError
    }

    // Recalcular liquidaciones desde la fecha de la venta eliminada
    const fechaVenta = new Date(venta.fecha).toISOString().split('T')[0]
    console.log('🗑️ Venta eliminada, recalculando liquidaciones desde:', fechaVenta)
    await recalcularLiquidacionesEnCascada(fechaVenta)

    // Forzar revalidación de todas las rutas críticas
    revalidatePath("/ventas")
    revalidatePath("/liquidaciones")
    revalidatePath("/eerr")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar venta:", error)
    return { success: false, error: "Error al eliminar venta" }
  }
}

export async function getVentaById(id: string) {
  try {
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .eq("id", id)
      .single()
    if (error) throw new Error("Error al obtener venta")
    return venta
  } catch (error) {
    console.error("Error al obtener venta:", error)
    throw new Error("Error al obtener venta")
  }
}

export async function updateEstadoEnvio(
  ventaIds: string[],
  estadoEnvio: EstadoEnvio,
  trackingUrl?: string,
  courier?: string,
) {
  try {
    const updateData: any = { estadoEnvio }
    if (trackingUrl) updateData.trackingUrl = trackingUrl
    if (courier) updateData.courier = courier

    await supabase
      .from("ventas")
      .update(updateData)
      .in("id", ventaIds)

    revalidatePath("/ventas")
    revalidatePath("/ventas/pendientes")
    return { success: true }
  } catch (error) {
    console.error("Error al actualizar estado de envío:", error)
    return { success: false, error: "Error al actualizar estado de envío" }
  }
}

export async function getVentasPendientes() {
  try {
    const { data: ventas, error } = await supabase
      .from("ventas")
      .select("*, producto:productos(*)")
      .in("estadoEnvio", ["Pendiente", "EnCamino"])
      .order("fecha", { ascending: true })
    if (error) throw new Error("Error al obtener ventas pendientes")
    return ventas
  } catch (error) {
    console.error("Error al obtener ventas pendientes:", error)
    throw new Error("Error al obtener ventas pendientes")
  }
}

export async function calcularPreviewVenta(
  productoId: string,
  plataforma: Plataforma,
  metodoPago: MetodoPago,
  condicion: string,
  pvBruto: number,
  cargoEnvioCosto: number,
) {
  try {
    // Obtener el producto para el costo
    const { data: producto, error: prodError } = await supabase
      .from("productos")
      .select("*")
      .eq("id", productoId)
      .single()
    if (prodError) throw new Error("Error al obtener producto")

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa con condicion usando getTarifaEspecifica
    const tarifaRaw = await getTarifaEspecifica(plataforma, metodoPago, condicion)

    if (!tarifaRaw) {
      return { success: false, error: "Tarifa no configurada" }
    }

    // Convertir a TarifaData
    const tarifa = {
      comisionPct: Number(tarifaRaw.comisionPct),
      iibbPct: Number(tarifaRaw.iibbPct),
      fijoPorOperacion: Number(tarifaRaw.fijoPorOperacion),
      descuentoPct: Number(tarifaRaw.descuentoPct || 0),
    }

    // Calcular preview
    const calculos = calcularVenta(pvBruto, cargoEnvioCosto, Number(producto.costoUnitarioARS), tarifa)

    return { success: true, data: calculos }
  } catch (error) {
    console.error("Error al calcular preview:", error)
    return { success: false, error: "Error al calcular preview" }
  }
}
