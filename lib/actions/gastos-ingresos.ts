"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { gastoIngresoSchema, type GastoIngresoFormData } from "@/lib/validations"
import type { GastoIngresoFilters } from "@/lib/types"

export async function getGastosIngresos(filters?: GastoIngresoFilters) {
  try {
    const where: any = {}

    if (filters?.fechaDesde || filters?.fechaHasta) {
      where.fecha = {}
      if (filters.fechaDesde) where.fecha.gte = filters.fechaDesde
      if (filters.fechaHasta) where.fecha.lte = filters.fechaHasta
    }

    if (filters?.canal) {
      if (filters.canal === "General") {
        where.canal = null
      } else {
        where.canal = filters.canal
      }
    }

    if (filters?.tipo) where.tipo = filters.tipo

    if (filters?.categoria) {
      where.categoria = {
        contains: filters.categoria,
        mode: "insensitive",
      }
    }

    const gastosIngresos = await prisma.gastoIngreso.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return gastosIngresos
  } catch (error) {
    console.error("Error al obtener gastos e ingresos:", error)
    throw new Error("Error al obtener gastos e ingresos")
  }
}

export async function createGastoIngreso(data: GastoIngresoFormData) {
  try {
    const validatedData = gastoIngresoSchema.parse(data)

    const gastoIngreso = await prisma.gastoIngreso.create({
      data: validatedData,
    })

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    return { success: true, data: gastoIngreso }
  } catch (error) {
    console.error("Error al crear gasto/ingreso:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear gasto/ingreso" }
  }
}

export async function updateGastoIngreso(id: string, data: GastoIngresoFormData) {
  try {
    const validatedData = gastoIngresoSchema.parse(data)

    const gastoIngreso = await prisma.gastoIngreso.update({
      where: { id },
      data: validatedData,
    })

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    return { success: true, data: gastoIngreso }
  } catch (error) {
    console.error("Error al actualizar gasto/ingreso:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar gasto/ingreso" }
  }
}

export async function deleteGastoIngreso(id: string) {
  try {
    await prisma.gastoIngreso.delete({
      where: { id },
    })

    revalidatePath("/gastos")
    revalidatePath("/eerr")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar gasto/ingreso:", error)
    return { success: false, error: "Error al eliminar gasto/ingreso" }
  }
}

export async function getGastoIngresoById(id: string) {
  try {
    const gastoIngreso = await prisma.gastoIngreso.findUnique({
      where: { id },
    })
    return gastoIngreso
  } catch (error) {
    console.error("Error al obtener gasto/ingreso:", error)
    throw new Error("Error al obtener gasto/ingreso")
  }
}

export async function getCategorias() {
  try {
    const categorias = await prisma.gastoIngreso.findMany({
      select: {
        categoria: true,
      },
      distinct: ["categoria"],
      orderBy: {
        categoria: "asc",
      },
    })

    return categorias.map((c) => c.categoria)
  } catch (error) {
    console.error("Error al obtener categorías:", error)
    return []
  }
}
