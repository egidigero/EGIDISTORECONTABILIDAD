"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ventaSchema, type VentaFormData } from "@/lib/validations"
import { calcularVenta, getTarifa, generarSaleCode } from "@/lib/calculos"
import type { VentaFilters, EstadoEnvio } from "@/lib/types"

export async function getVentas(filters?: VentaFilters) {
  try {
    const where: any = {}

    if (filters?.fechaDesde || filters?.fechaHasta) {
      where.fecha = {}
      if (filters.fechaDesde) where.fecha.gte = filters.fechaDesde
      if (filters.fechaHasta) where.fecha.lte = filters.fechaHasta
    }

    if (filters?.plataforma) where.plataforma = filters.plataforma
    if (filters?.metodoPago) where.metodoPago = filters.metodoPago
    if (filters?.estadoEnvio) where.estadoEnvio = filters.estadoEnvio

    if (filters?.comprador) {
      where.comprador = {
        contains: filters.comprador,
        mode: "insensitive",
      }
    }

    if (filters?.externalOrderId) {
      where.OR = [
        { externalOrderId: { contains: filters.externalOrderId, mode: "insensitive" } },
        { saleCode: { contains: filters.externalOrderId, mode: "insensitive" } },
      ]
    }

    const ventas = await prisma.venta.findMany({
      where,
      include: {
        producto: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return ventas
  } catch (error) {
    console.error("Error al obtener ventas:", error)
    throw new Error("Error al obtener ventas")
  }
}

export async function createVenta(data: VentaFormData) {
  try {
    const validatedData = ventaSchema.parse(data)

    // Obtener el producto para el costo
    const producto = await prisma.producto.findUnique({
      where: { id: validatedData.productoId },
    })

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa
    const tarifa = await getTarifa(validatedData.plataforma, validatedData.metodoPago)

    if (!tarifa) {
      return { success: false, error: "Tarifa no configurada para esta combinación de plataforma y método de pago" }
    }

    // Calcular todos los campos automáticamente
    const calculos = calcularVenta(
      validatedData.pvBruto,
      validatedData.cargoEnvioCosto,
      Number(producto.costoUnitarioARS),
      tarifa,
    )

    // Generar código de venta único
    const saleCode = generarSaleCode()

    const venta = await prisma.venta.create({
      data: {
        ...validatedData,
        ...calculos,
        saleCode,
      },
      include: {
        producto: true,
      },
    })

    revalidatePath("/ventas")
    return { success: true, data: venta }
  } catch (error) {
    console.error("Error al crear venta:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear venta" }
  }
}

export async function updateVenta(id: string, data: VentaFormData) {
  try {
    const validatedData = ventaSchema.parse(data)

    // Obtener el producto para el costo
    const producto = await prisma.producto.findUnique({
      where: { id: validatedData.productoId },
    })

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa
    const tarifa = await getTarifa(validatedData.plataforma, validatedData.metodoPago)

    if (!tarifa) {
      return { success: false, error: "Tarifa no configurada para esta combinación de plataforma y método de pago" }
    }

    // Recalcular todos los campos
    const calculos = calcularVenta(
      validatedData.pvBruto,
      validatedData.cargoEnvioCosto,
      Number(producto.costoUnitarioARS),
      tarifa,
    )

    const venta = await prisma.venta.update({
      where: { id },
      data: {
        ...validatedData,
        ...calculos,
      },
      include: {
        producto: true,
      },
    })

    revalidatePath("/ventas")
    return { success: true, data: venta }
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
    await prisma.venta.delete({
      where: { id },
    })

    revalidatePath("/ventas")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar venta:", error)
    return { success: false, error: "Error al eliminar venta" }
  }
}

export async function getVentaById(id: string) {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        producto: true,
      },
    })
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

    await prisma.venta.updateMany({
      where: {
        id: {
          in: ventaIds,
        },
      },
      data: updateData,
    })

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
    const ventas = await prisma.venta.findMany({
      where: {
        estadoEnvio: {
          in: ["Pendiente", "EnCamino"],
        },
      },
      include: {
        producto: true,
      },
      orderBy: { fecha: "asc" },
    })

    return ventas
  } catch (error) {
    console.error("Error al obtener ventas pendientes:", error)
    throw new Error("Error al obtener ventas pendientes")
  }
}

export async function calcularPreviewVenta(
  productoId: string,
  plataforma: string,
  metodoPago: string,
  pvBruto: number,
  cargoEnvioCosto: number,
) {
  try {
    // Obtener el producto para el costo
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    })

    if (!producto) {
      return { success: false, error: "Producto no encontrado" }
    }

    // Obtener la tarifa
    const tarifa = await getTarifa(plataforma as any, metodoPago as any)

    if (!tarifa) {
      return { success: false, error: "Tarifa no configurada" }
    }

    // Calcular preview
    const calculos = calcularVenta(pvBruto, cargoEnvioCosto, Number(producto.costoUnitarioARS), tarifa)

    return { success: true, data: calculos }
  } catch (error) {
    console.error("Error al calcular preview:", error)
    return { success: false, error: "Error al calcular preview" }
  }
}
