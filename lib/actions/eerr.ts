//
"use server"


import { supabase } from "@/lib/supabase"
import type { EERRData, Plataforma, MetodoPago } from "@/lib/types"
import { calcularVenta, getTarifa } from "@/lib/calculos"

export async function calcularEERR(
  fechaDesde: Date,
  fechaHasta: Date,
  canal?: Plataforma | "General",
): Promise<EERRData> {
  try {
    // ==== Devoluciones: primero obtener devoluciones finalizadas en el período
    // Queremos identificar las ventas que fueron reembolsadas para EXCLUIRLAS
    // completamente del cálculo de ventas/comisiones/envíos del EERR.
    let devolucionesQueryForExclusion = supabase
      .from('devoluciones')
      .select('id, venta_id, tipo_resolucion, estado, monto_reembolsado, plataforma, fecha_reclamo')
      .gte('fecha_reclamo', fechaDesde.toISOString())
      .lte('fecha_reclamo', fechaHasta.toISOString())

    if (canal && canal !== 'General') {
      devolucionesQueryForExclusion = devolucionesQueryForExclusion.eq('plataforma', canal)
    }

    const { data: devolucionesForExclusion, error: devolExclErr } = await devolucionesQueryForExclusion
    const devolucionesExcl = !devolExclErr && Array.isArray(devolucionesForExclusion) ? devolucionesForExclusion : []
    // Debug: mostrar devoluciones candidatas para exclusión (venta_id, tipo, monto_reembolsado)
    try {
      console.log('EERR debug - devolucionesForExclusion sample:', (devolucionesExcl || []).map(d => ({ id: d.id, venta_id: d.venta_id, tipo_resolucion: d.tipo_resolucion ?? d.estado, monto_reembolsado: Number(d.monto_reembolsado || 0) })))
    } catch (e) {}

    // Construir lista de venta_ids que tuvieron reembolso o están en devolución (las excluiremos)
    const ventaIdsExclSet = new Set<string>()
    for (const d of devolucionesExcl) {
      const tipo = String((d as any).tipo_resolucion || '')
      const estado = String((d as any).estado || '')
      
      // Excluir la venta si:
      // 1. tipo_resolucion es 'Reembolso'
      // 2. estado es 'En devolución' (aún no finalizada)
      const isReembolso = (typeof tipo === 'string' && tipo.toLowerCase().includes('reembolso'))
      const isEnDevolucion = estado === 'En devolución'
      
      if ((isReembolso || isEnDevolucion) && (d as any).venta_id) {
        ventaIdsExclSet.add(String((d as any).venta_id))
      }
    }

    // Construir filtros para ventas (excluyendo ventas reembolsadas)
    let ventasQuery = supabase
      .from("ventas")
      .select(`
        id,
        pvBruto, 
        precioNeto, 
        costoProducto, 
        cargoEnvioCosto, 
        ingresoMargen,
        comision,
        iibb,
        plataforma
      `)
      .gte("fecha", fechaDesde.toISOString())
      .lte("fecha", fechaHasta.toISOString())

    // Si canal es específico, filtrar por ese canal; si es General, no filtrar (traer todos)
    if (canal && canal !== "General") {
      ventasQuery = ventasQuery.eq("plataforma", canal)
    }

    // Si hay ids a excluir, usar .not('id','in',`(1,2,3)`)
    const ventaIdsExcl = Array.from(ventaIdsExclSet)
    if (ventaIdsExcl.length > 0) {
      // Supabase/PostgREST expects quoted strings for UUIDs in the 'in' operator
      const quoted = ventaIdsExcl.map(id => `'${id}'`).join(',')
      const inString = `(${quoted})`
      ventasQuery = ventasQuery.not('id', 'in', inString)
      // Debug: show the exact in-string used
      try { console.log('EERR debug - exclusion in-string:', inString) } catch (e) {}

      // Sanity-check: for each excluded id, log whether a venta with that id exists in the date range
      try {
        for (const vid of ventaIdsExcl) {
          try {
            const { data: found, error: foundErr } = await supabase
              .from('ventas')
              .select('id')
              .eq('id', vid)
              .gte('fecha', fechaDesde.toISOString())
              .lte('fecha', fechaHasta.toISOString())

            if (!foundErr && Array.isArray(found) && found.length > 0) {
              console.log('EERR debug - excluded venta FOUND in range (should be removed):', vid)
            } else {
              console.log('EERR debug - excluded venta NOT FOUND in range (no-op):', vid)
            }
          } catch (qErr) {
            console.warn('EERR debug - error checking venta existence for exclusion', vid, qErr)
          }
        }
      } catch (e) { /* ignore debug errors */ }
    }

    // Debug: show which venta ids we're excluding because of reembolsos
    try {
      console.log('EERR debug - ventaIdsExcl:', ventaIdsExcl)
    } catch (e) {
      /* ignore logging failures */
    }

    const ventasResult = await ventasQuery
    let ventas: any[] = Array.isArray((ventasResult as any).data) ? (ventasResult as any).data : []
    const ventasError = (ventasResult as any).error

    if (ventasError) {
      console.error("Error al obtener ventas:", ventasError)
      throw new Error("Error al obtener ventas")
    }

    try { console.log('EERR debug - ventas fetched count (raw):', ventas.length) } catch (e) {}

    // In-memory exclusion: asegúrate que las ventas marcadas para exclusión se eliminen
    if (ventaIdsExcl.length > 0 && Array.isArray(ventas) && ventas.length > 0) {
      try {
        const before = ventas.length
        ventas = ventas.filter(v => !ventaIdsExclSet.has(String(v.id)))
        const after = ventas.length
        console.log('EERR debug - ventas count after in-memory exclusion:', { before, after })
      } catch (e) {
        console.warn('EERR debug - error aplicando exclusión en memoria (no crítico)', e)
      }
    }

    // Calcular totales de ventas usando la lógica centralizada de calcularVenta
    let ventasTotales = {
      ventasTotales: 0,
      costoProducto: 0,
      envios: 0, // Solo envíos de TN (para comparar con gastos de envío)
      enviosTotales: 0, // Todos los envíos (TN + ML) para mostrar en costos de plataforma
      comisionesBase: 0,
      ivaComisiones: 0,
      iibbComisiones: 0,
      comisionesTotales: 0,
      comisionesExtra: 0,
      margenBruto: 0,
    };

    for (const venta of ventas || []) {
      const pvBruto = Number(venta.pvBruto || 0);
      const costoProducto = Number(venta.costoProducto || 0);
      const cargoEnvioCosto = Number(venta.cargoEnvioCosto || 0);
      // En la BD, "comision" es la base (sin IVA para ML, sin IVA ni IIBB para TN)
      const comisionBase = Number(venta.comision || 0);
      // Usar el IIBB guardado en la BD (para TN es auto-calculado, para ML es manual)
      const iibbComisiones = Number(venta.iibb || 0);
      // IVA siempre es 21% sobre la comisión base
      const ivaComisiones = comisionBase * 0.21;
      
      const comisionTotal = comisionBase + ivaComisiones + iibbComisiones;
      ventasTotales.ventasTotales += pvBruto;
      ventasTotales.costoProducto += costoProducto;
      // Sumar TODOS los envíos (TN + ML) para costos de plataforma
      ventasTotales.enviosTotales += cargoEnvioCosto;
      // Solo sumar envíos de Tienda Nube para la comparación con gastos
      if (venta.plataforma === 'TN') {
        ventasTotales.envios += cargoEnvioCosto;
      }
      ventasTotales.comisionesTotales += comisionTotal;
      ventasTotales.comisionesBase += comisionBase;
      ventasTotales.ivaComisiones += ivaComisiones;
      ventasTotales.iibbComisiones += iibbComisiones;
      ventasTotales.margenBruto += Number(venta.ingresoMargen || 0);
    }

    // Definir descuentos (ajustar según lógica real si aplica)
    const descuentos = 0;
    const ventasDespuesDescuentos = Math.round((ventasTotales.ventasTotales - descuentos) * 100) / 100;
    // Costos de plataforma total (comisiones + TODOS los envíos)
    const totalCostosPlataforma = Math.round((ventasTotales.comisionesTotales + ventasTotales.enviosTotales) * 100) / 100;
    // Precio neto = Ventas después de descuentos - Costos de plataforma
    const precioNeto = Math.round((ventasDespuesDescuentos - totalCostosPlataforma) * 100) / 100;
  // Resultado bruto = Ventas Netas (después de descuentos) - Costo productos
  const resultadoBruto = Math.round((ventasDespuesDescuentos - ventasTotales.costoProducto) * 100) / 100;

    // Obtener publicidad específica para el canal
    let publicidadQuery = supabase
      .from("gastos_ingresos")
      .select("montoARS,categoria")
      .gte("fecha", fechaDesde.toISOString())
      .lte("fecha", fechaHasta.toISOString())
      .eq("tipo", "Gasto")
      .or('categoria.eq.Gastos del negocio - ADS,descripcion.ilike.%Meta ADS%');

    if (canal && canal !== "General") {
      publicidadQuery = publicidadQuery.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
    }
    const { data: publicidadData, error: publicidadError } = await publicidadQuery;
    const publicidad = !publicidadError && publicidadData 
      ? Math.round(publicidadData.reduce((acc, gasto) => acc + Number(gasto.montoARS || 0), 0) * 100) / 100
      : 0;

    // Calcular ROAS sobre Ventas Netas (después de descuentos, no precio neto)
    const roas = publicidad > 0 ? Math.round((ventasDespuesDescuentos / publicidad) * 100) / 100 : 0;



    // Otros gastos (todos, excluyendo solo ADS y envíos que ya están en costos de plataforma)
    let otrosGastosQuery = supabase
      .from("gastos_ingresos")
      .select("id,fecha,montoARS,categoria,descripcion,canal")
      .gte("fecha", fechaDesde.toISOString())
      .lte("fecha", fechaHasta.toISOString())
      .eq("tipo", "Gasto")
      .not("categoria", "in", "(Gastos del negocio - ADS,Gastos del negocio - Envíos)");

    if (canal && canal !== "General") {
      otrosGastosQuery = otrosGastosQuery.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
    }

    const { data: otrosGastosData, error: otrosGastosError } = await otrosGastosQuery;
    
    // Para el cálculo del margen neto: excluir gastos personales Y Pago de Importación
    // Pago de Importación afecta liquidaciones pero NO aparece en EERR
    const categoriasPersonales = ["Gastos de Casa", "Gastos de Geronimo", "Gastos de Sergio"];
    const categoriasExcluirEERR = [...categoriasPersonales, "Pago de Importación"];
    const gastosNegocio = otrosGastosData 
      ? otrosGastosData.filter(g => !categoriasExcluirEERR.includes(g.categoria))
      : [];
    const otrosGastos = !otrosGastosError && gastosNegocio.length > 0
      ? Math.round(gastosNegocio.reduce((acc, gasto) => acc + Number(gasto.montoARS || 0), 0) * 100) / 100
      : 0;

    // Otros ingresos del negocio (excepto ventas)
    let otrosIngresosQuery = supabase
      .from("gastos_ingresos")
      .select("id,fecha,montoARS,categoria,descripcion,canal")
      .gte("fecha", fechaDesde.toISOString())
      .lte("fecha", fechaHasta.toISOString())
      .eq("tipo", "Ingreso");

    if (canal && canal !== "General") {
      otrosIngresosQuery = otrosIngresosQuery.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
    }
    // Excluir ingresos de ventas si existieran en la tabla (por seguridad)
    const { data: otrosIngresosData, error: otrosIngresosError } = await otrosIngresosQuery;
    const otrosIngresosFiltrados = otrosIngresosData
      ? otrosIngresosData.filter((ingreso) => ingreso.categoria !== "Ventas")
      : [];
    const otrosIngresos = !otrosIngresosError && otrosIngresosFiltrados.length > 0
      ? Math.round(otrosIngresosFiltrados.reduce((acc, ingreso) => acc + Number(ingreso.montoARS || 0), 0) * 100) / 100
      : 0;

  // Margen operativo base = Resultado bruto - Costos plataforma - Publicidad
  const margenOperativoBase = Math.round((resultadoBruto - totalCostosPlataforma - publicidad) * 100) / 100;

  // Gastos personales solo para canal General
  const { getGastosPersonalesTotal } = await import("@/lib/actions/gastos-personales");
  const gastosPersonales = await getGastosPersonalesTotal(fechaDesde, fechaHasta, canal);

  // Neto final base = margen operativo base - otros gastos + otros ingresos
  const margenNetoNegocioBase = Math.round((margenOperativoBase - otrosGastos + otrosIngresos) * 100) / 100;

  // Margen final después de gastos personales (solo para canal General) - base (will be recomputed after devoluciones)
  let margenFinalConPersonales = undefined;
  if (!canal || canal === "General") {
    margenFinalConPersonales = Math.round((margenNetoNegocioBase - gastosPersonales) * 100) / 100;
  }

    // ==== Devoluciones: leer directamente la tabla `devoluciones` por fecha_reclamo ====
    // Las devoluciones impactan en el mes en que se reclamaron (fecha_reclamo)
    let devoluciones: any[] = []
    try {
      let query = supabase
        .from('devoluciones')
        .select('*')
        .gte('fecha_reclamo', fechaDesde.toISOString())
        .lte('fecha_reclamo', fechaHasta.toISOString())

      if (canal && canal !== 'General') {
        query = query.eq('plataforma', canal)
      }

  const { data, error: err } = await query
  try { console.log('EERR debug - devoluciones por fecha_reclamo:', { desde: fechaDesde.toISOString(), hasta: fechaHasta.toISOString(), canal: canal ?? 'General', count: Array.isArray(data) ? data.length : 0, error: err ? JSON.stringify(err) : null }) } catch (e) {}
  if (!err && Array.isArray(data)) devoluciones = data
    } catch (err) {
      // ignore
    }

  try { console.log('EERR debug - devoluciones fetched count:', devoluciones.length) } catch (e) {}

    // If some devoluciones don't include the related venta row (PostgREST may not populate relation),
    // batch-fetch ventas by venta_id so we can always derive pvBruto/comision/iibb from the original sale.
    const ventaIdsToFetch = Array.from(new Set(devoluciones.filter((d: any) => {
      const hasVenta = !!(d as any).venta && !(Array.isArray((d as any).venta) && (d as any).venta.length === 0)
      return !hasVenta && (d as any).venta_id
    }).map((d: any) => String(d.venta_id))))

    let ventasMap: Record<string, any> = {}
    if (ventaIdsToFetch.length > 0) {
      try {
        const { data: ventasFromDb, error: ventasErr } = await supabase
          .from('ventas')
          .select('id, pvBruto, pv_bruto, comision, iibb')
          .in('id', ventaIdsToFetch)

        if (!ventasErr && Array.isArray(ventasFromDb)) {
          for (const v of ventasFromDb) {
            const id = v.id ?? v['id']
            ventasMap[String(id)] = v
          }
        }
      } catch (err) {
        console.warn('No se pudieron obtener ventas para devoluciones (fallback) en EERR (no crítico)', err)
      }
    }

  // Calcular impacto: devolucionesTotal (PV de la devolución que debe restar de ventas brutas),
  // pérdida total (productos no recuperados) y comisiones recuperadas (comisión + IVA + IIBB de la venta).
  let devolucionesTotal = 0
  let devolucionesPerdidaTotal = 0
  let devolucionesComisionesRecuperadas = 0
  let devolucionesEnviosTotal = 0
  // New detailed aggregations
  let devolucionesCostoProductoOriginalTotal = 0
  let devolucionesCostoProductoNuevoTotal = 0
  let devolucionesEnvioNuevoTotal = 0
    for (const d of devoluciones) {
    try {
      // Debug: log key fields for each devolución to diagnose zero totals
      try {
        console.log('EERR debug - processing devolucion', {
          id: (d as any).id,
          venta_id: (d as any).venta_id,
          tipo_resolucion: (d as any).tipo_resolucion ?? (d as any).estado,
          monto_reembolsado: Number((d as any).monto_reembolsado || 0),
          total_costos_envio: Number((d as any).total_costos_envio || 0),
          total_costo_productos: Number((d as any).total_costo_productos || 0),
          costo_envio_original: Number((d as any).costo_envio_original || 0),
          costo_envio_devolucion: Number((d as any).costo_envio_devolucion || 0),
          costo_envio_nuevo: Number((d as any).costo_envio_nuevo || 0),
          costo_producto_perdido: Number((d as any).costo_producto_perdido || 0),
          perdida_total: Number((d as any).perdida_total || 0),
        })
      } catch (logErr) { }
      // Normalizar venta relacionado (PostgREST puede devolver arrays)
      let venta: any = (d as any).venta ?? null
      if (Array.isArray(venta)) venta = venta[0] ?? null

      // If relation not present, try the ventasMap we fetched by venta_id
      if (!venta && d.venta_id && ventasMap[String(d.venta_id)]) {
        venta = ventasMap[String(d.venta_id)]
      }

  // PV de la devolución: prefer pvBruto de la venta; monto_reembolsado es la fuente de verdad para el monto aplicado
  const pvDevol = Number(venta?.pvBruto ?? venta?.pv_bruto ?? d.monto_reembolsado ?? 0)

      // Considerar solo devoluciones que impliquen reembolso para restar de ventas
      const tipo = String(d.tipo_resolucion || d.estado || '')
      const isReembolso = tipo.includes('Reembolso') || Number(d.monto_reembolsado || 0) > 0
      if (isReembolso) devolucionesTotal += pvDevol

      // Envíos: preferir el agregado DB `total_costos_envio`, sino sumar los envíos individuales
      const totalCostosEnvioRow = Number((d as any).total_costos_envio ?? ((d.costo_envio_original || 0) + (d.costo_envio_devolucion || 0) + (d.costo_envio_nuevo || 0)))

      // Producto original y nuevo, y nuevo envío: extraer campos y aplicar reglas
      const perdidaTotalRow = Number((d as any).perdida_total ?? 0)
      const productoRecuperableRaw = (d as any).producto_recuperable
      const productoRecuperable = (
        productoRecuperableRaw === true ||
        productoRecuperableRaw === 'true' ||
        productoRecuperableRaw === 't' ||
        Number(productoRecuperableRaw || 0) === 1
      )

      // costo_producto_original: persisted column or derived from venta if available
      const costoProductoOriginalRowRaw = Number((d as any).costo_producto_original ?? venta?.costoProductoOriginal ?? 0)
      const costoProductoOriginalRow = productoRecuperable ? 0 : Math.max(0, Math.round(costoProductoOriginalRowRaw * 100) / 100)

      // costo_producto_nuevo: if present (replacement product cost)
      const costoProductoNuevoRow = Math.max(0, Number((d as any).costo_producto_nuevo ?? (d as any).costoProductoNuevo ?? 0))

      // costo_envio_nuevo: outbound shipping for the replacement
      const costoEnvioNuevoRow = Math.max(0, Number((d as any).costo_envio_nuevo ?? (d as any).costoEnvioNuevo ?? 0))

      // Determine product loss portion (explicit prefer aggregated total_costo_productos when available)
      let costoProductosRow = 0
      if (productoRecuperable) {
        costoProductosRow = 0
      } else if (typeof (d as any).total_costo_productos !== 'undefined' && (d as any).total_costo_productos !== null) {
        costoProductosRow = Number((d as any).total_costo_productos || 0)
      } else if (perdidaTotalRow && totalCostosEnvioRow) {
        costoProductosRow = Math.max(0, Math.round((perdidaTotalRow - totalCostosEnvioRow) * 100) / 100)
      } else {
        costoProductosRow = Number((d as any).costo_producto_perdido ?? perdidaTotalRow ?? 0)
      }

      // Aggregate: product loss (we'll also keep separate original/new totals)
      devolucionesPerdidaTotal += costoProductosRow
      devolucionesEnviosTotal += totalCostosEnvioRow
      devolucionesCostoProductoOriginalTotal += costoProductoOriginalRow
      devolucionesCostoProductoNuevoTotal += costoProductoNuevoRow
      devolucionesEnvioNuevoTotal += costoEnvioNuevoRow

      // Comisiones recuperadas: derivar desde la venta (comision base + IVA + IIBB)
  const comisionBase = Number(venta?.comision ?? d.comision ?? 0)
  const iibb = Number(venta?.iibb ?? d.iibb ?? 0)
      const iva = comisionBase * 0.21
      const comisionesRecuperadasPorDevol = comisionBase + iva + iibb
      if (isReembolso) devolucionesComisionesRecuperadas += comisionesRecuperadasPorDevol
    } catch (err) {
      // ignore per-row errors
      console.warn('Error procesando devolución en cálculo EERR (no crítico)', err)
    }
  }

  // Round results
  devolucionesTotal = Math.round(devolucionesTotal * 100) / 100
  devolucionesPerdidaTotal = Math.round(devolucionesPerdidaTotal * 100) / 100
  devolucionesComisionesRecuperadas = Math.round(devolucionesComisionesRecuperadas * 100) / 100
  devolucionesEnviosTotal = Math.round(devolucionesEnviosTotal * 100) / 100
  const devolucionesComisionesTotal = devolucionesComisionesRecuperadas
  const devolucionesCount = devoluciones.length
  const porcentajeDevolucionesSobreVentas = ventasDespuesDescuentos > 0 ? Math.round((devolucionesTotal / ventasDespuesDescuentos) * 10000) / 100 : 0

  // Pérdidas derivadas de devoluciones: según nueva definición del negocio
  // ahora consideramos explícitamente:
  // - costo del producto ORIGINAL (si no se recupera)
  // - costo del producto NUEVO (reemplazo)
  // - nuevo envío de ida (costo_envio_nuevo)
  // Esto evita duplicar con el agregado `total_costos_envio` y refleja la pérdida real.
  const devolucionesCostoProductoOriginalTotalRounded = Math.round((devolucionesCostoProductoOriginalTotal || 0) * 100) / 100
  const devolucionesCostoProductoNuevoTotalRounded = Math.round((devolucionesCostoProductoNuevoTotal || 0) * 100) / 100
  const devolucionesEnvioNuevoTotalRounded = Math.round((devolucionesEnvioNuevoTotal || 0) * 100) / 100

  const perdidasPorDevoluciones = Math.round((devolucionesCostoProductoOriginalTotalRounded + devolucionesCostoProductoNuevoTotalRounded + devolucionesEnvioNuevoTotalRounded) * 100) / 100

  // IMPORTANT: refunded sales were excluded from the ventas query above, therefore
  // we should NOT restar (subtract) PV/comisiones de devoluciones de las ventas totals again.
  // ventasDespuesDevoluciones será igual a ventasDespuesDescuentos (no doble descuento).
  const ventasDespuesDevoluciones = Math.round(ventasDespuesDescuentos * 100) / 100

  // Since refunded sales are excluded, no need to treat comisionesDevueltas separately
  const comisionesDevueltas = 0
  const comisionesNetas = Math.round((ventasTotales.comisionesTotales) * 100) / 100

  // Costos de plataforma ajustado (comisiones netas + envios totales)
  const totalCostosPlataformaAjustado = Math.round((comisionesNetas + ventasTotales.enviosTotales) * 100) / 100

  // Recalcular precioNeto y resultadoBruto tomando en cuenta que ventas ya excluyen ventas reembolsadas
  const precioNetoAjustado = Math.round((ventasDespuesDevoluciones - totalCostosPlataformaAjustado) * 100) / 100
  const resultadoBrutoAjustado = Math.round((ventasDespuesDevoluciones - ventasTotales.costoProducto) * 100) / 100

  // Restar pérdidas por devoluciones ANTES de otros gastos del negocio
  const margenOperativo = Math.round((resultadoBrutoAjustado - totalCostosPlataformaAjustado - publicidad) * 100) / 100
  const margenOperativoConPerdidas = Math.round((margenOperativo - perdidasPorDevoluciones) * 100) / 100

  // Recompute margenFinalConPersonales based on the adjusted margin after devoluciones
  margenFinalConPersonales = (!canal || canal === "General")
    ? Math.round((margenOperativoConPerdidas - otrosGastos + otrosIngresos - gastosPersonales) * 100) / 100
    : margenFinalConPersonales

  return {
      ventasTotales: Math.round(ventasTotales.ventasTotales * 100) / 100,
      descuentos: Math.round(descuentos * 100) / 100,
      ventasNetas: ventasDespuesDevoluciones,
      costoProducto: Math.round(ventasTotales.costoProducto * 100) / 100,
      resultadoBruto: resultadoBrutoAjustado,
      comisiones: Math.round(ventasTotales.comisionesTotales * 100) / 100,
      comisionesNetas: comisionesNetas,
      comisionesDevueltas: comisionesDevueltas,
      comisionesBase: Math.round(ventasTotales.comisionesBase * 100) / 100,
      comisionesExtra: Math.round(ventasTotales.comisionesExtra * 100) / 100,
      ivaComisiones: Math.round(ventasTotales.ivaComisiones * 100) / 100,
      iibbComisiones: Math.round(ventasTotales.iibbComisiones * 100) / 100,
      envios: Math.round(ventasTotales.envios * 100) / 100, // Solo TN (para comparar con gastos)
      enviosTotales: Math.round(ventasTotales.enviosTotales * 100) / 100, // Todos (TN + ML) para costos plataforma
      iibb: Math.round(ventasTotales.iibbComisiones * 100) / 100,
  totalCostosPlataforma: Math.round(totalCostosPlataforma * 100) / 100,
  totalCostosPlataformaAjustado: totalCostosPlataformaAjustado,
  publicidad: Math.round(publicidad * 100) / 100,
  roas: Math.round(roas * 100) / 100,
  margenOperativo: margenOperativoConPerdidas,
      otrosGastos: Math.round(otrosGastos * 100) / 100,
      detalleOtrosGastos: otrosGastosData || [],
  otrosIngresos: Math.round(otrosIngresos * 100) / 100,
      detalleOtrosIngresos: otrosIngresosFiltrados || [],
      margenNetoNegocio: Math.round((margenOperativoConPerdidas - otrosGastos + otrosIngresos) * 100) / 100,
      ventasBrutas: Math.round(ventasTotales.ventasTotales * 100) / 100,
  precioNeto: precioNetoAjustado,
      costoEnvio: Math.round(ventasTotales.envios * 100) / 100,
      margenBruto: Math.round(ventasTotales.margenBruto * 100) / 100,
      gastosCanal: Math.round(otrosGastos * 100) / 100,
      gastosGenerales: 0,
  resultadoOperativo: Math.round(margenOperativo * 100) / 100,
  gastosPersonales: Math.round(gastosPersonales * 100) / 100,
  margenFinalConPersonales: margenFinalConPersonales,
    // Devoluciones
      // Devoluciones
    devolucionesTotal: devolucionesTotal,
  devolucionesPerdidaTotal: devolucionesPerdidaTotal,
  devolucionesEnviosTotal: devolucionesEnviosTotal,
  devolucionesComisionesTotal: devolucionesComisionesTotal,
  devolucionesComisionesRecuperadas: devolucionesComisionesRecuperadas,
    devolucionesCount: devolucionesCount,
    porcentajeDevolucionesSobreVentas: porcentajeDevolucionesSobreVentas,
    perdidasPorDevoluciones: perdidasPorDevoluciones,
    detalleDevoluciones: devoluciones,
    };
  } catch (error) {
    console.error("Error al calcular EERR:", error);
    return {
      ventasTotales: 0,
      descuentos: 0,
      ventasNetas: 0,
      costoProducto: 0,
      resultadoBruto: 0,
      comisiones: 0,
      comisionesBase: 0,
      comisionesExtra: 0,
      ivaComisiones: 0,
      iibbComisiones: 0,
      envios: 0,
      enviosTotales: 0,
      iibb: 0,
      totalCostosPlataforma: 0,
      publicidad: 0,
      roas: 0,
      otrosGastos: 0,
      margenOperativo: 0,
      margenNetoNegocio: 0,
      ventasBrutas: 0,
      precioNeto: 0,
      costoEnvio: 0,
      margenBruto: 0,
      gastosCanal: 0,
      gastosGenerales: 0,
      otrosIngresos: 0,
      resultadoOperativo: 0,
    };
  }

}

