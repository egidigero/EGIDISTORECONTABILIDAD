"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { productoSchema, type ProductoFormData } from "@/lib/validations"

export async function getProductos() {
  try {
    const productos = await prisma.producto.findMany({
      orderBy: { createdAt: "desc" },
    })
    return productos
  } catch (error) {
    console.error("Error al obtener productos:", error)
    throw new Error("Error al obtener productos")
  }
}

export async function createProducto(data: ProductoFormData) {
  try {
    const validatedData = productoSchema.parse(data)

    const producto = await prisma.producto.create({
      data: validatedData,
    })

    revalidatePath("/productos")
    return { success: true, data: producto }
  } catch (error) {
    console.error("Error al crear producto:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al crear producto" }
  }
}

export async function updateProducto(id: string, data: ProductoFormData) {
  try {
    const validatedData = productoSchema.parse(data)

    const producto = await prisma.producto.update({
      where: { id },
      data: validatedData,
    })

    revalidatePath("/productos")
    return { success: true, data: producto }
  } catch (error) {
    console.error("Error al actualizar producto:", error)
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Error al actualizar producto" }
  }
}

export async function deleteProducto(id: string) {
  try {
    await prisma.producto.delete({
      where: { id },
    })

    revalidatePath("/productos")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    return { success: false, error: "Error al eliminar producto" }
  }
}

export async function getProductoById(id: string) {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id },
    })
    return producto
  } catch (error) {
    console.error("Error al obtener producto:", error)
    throw new Error("Error al obtener producto")
  }
}
