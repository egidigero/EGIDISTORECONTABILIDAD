"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { ventaSchema, type VentaFormData } from "@/lib/validations"
import { calcularVenta, getTarifa, generarSaleCode } from "@/lib/calculos"
import { getTarifaEspecifica } from "@/lib/actions/tarifas"
import { getCostosEstimados30Dias } from "@/lib/actions/devoluciones"
import { calcularMargenVenta } from "@/lib/margen-venta"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"
import {
  buildEnvioTNGastoDescripcion,
  calcularCostoEnvioTotalVenta,
  debeCrearGastoEnvioTN,
  GASTO_ENVIO_TN_CATEGORY,
} from "@/lib/envios"
import type { VentaFilters, EstadoEnvio, Plataforma, MetodoPago } from "@/lib/types"

function toFechaISO(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().split("T")[0]
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString().split("T")[0] : date.toISOString().split("T")[0]
}

async function findGastoEnvioTNBySaleCode(saleCode?: string | null) {
  if (!saleCode) return null

  const { data, error } = await supabase
    .from("gastos_ingresos")
    .select("id")
    .eq("tipo", "Gasto")
    .eq("categoria", GASTO_ENVIO_TN_CATEGORY)
    .eq("canal", "TN")
    .ilike("descripcion", `%Venta ${saleCode}%`)
    .order("updatedAt", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error buscando gasto de envio TN:", error)
    return null
  }

  return data?.[0] ?? null
}

