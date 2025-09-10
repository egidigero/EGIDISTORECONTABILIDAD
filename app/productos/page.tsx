
import { Suspense } from "react"
import { getProductos } from "@/lib/actions/productos"
import { ProductosPageClient } from "./productos-client"

export default async function ProductosPage() {
  // Cargar productos en el servidor
  const productos = await getProductos()

  return (
    <Suspense fallback={<div>Cargando productos...</div>}>
      <ProductosPageClient initialProductos={productos} />
    </Suspense>
  )
}
