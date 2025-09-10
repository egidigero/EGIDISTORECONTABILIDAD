//
"use server"

import { supabase } from "@/lib/supabase"
import type { EERRData, Plataforma } from "@/lib/types"

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

    // Calcular totales de ventas
    const ventasTotales = (ventas || []).reduce(
      (acc, venta) => {
        const pvBruto = Number(venta.pvBruto || 0);
        const comisionBruta = Number(venta.comision || 0);
        const envios = Number(venta.cargoEnvioCosto || 0);
        let comisionBase = 0;
        let ivaComisiones = 0;
        let iibbComisiones = 0;
        if (venta.plataforma === 'TN') {
          comisionBase = comisionBruta / 1.24;
          ivaComisiones = comisionBase * 0.21;
          iibbComisiones = comisionBase * 0.03;
        } else {
          comisionBase = comisionBruta / 1.21;
          ivaComisiones = comisionBase * 0.21;
          iibbComisiones = 0;
        }
        return {
          ventasTotales: acc.ventasTotales + pvBruto,
          costoProducto: acc.costoProducto + Number(venta.costoProducto || 0),
          envios: acc.envios + envios,
          comisionesBase: acc.comisionesBase + comisionBase,
          ivaComisiones: acc.ivaComisiones + ivaComisiones,
          iibbComisiones: acc.iibbComisiones + iibbComisiones,
          comisionesTotales: acc.comisionesTotales + comisionBase + ivaComisiones + iibbComisiones,
          comisionesExtra: acc.comisionesExtra, // Por ahora en 0
          margenBruto: acc.margenBruto + Number(venta.ingresoMargen || 0),
        };
      },
      {
        ventasTotales: 0,
        costoProducto: 0,
        envios: 0,
        comisionesBase: 0,
        ivaComisiones: 0,
        iibbComisiones: 0,
        comisionesTotales: 0,
        comisionesExtra: 0,
        margenBruto: 0,
      }
    );

    // Definir descuentos (ajustar según lógica real si aplica)
    const descuentos = 0;
    const ventasDespuesDescuentos = Math.round((ventasTotales.ventasTotales - descuentos) * 100) / 100;
    // Costos de plataforma total
    const totalCostosPlataforma = Math.round((ventasTotales.comisionesTotales + ventasTotales.envios) * 100) / 100;
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
      // Mostrar gastos del canal y generales (null o 'General')
      publicidadQuery = publicidadQuery.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
    }

    const { data: publicidadData, error: publicidadError } = await publicidadQuery;
    const publicidad = !publicidadError && publicidadData 
      ? Math.round(publicidadData.reduce((acc, gasto) => acc + Number(gasto.montoARS || 0), 0) * 100) / 100
      : 0;

    // Calcular ROAS sobre Ventas Netas (después de descuentos, no precio neto)
    const roas = publicidad > 0 ? Math.round((ventasDespuesDescuentos / publicidad) * 100) / 100 : 0;

    // Otros gastos del canal (excluyendo publicidad y envíos)
    let otrosGastosQuery = supabase
      .from("gastos_ingresos")
      .select("montoARS,categoria")
      .gte("fecha", fechaDesde.toISOString())
      .lte("fecha", fechaHasta.toISOString())
      .eq("tipo", "Gasto")
      .eq("categoria", "Otros gastos del negocio");

    if (canal && canal !== "General") {
      // Mostrar gastos del canal y generales (null o 'General')
      otrosGastosQuery = otrosGastosQuery.or(`canal.eq.${canal},canal.is.null,canal.eq.General`);
    }

    const { data: otrosGastosData, error: otrosGastosError } = await otrosGastosQuery;
    const otrosGastos = !otrosGastosError && otrosGastosData 
      ? Math.round(otrosGastosData.reduce((acc, gasto) => acc + Number(gasto.montoARS || 0), 0) * 100) / 100
      : 0;

    // Margen operativo = Resultado bruto - Costos plataforma - Publicidad - Otros gastos
    const margenOperativo = Math.round((resultadoBruto - totalCostosPlataforma - publicidad - otrosGastos) * 100) / 100;

    // Calcular gastos personales (por canal y período)
    const { getGastosPersonalesTotal } = await import("@/lib/actions/gastos-personales");
    const gastosPersonales = await getGastosPersonalesTotal(fechaDesde, fechaHasta, canal);

    // Margen después de gastos personales
    const margenFinal = Math.round((margenOperativo - gastosPersonales) * 100) / 100;

    return {
      ventasTotales: Math.round(ventasTotales.ventasTotales * 100) / 100,
      descuentos: Math.round(descuentos * 100) / 100,
      ventasNetas: Math.round(ventasDespuesDescuentos * 100) / 100,
      costoProducto: Math.round(ventasTotales.costoProducto * 100) / 100,
      resultadoBruto: Math.round(resultadoBruto * 100) / 100,
      comisiones: Math.round(ventasTotales.comisionesTotales * 100) / 100,
      comisionesBase: Math.round(ventasTotales.comisionesBase * 100) / 100,
      comisionesExtra: Math.round(ventasTotales.comisionesExtra * 100) / 100,
      ivaComisiones: Math.round(ventasTotales.ivaComisiones * 100) / 100,
      iibbComisiones: Math.round(ventasTotales.iibbComisiones * 100) / 100,
      envios: Math.round(ventasTotales.envios * 100) / 100,
      iibb: Math.round(ventasTotales.iibbComisiones * 100) / 100,
      totalCostosPlataforma: Math.round(totalCostosPlataforma * 100) / 100,
      publicidad: Math.round(publicidad * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      otrosGastos: Math.round(otrosGastos * 100) / 100,
      margenOperativo: Math.round(margenOperativo * 100) / 100,
      ventasBrutas: Math.round(ventasTotales.ventasTotales * 100) / 100,
      precioNeto: Math.round(precioNeto * 100) / 100,
      costoEnvio: Math.round(ventasTotales.envios * 100) / 100,
      margenBruto: Math.round(ventasTotales.margenBruto * 100) / 100,
      gastosCanal: Math.round(otrosGastos * 100) / 100,
      gastosGenerales: 0,
      otrosIngresos: 0,
      resultadoOperativo: Math.round(margenOperativo * 100) / 100,
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
      iibb: 0,
      totalCostosPlataforma: 0,
      publicidad: 0,
      roas: 0,
      otrosGastos: 0,
      margenOperativo: 0,
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