async function syncGastoEnvioTNForVenta(venta: {
  saleCode?: string | null
  comprador: string
  plataforma?: string | null
  cargoEnvioCosto?: number | null
  fecha: Date | string
}) {
  const existing = await findGastoEnvioTNBySaleCode(venta.saleCode)

  if (!debeCrearGastoEnvioTN(venta.plataforma, venta.cargoEnvioCosto)) {
    if (existing?.id) {
      const { error } = await supabase.from("gastos_ingresos").delete().eq("id", existing.id)
      if (error) {
        console.error("Error eliminando gasto de envio TN:", error)
      }
    }
    return
  }

  const payload = {
    fecha: toFechaISO(venta.fecha),
    tipo: "Gasto" as const,
    categoria: GASTO_ENVIO_TN_CATEGORY,
    descripcion: buildEnvioTNGastoDescripcion(venta.comprador, venta.saleCode),
    montoARS: calcularCostoEnvioTotalVenta(venta.plataforma, venta.cargoEnvioCosto),
    canal: "TN" as const,
    esPersonal: false,
    updatedAt: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("gastos_ingresos")
      .update(payload)
      .eq("id", existing.id)

    if (error) {
      console.error("Error actualizando gasto de envio TN:", error)
    }
    return
  }

  const { error } = await supabase
    .from("gastos_ingresos")
    .insert([{ id: crypto.randomUUID(), ...payload }])

  if (error) {
    console.error("Error creando gasto de envio TN:", error)
  }
}

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
    if (filters?.productoId) query = query.eq("productoId", filters.productoId);
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
    // Margen nuevo: incluye devoluciones, estructura y publicidad (ROAS 30d).
    // No modifica comisiÃ³n/IVA/IIBB/precioNeto para no afectar liquidaciones.
    const plataformaParaCostos: "TN" | "ML" = validatedData.plataforma === "ML" ? "ML" : "TN"
    const costosEstimadosMargen = await getCostosEstimados30Dias(
      validatedData.productoId,
      plataformaParaCostos,
      (producto as any).sku || undefined
    )
    const costoEnvioTotalVenta = calcularCostoEnvioTotalVenta(validatedData.plataforma, validatedData.cargoEnvioCosto)
    const precioNetoCalculado = Number(
      (
        pvBrutoConDescuento -
        Number(calculos.comision || 0) -
        Number(calculos.iva || 0) -
        Number(calculos.iibb || 0) -
        costoEnvioTotalVenta
      ).toFixed(2)
    )
    let totalCostosPlataformaMargen =
      Number(calculos.comision || 0) +
      Number(calculos.iva || 0) +
      Number(calculos.iibb || 0) +
      costoEnvioTotalVenta

    // En ML, el fijo se guarda neto en "comision". Para margen se usa costo total.
    if (validatedData.plataforma === "ML") {
      const fijo = Number(tarifa.fijoPorOperacion || 0)
      totalCostosPlataformaMargen += fijo - (fijo / 1.21)
    }
    const resultadoOperativoMargen = pvBrutoConDescuento - Number(producto.costoUnitarioARS)
    const margenActualizado = calcularMargenVenta({
      precioReferenciaAds: Number(validatedData.pvBruto || 0),
      resultadoOperativo: resultadoOperativoMargen,
      totalCostosPlataforma: totalCostosPlataformaMargen,
      costoProducto: Number(producto.costoUnitarioARS),
      costoEnvio: costoEnvioTotalVenta,
      costosEstimados: costosEstimadosMargen,
    })

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
      precioNeto: precioNetoCalculado,
      ingresoMargen: Number(margenActualizado.margenNeto.toFixed(2)),
      rentabilidadSobrePV: Number(margenActualizado.rentabilidadSobrePV.toFixed(4)),
      rentabilidadSobreCosto: Number(margenActualizado.rentabilidadSobreCosto.toFixed(4)),
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

    // Registrar movimiento de stock (ya no actualizamos stockPropio directamente)
    if (venta?.[0]) {
      console.log("📦 Registrando movimiento de stock para producto:", validatedData.productoId)
      
      try {
        const movimientoData = {
          producto_id: validatedData.productoId.toString(),
          deposito_origen: 'PROPIO',
          deposito_destino: null,
          tipo: 'salida',
          cantidad: 1,
          fecha: new Date().toISOString(),
          observaciones: `Venta ${saleCode} - ${validatedData.comprador}`,
          origen_tipo: 'venta',
          origen_id: venta[0].id
        }
        console.log("📦 Datos del movimiento:", movimientoData)
        
        const { data: movData, error: movError } = await supabase
          .from("movimientos_stock")
          .insert(movimientoData)
          .select()
        
        if (movError) {
          console.error("❌ Error al registrar movimiento de stock:", movError)
          console.error("❌ Detalles del error:", JSON.stringify(movError, null, 2))
        } else {
          console.log("✅ Movimiento de stock registrado:", movData)
        }
      } catch (movError) {
        console.error("❌ Excepción al registrar movimiento de stock:", movError)
      }
    }

    // Actualizar liquidación si la venta fue creada exitosamente
    if (venta?.[0]) {
      // Asegurar que existe liquidación para esa fecha antes de recalcular
      await syncGastoEnvioTNForVenta({
        saleCode: venta[0].saleCode,
        comprador: venta[0].comprador,
        plataforma: venta[0].plataforma,
        cargoEnvioCosto: venta[0].cargoEnvioCosto,
        fecha: venta[0].fecha,
      })

      const fechaVenta = new Date(venta[0].fecha).toISOString().split('T')[0]
      
      // Importar función para asegurar liquidación
      const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
      await asegurarLiquidacionParaFecha(fechaVenta)
      
      // Ahora recalcular en cascada
      await recalcularLiquidacionesEnCascada(fechaVenta)
    }

    revalidatePath("/ventas")
    revalidatePath("/gastos")
    revalidatePath("/eerr")
    revalidatePath("/liquidaciones")
    revalidatePath("/productos")
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

    // Margen nuevo: incluye devoluciones, estructura y publicidad (ROAS 30d).
    // No modifica comisiÃ³n/IVA/IIBB/precioNeto para no afectar liquidaciones.
    const plataformaParaCostos: "TN" | "ML" = validatedData.plataforma === "ML" ? "ML" : "TN"
    const costosEstimadosMargen = await getCostosEstimados30Dias(
      validatedData.productoId,
      plataformaParaCostos,
      (producto as any).sku || undefined
    )
    const costoEnvioTotalVenta = calcularCostoEnvioTotalVenta(validatedData.plataforma, validatedData.cargoEnvioCosto)
    const precioNetoCalculado = Number(
      (
        pvBrutoConDescuento -
        Number(calculos.comision || 0) -
        Number(calculos.iva || 0) -
        Number(calculos.iibb || 0) -
        costoEnvioTotalVenta
      ).toFixed(2)
    )
    let totalCostosPlataformaMargen =
      Number(calculos.comision || 0) +
      Number(calculos.iva || 0) +
      Number(calculos.iibb || 0) +
      costoEnvioTotalVenta

    // En ML, el fijo se guarda neto en "comision". Para margen se usa costo total.
    if (validatedData.plataforma === "ML") {
      const fijo = Number(tarifa.fijoPorOperacion || 0)
      totalCostosPlataformaMargen += fijo - (fijo / 1.21)
    }
    const resultadoOperativoMargen = pvBrutoConDescuento - Number(producto.costoUnitarioARS)
    const margenActualizado = calcularMargenVenta({
      precioReferenciaAds: Number(validatedData.pvBruto || 0),
      resultadoOperativo: resultadoOperativoMargen,
      totalCostosPlataforma: totalCostosPlataformaMargen,
      costoProducto: Number(producto.costoUnitarioARS),
      costoEnvio: costoEnvioTotalVenta,
      costosEstimados: costosEstimadosMargen,
    })

    const datosParaActualizar = {
      ...ventaDataParaActualizar,
      pvBruto: pvBrutoConDescuento, // Guardar el precio con descuento ya aplicado
      ...calculosSinDescuento,
      precioNeto: precioNetoCalculado,
      ingresoMargen: Number(margenActualizado.margenNeto.toFixed(2)),
      rentabilidadSobrePV: Number(margenActualizado.rentabilidadSobrePV.toFixed(4)),
      rentabilidadSobreCosto: Number(margenActualizado.rentabilidadSobreCosto.toFixed(4)),
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
      await syncGastoEnvioTNForVenta({
        saleCode: venta[0].saleCode,
        comprador: venta[0].comprador,
        plataforma: venta[0].plataforma,
        cargoEnvioCosto: venta[0].cargoEnvioCosto,
        fecha: venta[0].fecha,
      })

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
    revalidatePath("/gastos")
    revalidatePath("/eerr")
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

    await syncGastoEnvioTNForVenta({
      saleCode: venta.saleCode,
      comprador: venta.comprador,
      plataforma: "ML",
      cargoEnvioCosto: 0,
      fecha: venta.fecha,
    })

    // Restaurar stock del producto mediante movimiento de stock
    const producto = venta.producto
    if (producto) {
      console.log("📦 Restaurando stock para producto:", venta.productoId)
      
      try {
        // Registrar movimiento de ENTRADA para restaurar el stock
        const movimientoData = {
          producto_id: venta.productoId.toString(),
          deposito_origen: 'PROPIO',
          deposito_destino: null,
          tipo: 'entrada',
          cantidad: 1,
          fecha: new Date().toISOString(),
          observaciones: `Devolución por eliminación de venta ${venta.saleCode || venta.id} - ${venta.comprador}`,
          origen_tipo: 'venta_eliminada',
          origen_id: id
        }
        console.log("📦 Datos del movimiento de devolución:", movimientoData)
        
        const { data: movData, error: movError } = await supabase
          .from("movimientos_stock")
          .insert(movimientoData)
          .select()
        
        if (movError) {
          console.error("❌ Error al registrar movimiento de devolución:", movError)
          console.error("❌ Detalles del error:", JSON.stringify(movError, null, 2))
        } else {
          console.log("✅ Movimiento de devolución registrado:", movData)
        }
      } catch (movError) {
        console.error("❌ Excepción al registrar movimiento de devolución:", movError)
      }
    }

    // Recalcular liquidaciones desde la fecha de la venta eliminada
    const fechaVenta = new Date(venta.fecha).toISOString().split('T')[0]
    console.log('🗑️ Venta eliminada, recalculando liquidaciones desde:', fechaVenta)
    await recalcularLiquidacionesEnCascada(fechaVenta)

    // Forzar revalidación de todas las rutas críticas
    revalidatePath("/ventas")
    revalidatePath("/gastos")
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
