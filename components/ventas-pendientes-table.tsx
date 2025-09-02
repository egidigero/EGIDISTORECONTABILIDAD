"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/data-table"
import { EstadoEnvioBadge } from "@/components/estado-envio-badge"
import { toast } from "@/hooks/use-toast"
import { getVentasPendientes, updateEstadoEnvio } from "@/lib/actions/ventas"
import { Package, Truck } from "lucide-react"

const estadoEnvioOptions = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "EnCamino", label: "En Camino" },
  { value: "Entregado", label: "Entregado" },
  { value: "Devuelto", label: "Devuelto" },
  { value: "Cancelado", label: "Cancelado" },
]

export function VentasPendientesTable() {
  const [ventas, setVentas] = useState<any[]>([])
  const [selectedVentas, setSelectedVentas] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Estados para actualización masiva
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [courier, setCourier] = useState("")

  useEffect(() => {
    loadVentas()
  }, [])

  const loadVentas = async () => {
    try {
      const ventasData = await getVentasPendientes()
      setVentas(ventasData)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las ventas pendientes.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVenta = (ventaId: string, checked: boolean) => {
    if (checked) {
      setSelectedVentas([...selectedVentas, ventaId])
    } else {
      setSelectedVentas(selectedVentas.filter((id) => id !== ventaId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVentas(ventas.map((v) => v.id))
    } else {
      setSelectedVentas([])
    }
  }

  const handleUpdateEstados = async () => {
    if (selectedVentas.length === 0 || !nuevoEstado) {
      toast({
        title: "Error",
        description: "Selecciona al menos una venta y un estado.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      const result = await updateEstadoEnvio(
        selectedVentas,
        nuevoEstado as any,
        trackingUrl || undefined,
        courier || undefined,
      )

      if (result.success) {
        toast({
          title: "Estados actualizados",
          description: `Se actualizaron ${selectedVentas.length} ventas correctamente.`,
        })
        setSelectedVentas([])
        setNuevoEstado("")
        setTrackingUrl("")
        setCourier("")
        await loadVentas()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron actualizar los estados.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const columns = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={selectedVentas.length === ventas.length && ventas.length > 0}
          onCheckedChange={handleSelectAll}
        />
      ),
      render: (venta: any) => (
        <Checkbox
          checked={selectedVentas.includes(venta.id)}
          onCheckedChange={(checked) => handleSelectVenta(venta.id, checked as boolean)}
        />
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: any) => new Date(venta.fecha).toLocaleDateString(),
    },
    {
      key: "saleCode",
      header: "Código",
      render: (venta: any) => <code className="text-xs bg-muted px-2 py-1 rounded">{venta.saleCode}</code>,
    },
    {
      key: "comprador",
      header: "Comprador",
    },
    {
      key: "producto",
      header: "Producto",
      render: (venta: any) => venta.producto.modelo,
    },
    {
      key: "estadoEnvio",
      header: "Estado",
      render: (venta: any) => <EstadoEnvioBadge estado={venta.estadoEnvio} />,
    },
    {
      key: "courier",
      header: "Courier",
      render: (venta: any) => venta.courier || "-",
    },
    {
      key: "trackingUrl",
      header: "Tracking",
      render: (venta: any) =>
        venta.trackingUrl ? (
          <Button variant="ghost" size="sm" onClick={() => window.open(venta.trackingUrl, "_blank")}>
            Ver
          </Button>
        ) : (
          "-"
        ),
    },
  ]

  if (isLoading) {
    return <div>Cargando ventas pendientes...</div>
  }

  return (
    <div className="space-y-6">
      {selectedVentas.length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-4">Actualización Masiva ({selectedVentas.length} ventas seleccionadas)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Nuevo Estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {estadoEnvioOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trackingUrl">URL de Tracking (opcional)</Label>
              <Input
                id="trackingUrl"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="courier">Courier (opcional)</Label>
              <Input
                id="courier"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="Correo Argentino, OCA..."
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleUpdateEstados} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Package className="h-4 w-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4 mr-2" />
                    Actualizar Estados
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DataTable data={ventas} columns={columns} searchable searchPlaceholder="Buscar por comprador o código..." />

      {ventas.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay ventas pendientes</h3>
          <p className="text-muted-foreground">Todas las ventas están entregadas o no hay ventas registradas.</p>
        </div>
      )}
    </div>
  )
}
