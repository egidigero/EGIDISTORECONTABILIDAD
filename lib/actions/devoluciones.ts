"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { devolucionSchema, devolucionSchemaBase, devolucionSchemaWithRecoveryCheck, type DevolucionFormData, type GastoIngresoFormData } from "@/lib/validations"
import { eliminarVentaDeLiquidacion } from "@/lib/actions/actualizar-liquidacion"
import { recalcularLiquidacionesEnCascada } from "@/lib/actions/recalcular-liquidaciones"
import { calcularPerdidaTotalAjustada } from "@/lib/devoluciones-loss"

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
    fechaRecepcion: 'fecha_recepcion',
    fechaPrueba: 'fecha_prueba',
    ubicacionProducto: 'ubicacion_producto',
    resultadoPrueba: 'resultado_prueba',
    observacionesPrueba: 'observaciones_prueba',
    productoRecuperable: 'producto_recuperable',
    numeroSeguimiento: 'numero_seguimiento',
    numeroDevolucionGenerado: 'id_devolucion'
  ,
  // MP/ML flags persisted from the UI
  mpEstado: 'mp_estado',
  mpRetener: 'mp_retenido',
  fueReclamo: 'fue_reclamo',
  // Campos que NO se deben guardar en DB (solo en memoria)
  fechaAccion: '__SKIP__'
  }
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key]
    const snake = mapping[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase()
    // Filtrar campos marcados como __SKIP__
    if (snake === '__SKIP__') continue
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
  if (obj instanceof Date) return obj
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

async function enrichDevolucionesConFueReclamo(rows: any[]): Promise<any[]> {
  const safeRows = Array.isArray(rows) ? rows : []
  if (safeRows.length === 0) return safeRows

  try {
    const ids = safeRows.map((row: any) => row?.id).filter(Boolean)
    if (ids.length === 0) return safeRows

    const { data: flags, error } = await supabase
      .from('devoluciones')
      .select('id,fue_reclamo,venta_id')
      .in('id', ids)

    if (error || !Array.isArray(flags) || flags.length === 0) return safeRows

    const byId = new Map<string, any>()
    for (const flag of flags) byId.set(String((flag as any).id), flag)

    return safeRows.map((row: any) => ({
      ...row,
      fue_reclamo: byId.has(String(row?.id)) ? byId.get(String(row?.id))?.fue_reclamo : row?.fue_reclamo,
      venta_id: byId.has(String(row?.id)) ? (byId.get(String(row?.id))?.venta_id ?? row?.venta_id) : row?.venta_id,
    }))
  } catch (err) {
    console.warn('No se pudo enriquecer devoluciones con fue_reclamo (no critico)', err)
    return safeRows
  }
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

// Listar devoluciones desde la vista con cÃ¡lculos automÃ¡ticos
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
    let rows = await enrichDevolucionesConFueReclamo(Array.isArray(data) ? data : [])
    // Normalize rows to camelCase so front-end receives stable keys
    try {
      return rows
        // Excluir devoluciones 'Sin reembolso' de estados en camino y finalizados
        .filter(d => {
          const sinReembolso = d.tipo_resolucion === 'Sin reembolso' || (d.tipoResolucion && d.tipoResolucion === 'Sin reembolso');
          if (!sinReembolso) return true; // Si no es sin reembolso, incluir siempre
          
          // Si es sin reembolso, excluir si estÃ¡:
          // 1. Finalizada o Entregada
          const finalizada = d.estado === 'Entregada' || d.estado === 'Finalizada';
          // 2. En camino (Pendiente/En devolución/Aceptada en camino sin fecha de recepción)
          const enCamino = (d.estado === 'Pendiente' || d.estado === 'En devolución' || d.estado === 'Aceptada en camino') && !d.fecha_recepcion && !d.fechaRecepcion;
          
          return !(finalizada || enCamino);
        })
        .map(d => {
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
            cam.fechaRecepcion = toIso(cam.fechaRecepcion ?? cam.fecha_recepcion)
            cam.fechaPrueba = toIso(cam.fechaPrueba ?? cam.fecha_prueba)
          } catch (dateErr) {
            // swallow â€” we'll leave original values if normalization fails
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
      return rows
    }
  } catch (error) {
    console.error("Error al obtener devoluciones:", error)
    throw new Error("Error al obtener devoluciones")
  }
}

// Crear devoluciÃ³n con auto-completado de datos financieros
export async function createDevolucion(data: DevolucionFormData) {
  try {
    // Validar que la venta no tenga ya una devoluciÃ³n activa
    if (data.ventaId) {
      const { data: devolucionExistente, error: checkError } = await supabase
        .from('devoluciones')
        .select('id, id_devolucion')
        .eq('venta_id', data.ventaId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (OK), cualquier otro error es problema
        throw checkError
      }

      if (devolucionExistente) {
        const numDev = devolucionExistente.id_devolucion || devolucionExistente.id
        return {
          success: false,
          error: `Esta venta ya tiene una devoluciÃ³n registrada (${numDev}). EliminÃ¡ la devoluciÃ³n existente si querÃ©s crear una nueva.`
        }
      }
    }

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
      // (la migraciÃ³n y datos pueden resolverse manualmente despuÃ©s)
      // No retornamos error aquÃ­ para no bloquear el flujo de registro del informe.
      console.warn('createDevolucion: no se pudo obtener datos de venta, creando informe sin autocompletado')
    }

    // Si no se proporcionÃ³ nÃºmero de devoluciÃ³n, generar uno (aunque la DB tambiÃ©n tiene trigger)
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
    // If this is a provisional informe (no resoluciÃ³n/estado final),
    // don't persist product costs or monto_reembolsado yet. This avoids
    // que la columna generada `perdida_total` muestre la pÃ©rdida de producto
    // antes de que la devolución sea finalizada.
    const isProvisional = (devolucionCompleta.estado === 'En devolución' || !devolucionCompleta.tipoResolucion)
    const plataformaCreacion = (validatedData as any).plataforma ?? datosVenta?.plataforma ?? 'TN'
    const esSinReembolsoCreacion =
      devolucionCompleta.tipoResolucion === 'Sin reembolso' ||
      (typeof devolucionCompleta.estado === 'string' && devolucionCompleta.estado.includes('Sin reembolso'))
    const fueReclamoCreacion = (devolucionCompleta as any).fueReclamo ?? (devolucionCompleta as any).fue_reclamo
    const esMLSinReclamoCreacion = plataformaCreacion === 'ML' && fueReclamoCreacion === false
    const costoEnvioOriginalCreacion =
      esSinReembolsoCreacion || esMLSinReclamoCreacion
        ? 0
        : Number(devolucionCompleta.costoEnvioOriginal ?? 0)
    const costoEnvioDevolucionCreacion = esSinReembolsoCreacion || esMLSinReclamoCreacion
      ? 0
      : Number(devolucionCompleta.costoEnvioDevolucion ?? 0)
    const costoEnvioNuevoCreacion = esSinReembolsoCreacion || esMLSinReclamoCreacion
      ? 0
      : Number(devolucionCompleta.costoEnvioNuevo ?? 0)

    const dbRow: any = {
      venta_id: devolucionCompleta.ventaId,
      producto_nuevo_id: devolucionCompleta.productoNuevoId ?? null,
      id_devolucion: devolucionCompleta.numeroDevolucion,
      fecha_compra: devolucionCompleta.fechaCompra,
      fecha_reclamo: devolucionCompleta.fechaReclamo,
      // fecha_completada NO se guarda - solo se usa para ejecutar acciones
      nombre_contacto: devolucionCompleta.nombreContacto ?? null,
      telefono_contacto: devolucionCompleta.telefonoContacto ?? null,
  // Persistir nÃºmero de seguimiento si el cliente lo proveyÃ³
  numero_seguimiento: devolucionCompleta.numeroSeguimiento ?? null,
      motivo: devolucionCompleta.motivo,
  // plataforma is NOT NULL in the DB; if we couldn't fetch it from the venta or the form,
  // default to 'TN' (Tienda Nube) to avoid DB constraint violation. Adjust as needed.
  plataforma: plataformaCreacion,
      estado: devolucionCompleta.estado ?? 'En devolución',
      tipo_resolucion: devolucionCompleta.tipoResolucion ?? null,
  // Persistir costo de producto ORIGINAL siempre (para trazabilidad),
  // pero no persistir como pÃ©rdida hasta la finalizaciÃ³n.
  costo_producto_original: Number(devolucionCompleta.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0),
  // El costo de producto nuevo y la bandera de recuperabilidad solo se aplican
  // cuando la devoluciÃ³n se finaliza (o se proveen explÃ­citamente).
  costo_producto_nuevo: isProvisional ? 0 : Number(devolucionCompleta.costoProductoNuevo ?? 0),
  producto_recuperable: isProvisional
    ? false
    : Boolean((devolucionCompleta as any).productoRecuperable ?? (esSinReembolsoCreacion ? true : false)),
      costo_envio_original: costoEnvioOriginalCreacion,
      costo_envio_devolucion: costoEnvioDevolucionCreacion,
  costo_envio_nuevo: costoEnvioNuevoCreacion,
  // total_costos_envio is a GENERATED column in the DB (calculated from the three envio columns).
  // Do not attempt to insert/update it explicitly; the DB computes it automatically.
      monto_venta_original: Number(devolucionCompleta.montoVentaOriginal ?? 0),
      // No persistir montoReembolsado en informes provisionales
      monto_reembolsado: isProvisional || esSinReembolsoCreacion ? 0 : Number(devolucionCompleta.montoReembolsado ?? 0),
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

  // Aplicar ajuste contable inmediato para el costo de envÃ­o de devoluciÃ³n:
  // El negocio requiere que al registrar el informe se reste el costo de envÃ­o
  // de la disponibilidad de MercadoPago en la fecha indicada por `fechaReclamo`.
    try {
  // Solo aplicar en la liquidaciÃ³n de hoy el costo de envÃ­o de vuelta (devoluciÃ³n).
  // El costo de ida ya fue aplicado en su momento cuando se registrÃ³ la venta.
  const costoEnvioDevolucion = Number(validatedData.costoEnvioDevolucion ?? 0)
  const costoEnvio = costoEnvioDevolucion
      if (costoEnvio && costoEnvio > 0) {
        // Use fecha_reclamo for creation - when the shipping cost was incurred
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
          // en gastos_ingresos con categoria 'DevoluciÃ³n' para que aparezca en el detalle
          // y reutilizar la lÃ³gica existente de recÃ¡lculo.
          try {
            const { createGastoIngreso } = await import('@/lib/actions/gastos-ingresos')
            // Construir descripciÃ³n usando datos de la venta si estÃ¡n disponibles
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
            const descripcion = `Costo de envÃ­o devoluciÃ³n ${ventaRef}`
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

              // Intentar persistir tambiÃ©n el id del gasto creado para idempotencia futura
              try {
                const gastoId = gastoRes.data?.id ?? gastoRes.data?.[0]?.id ?? gastoRes.data
                if (gastoId) {
                  await supabase.from('devoluciones').update({ gasto_creado_id: gastoId }).eq('id', created.id)
                }
              } catch (auditErr2) {
                console.warn('No se pudo persistir gasto_creado_id en creaciÃ³n (no crÃ­tico)', auditErr2)
              }

              // createGastoIngreso ya se encarga de asegurar la liquidaciÃ³n y recalcular.
                revalidatePath('/liquidaciones')
                revalidatePath('/eerr')
                revalidatePath('/ventas')
                // AdemÃ¡s ejecutar recÃ¡lculo en cascada para asegurar consistencia en la fecha de impacto
                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  await recalcularLiquidacionesEnCascada(impactoFecha)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras crear devoluciÃ³n (no crÃ­tico)', rcErr)
                }
            } else {
              console.error('No se pudo crear gasto_ingreso para devoluciÃ³n (creaciÃ³n):', gastoRes?.error)
            }
          } catch (errG) {
            console.error('Error creando gasto/ingreso para devoluciÃ³n (creaciÃ³n):', errG)
          }

          // Si hay costo de envÃ­o nuevo (cambio), crear gasto adicional
          const costoEnvioNuevo = Number((validatedData as any).costoEnvioNuevo ?? dbRow.costo_envio_nuevo ?? 0)
          if (!Number.isNaN(costoEnvioNuevo) && costoEnvioNuevo > 0) {
            try {
              const { createGastoIngreso } = await import('@/lib/actions/gastos-ingresos')
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
              const descripcionNuevo = `Costo de envÃ­o nuevo/cambio ${ventaRef}`
              const gastoNuevoRes = await createGastoIngreso({
                fecha: new Date(impactoFecha),
                tipo: 'Gasto',
                categoria: 'Gastos del negocio - Envios devoluciones',
                descripcion: `${descripcionNuevo} - devol ${created.id}`,
                montoARS: costoEnvioNuevo,
                canal: 'General'
              } as GastoIngresoFormData)

              if (gastoNuevoRes && gastoNuevoRes.success) {
                revalidatePath('/liquidaciones')
                revalidatePath('/eerr')
                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  await recalcularLiquidacionesEnCascada(impactoFecha)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras crear gasto envÃ­o nuevo (no crÃ­tico)', rcErr)
                }
              } else {
                console.error('No se pudo crear gasto_ingreso para envÃ­o nuevo (creaciÃ³n):', gastoNuevoRes?.error)
              }
            } catch (errGNuevo) {
              console.error('Error creando gasto para envÃ­o nuevo (creaciÃ³n):', errGNuevo)
            }
          }
        } else {
          console.warn('No se encontrÃ³ liquidaciÃ³n de hoy para aplicar costo de envÃ­o en creaciÃ³n de devoluciÃ³n', errorHoy)
        }
      }
    } catch (err) {
      console.error('Error aplicando ajuste contable al crear devoluciÃ³n (no crÃ­tico):', err)
    }

    // --- LÃ³gica ML adicional en creaciÃ³n: si la devoluciÃ³n es ML y viene como Reembolso,
    // aplicar ajuste en liquidaciones HOY segÃºn mpEstado/mpRetener (si el usuario lo indicÃ³).
    try {
      const plataformaCreada = (validatedData as any).plataforma ?? datosVenta?.plataforma ?? 'TN'
      const tipoResCreada = (validatedData as any).tipoResolucion ?? null
      const montoReembolsadoCreada = Number((validatedData as any).montoReembolsado ?? 0)
      const mpEstadoCreada = (validatedData as any).mpEstado ?? null
      const mpRetenerCreada = Boolean((validatedData as any).mpRetener ?? false)

  // If platform is ML and either the user marked MP to be retained at creation
  // or the devoluciÃ³n is a Reembolso with an explicit monto > 0, persist deltas.
  if ((plataformaCreada === 'ML' || (datosVenta && (datosVenta as any).plataforma === 'ML')) && (mpRetenerCreada || (tipoResCreada === 'Reembolso' && montoReembolsadoCreada > 0))) {
        // Use fechaReclamo for MP adjustments on creation - when the return was claimed
        const impactoFecha = (validatedData && (validatedData as any).fechaReclamo)
          ? new Date((validatedData as any).fechaReclamo).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
        const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
        await asegurarLiquidacionParaFecha(impactoFecha)
        const { data: liqHoy, error: liqErr } = await supabase.from('liquidaciones').select('*').eq('fecha', impactoFecha).single()
        if (!liqErr && liqHoy) {
          try {
            // Compute the amount to move: prefer the sale-derived "monto a liquidar"
            let montoALiquidar = 0
            try {
              // Try to fetch the venta and compute monto a liquidar using shared util
              if (validatedData && (validatedData as any).ventaId) {
                const { data: ventaFull, error: ventaErr } = await supabase.from('ventas').select('*').eq('id', (validatedData as any).ventaId).single()
                if (!ventaErr && ventaFull) {
                  try {
                    const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
                    const computed = await calcularMontoVentaALiquidar(ventaFull as any)
                    montoALiquidar = Number(computed ?? 0)
                  } catch (calcErr) {
                    console.warn('No se pudo calcular monto a liquidar desde venta en creaciÃ³n (fallback):', calcErr)
                    montoALiquidar = Number(montoReembolsadoCreada ?? 0)
                  }
                } else {
                  montoALiquidar = Number(montoReembolsadoCreada ?? 0)
                }
              } else {
                montoALiquidar = Number(montoReembolsadoCreada ?? 0)
              }

              // Decide which MP bucket to reduce based on mpEstado and mpRetener
              let delta_mp_disponible = 0
              let delta_mp_a_liquidar = 0
              let delta_mp_retenido = 0

              // LÃ“GICA: Si mpRetener estÃ¡ activado, el dinero se RETIENE
              // Solo se puede retener dinero DISPONIBLE (no se puede retener dinero "a_liquidar")
              if (mpRetenerCreada) {
                // RETENER dinero: SUMAR a mp_retenido (positivo) y RESTAR de mp_disponible
                delta_mp_retenido += montoALiquidar
                delta_mp_disponible += -montoALiquidar
              } else {
                // Flujo normal: restar de mp_disponible o mp_a_liquidar segÃºn mpEstado
                if (mpEstadoCreada === 'a_liquidar') delta_mp_a_liquidar += -montoALiquidar
                else delta_mp_disponible += -montoALiquidar
              }

              // LÃ“GICA DE ENVÃO PARA ML:
              // Solo restar envÃ­o si:
              // 1. NO es retenciÃ³n (mpRetener = false)
              // 2. Es Reembolso
              // 3. Es ML Y fue_reclamo = true (o no estÃ¡ definido, para backward compatibility)
              if (!mpRetenerCreada && tipoResCreada === 'Reembolso') {
                try {
                  const plataforma = (datosVenta as any)?.plataforma ?? (validatedData as any).plataforma
                  const fueReclamo = (validatedData as any).fueReclamo ?? (validatedData as any).fue_reclamo
                  
                  // Para ML: solo restar envÃ­o si fue_reclamo es true o undefined (backward compatibility)
                  const debeRestarEnvio = plataforma !== 'ML' || fueReclamo !== false
                  
                  if (debeRestarEnvio) {
                    const envioFromVenta = Number((datosVenta as any)?.costoEnvioOriginal ?? (datosVenta as any)?.costo_envio ?? (validatedData as any).costoEnvioOriginal ?? 0)
                    if (!Number.isNaN(envioFromVenta) && envioFromVenta > 0) {
                      delta_mp_disponible += -envioFromVenta
                    }
                  }
                } catch (envSubErr) {
                  // non-critical
                }
              }

              // Persist into devoluciones_deltas (tipo 'reclamo' for creation when mpRetener)
              const deltaRow: any = {
                devolucion_id: created.id ?? created?.id ?? null,
                tipo: mpRetenerCreada ? 'reclamo' : (validatedData && (validatedData as any).fechaCompletada ? 'completada' : 'manual'),
                fecha_impacto: impactoFecha,
                delta_mp_disponible: Number(delta_mp_disponible || 0),
                delta_mp_a_liquidar: Number(delta_mp_a_liquidar || 0),
                delta_mp_retenido: Number(delta_mp_retenido || 0),
                delta_tn_a_liquidar: 0
              }

              try {
                const upsertResp = await supabase.from('devoluciones_deltas').upsert([deltaRow], { onConflict: 'devolucion_id,tipo' }).select().single()
                if (upsertResp.error) throw upsertResp.error
              } catch (upsertErr: any) {
                console.warn('No se pudo upsertar en devoluciones_deltas durante create (posible falta de migraciÃ³n), intentando fallback:', upsertErr)
                try {
                  const payloadDeltas: any = {
                    fecha_impacto: impactoFecha,
                    delta_mp_disponible: Number(delta_mp_disponible || 0),
                    delta_mp_a_liquidar: Number(delta_mp_a_liquidar || 0),
                    delta_mp_retenido: Number(delta_mp_retenido || 0),
                    delta_tn_a_liquidar: 0
                  }
                  await supabase.from('devoluciones').update(payloadDeltas).eq('id', created.id)
                } catch (oldUpdErr: any) {
                  console.warn('Fallback a actualizaciÃ³n de liquidaciones directo en create (no crÃ­tico):', oldUpdErr)
                  try {
                    // As last resort, update liquidaciones directly for the impactoFecha
                    if (mpRetenerCreada) {
                      // decrement source and increment retenido
                      const { data: liqForImpact, error: liqErr2 } = await supabase.from('liquidaciones').select('*').eq('fecha', impactoFecha).single()
                      if (!liqErr2 && liqForImpact) {
                        const nuevoMpDisponible = Math.max(0, Number(liqForImpact.mp_disponible ?? 0) + (Number(delta_mp_disponible || 0)))
                        const nuevoMpALiquidar = Math.max(0, Number(liqForImpact.mp_a_liquidar ?? 0) + (Number(delta_mp_a_liquidar || 0)))
                        const nuevoMpRetenido = Math.max(0, Number(liqForImpact.mp_retenido ?? 0) + Number(delta_mp_retenido || 0))
                        await supabase.from('liquidaciones').update({ mp_disponible: nuevoMpDisponible, mp_a_liquidar: nuevoMpALiquidar, mp_retenido: nuevoMpRetenido }).eq('fecha', impactoFecha)
                      }
                    } else {
                      const { data: liqForImpact, error: liqErr2 } = await supabase.from('liquidaciones').select('*').eq('fecha', impactoFecha).single()
                      if (!liqErr2 && liqForImpact) {
                        const nuevoMpDisponible = Math.max(0, Number(liqForImpact.mp_disponible ?? 0) + (Number(delta_mp_disponible || 0)))
                        const nuevoMpALiquidar = Math.max(0, Number(liqForImpact.mp_a_liquidar ?? 0) + (Number(delta_mp_a_liquidar || 0)))
                        await supabase.from('liquidaciones').update({ mp_disponible: nuevoMpDisponible, mp_a_liquidar: nuevoMpALiquidar }).eq('fecha', impactoFecha)
                      }
                    }
                  } catch (uErr) {
                    console.warn('Fallback update liquidaciones fallÃ³ en create (no crÃ­tico)', uErr)
                  }
                }
              }

              try {
                const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                await recalcularLiquidacionesEnCascada(impactoFecha)
              } catch (rcErr) {
                console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras ML creaciÃ³n (no crÃ­tico)', rcErr)
              }
              revalidatePath('/liquidaciones')
              revalidatePath('/eerr')
              revalidatePath('/ventas')
            } catch (errInner) {
              console.warn('Error preparando/persistiendo deltas en creaciÃ³n ML (no crÃ­tico)', errInner)
            }
          } catch (applyErr) {
            console.warn('Error aplicando ajuste ML en creaciÃ³n (no crÃ­tico)', applyErr)
          }
        } else {
          console.warn('No se encontrÃ³ liquidaciÃ³n HOY para aplicar ajuste ML en creaciÃ³n', liqErr)
        }
      }
    } catch (mlErr) {
      console.warn('Error en flujo ML al crear devoluciÃ³n (no crÃ­tico)', mlErr)
    }

    // CreaciÃ³n ya aplicÃ³ (si correspondÃ­a) el ajuste de envÃ­o; devolver resultado
    revalidatePath("/devoluciones")
    return { success: true, data: created }
  } catch (error) {
    console.error("Error al crear devoluciÃ³n:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear devoluciÃ³n" }
  }
}

