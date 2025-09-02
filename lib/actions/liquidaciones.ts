"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { liquidacionSchema, type LiquidacionFormData } from "@/lib/validations"

export async function getLiquidaciones() {
  try {
    const liquidaciones = await prisma.liquidacion.findMany({
      orderBy: { fecha: "desc" },
    })

    return liquidaciones
  } catch (error) {
    console.error("Error al obtener liquidaciones:", error)
    throw new Error("Error al obtener liquidaciones")
  }
}

export async function createLiquidacion(data: LiquidacionFormData) {
  try {
    const validatedData = liquidacionSchema.parse(data)

    const liquidacion = await prisma.liquidacion.create({
      data: validatedData,
    })

    revalidatePath("/liquidaciones")
    return { success: true, data: liquidacion }
  } catch (error) {
    console.error("Error al crear liquidación:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear liquidación" }
  }
}

export const crearLiquidacion = createLiquidacion

export async function updateLiquidacion(id: string, data: LiquidacionFormData) {
  try {
    const validatedData = liquidacionSchema.parse(data)

    const liquidacion = await prisma.liquidacion.update({
      where: { id },
      data: validatedData,
    })

    revalidatePath("/liquidaciones")
    return { success: true, data: liquidacion }
  } catch (error) {
    console.error("Error al actualizar liquidación:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar liquidación" }
  }
}

export const actualizarLiquidacion = updateLiquidacion

export async function deleteLiquidacion(id: string) {
  try {
    await prisma.liquidacion.delete({
      where: { id },
    })

    revalidatePath("/liquidaciones")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar liquidación:", error)
    return { success: false, error: "Error al eliminar liquidación" }
  }
}

export const eliminarLiquidacion = deleteLiquidacion

export async function getLiquidacionById(id: string) {
  try {
    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
    })
    return liquidacion
  } catch (error) {
    console.error("Error al obtener liquidación:", error)
    throw new Error("Error al obtener liquidación")
  }
}
