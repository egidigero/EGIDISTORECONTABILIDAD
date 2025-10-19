"use server"

import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { devolucionSchema, type DevolucionFormData, type GastoIngresoFormData } from "@/lib/validations"
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
  }
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key]
    const snake = mapping[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase()
    out[snake] = toSnakeCase(val)
  }
  return out
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

    // Auto-completar costos desde la venta original
    return {
      costoProductoOriginal: venta.costoProducto || 0,
      costoEnvioOriginal: venta.costoEnvio || 0,
      montoVentaOriginal: venta.montoTotal || 0,
      // commission removed from devoluciones; derive from venta when necessary
      plataforma: venta.plataforma,
      productoId: venta.productoId,
      comprador: venta.comprador,
      fechaCompra: venta.fecha
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
    return data
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
      motivo: devolucionCompleta.motivo,
  // plataforma is NOT NULL in the DB; if we couldn't fetch it from the venta or the form,
  // default to 'TN' (Tienda Nube) to avoid DB constraint violation. Adjust as needed.
  plataforma: (validatedData as any).plataforma ?? datosVenta?.plataforma ?? 'TN',
      estado: devolucionCompleta.estado ?? 'Pendiente',
      tipo_resolucion: devolucionCompleta.tipoResolucion ?? null,
  // Persistir costo de producto SOLO si no es provisional
  costo_producto_original: isProvisional ? 0 : Number(devolucionCompleta.costoProductoOriginal ?? 0),
  costo_producto_nuevo: isProvisional ? 0 : Number(devolucionCompleta.costoProductoNuevo ?? 0),
  producto_recuperable: isProvisional ? false : Boolean((devolucionCompleta as any).productoRecuperable ?? false),
      costo_envio_original: Number(devolucionCompleta.costoEnvioOriginal ?? 0),
      costo_envio_devolucion: Number(devolucionCompleta.costoEnvioDevolucion ?? 0),
      costo_envio_nuevo: Number(devolucionCompleta.costoEnvioNuevo ?? 0),
      monto_venta_original: Number(devolucionCompleta.montoVentaOriginal ?? 0),
      // No persistir montoReembolsado en informes provisionales
      monto_reembolsado: isProvisional ? 0 : Number(devolucionCompleta.montoReembolsado ?? 0),
      observaciones: devolucionCompleta.observaciones ?? null,
    }

    const { data: created, error } = await supabase
      .from('devoluciones')
      .insert([dbRow])
      .select()
      .single()

    if (error) throw error

    // Aplicar ajuste contable inmediato para el costo de envío de devolución:
    // El negocio requiere que al registrar el informe se reste el costo de envío
    // de la disponibilidad de MercadoPago en la fecha de hoy.
    try {
  // Solo aplicar en la liquidación de hoy el costo de envío de vuelta (devolución).
  // El costo de ida ya fue aplicado en su momento cuando se registró la venta.
  const costoEnvioDevolucion = Number(validatedData.costoEnvioDevolucion ?? 0)
  const costoEnvio = costoEnvioDevolucion
      if (costoEnvio && costoEnvio > 0) {
        const fechaHoy = new Date().toISOString().split('T')[0]
        const { asegurarLiquidacionParaFecha } = await import('@/lib/actions/liquidaciones')
        await asegurarLiquidacionParaFecha(fechaHoy)
        const { data: liquidacionHoy, error: errorHoy } = await supabase
          .from('liquidaciones')
          .select('*')
          .eq('fecha', fechaHoy)
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
              fecha: new Date(fechaHoy),
              tipo: 'Gasto',
              categoria: 'Gastos del negocio - Envíos devoluciones',
              descripcion: `${descripcion} - devol ${created.id}`,
              montoARS: costoEnvio,
              canal: 'General'
            })

            if (gastoRes && gastoRes.success) {
              // Persistir en la devolución el monto aplicado hoy para auditoría (solo envío vuelta)
              try {
                await supabase.from('devoluciones').update({ monto_aplicado_liquidacion: costoEnvio }).eq('id', created.id)
              } catch (auditErr) {
                console.warn('No se pudo persistir monto_aplicado_liquidacion en creación (no crítico)', auditErr)
              }

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
export async function updateDevolucion(id: string, data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    // Obtener registro existente para hacer un update tipo "merge"
    const { data: existing, error: fetchError } = await supabase
      .from('devoluciones')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!existing) throw new Error('Devolución no encontrada')

    // Auto-completar campos originales desde la venta si hace falta
    let datosVenta = null
    if (validatedData.ventaId) {
      datosVenta = await obtenerDatosVenta(validatedData.ventaId)
    }

    const merged = {
      // mantener los valores actuales y sobreescribir con los campos validados
      ...existing,
      ...validatedData,
      // asegurar que los campos originales se completen si vienen vacíos
      costoProductoOriginal: validatedData.costoProductoOriginal ?? existing.costoProductoOriginal ?? datosVenta?.costoProductoOriginal ?? 0,
      costoEnvioOriginal: validatedData.costoEnvioOriginal ?? existing.costoEnvioOriginal ?? datosVenta?.costoEnvioOriginal ?? 0,
      montoVentaOriginal: validatedData.montoVentaOriginal ?? existing.montoVentaOriginal ?? datosVenta?.montoVentaOriginal ?? 0,
      // commission removed: not persisted on devoluciones
      nombreContacto: validatedData.nombreContacto ?? existing.nombreContacto ?? datosVenta?.comprador ?? existing.nombreContacto,
      fechaCompra: validatedData.fechaCompra ?? existing.fechaCompra ?? datosVenta?.fechaCompra ?? existing.fechaCompra,
    }

    const { data: updated, error } = await supabase
      .from('devoluciones')
      .update(toSnakeCase(merged))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Nota: aquí podríamos disparar lógica de cascada para stock/contabilidad
    // cuando haya cambios significativos (estado final, cambio de producto, etc.).
    // Por ahora revalidamos la ruta y devolvemos el registro actualizado.
    revalidatePath("/devoluciones")

    // Aplicar ajustes contables SOLO cuando la devolución se finaliza (etapa final)
    // Se distinguen dos casos: Reembolso y Cambio. Create() NO aplica ajustes.
    try {
      const prevTipo = existing.tipoResolucion ?? existing.tipo_resolucion ?? null
      const newTipo = merged.tipoResolucion ?? merged.tipo_resolucion ?? null
      const prevEstado = existing.estado ?? null
      const newEstado = merged.estado ?? null

      const wasFinalBefore = !!(prevTipo === 'Reembolso' || (typeof prevEstado === 'string' && (String(prevEstado).includes('Reembolso') || String(prevEstado).includes('Cambio'))))
      const isFinalNow = !!(newTipo === 'Reembolso' || newTipo?.startsWith('Cambio') || (typeof newEstado === 'string' && (String(newEstado).includes('Reembolso') || String(newEstado).includes('Cambio'))))

      // Obtener venta original si necesitamos aplicar ajustes
      if (isFinalNow) {
        // SERVER-SIDE GUARD: require fechaCompletada when finalizing; the client already enforces this but
        // validate on the server as well to avoid surprises from direct API calls.
        const fechaCompletadaProvided = !!(merged.fechaCompletada || merged.fecha_completada)
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
              await supabase.from('devoluciones').update({ montoReembolsado: newMonto }).eq('id', merged.id)
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
                      const descripcion = `Ajuste devolución - venta ${ventaRef} - devol ${merged.id}`

                      // Build payload
                      const gastoPayload = {
                        fecha: new Date(impactoFecha),
                        tipo: 'Gasto' as const,
                        categoria: 'Gastos del negocio - Envíos devoluciones',
                        descripcion,
                        montoARS: ajusteHoy,
                        canal: canal as any
                      } as unknown as GastoIngresoFormData

                      let gastoActual: any = null

                      // Try persisted gasto_creado_id first (existing DB column may or may not exist)
                      try {
                        const gastoIdPersistido = merged.gasto_creado_id || (existing as any).gasto_creado_id || null
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
                            .ilike('descripcion', `%devol ${merged.id}%`)
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

                      // Persistir monto_aplicado_liquidacion e intentar persistir gasto_creado_id para idempotencia futura
                      if (gastoActual) {
                        try {
                          await supabase.from('devoluciones').update({ monto_aplicado_liquidacion: ajusteHoy, gasto_creado_id: gastoActual.id ?? gastoActual }).eq('id', merged.id)
                        } catch (auditErr) {
                          console.warn('No se pudo persistir auditoría (monto_aplicado_liquidacion/gasto_creado_id) en devoluciones (no crítico)', auditErr)
                        }

                        revalidatePath('/liquidaciones')
                        revalidatePath('/eerr')
                        revalidatePath('/ventas')
                      } else {
                        console.error('No se pudo crear/actualizar gasto_ingreso para devolución (update)')
                      }
              
                    // Si la devolución ahora está finalizada y el producto no es recuperable,
                    // persistir el costo del producto como pérdida en la devolución (solo ahora).
                    try {
                      const fueFinalizada = isFinalNow
                      const productoRecuperableFlag = (merged.productoRecuperable ?? (merged as any).producto_recuperable)
                      const costoProducto = Number(merged.costoProductoOriginal ?? merged.costo_producto_original ?? 0)
                      if (fueFinalizada && productoRecuperableFlag === false && costoProducto > 0) {
                        // Persistir costo de producto como pérdida (columna costo_producto_perdido o update directo)
                        // La migración DB debería tener una columna que permita almacenar este valor; si no existe, el try/catch evita fallos.
                        try {
                          await supabase.from('devoluciones').update({ costo_producto_perdido: costoProducto }).eq('id', merged.id)
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

    revalidatePath("/devoluciones")
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
    return data
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
      data: devoluciones || []
    }
  } catch (error) {
    console.error("Error al obtener estadísticas:", error)
    throw new Error("Error al obtener estadísticas de devoluciones")
  }
}
