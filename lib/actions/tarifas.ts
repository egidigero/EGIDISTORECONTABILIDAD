"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { tarifaSchema, type TarifaFormData } from "@/lib/validations"

export async function getTarifas() {
  try {
    const tarifas = await prisma.tarifa.findMany({
      orderBy: { createdAt: "desc" },
    })
    return tarifas
  } catch (error) {
    console.error("Error al obtener tarifas:", error)
    throw new Error("Error al obtener tarifas")
  }
}

export async function createTarifa(data: TarifaFormData) {
  try {
    const validatedData = tarifaSchema.parse(data)

    const key = `${validatedData.plataforma}|${validatedData.metodoPago}`

    const tarifa = await prisma.tarifa.create({
      data: {
        ...validatedData,
        key,
      },
    })

    revalidatePath("/tarifas")
    return { success: true, data: tarifa }
  } catch (error) {
    console.error("Error al crear tarifa:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear tarifa" }
  }
}

export async function updateTarifa(id: string, data: TarifaFormData) {
  try {
    const validatedData = tarifaSchema.parse(data)

    const key = `${validatedData.plataforma}|${validatedData.metodoPago}`

    const tarifa = await prisma.tarifa.update({
      where: { id },
      data: {
        ...validatedData,
        key,
      },
    })

    revalidatePath("/tarifas")
    return { success: true, data: tarifa }
  } catch (error) {
    console.error("Error al actualizar tarifa:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar tarifa" }
  }
}

export async function deleteTarifa(id: string) {
  try {
    await prisma.tarifa.delete({
      where: { id },
    })

    revalidatePath("/tarifas")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar tarifa:", error)
    return { success: false, error: "Error al eliminar tarifa" }
  }
}

export async function getTarifaById(id: string) {
  try {
    const tarifa = await prisma.tarifa.findUnique({
      where: { id },
    })
    return tarifa
  } catch (error) {
    console.error("Error al obtener tarifa:", error)
    throw new Error("Error al obtener tarifa")
  }
}