// Actualizar devoluciÃ³n
export async function updateDevolucion(id: string, data: Partial<DevolucionFormData> | DevolucionFormData) {
  try {
    // Allow partial payloads on update: parse partial first to enforce types on provided fields,
    // then merge with existing DB row and validate the merged object with the full schema.
  // Sanitize incoming partial payload to avoid empty-string enum values causing Zod to fail
  const _safePartial: any = { ...(data as any) }
  if (_safePartial.mpEstado === "") _safePartial.mpEstado = undefined
  
  // Debug: log incoming data from frontend
  try { 
    console.debug('[updateDevolucion] FROM FRONTEND - fechaRecepcion=', _safePartial.fechaRecepcion, 'type=', typeof _safePartial.fechaRecepcion, 'instanceof Date=', _safePartial.fechaRecepcion instanceof Date) 
  } catch (dbg) {}
  
  const parsedPartial = devolucionSchemaBase.partial().parse(_safePartial)
  
  // Debug: log after first parse
  try { 
    console.debug('[updateDevolucion] AFTER FIRST PARSE - fechaRecepcion=', parsedPartial.fechaRecepcion, 'type=', typeof parsedPartial.fechaRecepcion) 
  } catch (dbg) {}

    // Obtener registro existente para hacer un update tipo "merge"
    const { data: existing, error: fetchError } = await supabase
      .from('devoluciones')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!existing) throw new Error('DevoluciÃ³n no encontrada')

    // -------------------------
    // Early path: if the update converts the devoluciÃ³n a Reembolso,
    // and the venta was PagoNube, we must subtract the monto que se liquidÃ³
    // durante la venta de 'tn_a_liquidar' de la liquidaciÃ³n de HOY.
  // This is intentionally minimal and idempotent: we previously persisted monto_aplicado_liquidacion
  // for audit/idempotence. We no longer write that column â€” accounting impacts are recorded via gastos_ingresos.
    // y actualicemos la devoluciÃ³n con los campos parciales enviados.
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
            // calcular monto a liquidar para la venta (usa la funciÃ³n compartida)
            try {
              const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
              const montoVentaLiquidado = await calcularMontoVentaALiquidar(venta as any)
              console.log('ðŸ” DEBUG REEMBOLSO - montoVentaLiquidado:', montoVentaLiquidado)
              console.log('ðŸ” DEBUG REEMBOLSO - venta.precioNeto:', (venta as any).precioNeto)
              console.log('ðŸ” DEBUG REEMBOLSO - venta.pvBruto:', (venta as any).pvBruto)
              // CRITICAL: Always use the calculated amount from the sale, NOT any user-provided value.
              // The montoVentaLiquidado already reflects the correct precioNeto from the venta.
              const newMonto = Number(montoVentaLiquidado ?? 0)
              console.log('ðŸ” DEBUG REEMBOLSO - newMonto final:', newMonto)
              // Use monto_reembolsado as the persisted source of truth for previous applied amount (fallback to 0)
              const prevApplied = Number((existing as any).monto_reembolsado ?? (existing as any).monto_reembolsado ?? 0)
              const delta = newMonto - prevApplied
              console.log('ðŸ” DEBUG REEMBOLSO - delta calculado:', delta)
              const plataforma = (venta as any).plataforma ?? null
              const metodoPago = (venta as any).metodoPago ?? null
              const fechaHoyActual = new Date().toISOString().split('T')[0]
              // LÃ³gica especial para Mercado Libre
              if (plataforma === 'ML' || metodoPago === 'MercadoPago') {
                // Use optional mpEstado/mpRetener provided by the client (advance modal or form)
                const mpEstadoProvided = (parsedPartial as any).mpEstado ?? (parsedPartial as any).mp_estado ?? null
                const mpRetenerProvided = Boolean((parsedPartial as any).mpRetener ?? (parsedPartial as any).mp_retener ?? false)
                // Persist desglose de envÃ­os si fue provisto
                try {
                  const fueReclamoEarly = (parsedPartial as any).fueReclamo ?? (parsedPartial as any).fue_reclamo ?? (existing as any).fue_reclamo
                  const envioOriginalValRaw = Number((parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                  const envioOriginalVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioOriginalValRaw
                  const envioVueltaValRaw = Number((parsedPartial as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                  const envioVueltaVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioVueltaValRaw
                  const envioNuevoValRaw = Number((parsedPartial as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                  const envioNuevoVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioNuevoValRaw
                  await supabase.from('devoluciones').update({ costo_envio_original: envioOriginalVal, costo_envio_devolucion: envioVueltaVal, costo_envio_nuevo: envioNuevoVal }).eq('id', id)
                } catch (envErrEarly) {
                  console.warn('No se pudo persistir desglose de envÃ­os en flujo ML (no crÃ­tico)', envErrEarly)
                }

                // Apply adjustments to the intended fecha de impacto (user-provided fechaCompletada) when available,
                // otherwise fall back to today's date. This ensures fecha_impacto uses the date the user selected
                // in the "Registrar avance" modal instead of always using today.
                try {
                  // IMPORTANTE: Usar fechaAccionString (string puro) para evitar conversiones de timezone
                  const fechaHoy = (parsedPartial && (parsedPartial as any).fechaAccionString)
                    ? String((parsedPartial as any).fechaAccionString)
                    : fechaHoyActual
                  console.log('[DEBUG] fechaAccionString:', (parsedPartial as any)?.fechaAccionString, 'fechaHoy result:', fechaHoy)
                  const impactoFechaForDeltas = fechaHoy
                  const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
                  await asegurarLiquidacionParaFecha(fechaHoy)
                  const { data: liqHoy, error: liqErr } = await supabase.from('liquidaciones').select('*').eq('fecha', fechaHoy).single()
                  if (!liqErr && liqHoy) {
                    let nuevoMpDisponible = Number(liqHoy.mp_disponible ?? 0)
                    let nuevoMpALiquidar = Number(liqHoy.mp_a_liquidar ?? 0)
                    let nuevoMpRetenido = Number((liqHoy as any).mp_retenido ?? 0)

                    // Decide deltas to persist on la devoluciÃ³n instead of updating liquidaciones directly.
                    // Compute delta buckets (negative values reduce buckets, positive values increase)
                    let delta_mp_disponible = 0
                    let delta_mp_a_liquidar = 0
                    let delta_mp_retenido = 0
                    let delta_tn_a_liquidar = 0

                    // CRITICAL: Check if money was ALREADY retained previously (existing.mp_retenido)
                    const wasAlreadyRetained = Boolean((existing as any).mp_retenido ?? false)
                    const montoAjusteML = Number(newMonto ?? 0)
                    const fueReclamoProvided = (parsedPartial as any).fueReclamo ?? (parsedPartial as any).fue_reclamo
                    const fueReclamoPersistido = (existing as any).fue_reclamo ?? (existing as any).fueReclamo ?? null
                    const fueReclamoML = plataforma === 'ML' ? (fueReclamoProvided ?? fueReclamoPersistido) : null
                    const debeRestarEnvioML = plataforma !== 'ML' || fueReclamoML !== false

                    if (wasAlreadyRetained) {
                      delta_mp_retenido += -montoAjusteML
                      // Money was already in mp_retenido from a previous reclamo.
                      // When finalizing Reembolso now, we only subtract shipping from disponible.
                      // The monto will be released from mp_retenido in a later step.
                      // DO NOT subtract the monto from disponible/a_liquidar again.
                      console.log('[Reembolso con retenciÃ³n previa] Solo restando envÃ­o de MP Disponible')
                    } else {
                      // Money was NOT retained before: this is either first-time processing
                      // or money is flowing directly. Subtract monto from the appropriate bucket.
                      if (mpEstadoProvided === 'a_liquidar') {
                        delta_mp_a_liquidar += -montoAjusteML
                      } else {
                        delta_mp_disponible += -montoAjusteML
                      }
                    }

                    // NOTE: shipping costs are persisted as gastos_ingresos and handled
                    // separately; do NOT include envÃ­o in delta_mp_disponible here.

                    // Business rule exception: when this is a Mercado Libre (ML) Reembolso
                    // flow, subtract the original envÃ­o of the venta from MP disponible
                    // so that the liquidation reflects the real cash movement. The
                    // envÃ­o itself is still recorded as a gasto_ingreso for EERR.
                    if (debeRestarEnvioML) {
                      try {
                        const envioOriginalFromVenta = Number((venta as any)?.costoEnvio ?? (venta as any)?.costo_envio ?? (parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                        if (!Number.isNaN(envioOriginalFromVenta) && envioOriginalFromVenta > 0) {
                          // Always subtract from disponible bucket
                          delta_mp_disponible += -envioOriginalFromVenta
                        }
                      } catch (envEx) {
                        // non-critical, continue
                      }
                    } else {
                      console.log('[Reembolso ML sin reclamo] No se descuenta envio de MP disponible')
                    }

                    // If user marked to retain money NOW (not previously), add to mp_retenido (positive)
                    if (mpRetenerProvided && !wasAlreadyRetained) {
                      delta_mp_retenido += montoAjusteML
                    }

                    // Persist deltas into the normalized table `devoluciones_deltas` so we can
                    // keep one row per impact event (reclamo/completada) instead of overwriting
                    // a single set of delta_* columns on the `devoluciones` row.
                    try {
                      const deltaRow: any = {
                        devolucion_id: id,
                        tipo: mpRetenerProvided ? 'reclamo' : (parsedPartial && (parsedPartial as any).fechaCompletada ? 'completada' : 'manual'),
                        fecha_impacto: impactoFechaForDeltas,
                        delta_mp_disponible: Number(delta_mp_disponible || 0),
                        delta_mp_a_liquidar: Number(delta_mp_a_liquidar || 0),
                        delta_mp_retenido: Number(delta_mp_retenido || 0),
                        delta_tn_a_liquidar: Number(delta_tn_a_liquidar || 0)
                      }

                      // Upsert into devoluciones_deltas using a unique constraint (devolucion_id, tipo).
                      // If the DB doesn't have the new table (migration not applied), fall back to updating
                      // the old columns on `devoluciones` or write directly to `liquidaciones`.
                      try {
                        // PostgREST client expects onConflict as a comma-separated string
                        const upsertResp = await supabase.from('devoluciones_deltas').upsert([deltaRow], { onConflict: 'devolucion_id,tipo' }).select().single()
                        if (upsertResp.error) throw upsertResp.error
                      } catch (upsertErr: any) {
                        console.warn('No se pudo upsertar en devoluciones_deltas (posible falta de migraciÃ³n), intentando fallback:', upsertErr)
                        // Fallback to trying to update the devoluciones row (old behavior)
                        try {
                          const payloadDeltas: any = {
                            fecha_impacto: impactoFechaForDeltas,
                            delta_mp_disponible: Number(delta_mp_disponible || 0),
                            delta_mp_a_liquidar: Number(delta_mp_a_liquidar || 0),
                            delta_mp_retenido: Number(delta_mp_retenido || 0),
                            delta_tn_a_liquidar: Number(delta_tn_a_liquidar || 0)
                          }
                          await supabase.from('devoluciones').update(payloadDeltas).eq('id', id)
                        } catch (oldUpdErr: any) {
                          console.warn('Fallback a actualizaciÃ³n de liquidaciones directo (no crÃ­tico):', oldUpdErr)
                          try {
                            const payloadFallback: any = {
                              mp_disponible: Math.max(0, Number(nuevoMpDisponible) + Number(delta_mp_disponible || 0)),
                              mp_a_liquidar: Math.max(0, Number(nuevoMpALiquidar) + Number(delta_mp_a_liquidar || 0))
                            }
                            if (Math.abs(Number(delta_mp_retenido || 0)) > 0.0001 || mpRetenerProvided || wasAlreadyRetained) {
                              payloadFallback.mp_retenido = Math.max(0, Number(nuevoMpRetenido) + Number(delta_mp_retenido || 0))
                            }
                            await supabase.from('liquidaciones').update(payloadFallback).eq('fecha', impactoFechaForDeltas)
                          } catch (uErr) {
                            console.warn('Fallback update liquidaciones fallÃ³ (no crÃ­tico)', uErr)
                          }
                        }
                      }
                    } catch (errPersistD) {
                      console.warn('No se pudo persistir deltas en devoluciones_deltas ni fallback (no crÃ­tico)', errPersistD)
                    }
                  } else {
                    console.warn('No se encontrÃ³ liquidaciÃ³n HOY para aplicar ajuste ML (no crÃ­tico)', liqErr)
                  }
                } catch (mlApplyErr) {
                  console.warn('Error aplicando ajuste ML en update temprano (no crÃ­tico)', mlApplyErr)
                }

                // Recalculate in cascade and revalidate (the recalculation will now read the persisted deltas)
                try {
                  const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                  // IMPORTANTE: Usar fechaAccionString para obtener la fecha correcta (igual que en impactoFechaForDeltas)
                  const fechaParaRecalculo = (parsedPartial && (parsedPartial as any).fechaAccionString)
                    ? String((parsedPartial as any).fechaAccionString)
                    : fechaHoyActual
                  await recalcularLiquidacionesEnCascada(fechaParaRecalculo)
                } catch (rcErr) {
                  console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras ML (no crÃ­tico)', rcErr)
                }
                revalidatePath('/liquidaciones')
                revalidatePath('/eerr')
                revalidatePath('/ventas')

                // Persistar el cambio en la tabla `devoluciones` para que el estado/fecha
                // y demÃ¡s campos queden guardados. En algunas instalaciones la columna
                // mp_retenido/mp_estado puede no existir, por eso aplicamos el mismo
                // patrÃ³n de retry que en otros puntos del cÃ³digo.
                try {
                  let updatedRow: any = null
                  try {
                    // Normalize dates and ensure fecha_completada is an ISO string when present
                    const payloadToPersist: any = toSnakeCase(parsedPartial)
                    // IMPORTANTE: Eliminar fechaAccionString porque no existe en la tabla (solo se usa para comunicaciÃ³n)
                    delete payloadToPersist.fecha_accion_string
                    if (payloadToPersist && payloadToPersist.fecha_completada) {
                      try { payloadToPersist.fecha_completada = new Date(payloadToPersist.fecha_completada).toISOString() } catch {}
                    }
                    const resp = await supabase.from('devoluciones').update(payloadToPersist).eq('id', id).select().single()
                    if (resp.error) throw resp.error
                    updatedRow = resp.data
                  } catch (updErr: any) {
                    const msg = String(updErr?.message ?? updErr)
                    if (updErr?.code === 'PGRST204' || msg.includes('mp_estado') || msg.includes('mp_retenido') || msg.includes('fecha_accion_string')) {
                      const safePayload: any = toSnakeCase(parsedPartial)
                      if (safePayload && safePayload.fecha_completada) {
                        try { safePayload.fecha_completada = new Date(safePayload.fecha_completada).toISOString() } catch {}
                      }
                      delete safePayload.mp_estado
                      delete safePayload.mp_retenido
                      delete safePayload.fecha_accion_string
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
                  console.warn('No se pudo persistir actualizaciÃ³n de devoluciÃ³n tras ajuste ML (pero ajuste aplicado en liquidaciones):', persistErr)
                  // Devolvemos Ã©xito parcial para no bloquear la UX; el caller debe ver el aviso.
                  return { success: true, data: parsedPartial }
                }
              } else if (metodoPago === 'PagoNube') {
                // LÃ³gica original para Tienda Nube
                if (delta !== 0) {
                  const { data: liq, error: liqErr } = await supabase.from('liquidaciones').select('tn_a_liquidar').eq('fecha', fechaHoyActual).single()
                  if (!liqErr && liq) {
                    const currentTn = Number(liq.tn_a_liquidar ?? 0)
                    const nuevoTn = Math.max(0, currentTn - delta)
                    // Persist delta in devoluciones_deltas so recalculation can consume it later
                    // IMPORTANTE: Usar fechaAccionString si estÃ¡ disponible para evitar problemas de timezone
                    const impactoFecha = (parsedPartial && (parsedPartial as any).fechaAccionString)
                      ? String((parsedPartial as any).fechaAccionString)
                      : fechaHoyActual
                    console.log('[DEBUG TN] fechaAccionString:', (parsedPartial as any)?.fechaAccionString, 'impactoFecha:', impactoFecha)
                    const deltaRow: any = {
                      devolucion_id: id,
                      tipo: (parsedPartial && (parsedPartial as any).fechaCompletada) ? 'completada' : 'manual',
                      fecha_impacto: impactoFecha,
                      delta_mp_disponible: 0,
                      delta_mp_a_liquidar: 0,
                      delta_mp_retenido: 0,
                      // Store TN delta as NEGATIVE (amount to decrement in TN a liquidar).
                      // This matches the convention used in migrations: delta_tn_a_liquidar = -monto_a_decrementar_en_tn_a_liquidar
                      delta_tn_a_liquidar: Number(-(delta || 0))
                    }
                    try {
                      const upsertResp = await supabase.from('devoluciones_deltas').upsert([deltaRow], { onConflict: 'devolucion_id,tipo' }).select().single()
                      if (upsertResp && upsertResp.error) throw upsertResp.error
                    } catch (upsertErr: any) {
                      console.warn('No se pudo persistir delta_tn_a_liquidar en devoluciones_deltas (posible falta de migraciÃ³n), procediendo a actualizar liquidaciones directamente:', upsertErr)
                      // Fallback: continue to update liquidaciones directamente
                    }

                    // Update liquidaciones tn_a_liquidar immediately (for UX) and persist devoluciones row
                    // IMPORTANTE: No actualizar liquidaciones directamente aquÃ­, dejar que el recÃ¡lculo lo haga
                    // await supabase.from('liquidaciones').update({ tn_a_liquidar: nuevoTn }).eq('fecha', fechaHoyActual)
                    
                    // Actualizar devoluciÃ³n con estado y campos completos
                    const updatePayload = toSnakeCase(parsedPartial)
                    // IMPORTANTE: Eliminar fechaAccionString porque no existe en la tabla (solo se usa para comunicaciÃ³n)
                    delete updatePayload.fecha_accion_string
                    console.log('[DEBUG TN UPDATE] parsedPartial:', parsedPartial)
                    console.log('[DEBUG TN UPDATE] updatePayload:', updatePayload)
                    const updateResult = await supabase.from('devoluciones').update(updatePayload).eq('id', id)
                    console.log('[DEBUG TN UPDATE] result:', updateResult)
                    if (updateResult.error) {
                      console.error('[DEBUG TN UPDATE] ERROR:', updateResult.error)
                    }
                    try {
                      const fueReclamoEarly = (parsedPartial as any).fueReclamo ?? (parsedPartial as any).fue_reclamo ?? (existing as any).fue_reclamo
                      const envioOriginalValRaw = Number((parsedPartial as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                      const envioOriginalVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioOriginalValRaw
                      const envioVueltaValRaw = Number((parsedPartial as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                      const envioVueltaVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioVueltaValRaw
                      const envioNuevoValRaw = Number((parsedPartial as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                      const envioNuevoVal = (plataforma === 'ML' && fueReclamoEarly === false) ? 0 : envioNuevoValRaw
                      await supabase.from('devoluciones').update({ costo_envio_original: envioOriginalVal, costo_envio_devolucion: envioVueltaVal, costo_envio_nuevo: envioNuevoVal }).eq('id', id)
                    } catch (envErrEarly) {
                      console.warn('No se pudo persistir desglose de envÃ­os en flujo temprano de Reembolso (no crÃ­tico)', envErrEarly)
                    }
                    try {
                      const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
                      // IMPORTANTE: Recalcular desde impactoFecha (fecha que eligiÃ³ el usuario), NO desde hoy
                      await recalcularLiquidacionesEnCascada(impactoFecha)
                    } catch (rcErr) {
                      console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras Reembolso temprano (no crÃ­tico)', rcErr)
                    }
                    revalidatePath('/liquidaciones')
                    revalidatePath('/eerr')
                    revalidatePath('/ventas')
                    return { success: true, data: parsedPartial }
                  } else {
                    console.warn('No se encontrÃ³ liquidaciÃ³n de HOY para ajustar tn_a_liquidar (no crÃ­tico)', liqErr)
                  }
                }
              }
            } catch (calcErr) {
              console.warn('No se pudo calcular montoVentaLiquidado para Reembolso (no crÃ­tico)', calcErr)
            }
          } else {
            console.warn('No se encontrÃ³ venta para aplicar Reembolso temprano (no crÃ­tico)', ventaErr)
          }
        }
      }
    } catch (earlyErr) {
      console.warn('Error en flujo temprano de Reembolso (no crÃ­tico)', earlyErr)
    }

    // Auto-completar campos originales desde la venta si hace falta
    let datosVenta = null
    if (parsedPartial.ventaId) {
      datosVenta = await obtenerDatosVenta(parsedPartial.ventaId)
    }

    // Normalize existing DB row (snake_case) to camelCase expected by Zod
    const existingCamel = toCamelCase(existing)

    // Extraer fechaAccion del parsedPartial ANTES del merge - solo se usa para crear gastos
    const fechaAccionForGasto = parsedPartial.fechaAccion || new Date()
    const parsedWithoutFechaAccion = { ...parsedPartial }
    delete parsedWithoutFechaAccion.fechaAccion

    const mergedPre = {
      // mantener los valores actuales y sobreescribir con los campos provistos
      ...existingCamel,
      ...parsedWithoutFechaAccion,
      // asegurar que los campos originales se completen SOLO si vienen explÃ­citamente
      // (no sobrescribir con defaults cuando estamos actualizando otros campos como recepciÃ³n/prueba)
    }
    
    // Solo agregar estos campos si vienen en el payload o si estamos creando (no hay existing)
    if (parsedPartial.costoProductoOriginal !== undefined) {
      mergedPre.costoProductoOriginal = parsedPartial.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0
    }
    if (parsedPartial.costoEnvioOriginal !== undefined) {
      mergedPre.costoEnvioOriginal = parsedPartial.costoEnvioOriginal ?? datosVenta?.costoEnvioOriginal ?? 0
    }
    if (parsedPartial.montoVentaOriginal !== undefined) {
      mergedPre.montoVentaOriginal = parsedPartial.montoVentaOriginal ?? datosVenta?.montoVentaOriginal ?? 0
    }
    if (parsedPartial.nombreContacto !== undefined) {
      mergedPre.nombreContacto = parsedPartial.nombreContacto ?? datosVenta?.comprador ?? existing.nombreContacto
    }
    if (parsedPartial.fechaCompra !== undefined) {
      mergedPre.fechaCompra = parsedPartial.fechaCompra ?? datosVenta?.fechaCompra ?? existing.fechaCompra
    }

    // Clean nulls and validate only provided/merged fields for update (allow partial)
    try {
      console.debug('[updateDevolucion] BEFORE stripNulls - fechaRecepcion=', mergedPre.fechaRecepcion, 'type=', typeof mergedPre.fechaRecepcion)
    } catch (dbg) {}
    
    let mergedClean = stripNulls(mergedPre)
    
    try {
      console.debug('[updateDevolucion] AFTER stripNulls - fechaRecepcion=', mergedClean.fechaRecepcion, 'type=', typeof mergedClean.fechaRecepcion)
    } catch (dbg) {}
    
    // Normalize date-like objects to Date/string so Zod preprocess can handle them.
    // Some deployments send objects (seconds/toDate), some send 'YYYY-MM-DD' strings
    // or 'YYYY-MM-DD HH:MM:SS'. Ensure we coerce to a real Date instance when possible
    // because Zod's preprocess expects either a Date or a parsable string.
    if (mergedClean && typeof mergedClean === 'object') {
      mergedClean.fechaCompra = normalizeDateLike(mergedClean.fechaCompra)
      mergedClean.fechaReclamo = normalizeDateLike(mergedClean.fechaReclamo)
      mergedClean.fechaCompletada = normalizeDateLike(mergedClean.fechaCompletada)

      const ensureDateForZod = (v: any) => {
        if (v === null || typeof v === 'undefined') return undefined
        if (v instanceof Date) return v
        // If v is a number treat as ms timestamp
        if (typeof v === 'number') {
          const d = new Date(v)
          if (!isNaN(d.getTime())) return d
          return undefined
        }

        // If it's a JSON-encoded value in a string, try to parse
        if (typeof v === 'string') {
          const trimmed = v.trim()
          // Attempt JSON parse for quoted strings or objects
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
            try {
              const parsed = JSON.parse(trimmed)
              return ensureDateForZod(parsed)
            } catch {}
          }

          // Normalize common DB formats to an ISO-parsable string
          const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
          const spaceDateMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
          let candidate = trimmed
          if (dateOnlyMatch) candidate = trimmed + 'T00:00:00Z'
          else if (spaceDateMatch) candidate = trimmed.replace(' ', 'T') + 'Z'

          // Try multiple parse strategies, return Date or undefined
          try {
            const d = new Date(candidate)
            if (!isNaN(d.getTime())) return d
          } catch {}
          try {
            const d2 = new Date(trimmed)
            if (!isNaN(d2.getTime())) return d2
          } catch {}

          // Attempt to extract YYYY-MM-DD if present
          try {
            const m = trimmed.match(/(\d{4}-\d{2}-\d{2})/)
            if (m && m[1]) {
              const d3 = new Date(m[1] + 'T00:00:00Z')
              if (!isNaN(d3.getTime())) return d3
            }
          } catch {}

          return undefined
        }

        if (typeof v === 'object') {
          if (typeof v.seconds === 'number') return new Date(v.seconds * 1000)
          if (typeof v.toDate === 'function') {
            try { return v.toDate() } catch {}
          }
          if (typeof v.toISOString === 'function') {
            try { return new Date(v.toISOString()) } catch {}
          }
          // If object has common keys
          if (typeof v.value === 'string') return ensureDateForZod(v.value)
          if (typeof v.iso === 'string') return ensureDateForZod(v.iso)
        }
        return undefined
      }

      mergedClean.fechaCompra = ensureDateForZod(mergedClean.fechaCompra)
      mergedClean.fechaReclamo = ensureDateForZod(mergedClean.fechaReclamo)
      mergedClean.fechaCompletada = ensureDateForZod(mergedClean.fechaCompletada)
      mergedClean.fechaRecepcion = ensureDateForZod(mergedClean.fechaRecepcion)
      mergedClean.fechaPrueba = ensureDateForZod(mergedClean.fechaPrueba)
    }

    // Debug: log the normalized date values right before parsing so we can inspect invalid inputs
    try {
      console.debug('[updateDevolucion] pre-parse fechas types=', {
        fechaCompra: { value: mergedClean?.fechaCompra, type: typeof mergedClean?.fechaCompra },
        fechaReclamo: { value: mergedClean?.fechaReclamo, type: typeof mergedClean?.fechaReclamo },
        fechaCompletada: { value: mergedClean?.fechaCompletada, type: typeof mergedClean?.fechaCompletada },
        fechaRecepcion: { value: mergedClean?.fechaRecepcion, type: typeof mergedClean?.fechaRecepcion }
      })
    } catch (dbg) {}

  const validatedMergedPartial = devolucionSchemaBase.partial().parse(mergedClean)
  
  // Debug after Zod parse
  try {
    console.debug('[updateDevolucion] post-parse fechaRecepcion=', validatedMergedPartial.fechaRecepcion, 'type=', typeof validatedMergedPartial.fechaRecepcion)
  } catch (dbg) {}
  
  // Alias for backward-compatible references below
  const merged: any = validatedMergedPartial as any
  // Re-attach fechaAccion despuÃ©s de validar (solo para uso en memoria, no se guarda en DB)
  merged.fechaAccion = fechaAccionForGasto

    let updated: any = null
    try {
      // Debug: log attempted update payload to help diagnose why updates fail
      const snakeCasePayload = toSnakeCase(validatedMergedPartial)
      try { console.debug('[updateDevolucion] BEFORE filter, snakeCasePayload.fecha_recepcion=', snakeCasePayload.fecha_recepcion, 'validatedMergedPartial.fechaRecepcion=', validatedMergedPartial.fechaRecepcion) } catch (dbg) {}
      try { console.debug('[updateDevolucion] snakeCasePayload.fecha_completada=', snakeCasePayload.fecha_completada, 'type=', typeof snakeCasePayload.fecha_completada, 'validatedMergedPartial.fechaCompletada=', validatedMergedPartial.fechaCompletada) } catch (dbg) {}
      // Filtrar undefined para evitar enviar campos que no queremos actualizar
      const cleanPayload = Object.fromEntries(
        Object.entries(snakeCasePayload).filter(([_, v]) => v !== undefined)
      )
      try { console.debug('[updateDevolucion] id=', id, 'payload=', cleanPayload) } catch (dbg) {}
      const resp = await supabase
        .from('devoluciones')
        .update(cleanPayload)
        .eq('id', id)
        .select()
        .single()
      if (resp.error) throw resp.error
      updated = resp.data
    } catch (updErr: any) {
      // Attempt a resilient retry: PostgREST can return PGRST204 when a column
      // is missing in the DB schema cache. The message usually includes the
      // missing column name (e.g. "Could not find the 'comision_original' column...").
      // We'll retry removing any referenced columns from the payload and re-run
      // the update a few times before giving up.
      try {
        console.warn('[updateDevolucion] update failed, attempting safe retry, error=', updErr?.message ?? updErr)
        let msg = String(updErr?.message ?? updErr)
        let safePayload: any = toSnakeCase(validatedMergedPartial)

        // Always defensively remove mp fields if present (common optional columns)
        delete safePayload.mp_estado
        delete safePayload.mp_retenido

        const maxAttempts = 5
        let attempt = 0
        let lastErr: any = updErr
        while (attempt < maxAttempts) {
          attempt += 1
          try {
            const retry = await supabase.from('devoluciones').update(safePayload).eq('id', id).select().single()
            if (retry.error) throw retry.error
            updated = retry.data
            lastErr = null
            break
          } catch (e: any) {
            lastErr = e
            // Extract any quoted identifier(s) from the error message and remove them
            const eMsg = String(e?.message ?? e)
            const cols: string[] = []
            try {
              const re = /'([^']+)'/g
              let m: RegExpExecArray | null
              while ((m = re.exec(eMsg)) !== null) {
                if (m[1]) cols.push(m[1])
              }
            } catch (xx) {}

            // If we found column names, delete them from payload and retry
            if (cols.length > 0) {
              for (const c of cols) {
                if (c in safePayload) {
                  delete safePayload[c]
                }
              }
              // continue the loop to retry
              continue
            }

            // If no quoted columns found, as a last resort try removing any snake_case fields
            // that look like optional extras (heuristic): comision_* , gasto_* , monto_*
            const optionalPatterns = [/^comision_/, /^gasto_/, /^monto_/, /^mp_/, /^costo_/]
            let removedAny = false
            for (const key of Object.keys(safePayload)) {
              for (const pat of optionalPatterns) {
                if (pat.test(key)) {
                  delete safePayload[key]
                  removedAny = true
                }
              }
            }
            if (removedAny) continue

            // No actionable change possible; break and rethrow
            break
          }
        }

        if (lastErr) throw lastErr
      } catch (finalUpdErr) {
        throw finalUpdErr
      }
    }

    // Si se agregÃ³ o modificÃ³ el costo de envÃ­o de devoluciÃ³n, crear/actualizar
    // un registro en `gastos_ingresos` con fecha HOY para reflejar el gasto.
    try {
      const prevShipping = Number((existing as any).costo_envio_devolucion ?? 0)
      // new shipping: priorizar lo provisto en parsedPartial o en el registro actualizado
      const newShipping = Number((parsedPartial as any).costoEnvioDevolucion ?? (parsedPartial as any).costo_envio_devolucion ?? (updated as any)?.costo_envio_devolucion ?? 0)
      const diffShipping = Math.abs(newShipping - prevShipping)
      // Solo actualizar si la diferencia es significativa (> 0.01 para evitar problemas de redondeo)
      if (!Number.isNaN(newShipping) && diffShipping > 0.01) {
        try {
          const { createGastoIngreso, updateGastoIngreso, getGastoIngresoById } = await import('@/lib/actions/gastos-ingresos')
          // Use merged.fechaCompletada as accounting date for the shipping gasto when available; fallback to today.
          const fechaHoy = (merged && merged.fechaCompletada) ? new Date(merged.fechaCompletada).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          const ventaRef = (updated as any)?.venta_id ?? (existing as any).venta_id ?? id
          const descripcion = `Costo envÃ­o devoluciÃ³n - devol ${updated?.id ?? id} - venta ${ventaRef}`
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

          // Fallback: buscar por descripciÃ³n que contenga 'devol <id>' y actualizar
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
              console.warn('Error buscando/creando gasto por descripciÃ³n (fallback):', searchErr)
            }
          }

          if (gastoActual) {
            try {
              const gastoId = gastoActual.id ?? gastoActual
              if (gastoId) {
                await supabase.from('devoluciones').update({ gasto_creado_id: gastoId }).eq('id', updated?.id ?? id)
              }
            } catch (auditErr) {
              console.warn('No se pudo persistir gasto_creado_id tras crear/actualizar gasto (no crÃ­tico)', auditErr)
            }

            // Revalidar rutas y recÃ¡lculo para que el ajuste sea efectivo hoy
            try {
              const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
              await recalcularLiquidacionesEnCascada(fechaHoy)
            } catch (rcErr) {
              console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras crear/actualizar gasto de envÃ­o (no crÃ­tico)', rcErr)
            }
            revalidatePath('/liquidaciones')
            revalidatePath('/eerr')
            revalidatePath('/ventas')
          }
        } catch (innerErr) {
          console.warn('Error creando/actualizando gasto de envÃ­o tras updateDevolucion (no crÃ­tico):', innerErr)
        }
      }
    } catch (errShip) {
      console.warn('Error evaluando cambio de costo_envio_devolucion (no crÃ­tico):', errShip)
    }

    // Si se agregÃ³ o modificÃ³ el costo de envÃ­o nuevo (cambio), crear/actualizar gasto
    try {
      const prevShippingNuevo = Number((existing as any).costo_envio_nuevo ?? 0)
      const newShippingNuevo = Number((parsedPartial as any).costoEnvioNuevo ?? (parsedPartial as any).costo_envio_nuevo ?? (updated as any)?.costo_envio_nuevo ?? 0)
      const diffShippingNuevo = Math.abs(newShippingNuevo - prevShippingNuevo)
      // Solo actualizar si la diferencia es significativa (> 0.01 para evitar problemas de redondeo)
      if (!Number.isNaN(newShippingNuevo) && diffShippingNuevo > 0.01 && newShippingNuevo > 0) {
        try {
          const { createGastoIngreso, updateGastoIngreso } = await import('@/lib/actions/gastos-ingresos')
          // Usar fechaAccion si estÃ¡ disponible, sino hoy
          const fechaAccion = (merged && merged.fechaAccion) ? new Date(merged.fechaAccion).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          const ventaRef = (updated as any)?.venta_id ?? (existing as any).venta_id ?? id
          const descripcionNuevo = `Costo envÃ­o nuevo/cambio - devol ${updated?.id ?? id} - venta ${ventaRef}`
          const gastoNuevoPayload: GastoIngresoFormData = {
            fecha: new Date(fechaAccion),
            tipo: 'Gasto',
            categoria: 'Gastos del negocio - Envios devoluciones',
            descripcion: descripcionNuevo,
            montoARS: newShippingNuevo,
            canal: 'General'
          }

          // Buscar si ya existe un gasto para envÃ­o nuevo de esta devoluciÃ³n
          let gastoNuevoActual: any = null
          try {
            const { data: foundNuevo } = await supabase
              .from('gastos_ingresos')
              .select('*')
              .ilike('descripcion', `%envÃ­o nuevo%devol ${updated?.id ?? id}%`)
              .limit(1)
              .single()

            if (foundNuevo) {
              const upd = await updateGastoIngreso(foundNuevo.id, gastoNuevoPayload)
              if (upd && (upd as any).success) gastoNuevoActual = (upd as any).data
            } else {
              const createdG = await createGastoIngreso(gastoNuevoPayload)
              if (createdG && (createdG as any).success) gastoNuevoActual = (createdG as any).data
            }
          } catch (searchErrNuevo) {
            console.warn('Error buscando/creando gasto envÃ­o nuevo (fallback):', searchErrNuevo)
          }

          if (gastoNuevoActual) {
            try {
              const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
              await recalcularLiquidacionesEnCascada(fechaAccion)
            } catch (rcErr) {
              console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras crear/actualizar gasto de envÃ­o nuevo (no crÃ­tico)', rcErr)
            }
            revalidatePath('/liquidaciones')
            revalidatePath('/eerr')
            revalidatePath('/ventas')
          }
        } catch (innerErrNuevo) {
          console.warn('Error creando/actualizando gasto de envÃ­o nuevo tras updateDevolucion (no crÃ­tico):', innerErrNuevo)
        }
      }
    } catch (errShipNuevo) {
      console.warn('Error evaluando cambio de costo_envio_nuevo (no crÃ­tico):', errShipNuevo)
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
      console.warn('No se pudo persistir explÃ­citamente numeroDevolucion/numeroSeguimiento (no crÃ­tico):', persistNumErr)
    }

    // Nota: aquÃ­ podrÃ­amos disparar lÃ³gica de cascada para stock/contabilidad
    // cuando haya cambios significativos (estado final, cambio de producto, etc.).
    // Por ahora revalidamos la ruta y devolvemos el registro actualizado.
    revalidatePath("/devoluciones")

    // Aplicar ajustes contables SOLO cuando la devoluciÃ³n se finaliza (etapa final)
    // Se distinguen dos casos: Reembolso y Cambio. Create() NO aplica ajustes.
    try {
  const prevTipo = (existing as any).tipoResolucion ?? (existing as any).tipo_resolucion ?? null
  const newTipo = merged.tipoResolucion ?? (merged as any).tipo_resolucion ?? null
      const prevEstado = existing.estado ?? null
      const newEstado = merged.estado ?? null

      const wasFinalBefore = !!(prevTipo === 'Reembolso' || (typeof prevEstado === 'string' && (String(prevEstado).includes('Reembolso') || String(prevEstado).includes('Cambio') || String(prevEstado).includes('Sin reembolso'))))
      const isFinalNow = !!(newTipo === 'Reembolso' || newTipo === 'Sin reembolso' || newTipo?.startsWith('Cambio') || (typeof newEstado === 'string' && (String(newEstado).includes('Reembolso') || String(newEstado).includes('Cambio') || String(newEstado).includes('Sin reembolso'))))

      // Obtener venta original si necesitamos aplicar ajustes
      if (isFinalNow) {
        console.log('[updateDevolucion] isFinalNow = true, newTipo:', newTipo, 'newEstado:', newEstado)
        
        // SERVER-SIDE GUARD: require fechaCompletada when finalizing (except Sin reembolso which can proceed without it)
        const fechaCompletadaProvided = !!(merged.fechaCompletada || (merged as any).fecha_completada)
        const esSinReembolso = newTipo === 'Sin reembolso' || (typeof newEstado === 'string' && String(newEstado).includes('Sin reembolso'))
        
        console.log('[updateDevolucion] fechaCompletadaProvided:', fechaCompletadaProvided, 'esSinReembolso:', esSinReembolso)
        
        if (!fechaCompletadaProvided && !esSinReembolso) {
          console.warn('FinalizaciÃ³n sin fechaCompletada detectada; cancelando ajustes contables')
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
          console.warn('No se encontrÃ³ venta para aplicar ajuste de devoluciÃ³n (update)', ventaError)
        } else {
          // Persistir siempre el desglose de envÃ­os al finalizar la devoluciÃ³n
          // para que la columna generada `perdida_total` incluya envÃ­o ida + vuelta.
          try {
            const envioOriginalFromVenta = (venta as any)?.costoEnvio ?? (venta as any)?.costo_envio ?? null
            const fueReclamoMerged = (merged as any).fueReclamo ?? (merged as any).fue_reclamo ?? (existing as any).fue_reclamo
            const envioOriginalRaw = Number((merged as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? (datosVenta as any)?.costoEnvioOriginal ?? envioOriginalFromVenta ?? 0)
            const envioOriginal = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioOriginalRaw
            const envioVueltaRaw = Number((merged as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? (datosVenta as any)?.costoEnvioDevolucion ?? 0)
            const envioVuelta = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioVueltaRaw
            const envioNuevoRaw = Number((merged as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
            const envioNuevo = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioNuevoRaw
            await supabase.from('devoluciones').update({ costo_envio_original: envioOriginal, costo_envio_devolucion: envioVuelta, costo_envio_nuevo: envioNuevo }).eq('id', updated?.id ?? (merged as any).id)
          } catch (envPersistErr) {
            console.warn('No se pudo persistir desglose de envÃ­os al finalizar (no crÃ­tico)', envPersistErr)
          }
          // Si es Reembolso -> aplicar monto reembolsado hoy (o diferencia)
          const becameReembolso = (newTipo === 'Reembolso' || (typeof newEstado === 'string' && String(newEstado).includes('Reembolso')))
          const wasReembolso = (prevTipo === 'Reembolso' || (typeof prevEstado === 'string' && String(prevEstado).includes('Reembolso')))

          // Preferir el monto que la venta realmente aportÃ³ a las liquidaciones.
          // Si el usuario no completÃ³ montoReembolsado, calculamos el monto a partir de la venta
          const { calcularMontoVentaALiquidar } = await import('@/lib/actions/actualizar-liquidacion')
          const montoVentaLiquidado = await calcularMontoVentaALiquidar(venta as any)

          const prevMonto = Number(existing.montoReembolsado ?? existing.montoVentaOriginal ?? 0)
          let newMonto = Number(merged.montoReembolsado ?? merged.montoVentaOriginal ?? 0)
          // Si no hay monto manual, usar el monto que efectivamente se liquidÃ³ para esa venta
          if ((!merged.montoReembolsado || Number(merged.montoReembolsado) === 0) && montoVentaLiquidado) {
            newMonto = montoVentaLiquidado
            // Persistir el monto calculado como montoReembolsado para trazabilidad
            try {
              await supabase.from('devoluciones').update({ montoReembolsado: newMonto }).eq('id', id)
            } catch (err) {
              console.warn('No se pudo persistir montoReembolsado calculado en devoluciÃ³n (no crÃ­tico)', err)
            }
          }
          const diffMonto = newMonto - prevMonto

          // Si es Cambio -> nos ocupamos solo de los costos de envÃ­o de devoluciÃ³n (hoy)
          const becameCambio = (newTipo && String(newTipo).includes('Cambio')) || (typeof newEstado === 'string' && String(newEstado).includes('Cambio'))
          const wasCambio = (prevTipo && String(prevTipo).includes('Cambio')) || (typeof prevEstado === 'string' && String(prevEstado).includes('Cambio'))

          // Calcular diferencia de costo de envÃ­o de devoluciÃ³n
          const prevShipping = Number(existing.costoEnvioDevolucion ?? 0)
          const newShipping = Number(merged.costoEnvioDevolucion ?? 0)
          const diffShipping = newShipping - prevShipping

          // Si es Sin reembolso -> liberar dinero retenido (vuelve a MP disponible)
          const becameSinReembolso = (newTipo === 'Sin reembolso' || (typeof newEstado === 'string' && String(newEstado).includes('Sin reembolso')))
          const wasSinReembolso = (prevTipo === 'Sin reembolso' || (typeof prevEstado === 'string' && String(prevEstado).includes('Sin reembolso')))

          // Detectar si hubo cambios financieros reales
          const cambioTipo = prevTipo !== newTipo
          const cambioEstado = prevEstado !== newEstado
          const cambioMonto = diffMonto !== 0
          const cambioEnvio = diffShipping !== 0
          const huboTransicion = (becameReembolso && !wasReembolso) || (becameCambio && !wasCambio) || (becameSinReembolso && !wasSinReembolso)
          
          // Solo aplicar ajustes si hubo cambios financieros reales
          const hayCAmbioFinanciero = cambioTipo || cambioEstado || cambioMonto || cambioEnvio || huboTransicion
          
          // Determinar ajustes a aplicar HOY
          let ajusteHoy = 0
          let aplicarRecalculo = false

          if ((becameReembolso || wasReembolso) && hayCAmbioFinanciero) {
            // Ajuste monetario: aplicar diferencia entre montos (o monto total si se convirtiÃ³ ahora)
            ajusteHoy = diffMonto !== 0 ? diffMonto : (becameReembolso && !wasReembolso ? newMonto : 0)
            aplicarRecalculo = ajusteHoy !== 0
          } else if ((becameCambio || wasCambio) && hayCAmbioFinanciero) {
            // Para cambio, solo aplicar el costo de envÃ­o de devoluciÃ³n (diferencia o monto nuevo si se convirtiÃ³ ahora)
            ajusteHoy = diffShipping !== 0 ? diffShipping : (becameCambio && !wasCambio ? newShipping : 0)
            aplicarRecalculo = ajusteHoy !== 0
          } else if (becameSinReembolso) {
            // Sin reembolso: es como que NO PASÃ“ NADA
            // Marcar producto como recuperado y actualizar estado para que no aparezca en camino ni permita registrar recepciÃ³n
            console.log('[Sin reembolso] === INICIO FLUJO SIN REEMBOLSO ===')
            console.log('[Sin reembolso] DevoluciÃ³n ID:', id)
            console.log('[Sin reembolso] Venta:', { plataforma: (venta as any).plataforma, metodoPago: (venta as any).metodoPago })
            console.log('[Sin reembolso] merged.fechaAccion:', merged.fechaAccion)
            console.log('[Sin reembolso] merged.fechaCompletada:', merged.fechaCompletada)

            // Marcar sin impacto financiero y producto como recuperado
            try {
              const updateResult = await supabase.from('devoluciones').update({ 
                monto_reembolsado: 0,
                producto_recuperable: true, // Marcar como recuperado
                costo_envio_original: 0,
                costo_envio_devolucion: 0,
                costo_envio_nuevo: 0,
                estado: 'Finalizada', // Estado para que no aparezca en camino ni permita registrar recepciÃ³n
                fecha_recepcion: null // Deshabilitar registro de recepciÃ³n
              }).eq('id', id)
              console.log('[Sin reembolso] âœ“ Campos actualizados a 0 y recuperado:', updateResult.error ? updateResult.error : 'OK')
            } catch (snErr) {
              console.error('[Sin reembolso] âœ— Error actualizando campos:', snErr)
            }

            if (!wasSinReembolso) {
              // Liberar dinero retenido (si hay) usando fechaAccion
              try {
              const plataforma = (venta as any).plataforma ?? null
              const metodoPago = (venta as any).metodoPago ?? null

              console.log('[Sin reembolso] Verificando plataforma ML:', { plataforma, metodoPago })

              if (plataforma === 'ML' || metodoPago === 'MercadoPago') {
                console.log('[Sin reembolso] âœ“ Es ML/MercadoPago - buscando delta reclamo...')

                // Buscar si hay dinero retenido previamente
                const { data: deltaReclamo, error: deltaError } = await supabase
                  .from('devoluciones_deltas')
                  .select('*')
                  .eq('devolucion_id', id)
                  .eq('tipo', 'reclamo')
                  .single()

                console.log('[Sin reembolso] Delta reclamo encontrado:', deltaReclamo)
                console.log('[Sin reembolso] Error al buscar delta:', deltaError)

                if (deltaReclamo && deltaReclamo.delta_mp_retenido > 0) {
                  const montoRetenido = Number(deltaReclamo.delta_mp_retenido)
                  console.log('[Sin reembolso] âœ“ Dinero retenido encontrado:', montoRetenido)
                  
                  // Usar fechaAccion (fecha de ejecuciÃ³n) para liberar el dinero
                  // IMPORTANTE: Usar fecha LOCAL sin convertir a UTC
                  let fechaAccion = new Date().toISOString().split('T')[0]
                  if (merged.fechaAccion) {
                    const d = new Date(merged.fechaAccion)
                    fechaAccion = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  } else if (merged.fechaCompletada) {
                    const d = new Date(merged.fechaCompletada)
                    fechaAccion = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  }
                  
                  console.log('[Sin reembolso] Fecha de liberaciÃ³n:', fechaAccion)
                  
                  // Crear delta de liberaciÃ³n
                  const deltaLiberacion: any = {
                    devolucion_id: id,
                    tipo: 'sin_reembolso',
                    fecha_impacto: fechaAccion,
                    delta_mp_disponible: montoRetenido,  // Vuelve a disponible
                    delta_mp_retenido: -montoRetenido,   // Sale de retenido
                    delta_mp_a_liquidar: 0,
                    delta_tn_a_liquidar: 0
                  }

                  console.log('[Sin reembolso] Delta a insertar:', deltaLiberacion)

                  const upsertResult = await supabase.from('devoluciones_deltas').upsert([deltaLiberacion], { onConflict: 'devolucion_id,tipo' })
                  console.log('[Sin reembolso] Resultado upsert:', upsertResult.error ? upsertResult.error : 'OK')
                  
                  aplicarRecalculo = true
                  console.log('[Sin reembolso] âœ“âœ“âœ“ Dinero liberado:', montoRetenido, 'ARS el', fechaAccion)
                } else {
                  console.log('[Sin reembolso] âœ— No habÃ­a dinero retenido (delta_mp_retenido:', deltaReclamo?.delta_mp_retenido, ')')
                }
              } else {
                console.log('[Sin reembolso] âœ— No es ML/MercadoPago - skip liberaciÃ³n')
              }
              } catch (liberarErr) {
                console.error('[Sin reembolso] âœ—âœ—âœ— Error liberando dinero retenido:', liberarErr)
              }
            }
            
            console.log('[Sin reembolso] === FIN FLUJO - aplicarRecalculo:', aplicarRecalculo, '===')
          }

          // Marcar venta como devuelta si se convirtiÃ³ en reembolso
          // (NO marcar si es Sin reembolso - la venta sigue siendo vÃ¡lida)
          if (becameReembolso && !becameSinReembolso) {
            await supabase.from('ventas').update({ estadoEnvio: 'Devuelto' }).eq('id', venta.id)
          }

          // Disparar recÃ¡lculo para Sin reembolso (liberar dinero retenido)
          if (aplicarRecalculo && becameSinReembolso) {
            try {
              const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
              const fechaRecalculo = (merged.fechaAccion && new Date(merged.fechaAccion).toISOString().split('T')[0]) || 
                                    (merged.fechaCompletada && new Date(merged.fechaCompletada).toISOString().split('T')[0]) || 
                                    new Date().toISOString().split('T')[0]
              await recalcularLiquidacionesEnCascada(fechaRecalculo)
              console.log('[Sin reembolso] RecÃ¡lculo ejecutado desde', fechaRecalculo)
              revalidatePath('/liquidaciones')
              revalidatePath('/eerr')
              revalidatePath('/ventas')
            } catch (recalcErr) {
              console.warn('Error ejecutando recÃ¡lculo para Sin reembolso (no crÃ­tico)', recalcErr)
            }
          }

          // DESHABILITADO: Este bloque es legacy y duplica el impacto de los deltas
          // Los deltas ya manejan todo el impacto financiero en las liquidaciones
          // Solo se deja el cÃ³digo de envÃ­os que estÃ¡ mÃ¡s abajo
          if (false && ajusteHoy !== 0) {
                // Ensure we persist envio breakdown and total on finalization
                try {
                  const fueReclamoMerged = (merged as any).fueReclamo ?? (merged as any).fue_reclamo ?? (existing as any).fue_reclamo
                  const envioOriginalRaw = Number(merged.costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                  const envioOriginal = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioOriginalRaw
                  const envioVueltaRaw = Number(merged.costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                  const envioVuelta = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioVueltaRaw
                  const envioNuevoRaw = Number(merged.costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                  const envioNuevo = ((venta as any)?.plataforma === 'ML' && fueReclamoMerged === false) ? 0 : envioNuevoRaw
                  const envioTotal = envioOriginal + envioVuelta + envioNuevo
                  await supabase.from('devoluciones').update({ costo_envio_original: envioOriginal, costo_envio_devolucion: envioVuelta, costo_envio_nuevo: envioNuevo }).eq('id', updated?.id ?? (merged as any).id)
                } catch (envErr) {
                  console.warn('No se pudo persistir desglose de envÃ­os en devoluciones (no crÃ­tico)', envErr)
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
                    console.warn('No se encontrÃ³ liquidaciÃ³n de hoy para aplicar ajuste de devoluciÃ³n (update)', errorHoy)
                  } else {
                    // En lugar de actualizar liquidaciones directamente, crear o actualizar un gasto/ingreso
                    // idempotente: preferir gasto_creado_id si existe, sino buscar por descripciÃ³n
                    try {
                      const { createGastoIngreso, updateGastoIngreso, getGastoIngresoById } = await import('@/lib/actions/gastos-ingresos')

                      // Use merged.fechaCompletada if provided as accounting-impact date; fallback to today
                      const impactoFecha = (merged.fechaCompletada && new Date(merged.fechaCompletada).toISOString().split('T')[0]) || fechaHoy

                      const metodoPago = venta.metodoPago || venta.metodo || null
                      const canal = metodoPago === 'MercadoPago' ? 'ML' : metodoPago === 'PagoNube' ? 'TN' : 'General'
                      const ventaRef = (venta as any)?.saleCode ?? (venta as any)?.externalOrderId ?? venta.id
                      const descripcion = `Ajuste devoluciÃ³n - venta ${ventaRef} - devol ${updated?.id ?? (merged as any).id ?? 'unknown'}`

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

                      // Fallback: buscar por descripciÃ³n que contenga 'devol <id>'
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
                          console.warn('Error buscando/creando gasto por descripciÃ³n (fallback):', searchErr)
                        }
                      }

                          // Persist only gasto_creado_id for idempotency; do not write monto_aplicado_liquidacion.
                          if (gastoActual) {
                            try {
                              await supabase.from('devoluciones').update({ gasto_creado_id: gastoActual.id ?? gastoActual }).eq('id', updated?.id ?? (merged as any).id)
                            } catch (auditErr) {
                              console.warn('No se pudo persistir gasto_creado_id en devoluciones (no crÃ­tico)', auditErr)
                            }

                        // Si la venta fue por Pago Nube, ajustar TN a liquidar EN HOY
                        try {
                          // Use previously stored monto_reembolsado as the baseline for delta calculation
                          const prevApplied = Number((existing as any).monto_reembolsado ?? 0)
                          const deltaToApply = Number(ajusteHoy) - prevApplied
                          if (deltaToApply !== 0 && (venta as any)?.metodoPago === 'PagoNube') {
                            // Aplicar la diferencia en la liquidaciÃ³n de HOY (no la fecha de impacto contable)
                            const fechaHoyActual = new Date().toISOString().split('T')[0]
                            const { data: liq, error: liqErr } = await supabase.from('liquidaciones').select('tn_a_liquidar').eq('fecha', fechaHoyActual).single()
                            if (!liqErr && liq != null) {
                              const currentTn = (liq != null && typeof liq?.tn_a_liquidar !== 'undefined') ? Number(liq?.tn_a_liquidar) : 0
                              const nuevoTn = Math.max(0, currentTn - deltaToApply)
                              try {
                                await supabase.from('liquidaciones').update({ tn_a_liquidar: nuevoTn }).eq('fecha', fechaHoyActual)
                                // Recalcular en cascada para propagar efectos
                                await recalcularLiquidacionesEnCascada(fechaHoyActual)
                              } catch (tnErr) {
                                console.warn('No se pudo ajustar tn_a_liquidar en liquidaciÃ³n HOY (no crÃ­tico)', tnErr)
                              }
                            } else {
                              console.warn('No se pudo obtener liquidaciÃ³n de HOY para ajustar tn_a_liquidar (no crÃ­tico)', liqErr)
                            }
                          }
                        } catch (tnApplyErr) {
                          console.warn('Error aplicando ajuste TN a liquidar para Pago Nube (no crÃ­tico)', tnApplyErr)
                        }

                        revalidatePath('/liquidaciones')
                        revalidatePath('/eerr')
                        revalidatePath('/ventas')
                        // If this finalization is a Reembolso and this devoluciÃ³n was marked to
                        // move money to mp_retenido, decrement mp_retenido by the refunded amount
                        try {
                          // Determine the original impact date for any mp_retenido adjustments.
                          // Prefer the persisted `fecha_impacto` on the devoluciÃ³n row; if missing,
                          // fall back to fecha_reclamo, then fecha_completada, then today.
                          let impactoFecha = null
                          try {
                            // Prefer the normalized table 'devoluciones_deltas' (tipo='reclamo') if present
                            const { data: deltaRow, error: deltaErr } = await supabase
                              .from('devoluciones_deltas')
                              .select('fecha_impacto')
                              .eq('devolucion_id', updated?.id ?? (merged as any).id ?? id)
                              .eq('tipo', 'reclamo')
                              .order('created_at', { ascending: false })
                              .limit(1)
                              .single()
                            if (!deltaErr && deltaRow != null && typeof deltaRow?.fecha_impacto !== 'undefined') impactoFecha = deltaRow?.fecha_impacto
                          } catch (pfErr) {
                            // ignore fetch errors and fall back to previous sources
                          }
                          if (!impactoFecha) {
                            try {
                              const { data: devRow } = await supabase
                                .from('devoluciones')
                                .select('fecha_reclamo, fecha_completada, created_at')
                                .eq('id', updated?.id ?? (merged as any).id ?? id)
                                .single()
                              if (devRow != null && (typeof devRow?.fecha_reclamo !== 'undefined' || typeof devRow?.fecha_completada !== 'undefined' || typeof devRow?.created_at !== 'undefined')) impactoFecha = devRow?.fecha_reclamo ?? devRow?.fecha_completada ?? devRow?.created_at
                            } catch (_) {
                              // ignore
                            }
                          }
                          if (!impactoFecha) impactoFecha = new Date().toISOString().split('T')[0]
                          else {
                            try { impactoFecha = new Date(impactoFecha).toISOString().split('T')[0] } catch { impactoFecha = String(impactoFecha) }
                          }

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
                                  console.warn('No se pudo decrementar mp_retenido al finalizar Reembolso (no crÃ­tico)', errRet)
                                }
                              } else {
                                console.warn('No se encontrÃ³ liquidaciÃ³n para decrementar mp_retenido tras Reembolso (no crÃ­tico)', liqForImpactErr)
                              }
                            } catch (errInner) {
                              console.warn('Error al procesar decremento de mp_retenido al finalizar Reembolso (no crÃ­tico)', errInner)
                            }
                          }
                        } catch (errMpMark) {
                          console.warn('Error verificando mpRetener en finalizaciÃ³n (no crÃ­tico)', errMpMark)
                        }
                      } else {
                        console.error('No se pudo crear/actualizar gasto_ingreso para devoluciÃ³n (update)')
                      }
              
                    // Si la devoluciÃ³n ahora estÃ¡ finalizada y el producto no es recuperable,
                    // persistir el costo del producto como pÃ©rdida en la devoluciÃ³n (solo ahora).
                    try {
                      const fueFinalizada = isFinalNow
                      const productoRecuperableFlag = (merged as any).productoRecuperable ?? (merged as any).producto_recuperable ?? (existing as any).producto_recuperable
                      const costoProducto = Number(merged.costoProductoOriginal ?? (merged as any).costo_producto_original ?? 0)
                      if (fueFinalizada && productoRecuperableFlag === false && costoProducto > 0) {
                        // Persistir costo de producto como pÃ©rdida (columna costo_producto_perdido o update directo)
                        // La migraciÃ³n DB deberÃ­a tener una columna que permita almacenar este valor; si no existe, el try/catch evita fallos.
                        try {
                // Persistir pÃ©rdida como suma del costo del producto + envÃ­os (ida + vuelta + nuevo)
                const fueReclamoMergedLoss = (merged as any).fueReclamo ?? (merged as any).fue_reclamo ?? (existing as any).fue_reclamo
                const envioOriginalValRaw = Number((merged as any).costoEnvioOriginal ?? (existing as any).costo_envio_original ?? 0)
                const envioOriginalVal = ((venta as any)?.plataforma === 'ML' && fueReclamoMergedLoss === false) ? 0 : envioOriginalValRaw
                const envioVueltaValRaw = Number((merged as any).costoEnvioDevolucion ?? (existing as any).costo_envio_devolucion ?? 0)
                const envioVueltaVal = ((venta as any)?.plataforma === 'ML' && fueReclamoMergedLoss === false) ? 0 : envioVueltaValRaw
                const envioNuevoValRaw = Number((merged as any).costoEnvioNuevo ?? (existing as any).costo_envio_nuevo ?? 0)
                const envioNuevoVal = ((venta as any)?.plataforma === 'ML' && fueReclamoMergedLoss === false) ? 0 : envioNuevoValRaw
                const perdidaCalculada = Number(costoProducto) + envioOriginalVal + envioVueltaVal + envioNuevoVal
                await supabase.from('devoluciones').update({ costo_producto_perdido: perdidaCalculada }).eq('id', updated?.id ?? (merged as any).id)
                          // Revalidar EERR para que la pÃ©rdida aparezca en reportes
                          revalidatePath('/eerr')
                        } catch (lossErr) {
                          console.warn('No se pudo persistir costo_producto_perdido en devoluciones (no crÃ­tico)', lossErr)
                        }
                      }
                    } catch (errLoss) {
                      console.warn('Error al evaluar persistencia de pÃ©rdida de producto tras finalizaciÃ³n (no crÃ­tico)', errLoss)
                    }
                    } catch (errCreateG) {
                      console.error('Error creando/actualizando gasto/ingreso para devoluciÃ³n (update):', errCreateG)
                    }
                  }

                // Comisiones recuperadas se manejan solo en EERR (no creamos/actualizamos gastos/ingresos aquÃ­)
          }
        }
      }
    } catch (err) {
      console.error('Error aplicando ajuste contable tras actualizar devoluciÃ³n:', err)
    }
    // For debugging/consistency: fetch the latest row from DB and return it so the caller
    // receives the persisted values (helps detect when certain columns were not actually written).
    try {
      const { data: refreshed, error: refreshErr } = await supabase.from('devoluciones').select('*').eq('id', id).single()
      if (!refreshErr && refreshed) updated = refreshed
    } catch (refreshFetchErr) {
      console.warn('No se pudo refrescar devoluciÃ³n tras update (no crÃ­tico):', refreshFetchErr)
    }
    return { success: true, data: updated }
  } catch (error) {
    console.error("Error al actualizar devoluciÃ³n:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar devoluciÃ³n" }
  }
}

// Eliminar devoluciÃ³n
export async function deleteDevolucion(id: string) {
  try {
    const { data: deleted, error } = await supabase
      .from('devoluciones')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // After deleting a devoluciÃ³n we must recalculate liquidaciones for the
    // date that was impacted by that devoluciÃ³n. Prefer `fecha_completada` (si
    // existÃ­a), luego `created_at` y como fallback usar hoy.
    try {
      const fechaImpactRaw = (deleted as any)?.fecha_completada ?? (deleted as any)?.created_at ?? null
      const fechaImpact = fechaImpactRaw ? new Date(fechaImpactRaw).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      try {
        const { recalcularLiquidacionesEnCascada } = await import('@/lib/actions/recalcular-liquidaciones')
        await recalcularLiquidacionesEnCascada(fechaImpact)
      } catch (rcErr) {
        console.warn('No se pudo ejecutar recÃ¡lculo en cascada tras eliminar devoluciÃ³n (no crÃ­tico)', rcErr)
      }
    } catch (dateErr) {
      console.warn('No se pudo determinar fecha de impacto tras eliminar devoluciÃ³n (no crÃ­tico)', dateErr)
    }

    revalidatePath("/devoluciones")
    revalidatePath('/liquidaciones')
    revalidatePath('/eerr')
    return { success: true, data: deleted }
  } catch (error) {
    console.error("Error al eliminar devoluciÃ³n:", error)
    return { success: false, error: "Error al eliminar devoluciÃ³n" }
  }
}

// Obtener devoluciÃ³n por ID desde la vista
export async function getDevolucionById(id: string) {
  try {
    // Query the base table to get venta_id (not available in the view)
    const { data, error } = await supabase
      .from('devoluciones')
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
    console.error("Error al obtener devoluciÃ³n:", error)
    throw new Error("Error al obtener devoluciÃ³n")
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

// Obtener estadÃ­sticas para reportes
export async function getEstadisticasDevoluciones(
  fechaInicio?: string, 
  fechaFin?: string,
  fechaCompraInicio?: string,
  fechaCompraFin?: string,
  plataforma?: string,
  estado?: string,
  estadoRecepcion?: string,
  estadoPrueba?: string
) {
  try {
    let query = supabase
      .from('devoluciones_resumen')
      .select('*')
      // Incluir todas las devoluciones, tanto cerradas como abiertas
      // Solo excluir las rechazadas que no tienen impacto
      .neq('estado', 'Rechazada')

    // Filtrar por fecha de reclamo
    if (fechaInicio) {
      query = query.gte('fecha_reclamo', fechaInicio)
    }
    if (fechaFin) {
      query = query.lte('fecha_reclamo', fechaFin)
    }

    // Filtrar por fecha de compra
    if (fechaCompraInicio) {
      query = query.gte('fecha_compra', fechaCompraInicio)
    }
    if (fechaCompraFin) {
      query = query.lte('fecha_compra', fechaCompraFin)
    }

    // Filtrar por plataforma
    if (plataforma && plataforma !== 'todas') {
      query = query.eq('plataforma', plataforma)
    }

    // Filtrar por estado
    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado)
    }

    // Filtrar por estado de recepciÃ³n
    if (estadoRecepcion && estadoRecepcion !== 'todos') {
      if (estadoRecepcion === 'recibido') {
        query = query.not('fecha_recepcion', 'is', null)
      } else if (estadoRecepcion === 'no_recibido') {
        query = query.is('fecha_recepcion', null)
      } else if (estadoRecepcion === 'pendiente_recibir') {
        // Solo devoluciones en proceso (no completadas) y sin recibir
        query = query.is('fecha_recepcion', null).is('tipo_resolucion', null)
      }
    }

    // Filtrar por estado de prueba
    if (estadoPrueba && estadoPrueba !== 'todos') {
      if (estadoPrueba === 'probado') {
        query = query.not('fecha_prueba', 'is', null)
      } else if (estadoPrueba === 'no_probado') {
        query = query.is('fecha_prueba', null)
      } else if (estadoPrueba === 'pendiente_probar') {
        // Recibido pero sin probar y no completado aÃºn
        query = query.not('fecha_recepcion', 'is', null).is('fecha_prueba', null).is('tipo_resolucion', null)
      } else if (estadoPrueba === 'funciona') {
        query = query.ilike('resultado_prueba', '%Funciona%')
      } else if (estadoPrueba === 'no_funciona') {
        query = query.ilike('resultado_prueba', '%No funciona%')
      }
    }

    const { data: devolucionesData, error } = await query

    if (error) throw error
    const devoluciones = await enrichDevolucionesConFueReclamo(devolucionesData || [])

    // Calcular estadÃ­sticas
    const total = devoluciones.length || 0
    
    const porEstado = devoluciones.reduce((acc, dev) => {
      acc[dev.estado] = (acc[dev.estado] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const porPlataforma = devoluciones.reduce((acc, dev) => {
      acc[dev.plataforma] = (acc[dev.plataforma] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const porTipoResolucion = devoluciones.reduce((acc, dev) => {
      if (dev.tipo_resolucion) {
        acc[dev.tipo_resolucion] = (acc[dev.tipo_resolucion] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const perdidaTotal = devoluciones.reduce((sum, dev) => sum + calcularPerdidaTotalAjustada(dev), 0)
    const impactoVentasNetas = devoluciones.reduce((sum, dev) => sum + (dev.impacto_ventas_netas || 0), 0)

    // Top motivos
    const motivosCount = devoluciones.reduce((acc, dev) => {
      acc[dev.motivo] = (acc[dev.motivo] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topMotivos = Object.entries(motivosCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([motivo, count]) => ({ motivo, count: count as number }))

    // Promedio de pÃ©rdida
    const devolucionesConPerdida = devoluciones.filter(d => calcularPerdidaTotalAjustada(d) > 0)
    const perdidaPromedio = devolucionesConPerdida.length > 0
      ? perdidaTotal / devolucionesConPerdida.length
      : 0

    // Obtener conteo de ventas en el rango proporcionado (si aplica) para mostrar % devoluciones sobre ventas
    // IMPORTANTE: Usar fechas de COMPRA (no de reclamo) para comparar con las ventas correctamente
    let totalVentas = 0
    try {
      // Preferir filtrar por 'fecha' en ventas; si falla, caer a 'created_at'
      let ventasQuery: any = supabase.from('ventas').select('id', { count: 'exact', head: true })
      // Usar fechaCompraInicio/Fin si estÃ¡n disponibles, sino caer a fechaInicio/Fin
      const fechaVentasInicio = fechaCompraInicio || fechaInicio
      const fechaVentasFin = fechaCompraFin || fechaFin
      
      if (fechaVentasInicio) {
        try { ventasQuery = ventasQuery.gte('fecha', fechaVentasInicio) } catch { ventasQuery = ventasQuery.gte('created_at', fechaVentasInicio) }
      }
      if (fechaVentasFin) {
        try { ventasQuery = ventasQuery.lte('fecha', fechaVentasFin) } catch { ventasQuery = ventasQuery.lte('created_at', fechaVentasFin) }
      }
      const ventasResp = await ventasQuery
      totalVentas = Number(ventasResp?.count ?? 0)
    } catch (errVentas) {
      console.warn('No se pudo obtener conteo de ventas para estadisticas de devoluciones (no crÃ­tico)', errVentas)
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
      data: devoluciones,
      totalVentas
    }
  } catch (error) {
    console.error("Error al obtener estadÃ­sticas:", error)
    throw new Error("Error al obtener estadÃ­sticas de devoluciones")
  }
}

// Obtener costos estimados de los Ãºltimos 30 dÃ­as para la calculadora de precios
export async function getCostosEstimados30Dias(productoId?: string, plataforma?: 'TN' | 'ML', productoSku?: string) {
  try {
    const normalize = (value: unknown): string =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()

    const isSinReembolso = (row: any): boolean => {
      const tipo = normalize(row?.tipo_resolucion ?? row?.tipoResolucion ?? "")
      const estado = normalize(row?.estado ?? "")
      return tipo === "sin reembolso" || estado.includes("sin reembolso")
    }

    const isUGC = (row: any): boolean => {
      const categoria = normalize(row?.categoria)
      const descripcion = normalize(row?.descripcion)
      return categoria.includes("ugc") || descripcion.includes("ugc")
    }

    const toLocalDateString = (date: Date): string =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

    const hoy = new Date()
    const hace30Dias = new Date(hoy)
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    const fechaInicio = toLocalDateString(hace30Dias)
    const fechaFin = toLocalDateString(hoy)
    const fechaInicioDateTime = `${fechaInicio}T00:00:00`
    const fechaFinDateTime = `${fechaFin}T23:59:59.999`
    const fechaInicioDevoluciones = fechaInicio

    console.log('[getCostosEstimados30Dias] Ventas desde:', fechaInicio, 'hasta:', fechaFin, 'Devoluciones desde:', fechaInicioDevoluciones, 'productoId:', productoId, 'productoSku:', productoSku, 'plataforma:', plataforma)

    // Obtener devoluciones de los Ãºltimos 30 dÃ­as (SIN FILTRAR POR PLATAFORMA - dato general)
    // Excluir solo rechazadas; la pÃ©rdida ajustada canÃ³nica resuelve sin reembolso/ML sin reclamo.
    let devolucionesQuery = supabase
      .from('devoluciones_resumen')
      .select('*')
      .neq('estado', 'Rechazada')
      .gte('fecha_reclamo', fechaInicioDateTime)
      .lte('fecha_reclamo', fechaFinDateTime)
    
    if (productoSku) {
      console.log('[getCostosEstimados30Dias] Filtrando devoluciones por SKU:', productoSku)
      devolucionesQuery = devolucionesQuery.eq('producto_sku', productoSku)
    }
    // NO filtrar por plataforma - queremos dato general
    
    const { data: devolucionesRaw, error: errorDev } = await devolucionesQuery
    const devoluciones = await enrichDevolucionesConFueReclamo(devolucionesRaw || [])
    console.log('[getCostosEstimados30Dias] Devoluciones (30d) encontradas:', devoluciones.length, 'error:', errorDev)
    if (devoluciones && devoluciones.length > 0) {
      console.log('[getCostosEstimados30Dias] Muestra devoluciones (primeras 3):', devoluciones.slice(0, 3).map(d => ({
        sku: d.producto_sku,
        fecha_reclamo: d.fecha_reclamo,
        perdida: calcularPerdidaTotalAjustada(d)
      })))
    }
    if (errorDev) {
      console.error('[getCostosEstimados30Dias] Error completo devoluciones:', JSON.stringify(errorDev))
    }

    // Obtener ventas de los Ãºltimos 30 dÃ­as (SIN FILTRAR POR PLATAFORMA) para cÃ¡lculo de devoluciones
    let ventasGeneralesQuery = supabase
      .from('ventas')
      .select('*')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)
    if (productoId) {
      ventasGeneralesQuery = ventasGeneralesQuery.eq('productoId', productoId)
    }
    const { data: ventasGenerales } = await ventasGeneralesQuery
    const totalVentasGenerales = ventasGenerales?.length || 0

    // Para costo de devoluciones por unidad del modelo: usar ventas - devoluciones con impacto
    // (misma regla operativa usada en tablero: contar devoluciones no rechazadas y excluir "Sin reembolso").
    const cantidadDevoluciones = (devoluciones || []).filter((d: any) => !isSinReembolso(d)).length
    const unidadesVendidasNoDevueltas = Math.max(totalVentasGenerales - cantidadDevoluciones, 0)

    // Obtener ventas de los Ãºltimos 30 dÃ­as (filtrar por producto y plataforma) para cÃ¡lculos especÃ­ficos de plataforma
    let ventasQuery = supabase
      .from('ventas')
      .select('*')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)
    
    if (productoId) {
      ventasQuery = ventasQuery.eq('productoId', productoId)
      console.log('[getCostosEstimados30Dias] Filtrando ventas por productoId:', productoId)
    }
    
    if (plataforma) {
      ventasQuery = ventasQuery.eq('plataforma', plataforma)
      console.log('[getCostosEstimados30Dias] Filtrando ventas por plataforma:', plataforma)
    }
    
    const { data: ventas, error: errorVentas } = await ventasQuery
    console.log('[getCostosEstimados30Dias] Ventas (30d plataforma) encontradas:', ventas?.length, 'error:', errorVentas)
    if (errorVentas) {
      console.error('[getCostosEstimados30Dias] Error completo ventas:', JSON.stringify(errorVentas))
    }
    const totalVentas = ventas?.length || 0

    // Calcular pÃ©rdida total por devoluciones del modelo especÃ­fico (general, no por plataforma)
    const perdidaTotalDevoluciones = devoluciones?.reduce((sum, dev) => sum + calcularPerdidaTotalAjustada(dev), 0) || 0

    // Calcular costo de incidencia de devoluciones (GENERAL, no por plataforma):
    // PÃ©rdidas totales del modelo (30d) / unidades vendidas no devueltas del modelo (30d)
    const costoDevolucionesPorVenta = unidadesVendidasNoDevueltas > 0 
      ? Math.round((perdidaTotalDevoluciones / unidadesVendidasNoDevueltas) * 100) / 100
      : 0
    
    console.log('[getCostosEstimados30Dias] Devoluciones (30d):', cantidadDevoluciones, 'Ventas generales (30d):', totalVentasGenerales, 'No devueltas:', unidadesVendidasNoDevueltas, 'PÃ©rdidas:', perdidaTotalDevoluciones, 'Costo/venta:', costoDevolucionesPorVenta)

    // Primero verificar si hay gastos en general
    const { data: gastosTotales } = await supabase
      .from('gastos_ingresos')
      .select('categoria, tipo, fecha')
      .eq('tipo', 'Gasto')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)
      .limit(5)
    console.log('[getCostosEstimados30Dias] Muestra de gastos totales:', gastosTotales)

    // Obtener gasto en ADS de los Ãºltimos 30 dÃ­as (mismo filtro que EERR)
    const { data: gastosAds, error: errorAds } = await supabase
      .from('gastos_ingresos')
      .select('montoARS, categoria, fecha, descripcion')
      .eq('tipo', 'Gasto')
      .or('categoria.eq.Gastos del negocio - ADS,descripcion.ilike.%Meta ADS%')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)

    console.log('[getCostosEstimados30Dias] Gastos ADS encontrados:', gastosAds?.length, 'error:', errorAds)
    if (gastosAds && gastosAds.length > 0) {
      console.log('[getCostosEstimados30Dias] Muestra de gastos ADS:', gastosAds.slice(0, 3))
    }

    const totalGastosAds = Math.round((gastosAds?.reduce((sum, g) => {
      const monto = Number(g.montoARS) || 0
      return sum + monto
    }, 0) || 0) * 100) / 100
    
    console.log('[getCostosEstimados30Dias] Total gastos ADS:', totalGastosAds)

    // UGC se considera marketing (igual que EERR), no estructura
    const { data: gastosUGCData, error: errorUGC } = await supabase
      .from('gastos_ingresos')
      .select('montoARS, categoria, descripcion, fecha')
      .eq('tipo', 'Gasto')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)

    const totalGastosUGC = Math.round((gastosUGCData?.reduce((sum, g) => {
      if (!isUGC(g)) return sum
      return sum + Math.abs(Number(g.montoARS) || 0)
    }, 0) || 0) * 100) / 100
    console.log('[getCostosEstimados30Dias] Total gastos UGC:', totalGastosUGC, 'error:', errorUGC)

    // Calcular envÃ­o promedio (total envÃ­os / cantidad de ventas) por plataforma
    const totalEnvios = ventas?.reduce((sum, v) => {
      const envio = Number(v.cargoEnvioCosto || v.cargo_envio_costo || v.costo_envio || v.costoEnvio) || 0
      return sum + envio
    }, 0) || 0
    const envioPromedio = totalVentas > 0 ? Math.round((totalEnvios / totalVentas) * 100) / 100 : 0
    console.log('[getCostosEstimados30Dias] Total envios:', totalEnvios, 'Envio promedio:', envioPromedio)

    // Calcular precio de venta promedio por plataforma
    const totalPrecioVenta = ventas?.reduce((sum, v) => {
      const precio = Number(v.pv_bruto || v.pvBruto || v.precio_venta) || 0
      return sum + precio
    }, 0) || 0
    const precioVentaPromedio = totalVentas > 0 ? Math.round((totalPrecioVenta / totalVentas) * 100) / 100 : 0

    // Calcular ROAS GENERAL (todas las plataformas) de los Ãºltimos 30 dÃ­as
    // Usar EXACTAMENTE la misma fÃ³rmula que EERR: ROAS = Ventas totales (SIN reembolsos) / Publicidad
    
    // IGUAL QUE EERR: Obtener devoluciones para identificar ventas a excluir
    const { data: devolucionesForExclusion } = await supabase
      .from('devoluciones')
      .select('id, venta_id, tipo_resolucion, estado')
      .gte('fecha_reclamo', fechaInicioDateTime)
      .lte('fecha_reclamo', fechaFinDateTime)
    
    const devolucionesExcl = devolucionesForExclusion || []
    
    // IGUAL QUE EERR: Construir lista de venta_ids que tuvieron reembolso o estÃ¡n en devoluciÃ³n
    const ventaIdsExclSet = new Set<string>()
    for (const d of devolucionesExcl) {
      const tipo = String(d.tipo_resolucion || '')
      const estado = String(d.estado || '')
      
      // Excluir la venta si:
      // 1. tipo_resolucion es 'Reembolso'
      // 2. estado es 'En devolución' (aún no finalizada)
      const isReembolso = tipo.toLowerCase().includes('reembolso')
      const isEnDevolucion = estado === 'En devolución'
      
      if ((isReembolso || isEnDevolucion) && d.venta_id) {
        ventaIdsExclSet.add(String(d.venta_id))
      }
    }
    
    console.log('ðŸ” Devoluciones para exclusiÃ³n encontradas:', devolucionesExcl.length, 'Ventas a excluir:', ventaIdsExclSet.size)
    
    // IGUAL QUE EERR: Construir query de ventas excluyendo reembolsadas
    let ventasRoasQuery = supabase
      .from('ventas')
      .select('id, pvBruto, plataforma, cargoEnvioCosto')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)
    
    // IGUAL QUE EERR: Si hay ids a excluir, usar .not('id','in',`(1,2,3)`)
    const ventaIdsExcluir = Array.from(ventaIdsExclSet)
    if (ventaIdsExcluir.length > 0) {
      const quoted = ventaIdsExcluir.map(id => `'${id}'`).join(',')
      const inString = `(${quoted})`
      ventasRoasQuery = ventasRoasQuery.not('id', 'in', inString)
    }
    
    const { data: todasVentasRoas, error: errorVentasRoas } = await ventasRoasQuery
    
    // IGUAL QUE EERR: Aplicar exclusiÃ³n en memoria para asegurar
    let ventasFiltradas = todasVentasRoas || []
    if (ventaIdsExcluir.length > 0 && ventasFiltradas.length > 0) {
      const before = ventasFiltradas.length
      ventasFiltradas = ventasFiltradas.filter(v => !ventaIdsExclSet.has(String(v.id)))
      const after = ventasFiltradas.length
      console.log('ðŸ“Š ROAS - ExclusiÃ³n en memoria:', { before, after, excluidas: before - after })
    }
    
    console.log('ðŸ“Š ROAS - Total ventas (despuÃ©s de exclusiÃ³n):', ventasFiltradas.length, 'error:', errorVentasRoas)
    
    if (errorVentasRoas) {
      console.error('âŒ Error en query de ventas para ROAS:', errorVentasRoas)
    }
    
    if (ventasFiltradas && ventasFiltradas.length > 0) {
      console.log('ðŸ“Š ROAS - Primeras 5 ventas:', ventasFiltradas.slice(0, 5).map(v => ({ pvBruto: v.pvBruto })))
    } else {
      console.log('âš ï¸ No se encontraron ventas para ROAS')
    }
    
    const totalVentasBruto = Math.round((ventasFiltradas.reduce((sum, v) => {
      const precio = Number(v.pvBruto) || 0
      return sum + precio
    }, 0)) * 100) / 100
    
    const inversionMarketing = Math.round((totalGastosAds + totalGastosUGC) * 100) / 100
    const roas = inversionMarketing > 0 ? Math.round((totalVentasBruto / inversionMarketing) * 100) / 100 : 0
    
    console.log('ðŸ’° ROAS DETALLADO:')
    console.log('   - Total ventas bruto (sin reembolsos):', totalVentasBruto)
    console.log('   - Total ADS:', totalGastosAds)
    console.log('   - Total UGC:', totalGastosUGC)
    console.log('   - InversiÃ³n marketing (ADS+UGC):', inversionMarketing)
    console.log('   - ROAS calculado:', roas)
    console.log('   - Cantidad ventas incluidas:', ventasFiltradas.length)
    console.log('   - Cantidad ventas excluidas:', ventaIdsExcluir.length)
    
    // IGUAL QUE EERR: Otros gastos (todos, excluyendo solo ADS)
    // NOTA: Incluimos "Gastos del negocio - Envios" porque necesitamos calcular la diferencia con los envÃ­os de plataforma
    const { data: otrosGastosData, error: errorGastosNegocio } = await supabase
      .from("gastos_ingresos")
      .select("montoARS,categoria,canal,descripcion")
      .gte("fecha", fechaInicioDateTime)
      .lte("fecha", fechaFinDateTime)
      .eq("tipo", "Gasto")
      .not("categoria", "eq", "Gastos del negocio - ADS")
    
    // IGUAL QUE EERR: Excluir gastos personales y Pago de ImportaciÃ³n
    // Nota: Solo filtramos gastos personales aquÃ­. Los ingresos personales se excluyen en eerr.ts
    const categoriasPersonales = ["Gastos de Casa", "Gastos de Geronimo", "Gastos de Sergio"]
    const categoriasExcluirEERR = [...categoriasPersonales, "Pago de Importación", "Pago de Importacion"]
    const categoriasExcluirEERRNorm = new Set(categoriasExcluirEERR.map(normalize))
    // TAMBIÃ‰N excluir "Gastos del negocio - Envios devoluciones" porque ya estÃ¡n en pÃ©rdidas de devoluciones
    const gastosNegocio = otrosGastosData 
      ? otrosGastosData.filter(g =>
          !categoriasExcluirEERRNorm.has(normalize(g.categoria)) &&
          normalize(g.categoria) !== normalize('Gastos del negocio - Envios devoluciones') &&
          !isUGC(g)
        )
      : []
    
    // IGUAL QUE EERR: Calcular diferencia de envÃ­os TN (envÃ­os pagados - envÃ­os en plataforma)
    // 1. Total de envÃ­os TN pagados (de gastos_ingresos)
    const enviosNegocioTN = gastosNegocio.filter(g => g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN')
    const totalEnviosNegocioTN = enviosNegocioTN.reduce((acc, g) => acc + (Number(g.montoARS) || 0), 0)
    
    // 2. Total de envÃ­os TN en plataforma (de las ventas)
    const totalEnviosCostosPlataformaTN = ventasFiltradas
      .filter(v => v.plataforma === 'TN')
      .reduce((acc, v) => acc + (Number(v.cargoEnvioCosto) || 0), 0)
    
    // 3. Diferencia (envÃ­os pagados - envÃ­os en plataforma)
    const diferenciaEnvios = totalEnviosNegocioTN - totalEnviosCostosPlataformaTN
    
    // 4. Otros gastos del negocio: todos menos los envÃ­os TN (que se suman como diferencia)
    const otrosGastosNegocio = gastosNegocio.filter(g => !(g.categoria === 'Gastos del negocio - Envios' && g.canal === 'TN'))
    const totalOtrosGastosNegocio = otrosGastosNegocio.reduce((acc, g) => acc + (Number(g.montoARS) || 0), 0)
    
    // 5. Total final de otros gastos del negocio incluye la diferencia de envÃ­os
    const totalGastosNegocio = Math.round((totalOtrosGastosNegocio + diferenciaEnvios) * 100) / 100
    
    console.log('[getCostosEstimados30Dias] Total gastos obtenidos:', otrosGastosData?.length, 'Gastos negocio (filtrados):', gastosNegocio.length, 'error:', errorGastosNegocio)
    console.log('[getCostosEstimados30Dias] ðŸ“¦ CÃLCULO ENVÃOS TN:')
    console.log('   - EnvÃ­os TN pagados (gastos):', totalEnviosNegocioTN.toFixed(2), `(${enviosNegocioTN.length} registros)`)
    console.log('   - EnvÃ­os TN en plataforma (ventas):', totalEnviosCostosPlataformaTN.toFixed(2))
    console.log('   - Diferencia (pagados - plataforma):', diferenciaEnvios.toFixed(2))
    
    if (gastosNegocio && gastosNegocio.length > 0) {
      console.log('[getCostosEstimados30Dias] Muestra gastos negocio:', otrosGastosNegocio.slice(0, 5).map(g => ({ categoria: g.categoria, monto: g.montoARS })))
      console.log('[getCostosEstimados30Dias] CategorÃ­as Ãºnicas:', [...new Set(otrosGastosNegocio.map(g => g.categoria))])
      
      // Log detallado por categorÃ­a
      const porCategoria = otrosGastosNegocio.reduce((acc, g) => {
        const cat = g.categoria
        if (!acc[cat]) acc[cat] = { total: 0, count: 0 }
        acc[cat].total += Number(g.montoARS) || 0
        acc[cat].count += 1
        return acc
      }, {} as Record<string, { total: number, count: number }>)
      
      console.log('[getCostosEstimados30Dias] ðŸ“‹ DETALLE POR CATEGORÃA:')
      Object.entries(porCategoria).forEach(([cat, data]) => {
        console.log(`   - ${cat}: $${data.total.toFixed(2)} (${data.count} gastos)`)
      })
    }
    
    console.log('[getCostosEstimados30Dias] ðŸ’° DETALLE GASTOS DEL NEGOCIO:')
    console.log('   - Total gastos del negocio:', totalGastosNegocio)
    console.log('   - Cantidad de gastos incluidos:', gastosNegocio.length)
    
    // Para prorrateo de estructura: ventas generales - devoluciones generales (no rechazadas).
    const { data: todasVentas30d } = await supabase
      .from('ventas')
      .select('id')
      .gte('fecha', fechaInicioDateTime)
      .lte('fecha', fechaFinDateTime)

    const { data: devoluciones30d } = await supabase
      .from('devoluciones_resumen')
      .select('id')
      .neq('estado', 'Rechazada')
      .gte('fecha_reclamo', fechaInicioDateTime)
      .lte('fecha_reclamo', fechaFinDateTime)

    const totalVentasGenerales30d = todasVentas30d?.length || 0
    const cantidadDevoluciones30d = devoluciones30d?.length || 0
    const ventasNoDevueltas30d = Math.max(totalVentasGenerales30d - cantidadDevoluciones30d, 0)
    
    console.log('[getCostosEstimados30Dias] ðŸ“Š DETALLE VENTAS/DEVOLUCIONES 30d (base general):')
    console.log('   - Total ventas 30d:', totalVentasGenerales30d)
    console.log('   - Total devoluciones 30d:', cantidadDevoluciones30d)
    console.log('   - Ventas no devueltas:', ventasNoDevueltas30d)
    
    // Calcular costo de gastos del negocio por venta (dividir por ventas NO devueltas)
    const costoGastosNegocioPorVenta = ventasNoDevueltas30d > 0
      ? Math.round((totalGastosNegocio / ventasNoDevueltas30d) * 100) / 100
      : 0
    
    console.log('[getCostosEstimados30Dias] ðŸ’µ CÃLCULO FINAL:')
    console.log('   - Total gastos negocio: $', totalGastosNegocio)
    console.log('   - Ventas no devueltas:', ventasNoDevueltas30d)
    console.log('   - Costo por venta: $', costoGastosNegocioPorVenta)
    console.log('   - FÃ³rmula:', totalGastosNegocio, '/', ventasNoDevueltas30d, '=', costoGastosNegocioPorVenta)
    console.log('[getCostosEstimados30Dias] ROAS:', roas)

    const resultado = {
      costoDevolucionesPorVenta,
      costoGastosNegocioPorVenta,
      totalVentas,
      cantidadDevoluciones,
      unidadesVendidasNoDevueltas,
      perdidaTotalDevoluciones,
      totalGastosAds,
      totalGastosNegocio,
      envioPromedio,
      precioVentaPromedio,
      roas
    }

    console.log('[getCostosEstimados30Dias] Resultado:', resultado)

    return resultado
  } catch (error) {
    console.error("[getCostosEstimados30Dias] Error al obtener costos estimados:", error)
    return {
      costoDevolucionesPorVenta: 0,
      costoGastosNegocioPorVenta: 0,
      totalVentas: 0,
      cantidadDevoluciones: 0,
      unidadesVendidasNoDevueltas: 0,
      perdidaTotalDevoluciones: 0,
      totalGastosAds: 0,
      totalGastosNegocio: 0,
      envioPromedio: 0,
      precioVentaPromedio: 0,
      roas: 0
    }
  }
}