export async function getResumenPorPeriodo(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  try {
    // Calcular EERR para el período actual
    const eerrActual = await calcularEERR(fechaDesde, fechaHasta, canal)

    // Calcular período anterior (mismo rango de días)
    const diasDiferencia = Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24))
    const fechaDesdeAnterior = new Date(fechaDesde)
    fechaDesdeAnterior.setDate(fechaDesdeAnterior.getDate() - diasDiferencia)
    const fechaHastaAnterior = new Date(fechaDesde)
    fechaHastaAnterior.setDate(fechaHastaAnterior.getDate() - 1)

    const eerrAnterior = await calcularEERR(fechaDesdeAnterior, fechaHastaAnterior, canal)

    return {
      actual: eerrActual,
      anterior: eerrAnterior,
      variacion: {
        ventasBrutas: Math.round((eerrActual.ventasBrutas - eerrAnterior.ventasBrutas) * 100) / 100,
        resultadoOperativo: Math.round((eerrActual.resultadoOperativo - eerrAnterior.resultadoOperativo) * 100) / 100,
      },
    }
  } catch (error) {
    console.error("Error al obtener resumen por período:", error)
    return {
      actual: {
        ventasBrutas: 0,
        precioNeto: 0,
        costoProducto: 0,
        costoEnvio: 0,
        margenBruto: 0,
        gastosCanal: 0,
        gastosGenerales: 0,
        otrosIngresos: 0,
        resultadoOperativo: 0
      },
      anterior: {
        ventasBrutas: 0,
        precioNeto: 0,
        costoProducto: 0,
        costoEnvio: 0,
        margenBruto: 0,
        gastosCanal: 0,
        gastosGenerales: 0,
        otrosIngresos: 0,
        resultadoOperativo: 0
      },
      variacion: {
        ventasBrutas: 0,
        resultadoOperativo: 0
      }
    }
  }
}

