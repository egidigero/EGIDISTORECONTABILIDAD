"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { devolucionSchema, devolucionSchemaBase, devolucionSchemaWithRecoveryCheck, type DevolucionFormData, type GastoIngresoFormData } from "@/lib/validations"
import { eliminarVentaDeLiquidacion } from "@/lib/actions/actualizar-liquidacion"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"

// Helper: convert camelCase object keys to snake_case for PostgREST/Supabase
function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  const mapping: Record<string, string> = {
    // Field name translations where DB column differs from camelCase key
    numeroDevolucion: 'id_devolucion',
    ventaId: 'venta_id',
    productoNuevoId: 'producto_nuevo_id',
    nombreContacto: 'nombre_contacto',
    telefonoContacto: 'telefono_contacto',
    costoEnvioOriginal: 'costo_envio_original',
    costoEnvioDevolucion: 'costo_envio_devolucion',
    costoEnvioNuevo: 'costo_envio_nuevo',
    costoProductoOriginal: 'costo_producto_original',
    costoProductoNuevo: 'costo_producto_nuevo',
    montoVentaOriginal: 'monto_venta_original',
    montoReembolsado: 'monto_reembolsado',
    tipoResolucion: 'tipo_resolucion',
    fechaCompra: 'fecha_compra',
    fechaReclamo: 'fecha_reclamo',
    fechaCompletada: 'fecha_completada',
    productoRecuperable: 'producto_recuperable',
    numeroSeguimiento: 'numero_seguimiento',
    numeroDevolucionGenerado: 'id_devolucion'
  ,
  // MP/ML flags persisted from the UI
  mpEstado: 'mp_estado',
  mpRetener: 'mp_retenido'
  }
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key]
    const snake = mapping[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase()
    out[snake] = toSnakeCase(val)
  }
  return out
}

// Helper: convert snake_case keys from DB to camelCase expected by our Zod schemas
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key]
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = toCamelCase(val)
  }
  return out
}

// Helper: recursively remove null values to avoid Zod rejecting null (Zod allows undefined for optional fields)
function stripNulls(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(stripNulls)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key]
    if (val === null) continue
    out[key] = stripNulls(val)
  }
  return out
}

// Normalize common DB date-like objects to string or Date so Zod preprocess can handle them
function normalizeDateLike(val: any): any {
  if (val === null || val === undefined) return val
  if (val instanceof Date) return val
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    // Firestore-like timestamp
    if (typeof val.toDate === 'function') {
      try { return val.toDate() } catch {}
    }
    // Numeric seconds (e.g., { seconds: 169 })
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000)
    // Common wrappers
    if (typeof val.value === 'string') return val.value
    if (typeof val.iso === 'string') return val.iso
    if (typeof val.toISOString === 'function') {
      try { return new Date(val.toISOString()) } catch {}
    }
    // Fallback: stringify (Zod will try to parse string)
    try { return JSON.stringify(val) } catch { return String(val) }
  }
  return val
}

// Helper: Obtener datos de la venta para auto-completar
async function obtenerDatosVenta(ventaId: string) {
  try {
    const { data: venta, error } = await supabase
      .from('ventas')
      // Avoid joining tarifas here (some DB schemas don't define that FK relationship in PostgREST)
      // We only need basic venta fields and product info
      .select('*, productos(*)')
      .eq('id', ventaId)
      .single()

    if (error) throw error
    if (!venta) throw new Error("Venta no encontrada")

    // Auto-completar costos desde la venta original.
    // Los nombres de columnas pueden variar entre esquemas (snake_case o camelCase),
    // por eso intentamos varias alternativas.
    const costoProductoCandidates = [
      (venta as any).costoProducto,
      (venta as any).costo_producto,
      (venta as any).costoUnitarioARS,
      (venta as any).costo_unitario_ars,
      (venta as any).costo || null
    ]
    const costoEnvioCandidates = [
      (venta as any).costoEnvio,
      (venta as any).costo_envio,
      (venta as any).cargoEnvioCosto,
      (venta as any).cargo_envio_costo,
      (venta as any).shippingCost,
      (venta as any).shipping_cost,
      0
    ]
    const montoVentaCandidates = [
      (venta as any).montoTotal,
      (venta as any).monto_total,
      (venta as any).pvBruto,
      (venta as any).pv_bruto,
      (venta as any).total
    ]

    const pickFirstNumber = (arr: any[]) => {
      for (const v of arr) {
        if (typeof v === 'number' && !Number.isNaN(v)) return v
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
      }
      return 0
    }

    return {
      costoProductoOriginal: pickFirstNumber(costoProductoCandidates),
      costoEnvioOriginal: pickFirstNumber(costoEnvioCandidates),
      montoVentaOriginal: pickFirstNumber(montoVentaCandidates),
      // commission removed from devoluciones; derive from venta when necessary
      plataforma: (venta as any).plataforma,
  productoId: ((venta as any).productoId ?? (venta as any).producto_id) || null,
      comprador: (venta as any).comprador ?? (venta as any).buyer_name ?? (venta as any).cliente ?? null,
      fechaCompra: (venta as any).fecha ?? (venta as any).fecha_compra ?? (venta as any).created_at ?? null,
      saleCode: (venta as any).saleCode ?? (venta as any).sale_code ?? null,
      externalOrderId: (venta as any).externalOrderId ?? (venta as any).external_order_id ?? null
    }
  } catch (error) {
    console.error("Error al obtener datos de venta:", error)
    return null
  }
}

// Listar devoluciones desde la vista con cálculos automáticos
export async function getDevoluciones() {
  try {
    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .order('fecha_reclamo', { ascending: false })
    
    if (error) throw error
    // Debug: log number of rows and a sample row to help diagnose UI load issues
    try {
      console.debug('[getDevoluciones] rows=', Array.isArray(data) ? data.length : 0, 'sample=', Array.isArray(data) && data.length > 0 ? data[0] : null)
    } catch (dbg) {
      // ignore debug errors
    }
    // Normalize rows to camelCase so front-end receives stable keys
    try {
      return (data || []).map(d => {
        const cam: any = toCamelCase(d)
        // Provide compatibility aliases used by the UI
        cam.numeroDevolucion = cam.numeroDevolucion ?? cam.idDevolucion ?? cam.id_devolucion ?? cam.id ?? undefined
        cam.numeroSeguimiento = cam.numeroSeguimiento ?? cam.numero_seguimiento ?? undefined
  // Normalize date fields to ISO strings so frontend can safely parse/display them
        try {
          const toIso = (v: any) => {
            if (v === null || typeof v === 'undefined') return null
            if (v instanceof Date) return v.toISOString()
            if (typeof v === 'string') {
              // Common Postgres format: 'YYYY-MM-DD HH:MM:SS' (no T, no Z)
              // Normalize to ISO by replacing space with 'T' and appending 'Z'
              const spaceDateMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(v)
              const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(v)
              let candidate = v
              if (spaceDateMatch) candidate = v.replace(' ', 'T') + 'Z'
              else if (dateOnlyMatch) candidate = v + 'T00:00:00Z'
              const parsed = new Date(candidate)
              return isNaN(parsed.getTime()) ? null : parsed.toISOString()
            }
            // If it's another object, try the generic parser
            const parsed = new Date(v as any)
            return isNaN(parsed.getTime()) ? null : parsed.toISOString()
          }
          cam.fechaCompra = toIso(cam.fechaCompra ?? cam.fecha_compra)
          cam.fechaReclamo = toIso(cam.fechaReclamo ?? cam.fecha_reclamo)
          cam.fechaCompletada = toIso(cam.fechaCompletada ?? cam.fecha_completada)
        } catch (dateErr) {
          // swallow — we'll leave original values if normalization fails
        }
        // Provide a single displayName that the UI can use to avoid showing duplicates
        try {
          cam.displayName = cam.comprador ?? cam.nombreContacto ?? cam.saleCode ?? null
        } catch (e) {
          cam.displayName = cam.comprador ?? cam.nombreContacto ?? null
        }
        return cam
      })
    } catch (normErr) {
      // If normalization fails, still return raw data to avoid breaking callers
      console.warn('getDevoluciones: normalization failed, returning raw rows', normErr)
      return data
    }
  } catch (error) {
    console.error("Error al obtener devoluciones:", error)
    throw new Error("Error al obtener devoluciones")
  }
}

