"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { ProductosTableClient } from "@/components/productos-table-client"
import { NuevoProductoModal } from "@/components/nuevo-producto-modal"
import { StockResumen } from "@/components/stock-resumen"
import { consultarStock, consultarMovimientos } from "@/lib/stock-api"
import { AnalisisVentas30Dias } from "@/components/analisis-ventas-30dias"
import RotacionStock from "@/components/rotacion-stock"

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

  const [stock, setStock] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const s = await consultarStock()
        setStock(s || [])
        const m = await consultarMovimientos()
        setMovimientos(m || [])
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })()
  }, [])

  // Calcular patrimonio total en stock (usando stock total: propio + full)
  const patrimonioStock = initialProductos.reduce((total, p) => {
    const stockTotal = Number(p.stockPropio || 0) + Number(p.stockFull || 0)
    return total + (p.costoUnitarioARS * stockTotal)
  }, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Productos</CardTitle>
            <CardDescription>Listado de productos en el sistema.</CardDescription>
            <div className="flex gap-2 mt-2">
              <Button asChild variant="outline" size="sm">
                <a href="/">← Volver al menú principal</a>
              </Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo producto
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <StockResumen productos={initialProductos} />
          </div>
          <ProductosTableClient productos={initialProductos} onUpdate={router.refresh} movimientos={movimientos} ventasPorProducto />
        </CardContent>
      </Card>
      <RotacionStock productos={initialProductos} />
      <AnalisisVentas30Dias productos={initialProductos} />
      <NuevoProductoModal open={showModal} onClose={handleCloseModal} />
    </div>
  )
}