"use client"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { ProductosTableClient } from "@/components/productos-table-client"
import { NuevoProductoModal } from "@/components/nuevo-producto-modal"

interface ProductosPageClientProps {
  initialProductos: any[]
}

export function ProductosPageClient({ initialProductos }: ProductosPageClientProps) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const handleCloseModal = () => {
    setShowModal(false)
    router.refresh() // Revalidar página para actualizar datos
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Productos</CardTitle>
            <CardDescription>Listado de productos en el sistema.</CardDescription>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <a href="/">← Volver al menú principal</a>
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo producto
          </Button>
        </CardHeader>
        <CardContent>
          <ProductosTableClient productos={initialProductos} onUpdate={() => router.refresh()} />
        </CardContent>
      </Card>
  <NuevoProductoModal open={showModal} onClose={handleCloseModal} />
    </div>
  )
}