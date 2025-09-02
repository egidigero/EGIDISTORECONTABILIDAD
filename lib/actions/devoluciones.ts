"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { devolucionSchema, type DevolucionFormData } from "@/lib/validations"

export async function getDevoluciones() {
  try {
    const devoluciones = await prisma.devolucion.findMany({
      include: {
        venta: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return devoluciones
  } catch (error) {
    console.error("Error al obtener devoluciones:", error)
    throw new Error("Error al obtener devoluciones")
  }
}

export async function createDevolucion(data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    const devolucion = await prisma.devolucion.create({
      data: validatedData,
      include: {
        venta: {
          include: {
            producto: true,
          },
        },
      },
    })

    revalidatePath("/devoluciones")
    return { success: true, data: devolucion }
  } catch (error) {
    console.error("Error al crear devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear devolución" }
  }
}

export async function updateDevolucion(id: string, data: DevolucionFormData) {
  try {
    const validatedData = devolucionSchema.parse(data)

    const devolucion = await prisma.devolucion.update({
      where: { id },
      data: validatedData,
      include: {
        venta: {
          include: {
            producto: true,
          },
        },
      },
    })

    revalidatePath("/devoluciones")
    return { success: true, data: devolucion }
  } catch (error) {
    console.error("Error al actualizar devolución:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar devolución" }
  }
}

export async function deleteDevolucion(id: string) {
  try {
    await prisma.devolucion.delete({
      where: { id },
    })

    revalidatePath("/devoluciones")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar devolución:", error)
    return { success: false, error: "Error al eliminar devolución" }
  }
}

export async function getDevolucionById(id: string) {
  try {
    const devolucion = await prisma.devolucion.findUnique({
      where: { id },
      include: {
        venta: {
          include: {
            producto: true,
          },
        },
      },
    })
    return devolucion
  } catch (error) {
    console.error("Error al obtener devolución:", error)
    throw new Error("Error al obtener devolución")
  }
}

export async function buscarVentas(query: string) {
  try {
    const ventas = await prisma.venta.findMany({
      where: {
        OR: [
          { saleCode: { contains: query, mode: "insensitive" } },
          { externalOrderId: { contains: query, mode: "insensitive" } },
          { comprador: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        producto: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    })

    return ventas
  } catch (error) {
    console.error("Error al buscar ventas:", error)
    return []
  }
}
