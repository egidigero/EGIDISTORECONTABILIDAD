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
    // Construir filtros para ventas
    let ventasQuery = supabase
      .from("ventas")
      .select(`
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

    const { data: ventas, error: ventasError } = await ventasQuery

    if (ventasError) {
      console.error("Error al obtener ventas:", ventasError)
      throw new Error("Error al obtener ventas")
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

  // Margen operativo = Resultado bruto - Costos plataforma - Publicidad
  const margenOperativo = Math.round((resultadoBruto - totalCostosPlataforma - publicidad) * 100) / 100;

    // Gastos personales solo para canal General
  const { getGastosPersonalesTotal } = await import("@/lib/actions/gastos-personales");
  const gastosPersonales = await getGastosPersonalesTotal(fechaDesde, fechaHasta, canal);

    // Neto final = margen operativo - otros gastos + otros ingresos
    const margenNetoNegocio = Math.round((margenOperativo - otrosGastos + otrosIngresos) * 100) / 100;

    // Margen final después de gastos personales (solo para canal General)
    let margenFinalConPersonales = undefined;
    if (!canal || canal === "General") {
      margenFinalConPersonales = Math.round((margenNetoNegocio - gastosPersonales) * 100) / 100;
    }

    // ==== Devoluciones: consultar resumen de devoluciones en el período y canal ====
    let devolucionesQuery = supabase
      .from('devoluciones_resumen')
      .select('*')
      .gte('fecha_reclamo', fechaDesde.toISOString())
      .lte('fecha_reclamo', fechaHasta.toISOString())

    if (canal && canal !== 'General') {
      devolucionesQuery = devolucionesQuery.eq('plataforma', canal)
    }

    const { data: devolucionesData, error: devolucionesError } = await devolucionesQuery

    const devoluciones = !devolucionesError && Array.isArray(devolucionesData) ? devolucionesData : []

  // Calcular impacto: devolucionesTotal (monto neto que afectó ventas netas), perdida total (productos no recuperados)
  const devolucionesTotal = Math.round((devoluciones.reduce((s: number, d: any) => s + Number(d.impacto_ventas_netas || 0), 0)) * 100) / 100
  // Sumar la pérdida de producto persistida en la devolución (costo_producto_perdido) si existe
  const devolucionesPerdidaTotal = Math.round((devoluciones.reduce((s: number, d: any) => s + Number(d.costo_producto_perdido || d.perdida_total || 0), 0)) * 100) / 100
  // Sumar comisiones recuperadas (si la vista expone este campo o podemos derivarlo)
  const devolucionesComisionesRecuperadas = Math.round((devoluciones.reduce((s: number, d: any) => s + Number(d.comisiones_recuperadas || 0), 0)) * 100) / 100
  // Comisiones devueltas: column removed from devoluciones. TODO: derive returned commission from ventas or expose sale commission in the view.
  const devolucionesComisionesTotal = 0
    const devolucionesCount = devoluciones.length
    const porcentajeDevolucionesSobreVentas = ventasDespuesDescuentos > 0 ? Math.round((devolucionesTotal / ventasDespuesDescuentos) * 10000) / 100 : 0
    // Ajustar ventas y comisiones por devoluciones
    const ventasDespuesDevoluciones = Math.round((ventasDespuesDescuentos - devolucionesTotal) * 100) / 100
  const comisionesDevueltas = devolucionesComisionesTotal
  const comisionesNetas = Math.round((ventasTotales.comisionesTotales - comisionesDevueltas) * 100) / 100

    // Costos de plataforma ajustado (comisiones netas + envios totales)
    const totalCostosPlataformaAjustado = Math.round((comisionesNetas + ventasTotales.enviosTotales) * 100) / 100

    // Recalcular precioNeto y resultadoBruto tomando en cuenta devoluciones
    const precioNetoAjustado = Math.round((ventasDespuesDevoluciones - totalCostosPlataformaAjustado) * 100) / 100
    const resultadoBrutoAjustado = Math.round((ventasDespuesDevoluciones - ventasTotales.costoProducto) * 100) / 100

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
  margenOperativo: Math.round((resultadoBrutoAjustado - totalCostosPlataformaAjustado - publicidad) * 100) / 100,
      otrosGastos: Math.round(otrosGastos * 100) / 100,
      detalleOtrosGastos: otrosGastosData || [],
  otrosIngresos: Math.round(otrosIngresos * 100) / 100,
      detalleOtrosIngresos: otrosIngresosFiltrados || [],
      margenNetoNegocio: Math.round(margenNetoNegocio * 100) / 100,
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
      devolucionesComisionesTotal: devolucionesComisionesTotal,
    devolucionesCount: devolucionesCount,
    porcentajeDevolucionesSobreVentas: porcentajeDevolucionesSobreVentas,
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

