"use server"

import { prisma } from "@/lib/prisma"
import type { EERRData, Plataforma } from "@/lib/types"

export async function calcularEERR(
  fechaDesde: Date,
  fechaHasta: Date,
  canal?: Plataforma | "General",
): Promise<EERRData> {
  try {
    // Filtros base para ventas
    const ventasWhere: any = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    }

    // Filtrar por canal si se especifica
    if (canal && canal !== "General") {
      ventasWhere.plataforma = canal
    }

    // Obtener datos de ventas
    const ventas = await prisma.venta.findMany({
      where: ventasWhere,
      select: {
        pvBruto: true,
        precioNeto: true,
        costoProducto: true,
        cargoEnvioCosto: true,
        ingresoMargen: true,
      },
    })

    // Calcular totales de ventas
    const ventasTotales = ventas.reduce(
      (acc, venta) => ({
        ventasBrutas: acc.ventasBrutas + Number(venta.pvBruto),
        precioNeto: acc.precioNeto + Number(venta.precioNeto),
        costoProducto: acc.costoProducto + Number(venta.costoProducto),
        costoEnvio: acc.costoEnvio + Number(venta.cargoEnvioCosto),
        margenBruto: acc.margenBruto + Number(venta.ingresoMargen),
      }),
      {
        ventasBrutas: 0,
        precioNeto: 0,
        costoProducto: 0,
        costoEnvio: 0,
        margenBruto: 0,
      },
    )

    // Filtros para gastos e ingresos
    const gastosIngresosWhere: any = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    }

    // Gastos del canal específico
    let gastosCanal = 0
    if (canal && canal !== "General") {
      const gastosDelCanal = await prisma.gastoIngreso.findMany({
        where: {
          ...gastosIngresosWhere,
          canal: canal,
          tipo: "Gasto",
        },
        select: {
          montoARS: true,
        },
      })
      gastosCanal = gastosDelCanal.reduce((acc, gasto) => acc + Number(gasto.montoARS), 0)
    }

    // Gastos generales (canal null o "General")
    const gastosGeneralesData = await prisma.gastoIngreso.findMany({
      where: {
        ...gastosIngresosWhere,
        canal: null,
        tipo: "Gasto",
      },
      select: {
        montoARS: true,
      },
    })
    const gastosGenerales = gastosGeneralesData.reduce((acc, gasto) => acc + Number(gasto.montoARS), 0)

    // Otros ingresos del canal específico + generales
    const otrosIngresosWhere: any = {
      ...gastosIngresosWhere,
      tipo: "OtroIngreso",
    }

    if (canal && canal !== "General") {
      otrosIngresosWhere.OR = [{ canal: canal }, { canal: null }]
    } else {
      otrosIngresosWhere.canal = null
    }

    const otrosIngresosData = await prisma.gastoIngreso.findMany({
      where: otrosIngresosWhere,
      select: {
        montoARS: true,
      },
    })
    const otrosIngresos = otrosIngresosData.reduce((acc, ingreso) => acc + Number(ingreso.montoARS), 0)

    // Calcular resultado operativo
    const resultadoOperativo = ventasTotales.margenBruto - gastosCanal - gastosGenerales + otrosIngresos

    return {
      ventasBrutas: ventasTotales.ventasBrutas,
      precioNeto: ventasTotales.precioNeto,
      costoProducto: ventasTotales.costoProducto,
      costoEnvio: ventasTotales.costoEnvio,
      margenBruto: ventasTotales.margenBruto,
      gastosCanal,
      gastosGenerales,
      otrosIngresos,
      resultadoOperativo,
    }
  } catch (error) {
    console.error("Error al calcular EERR:", error)
    throw new Error("Error al calcular estado de resultados")
  }
}

export async function getDetalleVentas(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  try {
    const where: any = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    }

    if (canal && canal !== "General") {
      where.plataforma = canal
    }

    const ventas = await prisma.venta.findMany({
      where,
      include: {
        producto: true,
      },
      orderBy: {
        fecha: "desc",
      },
    })

    return ventas
  } catch (error) {
    console.error("Error al obtener detalle de ventas:", error)
    throw new Error("Error al obtener detalle de ventas")
  }
}

export async function getDetalleGastosIngresos(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  try {
    const where: any = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    }

    if (canal && canal !== "General") {
      where.OR = [{ canal: canal }, { canal: null }]
    } else if (canal === "General") {
      where.canal = null
    }

    const gastosIngresos = await prisma.gastoIngreso.findMany({
      where,
      orderBy: {
        fecha: "desc",
      },
    })

    return gastosIngresos
  } catch (error) {
    console.error("Error al obtener detalle de gastos e ingresos:", error)
    throw new Error("Error al obtener detalle de gastos e ingresos")
  }
}

export async function getResumenPorPeriodo(fechaDesde: Date, fechaHasta: Date, canal?: Plataforma | "General") {
  try {
    // Calcular EERR para diferentes períodos para comparación
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
        ventasBrutas: eerrActual.ventasBrutas - eerrAnterior.ventasBrutas,
        resultadoOperativo: eerrActual.resultadoOperativo - eerrAnterior.resultadoOperativo,
      },
    }
  } catch (error) {
    console.error("Error al obtener resumen por período:", error)
    throw new Error("Error al obtener resumen por período")
  }
}