// Crear devolución con auto-completado de datos financieros
export async function createDevolucion(data: DevolucionFormData) {
  try {
    // Obtener datos de la venta primero para poder autocompletar fechas/costos
    const datosVenta = data.ventaId ? await obtenerDatosVenta(data.ventaId) : null

    // Asegurar fechas por defecto: fechaReclamo = hoy si no viene; fechaCompra desde la venta
    const provisional = {
      ...data,
      fechaReclamo: (data as any).fechaReclamo ?? new Date(),
      // Garantizar fechaCompra: preferir la de la venta, sino caer a fechaReclamo (hoy)
      fechaCompra: (data as any).fechaCompra ?? datosVenta?.fechaCompra ?? ((data as any).fechaReclamo ? (data as any).fechaReclamo : new Date()),
    }

  // Sanitize optional enum fields coming from the client: don't pass empty strings to Zod enums
  if (provisional && (provisional as any).mpEstado === "") (provisional as any).mpEstado = undefined
  const validatedData = devolucionSchema.parse(provisional)

    if (!datosVenta) {
      // Si no logramos obtener la venta, seguimos permitiendo crear el informe pero con menos autocompletado
      // (la migración y datos pueden resolverse manualmente después)
      // No retornamos error aquí para no bloquear el flujo de registro del informe.
      console.warn('createDevolucion: no se pudo obtener datos de venta, creando informe sin autocompletado')
    }

    // Si no se proporcionó número de devolución, generar uno (aunque la DB también tiene trigger)
    const numeroDevolucionGenerado = validatedData.numeroDevolucion || `DEV-${Date.now().toString().slice(-6)}`

    // Combinar datos del formulario con datos auto-completados
    const devolucionCompleta = {
      ...validatedData,
      numeroDevolucion: numeroDevolucionGenerado,
      costoProductoOriginal: validatedData.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0,
      costoEnvioOriginal: validatedData.costoEnvioOriginal ?? datosVenta?.costoEnvioOriginal ?? 0,
      montoVentaOriginal: validatedData.montoVentaOriginal ?? datosVenta?.montoVentaOriginal ?? 0,
      // commission removed: not persisted on devoluciones
      // Use optional chaining in case the validation schema doesn't include comisionOriginal
  comisionOriginal: (validatedData as any)?.comisionOriginal ?? (datosVenta as any)?.comisionOriginal ?? 0,
      nombreContacto: validatedData.nombreContacto ?? datosVenta?.comprador ?? validatedData.nombreContacto,
      fechaCompra: validatedData.fechaCompra ?? datosVenta?.fechaCompra,
    }

    // Build a deterministic DB row with exact snake_case column names to avoid PostgREST schema cache errors
    // If this is a provisional informe (no resolución/estado final),
    // don't persist product costs or monto_reembolsado yet. This avoids
    // que la columna generada `perdida_total` muestre la pérdida de producto
    // antes de que la devolución sea finalizada.
    const isProvisional = (devolucionCompleta.estado === 'Pendiente' || !devolucionCompleta.tipoResolucion)

    const dbRow: any = {
      venta_id: devolucionCompleta.ventaId,
      producto_nuevo_id: devolucionCompleta.productoNuevoId ?? null,
      id_devolucion: devolucionCompleta.numeroDevolucion,
      fecha_compra: devolucionCompleta.fechaCompra,
      fecha_reclamo: devolucionCompleta.fechaReclamo,
      fecha_completada: devolucionCompleta.fechaCompletada ?? null,
      nombre_contacto: devolucionCompleta.nombreContacto ?? null,
      telefono_contacto: devolucionCompleta.telefonoContacto ?? null,
  // Persistir número de seguimiento si el cliente lo proveyó
  numero_seguimiento: devolucionCompleta.numeroSeguimiento ?? null,
      motivo: devolucionCompleta.motivo,
  // plataforma is NOT NULL in the DB; if we couldn't fetch it from the venta or the form,
  // default to 'TN' (Tienda Nube) to avoid DB constraint violation. Adjust as needed.
  plataforma: (validatedData as any).plataforma ?? datosVenta?.plataforma ?? 'TN',
      estado: devolucionCompleta.estado ?? 'Pendiente',
      tipo_resolucion: devolucionCompleta.tipoResolucion ?? null,
  // Persistir costo de producto ORIGINAL siempre (para trazabilidad),
  // pero no persistir como pérdida hasta la finalización.
  costo_producto_original: Number(devolucionCompleta.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0),
  // El costo de producto nuevo y la bandera de recuperabilidad solo se aplican
  // cuando la devolución se finaliza (o se proveen explícitamente).
  costo_producto_nuevo: isProvisional ? 0 : Number(devolucionCompleta.costoProductoNuevo ?? 0),
  producto_recuperable: isProvisional ? false : Boolean((devolucionCompleta as any).productoRecuperable ?? false),
      costo_envio_original: Number(devolucionCompleta.costoEnvioOriginal ?? 0),
      costo_envio_devolucion: Number(devolucionCompleta.costoEnvioDevolucion ?? 0),
  costo_envio_nuevo: Number(devolucionCompleta.costoEnvioNuevo ?? 0),
  // total_costos_envio is a GENERATED column in the DB (calculated from the three envio columns).
  // Do not attempt to insert/update it explicitly; the DB computes it automatically.
      monto_venta_original: Number(devolucionCompleta.montoVentaOriginal ?? 0),
      // No persistir montoReembolsado en informes provisionales
      monto_reembolsado: isProvisional ? 0 : Number(devolucionCompleta.montoReembolsado ?? 0),
      observaciones: devolucionCompleta.observaciones ?? null,
      // Persist MP-related choices if the client provided them (optional columns in DB)
      mp_estado: (devolucionCompleta as any).mpEstado ?? null,
      mp_retenido: (devolucionCompleta as any).mpRetener ? true : false,
    }

    let created: any = null
    try {
      const resp = await supabase
        .from('devoluciones')
        .insert([dbRow])
        .select()
        .single()
      if (resp.error) throw resp.error
      created = resp.data
    } catch (insErr: any) {
      // PostgREST returns PGRST204 when a provided column is not found in the schema cache.
      // This can happen if the DB hasn't been migrated to include mp_estado/mp_retenido.
      // Detect that case and retry without those optional columns for backward compatibility.
      try {
        const msg = String(insErr?.message ?? insErr)
        if (insErr?.code === 'PGRST204' || msg.includes("mp_estado") || msg.includes("mp_retenido")) {
          const safeRow = { ...dbRow }
          delete safeRow.mp_estado
          delete safeRow.mp_retenido
          const retry = await supabase.from('devoluciones').insert([safeRow]).select().single()
          if (retry.error) throw retry.error
          created = retry.data
        } else {
          throw insErr
        }
      } catch (finalErr) {
        throw finalErr
      }
    }

  // Aplicar ajuste contable inmediato para el costo de envío de devolución:
  // El negocio requiere que al registrar el informe se reste el costo de envío
  // de la disponibilidad de MercadoPago en la fecha indicada por `fechaReclamo`.
    try {
  // Solo aplicar en la liquidación de hoy el costo de envío de vuelta (devolución).
  // El costo de ida ya fue aplicado en su momento cuando se registró la venta.
  const costoEnvioDevolucion = Number(validatedData.costoEnvioDevolucion ?? 0)
  const costoEnvio = costoEnvioDevolucion
      if (costoEnvio && costoEnvio > 0) {
        // Use the claim date (fechaReclamo) as the accounting impact date; fallback to today
        const impactoFecha = (validatedData && (validatedData as any).fechaReclamo)
          ? new Date((validatedData as any).fechaReclamo).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
        const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
        await asegurarLiquidacionParaFecha(impactoFecha)
        const { data: liquidacionHoy, error: errorHoy } = await supabase
          .from('liquidaciones')
          .select('*')
          .eq('fecha', impactoFecha)
          .single()

        if (!errorHoy && liquidacionHoy) {
          // En lugar de tocar directamente la fila de liquidaciones, crear un registro
          // en gastos_ingresos con categoria 'Devolución' para que aparezca en el detalle
          // y reutilizar la lógica existente de recálculo.
          try {
            const { createGastoIngreso } = await import('@/lib/actions/gastos-ingresos')
            // Construir descripción usando datos de la venta si están disponibles
            // Construir referencia a la venta de forma segura: probar varios campos posibles
            const ventaRefCandidates = [
              (datosVenta as any)?.saleCode,
              (datosVenta as any)?.externalOrderId,
              (datosVenta as any)?.productoId,
              (datosVenta as any)?.comprador,
              dbRow.venta_id,
              created.venta_id,
              created.id,
            ]
            const ventaRef = ventaRefCandidates.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? 'sin-ref'
            const descripcion = `Costo de envío devolución ${ventaRef}`
            const gastoRes = await createGastoIngreso({
              // Persist the gasto with the impact date (fechaReclamo)
              fecha: new Date(impactoFecha),
              tipo: 'Gasto',
              categoria: 'Gastos del negocio - Envios devoluciones',
              descripcion: `${descripcion} - devol ${created.id}`,
              montoARS: costoEnvio,
              canal: 'General'
            } as GastoIngresoFormData)

            if (gastoRes && gastoRes.success) {
              // Nota: ya no persistimos `monto_aplicado_liquidacion` en la fila de devoluciones.
              // El ajuste contable queda reflejado mediante el registro en `gastos_ingresos` (gasto creado arriba).

              // Intentar persistir también el id del gasto creado para idempotencia futura
              try {
                const gastoId = gastoRes.data?.id ?? gastoRes.data?.[0]?.id ?? gastoRes.data
                if (gastoId) {
                  await supabase.from('devoluciones').update({ gasto_creado_id: gastoId }).eq('id', created.id)
                }
              } catch (auditErr2) {
                console.warn('No se pudo persistir gasto_creado_id en creación (no crítico)', auditErr2)
              }

              // createGastoIngreso ya se encarga de asegurar la liquidación y recalcular.
                revalidatePath('/liquidaciones')
                revalidatePath('/eerr')
                revalidatePath('/ventas')
                // Además ejecutar recálculo en cascada para asegurar consistencia en la fecha de impacto
                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  await recalcularLiquidacionesEnCascada(impactoFecha)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recálculo en cascada tras crear devolución (no crítico)', rcErr)
                }
            } else {
              console.error('No se pudo crear gasto_ingreso para devolución (creación):', gastoRes?.error)
            }
          } catch (errG) {
            console.error('Error creando gasto/ingreso para devolución (creación):', errG)
          }
        } else {
          console.warn('No se encontró liquidación de hoy para aplicar costo de envío en creación de devolución', errorHoy)
        }
      }
    } catch (err) {
      console.error('Error aplicando ajuste contable al crear devolución (no crítico):', err)
    }

    // --- Lógica ML adicional en creación: si la devolución es ML y viene como Reembolso,
    // aplicar ajuste en liquidaciones HOY según mpEstado/mpRetener (si el usuario lo indicó).
    try {
      const plataformaCreada = (validatedData as any).plataforma ?? datosVenta?.plataforma ?? 'TN'
      const tipoResCreada = (validatedData as any).tipoResolucion ?? null
      const montoReembolsadoCreada = Number((validatedData as any).montoReembolsado ?? 0)
      const mpEstadoCreada = (validatedData as any).mpEstado ?? null
      const mpRetenerCreada = Boolean((validatedData as any).mpRetener ?? false)

      if ((plataformaCreada === 'ML' || (datosVenta && (datosVenta as any).plataforma === 'ML')) && tipoResCreada === 'Reembolso' && montoReembolsadoCreada > 0) {
        // Use fechaReclamo as impact date for MP adjustments on creation
        const impactoFecha = (validatedData && (validatedData as any).fechaReclamo)
          ? new Date((validatedData as any).fechaReclamo).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
        const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
        await asegurarLiquidacionParaFecha(impactoFecha)
        const { data: liqHoy, error: liqErr } = await supabase.from('liquidaciones').select('*').eq('fecha', impactoFecha).single()
        if (!liqErr && liqHoy) {
          try {
            let nuevoMpDisponible = Number(liqHoy.mp_disponible ?? 0)
            let nuevoMpALiquidar = Number(liqHoy.mp_a_liquidar ?? 0)
            let nuevoMpRetenido = Number((liqHoy as any).mp_retenido ?? 0)

            // Default: assume money was liquidado unless mpEstado indicates otherwise
            if (mpEstadoCreada === 'a_liquidar') {
              nuevoMpALiquidar = Math.max(0, nuevoMpALiquidar - montoReembolsadoCreada)
            } else {
              // liquidado or unknown
              nuevoMpDisponible = Math.max(0, nuevoMpDisponible - montoReembolsadoCreada)
            }

            if (mpRetenerCreada) {
              // Try to increment mp_retenido if column exists; if not, just subtract from source
              try {
                nuevoMpRetenido = Number(nuevoMpRetenido) + Number(montoReembolsadoCreada)
                await supabase.from('liquidaciones').update({ mp_disponible: nuevoMpDisponible, mp_a_liquidar: nuevoMpALiquidar, mp_retenido: nuevoMpRetenido }).eq('fecha', impactoFecha)
              } catch (uErr) {
                console.warn('No se pudo actualizar mp_retenido (posible falta de columna), aplicando solo source decrement', uErr)
                await supabase.from('liquidaciones').update({ mp_disponible: nuevoMpDisponible, mp_a_liquidar: nuevoMpALiquidar }).eq('fecha', impactoFecha)
              }
            } else {
              await supabase.from('liquidaciones').update({ mp_disponible: nuevoMpDisponible, mp_a_liquidar: nuevoMpALiquidar }).eq('fecha', impactoFecha)
            }

                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  await recalcularLiquidacionesEnCascada(impactoFecha)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recálculo en cascada tras ML creación (no crítico)', rcErr)
                }
            revalidatePath('/liquidaciones')
            revalidatePath('/eerr')
            revalidatePath('/ventas')
          } catch (applyErr) {
            console.warn('Error aplicando ajuste ML en creación (no crítico)', applyErr)
          }
        } else {
          console.warn('No se encontró liquidación HOY para aplicar ajuste ML en creación', liqErr)
        }
      }
    } catch (mlErr) {
      console.warn('Error en flujo ML al crear devolución (no crítico)', mlErr)
    }

    // Creación ya aplicó (si correspondía) el ajuste de envío; devolver resultado
    revalidatePath("/devoluciones")
    return { success: true, data: created }
  } catch (error) {
    console.error("Error al crear devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear devolución" }
  }
}

