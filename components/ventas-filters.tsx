"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, X } from "lucide-react"
import { getProductos } from "@/lib/actions/productos"

const plataformaOptions = [
  { value: "TN", label: "Tienda Nube" },
  { value: "ML", label: "Mercado Libre" },
  { value: "Directo", label: "Venta Directa" },
]

const metodoPagoOptions = [
  { value: "PagoNube", label: "Pago Nube" },
  { value: "MercadoPago", label: "Mercado Pago" },
  { value: "Transferencia", label: "Transferencia" },
  { value: "Efectivo", label: "Efectivo" },
]

const estadoEnvioOptions = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "EnCamino", label: "En Camino" },
  { value: "Entregado", label: "Entregado" },
  { value: "Devuelto", label: "Devuelto" },
  { value: "Cancelado", label: "Cancelado" },
]

export function VentasFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [productos, setProductos] = useState<any[]>([])

  const [filters, setFilters] = useState({
    fechaDesde: searchParams.get("fechaDesde") || "",
    fechaHasta: searchParams.get("fechaHasta") || "",
    plataforma: searchParams.get("plataforma") || "all",
    metodoPago: searchParams.get("metodoPago") || "all",
    estadoEnvio: searchParams.get("estadoEnvio") || "all",
    productoId: searchParams.get("productoId") || "all",
    comprador: searchParams.get("comprador") || "",
    externalOrderId: searchParams.get("externalOrderId") || "",
  })

  useEffect(() => {
    async function cargarProductos() {
      try {
        const data = await getProductos()
        setProductos(data || [])
      } catch (error) {
        console.error('Error cargando productos:', error)
      }
    }
    cargarProductos()
  }, [])

  const applyFilters = () => {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value)
      }
    })

    router.push(`/ventas?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilters({
      fechaDesde: "",
      fechaHasta: "",
      plataforma: "all",
      metodoPago: "all",
      estadoEnvio: "all",
      productoId: "all",
      comprador: "",
      externalOrderId: "",
    })
    router.push("/ventas")
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== "" && value !== "all")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaDesde">Fecha Desde</Label>
                <Input
                  id="fechaDesde"
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaHasta">Fecha Hasta</Label>
                <Input
                  id="fechaHasta"
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select
                  value={filters.plataforma}
                  onValueChange={(value) => setFilters({ ...filters, plataforma: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las plataformas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las plataformas</SelectItem>
                    {plataformaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={filters.metodoPago}
                  onValueChange={(value) => setFilters({ ...filters, metodoPago: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los métodos</SelectItem>
                    {metodoPagoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado de Envío</Label>
                <Select
                  value={filters.estadoEnvio}
                  onValueChange={(value) => setFilters({ ...filters, estadoEnvio: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {estadoEnvioOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Producto</Label>
                <Select
                  value={filters.productoId}
                  onValueChange={(value) => setFilters({ ...filters, productoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los productos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {productos.map((producto) => (
                      <SelectItem key={producto.id} value={producto.id.toString()}>
                        {producto.nombre} - SKU: {producto.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comprador">Comprador</Label>
                <Input
                  id="comprador"
                  placeholder="Buscar por nombre..."
                  value={filters.comprador}
                  onChange={(e) => setFilters({ ...filters, comprador: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalOrderId">ID de Orden / Código</Label>
                <Input
                  id="externalOrderId"
                  placeholder="ID externo o código de venta..."
                  value={filters.externalOrderId}
                  onChange={(e) => setFilters({ ...filters, externalOrderId: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFilters}>
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