// Actualizar devolución
export async function updateDevolucion(id: string, data: Partial<DevolucionFormData> | DevolucionFormData) {
  try {
    // Allow partial payloads on update: parse partial first to enforce types on provided fields,
    // then merge with existing DB row and validate the merged object with the full schema.
  // Sanitize incoming partial payload to avoid empty-string enum values causing Zod to fail
  const _safePartial: any = { ...(data as any) }
  if (_safePartial.mpEstado === "") _safePartial.mpEstado = undefined
  const parsedPartial = devolucionSchemaBase.partial().parse(_safePartial)

    // Obtener registro existente para hacer un update tipo "merge"
    const { data: existing, error: fetchError } = await supabase
      .from('devoluciones')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!existing) throw new Error('Devolución no encontrada')

    // -------------------------
    // Early path: if the update converts the devolución a Reembolso,
    // and the venta was PagoNube, we must subtract the monto que se liquidó
    // durante la venta de 'tn_a_liquidar' de la liquidación de HOY.
  // This is intentionally minimal and idempotent: we previously persisted monto_aplicado_liquidacion
  // for audit/idempotence. We no longer write that column — accounting impacts are recorded via gastos_ingresos.
    // y actualicemos la devolución con los campos parciales enviados.
    // -------------------------
    try {
      const prevTipoCandidate = (existing as any).tipoResolucion ?? (existing as any).tipo_resolucion ?? null
      const newTipoCandidate = (parsedPartial as any).tipoResolucion ?? (parsedPartial as any).tipo_resolucion ?? (parsedPartial as any).estado ?? null
      const wasReembolsoBefore = !!(prevTipoCandidate === 'Reembolso' || (typeof (existing as any).estado === 'string' && String((existing as any).estado).includes('Reembolso')))
      const willBeReembolsoNow = !!(newTipoCandidate === 'Reembolso' || (typeof (parsedPartial as any).estado === 'string' && String((parsedPartial as any).estado).includes('Reembolso')))

      if (willBeReembolsoNow && !wasReembolsoBefore) {
        // Fetch venta to know metodoPago and calculate monto a liquidar
        const ventaIdToUse = (parsedPartial as any).ventaId ?? (existing as any).venta_id
        if (ventaIdToUse) {
          const { data: venta, error: ventaErr } = await supabase.from('ventas').select('*').eq('id', ventaIdToUse).single()
          if (!ventaErr && venta) {
            // calcular monto a liquidar para la venta (usa la función compartida)
            try {
              const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
              const montoVentaLiquidado = await calcularMontoVentaALiquidar(venta as any)
              const newMonto = Number((parsedPartial as any).montoReembolsado ?? (parsedPartial as any).monto_reembolsado ?? montoVentaLiquidado ?? 0)
              // Use monto_reembolsado as the persisted source of truth for previous applied amount (fallback to 0)
              const prevApplied = Number((existing as any).monto_reembolsado ?? (existing as any).monto_reembolsado ?? 0)
              const delta = newMonto - prevApplied
              const plataforma = (venta as any).plataforma ?? null
              const metodoPago = (venta as any).metodoPago ?? null
              const fechaHoyActual = new Date().toISOString().split('T')[0]
              // Lógica especial para Mercado Libre
              if (plataforma === 'ML' || metodoPago === 'MercadoPago') {
                // Use optional mpEstado/mpRetener provided by the client (advance modal or form)
                const mpEstadoProvided = (parsedPartial as any).mpEstado ?? (parsedPartial as any).mp_estado ?? null
                const mpRetenerProvided = Boolean((parsedPartial as any).mpRetener ?? (parsedPartial as any).mp_retener ?? false)
                // Persist desglose de envíos si fue provisto
                try {
                  const envioOriginalVal = Number((parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                  const envioVueltaVal = Number((parsedPartial as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                  const envioNuevoVal = Number((parsedPartial as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                  await supabase.from('devoluciones').update({ costo_envio_original: envioOriginalVal, costo_envio_devolucion: envioVueltaVal, costo_envio_nuevo: envioNuevoVal }).eq('id', id)
                } catch (envErrEarly) {
                  console.warn('No se pudo persistir desglose de envíos en flujo ML (no crítico)', envErrEarly)
                }

                // Apply adjustments to the intended fecha de impacto (user-provided fechaCompletada) when available,
                // otherwise fall back to today's date. This ensures fecha_impacto uses the date the user selected
                // in the "Registrar avance" modal instead of always using today.
                try {
                  const fechaHoy = (parsedPartial && (parsedPartial as any).fechaCompletada)
                    ? new Date((parsedPartial as any).fechaCompletada).toISOString().split('T')[0]
                    : fechaHoyActual
                  const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
                  await asegurarLiquidacionParaFecha(fechaHoy)
                  const { data: liqHoy, error: liqErr } = await supabase.from('liquidaciones').select('*').eq('fecha', fechaHoy).single()
                  if (!liqErr && liqHoy) {
                    let nuevoMpDisponible = Number(liqHoy.mp_disponible ?? 0)
                    let nuevoMpALiquidar = Number(liqHoy.mp_a_liquidar ?? 0)
                    let nuevoMpRetenido = Number((liqHoy as any).mp_retenido ?? 0)

                    // Decide deltas to persist on la devolución instead of updating liquidaciones directly.
                    // Compute delta buckets (negative values reduce buckets, positive values increase)
                    let delta_mp_disponible = 0
                    let delta_mp_a_liquidar = 0
                    let delta_mp_retenido = 0
                    let delta_tn_a_liquidar = 0

                    // If the money was still 'a_liquidar', reduce that bucket; otherwise reduce disponible
                    if (mpEstadoProvided === 'a_liquidar') {
                      delta_mp_a_liquidar += -delta
                    } else {
                      delta_mp_disponible += -delta
                    }

                    // Additionally, always subtract the original shipping cost from MP disponible
                    try {
                      const envioOriginal = Number((parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                      if (envioOriginal && envioOriginal > 0) {
                        delta_mp_disponible += -envioOriginal
                      }
                    } catch (e) {
                      // no-op
                    }

                    // If user marked to retain money, add to mp_retenido (positive)
                    if (mpRetenerProvided) {
                      delta_mp_retenido += delta
                    }

                    // Persist deltas and fecha_impacto on the devolución row so the recalculation
                    // can consume them centrally.
                    try {
                      const payloadDeltas: any = {
                        fecha_impacto: fechaHoy,
                        delta_mp_disponible: Number(delta_mp_disponible || 0),
                        delta_mp_a_liquidar: Number(delta_mp_a_liquidar || 0),
                        delta_mp_retenido: Number(delta_mp_retenido || 0),
                        delta_tn_a_liquidar: Number(delta_tn_a_liquidar || 0)
                      }
                      // Try update directly; if columns missing, fallback to previous behavior (update liquidaciones)
                      try {
                        await supabase.from('devoluciones').update(payloadDeltas).eq('id', id)
                      } catch (updDErr: any) {
                        // If update fails due to missing columns, fall back to updating liquidaciones directly
                        console.warn('No se pudo persistir deltas en devoluciones (fallback a update liquidaciones):', updDErr)
                        try {
                          if (mpRetenerProvided) {
                            nuevoMpRetenido = Number(nuevoMpRetenido) + Number(delta)
                            await supabase.from('liquidaciones').update({ mp_disponible: Math.max(0, nuevoMpDisponible), mp_a_liquidar: Math.max(0, nuevoMpALiquidar), mp_retenido: nuevoMpRetenido }).eq('fecha', fechaHoy)
                          } else {
                            await supabase.from('liquidaciones').update({ mp_disponible: Math.max(0, nuevoMpDisponible), mp_a_liquidar: Math.max(0, nuevoMpALiquidar) }).eq('fecha', fechaHoy)
                          }
                        } catch (uErr) {
                          console.warn('Fallback update liquidaciones falló (no crítico)', uErr)
                        }
                      }
                    } catch (errPersistD) {
                      console.warn('No se pudo persistir deltas en devoluciones (no crítico)', errPersistD)
                    }
                  } else {
                    console.warn('No se encontró liquidación HOY para aplicar ajuste ML (no crítico)', liqErr)
                  }
                } catch (mlApplyErr) {
                  console.warn('Error aplicando ajuste ML en update temprano (no crítico)', mlApplyErr)
                }

                // Recalculate in cascade and revalidate (the recalculation will now read the persisted deltas)
                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  // Recompute the intended impact date here (use client-provided fechaCompletada
                  // when present, otherwise fall back to fechaHoyActual). We recompute because
                  // the earlier fechaHoy variable was scoped inside the previous try block.
                  const fechaImpacto = (parsedPartial && (parsedPartial as any).fechaCompletada)
                    ? new Date((parsedPartial as any).fechaCompletada).toISOString().split('T')[0]
                    : fechaHoyActual
                  await recalcularLiquidacionesEnCascada(fechaImpacto)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recálculo en cascada tras ML (no crítico)', rcErr)
                }
                revalidatePath('/liquidaciones')
                revalidatePath('/eerr')
                revalidatePath('/ventas')

                // Persistar el cambio en la tabla `devoluciones` para que el estado/fecha
                // y demás campos queden guardados. En algunas instalaciones la columna
                // mp_retenido/mp_estado puede no existir, por eso aplicamos el mismo
                // patrón de retry que en otros puntos del código.
                try {
                  let updatedRow: any = null
                  try {
                    // Normalize dates and ensure fecha_completada is an ISO string when present
                    const payloadToPersist: any = toSnakeCase(parsedPartial)
                    if (payloadToPersist && payloadToPersist.fecha_completada) {
                      try { payloadToPersist.fecha_completada = new Date(payloadToPersist.fecha_completada).toISOString() } catch {}
                    }
                    const resp = await supabase.from('devoluciones').update(payloadToPersist).eq('id', id).select().single()
                    if (resp.error) throw resp.error
                    updatedRow = resp.data
                  } catch (updErr: any) {
                    const msg = String(updErr?.message ?? updErr)
                    if (updErr?.code === 'PGRST204' || msg.includes('mp_estado') || msg.includes('mp_retenido')) {
                      const safePayload: any = toSnakeCase(parsedPartial)
                      if (safePayload && safePayload.fecha_completada) {
                        try { safePayload.fecha_completada = new Date(safePayload.fecha_completada).toISOString() } catch {}
                      }
                      delete safePayload.mp_estado
                      delete safePayload.mp_retenido
                      const retry = await supabase.from('devoluciones').update(safePayload).eq('id', id).select().single()
                      if (retry.error) throw retry.error
                      updatedRow = retry.data
                    } else {
                      throw updErr
                    }
                  }
                  revalidatePath('/devoluciones')
                  return { success: true, data: updatedRow ?? parsedPartial }
                } catch (persistErr) {
                  console.warn('No se pudo persistir actualización de devolución tras ajuste ML (pero ajuste aplicado en liquidaciones):', persistErr)
                  // Devolvemos éxito parcial para no bloquear la UX; el caller debe ver el aviso.
                  return { success: true, data: parsedPartial }
                }
              } else if (metodoPago === 'PagoNube') {
                // Lógica original para Tienda Nube
                if (delta !== 0) {
                  const { data: liq, error: liqErr } = await supabase.from('liquidaciones').select('tn_a_liquidar').eq('fecha', fechaHoyActual).single()
                  if (!liqErr && liq) {
                    const currentTn = Number(liq.tn_a_liquidar ?? 0)
                    const nuevoTn = Math.max(0, currentTn - delta)
                    await supabase.from('liquidaciones').update({ tn_a_liquidar: nuevoTn }).eq('fecha', fechaHoyActual)
                    await supabase.from('devoluciones').update(toSnakeCase(parsedPartial)).eq('id', id)
                    try {
                      const envioOriginalVal = Number((parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                      const envioVueltaVal = Number((parsedPartial as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                      const envioNuevoVal = Number((parsedPartial as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                      await supabase.from('devoluciones').update({ costo_envio_original: envioOriginalVal, costo_envio_devolucion: envioVueltaVal, costo_envio_nuevo: envioNuevoVal }).eq('id', id)
                    } catch (envErrEarly) {
                      console.warn('No se pudo persistir desglose de envíos en flujo temprano de Reembolso (no crítico)', envErrEarly)
                    }
                    try {
                      const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                      await recalcularLiquidacionesEnCascada(fechaHoyActual)
                    } catch (rcErr) {
                      console.warn('No se pudo ejecutar recálculo en cascada tras Reembolso temprano (no crítico)', rcErr)
                    }
                    revalidatePath('/liquidaciones')
                    revalidatePath('/eerr')
                    revalidatePath('/ventas')
                    return { success: true, data: parsedPartial }
                  } else {
                    console.warn('No se encontró liquidación de HOY para ajustar tn_a_liquidar (no crítico)', liqErr)
                  }
                }
              }
            } catch (calcErr) {
              console.warn('No se pudo calcular montoVentaLiquidado para Reembolso (no crítico)', calcErr)
            }
          } else {
            console.warn('No se encontró venta para aplicar Reembolso temprano (no crítico)', ventaErr)
          }
        }
      }
    } catch (earlyErr) {
      console.warn('Error en flujo temprano de Reembolso (no crítico)', earlyErr)
    }

    // Auto-completar campos originales desde la venta si hace falta
    let datosVenta = null
    if (parsedPartial.ventaId) {
      datosVenta = await obtenerDatosVenta(parsedPartial.ventaId)
    }

    // Normalize existing DB row (snake_case) to camelCase expected by Zod
    const existingCamel = toCamelCase(existing)

    const mergedPre = {
      // mantener los valores actuales y sobreescribir con los campos provistos
      ...existingCamel,
      ...parsedPartial,
      // asegurar que los campos originales se completen si vienen vacíos
  costoProductoOriginal: parsedPartial.costoProductoOriginal ?? existing.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0,
  costoEnvioOriginal: parsedPartial.costoEnvioOriginal ?? existing.costoEnvioOriginal ?? datosVenta?.costoEnvioOriginal ?? 0,
  montoVentaOriginal: parsedPartial.montoVentaOriginal ?? existing.montoVentaOriginal ?? datosVenta?.montoVentaOriginal ?? 0,
  // commission removed: not persisted on devoluciones
  nombreContacto: parsedPartial.nombreContacto ?? existing.nombreContacto ?? datosVenta?.comprador ?? existing.nombreContacto,
  fechaCompra: parsedPartial.fechaCompra ?? existing.fechaCompra ?? datosVenta?.fechaCompra ?? existing.fechaCompra,
    }

    // Clean nulls and validate only provided/merged fields for update (allow partial)
    let mergedClean = stripNulls(mergedPre)
    // Normalize date-like objects to Date/string so Zod preprocess can handle them
    if (mergedClean && typeof mergedClean === 'object') {
      mergedClean.fechaCompra = normalizeDateLike(mergedClean.fechaCompra)
      mergedClean.fechaReclamo = normalizeDateLike(mergedClean.fechaReclamo)
      mergedClean.fechaCompletada = normalizeDateLike(mergedClean.fechaCompletada)
    }
  const validatedMergedPartial = devolucionSchemaBase.partial().parse(mergedClean)
  // Alias for backward-compatible references below
  const merged: any = validatedMergedPartial as any

    let updated: any = null
    try {
      const resp = await supabase
        .from('devoluciones')
        .update(toSnakeCase(validatedMergedPartial))
        .eq('id', id)
        .select()
        .single()
      if (resp.error) throw resp.error
      updated = resp.data
    } catch (updErr: any) {
      try {
        const msg = String(updErr?.message ?? updErr)
        if (updErr?.code === 'PGRST204' || msg.includes("mp_estado") || msg.includes("mp_retenido")) {
          const safePayload: any = toSnakeCase(validatedMergedPartial)
          delete safePayload.mp_estado
          delete safePayload.mp_retenido
          const retry = await supabase.from('devoluciones').update(safePayload).eq('id', id).select().single()
          if (retry.error) throw retry.error
          updated = retry.data
        } else {
          throw updErr
        }
      } catch (finalUpdErr) {
        throw finalUpdErr
      }
    }

    // Si se agregó o modificó el costo de envío de devolución, crear/actualizar
    // un registro en `gastos_ingresos` con fecha HOY para reflejar el gasto.
    try {
      const prevShipping = Number((existing as any).costo_envio_devolucion ?? 0)
      // new shipping: priorizar lo provisto en parsedPartial o en el registro actualizado
      const newShipping = Number((parsedPartial as any).costoEnvioDevolucion ?? (parsedPartial as any).costo_envio_devolucion ?? (updated as any)?.costo_envio_devolucion ?? 0)
      if (!Number.isNaN(newShipping) && newShipping !== prevShipping) {
        try {
          const { createGastoIngreso, updateGastoIngreso, getGastoIngresoById } = await import('@/lib/actions/gastos-ingresos')
          // Use merged.fechaCompletada as accounting date for the shipping gasto when available; fallback to today.
          const fechaHoy = (merged && merged.fechaCompletada) ? new Date(merged.fechaCompletada).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          const ventaRef = (updated as any)?.venta_id ?? (existing as any).venta_id ?? id
          const descripcion = `Costo envío devolución - devol ${updated?.id ?? id} - venta ${ventaRef}`
          const gastoPayload: GastoIngresoFormData = {
            fecha: new Date(fechaHoy),
            tipo: 'Gasto',
            categoria: 'Gastos del negocio - Envios devoluciones',
            descripcion,
            montoARS: newShipping,
            canal: 'General'
          }

          let gastoActual: any = null

          // Intentar usar gasto_creado_id si existe para idempotencia
          const gastoIdPersistido = (existing as any).gasto_creado_id ?? (updated as any)?.gasto_creado_id ?? null
          if (gastoIdPersistido) {
            try {
              const existingG = await getGastoIngresoById(gastoIdPersistido)
              if (existingG) {
                const upd = await updateGastoIngreso(gastoIdPersistido, gastoPayload)
                if (upd && (upd as any).success) gastoActual = (upd as any).data
              }
            } catch (idErr) {
              console.warn('No se pudo usar gasto_creado_id para actualizar gasto (continuando):', idErr)
            }
          }

          // Fallback: buscar por descripción que contenga 'devol <id>' y actualizar
          if (!gastoActual) {
            try {
              const { data: found } = await supabase
                .from('gastos_ingresos')
                .select('*')
                .ilike('descripcion', `%devol ${updated?.id ?? id}%`)
                .limit(1)
                .single()

              if (found) {
                const upd = await updateGastoIngreso(found.id, gastoPayload)
                if (upd && (upd as any).success) gastoActual = (upd as any).data
              } else {
                const createdG = await createGastoIngreso(gastoPayload)
                if (createdG && (createdG as any).success) gastoActual = (createdG as any).data
              }
            } catch (searchErr) {
              console.warn('Error buscando/creando gasto por descripción (fallback):', searchErr)
            }
          }

          if (gastoActual) {
            try {
              const gastoId = gastoActual.id ?? gastoActual
              if (gastoId) {
                await supabase.from('devoluciones').update({ gasto_creado_id: gastoId }).eq('id', updated?.id ?? id)
              }
            } catch (auditErr) {
              console.warn('No se pudo persistir gasto_creado_id tras crear/actualizar gasto (no crítico)', auditErr)
            }

            // Revalidar rutas y recálculo para que el ajuste sea efectivo hoy
            try {
              const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
              await recalcularLiquidacionesEnCascada(fechaHoy)
            } catch (rcErr) {
              console.warn('No se pudo ejecutar recálculo en cascada tras crear/actualizar gasto de envío (no crítico)', rcErr)
            }
            revalidatePath('/liquidaciones')
            revalidatePath('/eerr')
            revalidatePath('/ventas')
          }
        } catch (innerErr) {
          console.warn('Error creando/actualizando gasto de envío tras updateDevolucion (no crítico):', innerErr)
        }
      }
    } catch (errShip) {
      console.warn('Error evaluando cambio de costo_envio_devolucion (no crítico):', errShip)
    }

    // Fallback explicit persistence: ensure numero_devolucion and numero_seguimiento are stored
    // Some DB schemas or PostgREST caches can ignore/rename fields; write them explicitly if provided.
    try {
      const explicitFields: any = {}
      if (typeof (parsedPartial as any).numeroDevolucion !== 'undefined') explicitFields.id_devolucion = (parsedPartial as any).numeroDevolucion
      if (typeof (parsedPartial as any).numeroSeguimiento !== 'undefined') explicitFields.numero_seguimiento = (parsedPartial as any).numeroSeguimiento
      if (Object.keys(explicitFields).length > 0) {
        try {
          await supabase.from('devoluciones').update(explicitFields).eq('id', id)
        } catch (expErr: any) {
          const msg = String(expErr?.message ?? expErr)
          if (expErr?.code === 'PGRST204' || msg.includes('mp_estado') || msg.includes('mp_retenido')) {
            const safeExplicit = { ...explicitFields }
            delete (safeExplicit as any).mp_estado
            delete (safeExplicit as any).mp_retenido
            await supabase.from('devoluciones').update(safeExplicit).eq('id', id)
          } else {
            throw expErr
          }
        }
      }
    } catch (persistNumErr) {
      console.warn('No se pudo persistir explícitamente numeroDevolucion/numeroSeguimiento (no crítico):', persistNumErr)
    }

    // Nota: aquí podríamos disparar lógica de cascada para stock/contabilidad
    // cuando haya cambios significativos (estado final, cambio de producto, etc.).
    // Por ahora revalidamos la ruta y devolvemos el registro actualizado.
    revalidatePath("/devoluciones")

    // Aplicar ajustes contables SOLO cuando la devolución se finaliza (etapa final)
    // Se distinguen dos casos: Reembolso y Cambio. Create() NO aplica ajustes.
    try {
  const prevTipo = (existing as any).tipoResolucion ?? (existing as any).tipo_resolucion ?? null
  const newTipo = merged.tipoResolucion ?? (merged as any).tipo_resolucion ?? null
      const prevEstado = existing.estado ?? null
      const newEstado = merged.estado ?? null

      const wasFinalBefore = !!(prevTipo === 'Reembolso' || (typeof prevEstado === 'string' && (String(prevEstado).includes('Reembolso') || String(prevEstado).includes('Cambio'))))
      const isFinalNow = !!(newTipo === 'Reembolso' || newTipo?.startsWith('Cambio') || (typeof newEstado === 'string' && (String(newEstado).includes('Reembolso') || String(newEstado).includes('Cambio'))))

      // Obtener venta original si necesitamos aplicar ajustes
      if (isFinalNow) {
        // SERVER-SIDE GUARD: require fechaCompletada when finalizing; the client already enforces this but
        // validate on the server as well to avoid surprises from direct API calls.
  const fechaCompletadaProvided = !!(merged.fechaCompletada || (merged as any).fecha_completada)
        if (!fechaCompletadaProvided) {
          console.warn('Finalización sin fechaCompletada detectada; cancelando ajustes contables')
          // We intentionally don't throw to avoid breaking the update, but we don't apply accounting.
          revalidatePath('/devoluciones')
          return { success: true, data: updated }
        }
        const { data: venta, error: ventaError } = await supabase
          .from('ventas')
          .select('*, producto:productos(*)')
          .eq('id', merged.ventaId)
          .single()

        if (!venta || ventaError) {
          console.warn('No se encontró venta para aplicar ajuste de devolución (update)', ventaError)
        } else {
          // Persistir siempre el desglose de envíos al finalizar la devolución
          // para que la columna generada `perdida_total` incluya envío ida + vuelta.
          try {
            const envioOriginalFromVenta = (venta as any)?.costoEnvio ?? (venta as any)?.costo_envio ?? null
            const envioOriginal = Number((merged as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? (datosVenta as any)?.costoEnvioOriginal ?? envioOriginalFromVenta ?? 0)
            const envioVuelta = Number((merged as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? (datosVenta as any)?.costoEnvioDevolucion ?? 0)
            const envioNuevo = Number((merged as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
            await supabase.from('devoluciones').update({ costo_envio_original: envioOriginal, costo_envio_devolucion: envioVuelta, costo_envio_nuevo: envioNuevo }).eq('id', updated?.id ?? (merged as any).id)
          } catch (envPersistErr) {
            console.warn('No se pudo persistir desglose de envíos al finalizar (no crítico)', envPersistErr)
          }
          // Si es Reembolso -> aplicar monto reembolsado hoy (o diferencia)
          const becameReembolso = (newTipo === 'Reembolso' || (typeof newEstado === 'string' && String(newEstado).includes('Reembolso')))
          const wasReembolso = (prevTipo === 'Reembolso' || (typeof prevEstado === 'string' && String(prevEstado).includes('Reembolso')))

          // Preferir el monto que la venta realmente aportó a las liquidaciones.
          // Si el usuario no completó montoReembolsado, calculamos el monto a partir de la venta
          const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
          const montoVentaLiquidado = await calcularMontoVentaALiquidar(venta as any)

          const prevMonto = Number(existing.montoReembolsado ?? existing.montoVentaOriginal ?? 0)
          let newMonto = Number(merged.montoReembolsado ?? merged.montoVentaOriginal ?? 0)
          // Si no hay monto manual, usar el monto que efectivamente se liquidó para esa venta
          if ((!merged.montoReembolsado || Number(merged.montoReembolsado) === 0) && montoVentaLiquidado) {
            newMonto = montoVentaLiquidado
            // Persistir el monto calculado como montoReembolsado para trazabilidad
            try {
              await supabase.from('devoluciones').update({ montoReembolsado: newMonto }).eq('id', id)
            } catch (err) {
              console.warn('No se pudo persistir montoReembolsado calculado en devolución (no crítico)', err)
            }
          }
          const diffMonto = newMonto - prevMonto

          // Si es Cambio -> nos ocupamos solo de los costos de envío de devolución (hoy)
          const becameCambio = (newTipo && String(newTipo).includes('Cambio')) || (typeof newEstado === 'string' && String(newEstado).includes('Cambio'))
          const wasCambio = (prevTipo && String(prevTipo).includes('Cambio')) || (typeof prevEstado === 'string' && String(prevEstado).includes('Cambio'))

          // Calcular diferencia de costo de envío de devolución
          const prevShipping = Number(existing.costoEnvioDevolucion ?? 0)
          const newShipping = Number(merged.costoEnvioDevolucion ?? 0)
          const diffShipping = newShipping - prevShipping

          // Determinar ajustes a aplicar HOY
          let ajusteHoy = 0
          let aplicarRecalculo = false

          if (becameReembolso || wasReembolso) {
            // Ajuste monetario: aplicar diferencia entre montos (o monto total si se convirtió ahora)
            ajusteHoy = diffMonto !== 0 ? diffMonto : (becameReembolso && !wasReembolso ? newMonto : 0)
            aplicarRecalculo = ajusteHoy !== 0
          } else if (becameCambio || wasCambio) {
            // Para cambio, solo aplicar el costo de envío de devolución (diferencia o monto nuevo si se convirtió ahora)
            ajusteHoy = diffShipping !== 0 ? diffShipping : (becameCambio && !wasCambio ? newShipping : 0)
            aplicarRecalculo = ajusteHoy !== 0
          }

          // Marcar venta como devuelta si se convirtió en reembolso
          if (becameReembolso) {
            await supabase.from('ventas').update({ estadoEnvio: 'Devuelto' }).eq('id', venta.id)
          }

          if (ajusteHoy !== 0) {
                // Ensure we persist envio breakdown and total on finalization
                try {
                  const envioOriginal = Number(merged.costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                  const envioVuelta = Number(merged.costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                  const envioNuevo = Number(merged.costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                  const envioTotal = envioOriginal + envioVuelta + envioNuevo
                  await supabase.from('devoluciones').update({ costo_envio_original: envioOriginal, costo_envio_devolucion: envioVuelta, costo_envio_nuevo: envioNuevo }).eq('id', updated?.id ?? (merged as any).id)
                } catch (envErr) {
                  console.warn('No se pudo persistir desglose de envíos en devoluciones (no crítico)', envErr)
                }

                // Use merged.fechaCompletada as accounting date if provided
                const fechaHoy = (merged.fechaCompletada && new Date(merged.fechaCompletada).toISOString().split('T')[0]) || new Date().toISOString().split('T')[0]
            const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
            await asegurarLiquidacionParaFecha(fechaHoy)
                  const { data: liquidacionHoy, error: errorHoy } = await supabase
                    .from('liquidaciones')
                    .select('*')
                    .eq('fecha', fechaHoy)
                    .single()

                  if (errorHoy || !liquidacionHoy) {
                    console.warn('No se encontró liquidación de hoy para aplicar ajuste de devolución (update)', errorHoy)
                  } else {
                    // En lugar de actualizar liquidaciones directamente, crear o actualizar un gasto/ingreso
                    // idempotente: preferir gasto_creado_id si existe, sino buscar por descripción
                    try {
                      const { createGastoIngreso, updateGastoIngreso, getGastoIngresoById } = await import('@/lib/actions/gastos-ingresos')

                      // Use merged.fechaCompletada if provided as accounting-impact date; fallback to today
                      const impactoFecha = (merged.fechaCompletada && new Date(merged.fechaCompletada).toISOString().split('T')[0]) || fechaHoy

                      const metodoPago = venta.metodoPago || venta.metodo || null
                      const canal = metodoPago === 'MercadoPago' ? 'ML' : metodoPago === 'PagoNube' ? 'TN' : 'General'
                      const ventaRef = (venta as any)?.saleCode ?? (venta as any)?.externalOrderId ?? venta.id
                      const descripcion = `Ajuste devolución - venta ${ventaRef} - devol ${updated?.id ?? (merged as any).id ?? 'unknown'}`

                      // Build payload
                      const gastoPayload = {
                        fecha: new Date(impactoFecha),
                        tipo: 'Gasto' as const,
                        categoria: 'Gastos del negocio - Envios devoluciones',
                        descripcion,
                        montoARS: ajusteHoy,
                        canal: canal as any
                      } as unknown as GastoIngresoFormData

                      let gastoActual: any = null

                      // Try persisted gasto_creado_id first (existing DB column may or may not exist)
                      try {
                        const gastoIdPersistido = (merged as any).gasto_creado_id || (existing as any).gasto_creado_id || null
                        if (gastoIdPersistido) {
                          const existingGasto = await getGastoIngresoById(gastoIdPersistido)
                          if (existingGasto) {
                            const upd = await updateGastoIngreso(gastoIdPersistido, gastoPayload)
                            if (upd && upd.success) gastoActual = upd.data
                          }
                        }
                      } catch (idErr) {
                        console.warn('No se pudo usar gasto_creado_id para idempotencia (continuando con fallback):', idErr)
                      }

                      // Fallback: buscar por descripción que contenga 'devol <id>'
                      if (!gastoActual) {
                        try {
                          const { data: found } = await supabase
                            .from('gastos_ingresos')
                            .select('*')
                            .ilike('descripcion', `%devol ${updated?.id ?? (merged as any).id ?? ''}%`)
                            .limit(1)
                            .single()

                          if (found) {
                            const upd = await updateGastoIngreso(found.id, gastoPayload)
                            if (upd && upd.success) gastoActual = upd.data
                          } else {
                            const createdG = await createGastoIngreso(gastoPayload)
                            if (createdG && createdG.success) gastoActual = createdG.data
                          }
                        } catch (searchErr) {
                          console.warn('Error buscando/creando gasto por descripción (fallback):', searchErr)
                        }
                      }

                          // Persist only gasto_creado_id for idempotency; do not write monto_aplicado_liquidacion.
                          if (gastoActual) {
                            try {
                              await supabase.from('devoluciones').update({ gasto_creado_id: gastoActual.id ?? gastoActual }).eq('id', updated?.id ?? (merged as any).id)
                            } catch (auditErr) {
                              console.warn('No se pudo persistir gasto_creado_id en devoluciones (no crítico)', auditErr)
                            }

                        // Si la venta fue por Pago Nube, ajustar TN a liquidar EN HOY
                        try {
                          // Use previously stored monto_reembolsado as the baseline for delta calculation
                          const prevApplied = Number((existing as any).monto_reembolsado ?? 0)
                          const deltaToApply = Number(ajusteHoy) - prevApplied
                          if (deltaToApply !== 0 && (venta as any)?.metodoPago === 'PagoNube') {
                            // Aplicar la diferencia en la liquidación de HOY (no la fecha de impacto contable)
                            const fechaHoyActual = new Date().toISOString().split('T')[0]
                            const { data: liq, error: liqErr } = await supabase.from('liquidaciones').select('tn_a_liquidar').eq('fecha', fechaHoyActual).single()
                            if (!liqErr && liq) {
                              const currentTn = Number(liq.tn_a_liquidar ?? 0)
                              const nuevoTn = Math.max(0, currentTn - deltaToApply)
                              try {
                                await supabase.from('liquidaciones').update({ tn_a_liquidar: nuevoTn }).eq('fecha', fechaHoyActual)
                                // Recalcular en cascada para propagar efectos
                                await recalcularLiquidacionesEnCascada(fechaHoyActual)
                              } catch (tnErr) {
                                console.warn('No se pudo ajustar tn_a_liquidar en liquidación HOY (no crítico)', tnErr)
                              }
                            } else {
                              console.warn('No se pudo obtener liquidación de HOY para ajustar tn_a_liquidar (no crítico)', liqErr)
                            }
                          }
                        } catch (tnApplyErr) {
                          console.warn('Error aplicando ajuste TN a liquidar para Pago Nube (no crítico)', tnApplyErr)
                        }

                        revalidatePath('/liquidaciones')
                        revalidatePath('/eerr')
                        revalidatePath('/ventas')
                        // If this finalization is a Reembolso and this devolución was marked to
                        // move money to mp_retenido, decrement mp_retenido by the refunded amount
                        try {
                          const mpMarked = (merged as any).mpRetener ?? (merged as any).mp_retenido ?? (existing as any).mp_retenido ?? false
                          if (becameReembolso && mpMarked) {
                            try {
                              const montoToRemove = Number(newMonto ?? 0)
                              const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
                              await asegurarLiquidacionParaFecha(impactoFecha)
                              const { data: liqForImpact, error: liqForImpactErr } = await supabase.from('liquidaciones').select('*').eq('fecha', impactoFecha).single()
                              if (!liqForImpactErr && liqForImpact) {
                                const currentRet = Number((liqForImpact as any).mp_retenido ?? 0)
                                const nuevoRet = Math.max(0, currentRet - montoToRemove)
                                try {
                                  await supabase.from('liquidaciones').update({ mp_retenido: nuevoRet }).eq('fecha', impactoFecha)
                                  // Recalculate cascade to propagate totals
                                  await recalcularLiquidacionesEnCascada(impactoFecha)
                                  revalidatePath('/liquidaciones')
                                  revalidatePath('/eerr')
                                } catch (errRet) {
                                  console.warn('No se pudo decrementar mp_retenido al finalizar Reembolso (no crítico)', errRet)
                                }
                              } else {
                                console.warn('No se encontró liquidación para decrementar mp_retenido tras Reembolso (no crítico)', liqForImpactErr)
                              }
                            } catch (errInner) {
                              console.warn('Error al procesar decremento de mp_retenido al finalizar Reembolso (no crítico)', errInner)
                            }
                          }
                        } catch (errMpMark) {
                          console.warn('Error verificando mpRetener en finalización (no crítico)', errMpMark)
                        }
                      } else {
                        console.error('No se pudo crear/actualizar gasto_ingreso para devolución (update)')
                      }
              
                    // Si la devolución ahora está finalizada y el producto no es recuperable,
                    // persistir el costo del producto como pérdida en la devolución (solo ahora).
                    try {
                      const fueFinalizada = isFinalNow
                      const productoRecuperableFlag = (merged as any).productoRecuperable ?? (merged as any).producto_recuperable ?? (existing as any).producto_recuperable
                      const costoProducto = Number(merged.costoProductoOriginal ?? (merged as any).costo_producto_original ?? 0)
                      if (fueFinalizada && productoRecuperableFlag === false && costoProducto > 0) {
                        // Persistir costo de producto como pérdida (columna costo_producto_perdido o update directo)
                        // La migración DB debería tener una columna que permita almacenar este valor; si no existe, el try/catch evita fallos.
                        try {
                // Persistir pérdida como suma del costo del producto + envíos (ida + vuelta + nuevo)
                const envioOriginalVal = Number((merged as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                const envioVueltaVal = Number((merged as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                const envioNuevoVal = Number((merged as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                const perdidaCalculada = Number(costoProducto) + envioOriginalVal + envioVueltaVal + envioNuevoVal
                await supabase.from('devoluciones').update({ costo_producto_perdido: perdidaCalculada }).eq('id', updated?.id ?? (merged as any).id)
                          // Revalidar EERR para que la pérdida aparezca en reportes
                          revalidatePath('/eerr')
                        } catch (lossErr) {
                          console.warn('No se pudo persistir costo_producto_perdido en devoluciones (no crítico)', lossErr)
                        }
                      }
                    } catch (errLoss) {
                      console.warn('Error al evaluar persistencia de pérdida de producto tras finalización (no crítico)', errLoss)
                    }
                    } catch (errCreateG) {
                      console.error('Error creando/actualizando gasto/ingreso para devolución (update):', errCreateG)
                    }
                  }

                // Comisiones recuperadas se manejan solo en EERR (no creamos/actualizamos gastos/ingresos aquí)
          }
        }
      }
    } catch (err) {
      console.error('Error aplicando ajuste contable tras actualizar devolución:', err)
    }
    // For debugging/consistency: fetch the latest row from DB and return it so the caller
    // receives the persisted values (helps detect when certain columns were not actually written).
    try {
      const { data: refreshed, error: refreshErr } = await supabase.from('devoluciones').select('*').eq('id', id).single()
      if (!refreshErr && refreshed) updated = refreshed
    } catch (refreshFetchErr) {
      console.warn('No se pudo refrescar devolución tras update (no crítico):', refreshFetchErr)
    }
    return { success: true, data: updated }
  } catch (error) {
    console.error("Error al actualizar devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar devolución" }
  }
}

// Eliminar devolución
export async function deleteDevolucion(id: string) {
  try {
    const { data: deleted, error } = await supabase
      .from('devoluciones')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // After deleting a devolución we must recalculate liquidaciones for the
    // date that was impacted by that devolución. Prefer `fecha_completada` (si
    // existía), luego `created_at` y como fallback usar hoy.
    try {
      const fechaImpactRaw = (deleted as any)?.fecha_completada ?? (deleted as any)?.created_at ?? null
      const fechaImpact = fechaImpactRaw ? new Date(fechaImpactRaw).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      try {
        const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
        await recalcularLiquidacionesEnCascada(fechaImpact)
      } catch (rcErr) {
        console.warn('No se pudo ejecutar recálculo en cascada tras eliminar devolución (no crítico)', rcErr)
      }
    } catch (dateErr) {
      console.warn('No se pudo determinar fecha de impacto tras eliminar devolución (no crítico)', dateErr)
    }

    revalidatePath("/devoluciones")
    revalidatePath('/liquidaciones')
    revalidatePath('/eerr')
    return { success: true, data: deleted }
  } catch (error) {
    console.error("Error al eliminar devolución:", error)
    return { success: false, error: "Error al eliminar devolución" }
  }
}

// Obtener devolución por ID desde la vista
export async function getDevolucionById(id: string) {
  try {
    const { data, error } = await supabase
      .from('devoluciones_resumen')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    // Normalize to camelCase and provide compatibility aliases so UI can rely on the same keys
    try {
      const cam: any = toCamelCase(data)
      cam.numeroDevolucion = cam.numeroDevolucion ?? cam.idDevolucion ?? cam.id_devolucion ?? cam.id ?? undefined
      cam.numeroSeguimiento = cam.numeroSeguimiento ?? cam.numero_seguimiento ?? undefined
      // Normalize date fields to ISO strings
      const toIso = (v: any) => {
        if (v === null || typeof v === 'undefined') return null
        if (v instanceof Date) return v.toISOString()
        if (typeof v === 'string') {
          const spaceDateMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(v)
          const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(v)
          let candidate = v
          if (spaceDateMatch) candidate = v.replace(' ', 'T') + 'Z'
          else if (dateOnlyMatch) candidate = v + 'T00:00:00Z'
          const parsed = new Date(candidate)
          return isNaN(parsed.getTime()) ? null : parsed.toISOString()
        }
        const parsed = new Date(v as any)
        return isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }
      try {
        cam.fechaCompra = toIso(cam.fechaCompra ?? cam.fecha_compra)
        cam.fechaReclamo = toIso(cam.fechaReclamo ?? cam.fecha_reclamo)
        cam.fechaCompletada = toIso(cam.fechaCompletada ?? cam.fecha_completada)
      } catch (_) {}
      // Single display name for UI
      cam.displayName = cam.comprador ?? cam.nombreContacto ?? cam.saleCode ?? null
      return cam
    } catch (normErr) {
      console.warn('getDevolucionById: normalization failed, returning raw row', normErr)
      return data
    }
  } catch (error) {
    console.error("Error al obtener devolución:", error)
    throw new Error("Error al obtener devolución")
  }
}

// Buscar ventas para el selector
export async function buscarVentas(query: string) {
  try {
    if (!query || !query.trim()) return []

    // sanitize query to avoid injection into the or() string
  const q = String(query).replace(/[%']/g, '').trim()
    if (!q) return []

  // If query looks like an id (uuid-like or numeric), try direct eq first for speed
  const isProbablyId = /^[0-9a-fA-F-]{4,}$/.test(q)

  const orClause = `saleCode.ilike.%${q}%,externalOrderId.ilike.%${q}%,comprador.ilike.%${q}%`

    // Build base query
    let qb = supabase
      .from('ventas')
      .select('*, productos(*)')
      .or(orClause)
      .limit(10)

    // Try to order by createdAt if present; if DB rejects it we'll still return results
    try {
      qb = (qb as any).order ? (qb as any).order('createdAt', { ascending: false }) : qb
    } catch (orderErr) {
      // ignore order errors (column might be named differently)
      console.warn('buscarVentas: no se pudo ordenar por createdAt, continuando sin order', orderErr)
    }

    let data: any = []
    let error: any = null
    if (isProbablyId) {
      // Try direct id match first
      const { data: byId, error: errById } = await supabase.from('ventas').select('*, productos(*)').eq('id', q).limit(1)
      if (!errById && byId && byId.length > 0) {
        return byId
      }
      // Fall back to general query
    }

    const resp = await qb
    data = resp.data
    error = resp.error

    // Debugging: log query and returned rows count to server console
    try {
      console.debug('buscarVentas: query=', q, 'rows=', Array.isArray(data) ? data.length : 0)
    } catch (dbg) {}
    if (error) {
      console.error("Error al buscar ventas (supabase):", error)
      return []
    }
    // Normalize rows to ensure frontend fields exist
    const normalized = (data || []).map((row: any) => {
      // try common date fields
      const fecha = row.fecha ?? row.fechaCompra ?? row.fecha_compra ?? row.createdAt ?? row.created_at ?? row.date ?? null
      return {
        id: row.id,
        saleCode: row.saleCode ?? row.codigo_venta ?? row.externalOrderId ?? row.external_order_id ?? row.external_id ?? row.sale_code ?? '',
        comprador: row.comprador ?? row.buyer_name ?? row.cliente ?? row.customer_name ?? '',
        pvBruto: Number(row.pvBruto ?? row.pv_bruto ?? row.montoTotal ?? row.monto_total ?? row.pv_bruto) || 0,
        producto: row.productos ? (Array.isArray(row.productos) ? row.productos[0] : row.productos) : (row.producto || { modelo: '' }),
        fecha: fecha,
        // include raw row for any additional fields
        _raw: row,
      }
    })
    return normalized
  } catch (error) {
    console.error("Error al buscar ventas:", error)
    return []
  }
}

// Obtener estadísticas para reportes
export async function getEstadisticasDevoluciones(fechaInicio?: string, fechaFin?: string) {
  try {
    let query = supabase
      .from('devoluciones_resumen')
      .select('*')

    if (fechaInicio) {
      query = query.gte('fecha_reclamo', fechaInicio)
    }
    if (fechaFin) {
      query = query.lte('fecha_reclamo', fechaFin)
    }

    const { data: devoluciones, error } = await query

    if (error) throw error

    // Calcular estadísticas
    const total = devoluciones?.length || 0
    
    const porEstado = devoluciones?.reduce((acc, dev) => {
      acc[dev.estado] = (acc[dev.estado] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const porPlataforma = devoluciones?.reduce((acc, dev) => {
      acc[dev.plataforma] = (acc[dev.plataforma] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const porTipoResolucion = devoluciones?.reduce((acc, dev) => {
      if (dev.tipo_resolucion) {
        acc[dev.tipo_resolucion] = (acc[dev.tipo_resolucion] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>) || {}

    const perdidaTotal = devoluciones?.reduce((sum, dev) => sum + (dev.perdida_total || 0), 0) || 0
    const impactoVentasNetas = devoluciones?.reduce((sum, dev) => sum + (dev.impacto_ventas_netas || 0), 0) || 0

    // Top motivos
    const motivosCount = devoluciones?.reduce((acc, dev) => {
      acc[dev.motivo] = (acc[dev.motivo] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const topMotivos = Object.entries(motivosCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([motivo, count]) => ({ motivo, count: count as number }))

    // Promedio de pérdida
    const devolucionesConPerdida = devoluciones?.filter(d => (d.perdida_total || 0) > 0) || []
    const perdidaPromedio = devolucionesConPerdida.length > 0
      ? perdidaTotal / devolucionesConPerdida.length
      : 0

    // Obtener conteo de ventas en el rango proporcionado (si aplica) para mostrar % devoluciones sobre ventas
    let totalVentas = 0
    try {
      // Preferir filtrar por 'fecha' en ventas; si falla, caer a 'created_at'
      let ventasQuery: any = supabase.from('ventas').select('id', { count: 'exact', head: true })
      if (fechaInicio) {
        try { ventasQuery = ventasQuery.gte('fecha', fechaInicio) } catch { ventasQuery = ventasQuery.gte('created_at', fechaInicio) }
      }
      if (fechaFin) {
        try { ventasQuery = ventasQuery.lte('fecha', fechaFin) } catch { ventasQuery = ventasQuery.lte('created_at', fechaFin) }
      }
      const ventasResp = await ventasQuery
      totalVentas = Number(ventasResp?.count ?? 0)
    } catch (errVentas) {
      console.warn('No se pudo obtener conteo de ventas para estadisticas de devoluciones (no crítico)', errVentas)
      totalVentas = 0
    }

    return {
      total,
      porEstado,
      porPlataforma,
      porTipoResolucion,
      perdidaTotal,
      impactoVentasNetas,
      topMotivos,
      perdidaPromedio,
      devolucionesConPerdida: devolucionesConPerdida.length,
      data: devoluciones || [],
      totalVentas
    }
  } catch (error) {
    console.error("Error al obtener estadísticas:", error)
    throw new Error("Error al obtener estadísticas de devoluciones")
  }
}
