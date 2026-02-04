"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface StockDevolucionItem {
  id: string
  id_devolucion: string
  numero_seguimiento: string
  fecha_recepcion: string | null
  fecha_prueba: string | null
  resultado_prueba: string
  stock_reincorporado: boolean
  ubicacion_producto: string | null
  observaciones_prueba: string | null
  sale_code: string
  comprador: string
  producto_modelo: string
  producto_sku: string
  producto_id: string
  estado_stock: string
}

export function StockDevolucionesControl() {
  const [stockDevoluciones, setStockDevoluciones] = useState<StockDevolucionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showReincorporar, setShowReincorporar] = useState(false)
  const [selectedDevolucion, setSelectedDevolucion] = useState<StockDevolucionItem | null>(null)
  const [deposito, setDeposito] = useState<'Propio' | 'Full'>('Propio')
  const [isProcessing, setIsProcessing] = useState(false)

  const cargarStock = async () => {
    try {
      const { data, error } = await supabase
        .from('devoluciones_stock_control')
        .select('*')
        .order('fecha_recepcion', { ascending: false, nullsFirst: false })

      if (error) throw error
      setStockDevoluciones(data || [])
    } catch (error) {
      console.error("Error al cargar stock de devoluciones:", error)
      toast({ title: "Error", description: "No se pudo cargar el stock de devoluciones", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarStock()
  }, [])

  const handleReincorporar = async () => {
    if (!selectedDevolucion) return
    setIsProcessing(true)

    try {
      // Llamar a la función de PostgreSQL para reincorporar stock
      const { data, error } = await supabase.rpc('reincorporar_stock_devolucion', {
        p_devolucion_id: selectedDevolucion.id,
        p_deposito: deposito
      })

      if (error) throw error

      toast({ 
        title: "Stock reincorporado", 
        description: `Se agregó 1 unidad al stock ${deposito.toLowerCase()}` 
      })
      
      setShowReincorporar(false)
      setSelectedDevolucion(null)
      cargarStock() // Recargar datos
    } catch (error: any) {
      console.error("Error al reincorporar stock:", error)
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo reincorporar el stock", 
        variant: "destructive" 
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badgeMap: Record<string, { variant: any, label: string }> = {
      'No Recibido': { variant: 'secondary', label: '📦 No Recibido' },
      'A Probar': { variant: 'default', label: '🔍 A Probar' },
      'Probado - Pendiente Reincorporar': { variant: 'default', label: '✅ Listo para Reincorporar' },
      'Reincorporado a Stock': { variant: 'outline', label: '♻️ Reincorporado' },
      'Stock Roto': { variant: 'destructive', label: '❌ Stock Roto' },
    }

    const config = badgeMap[estado] || { variant: 'secondary', label: estado }
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  const agruparPorEstado = () => {
    const grupos: Record<string, StockDevolucionItem[]> = {
      'A Probar': [],
      'Probado - Pendiente Reincorporar': [],
      'Stock Roto': [],
      'No Recibido': [],
      'Reincorporado a Stock': [],
    }

    stockDevoluciones.forEach(item => {
      if (grupos[item.estado_stock]) {
        grupos[item.estado_stock].push(item)
      }
    })

    return grupos
  }

  if (loading) {
    return <div className="p-4">Cargando stock de devoluciones...</div>
  }

  const grupos = agruparPorEstado()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📦 Control de Stock - Devoluciones</CardTitle>
          <CardDescription>
            Gestión de productos devueltos: prueba y reincorporación a stock
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* A Probar */}
            {grupos['A Probar'].length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-orange-600">🔍 A Probar</span>
                  <Badge variant="secondary">{grupos['A Probar'].length}</Badge>
                </h3>
                <div className="space-y-2">
                  {grupos['A Probar'].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{item.producto_modelo} ({item.producto_sku})</p>
                        <p className="text-sm text-muted-foreground">
                          Venta: {item.sale_code} • {item.comprador}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.ubicacion_producto && `Ubicación: ${item.ubicacion_producto}`}
                        </p>
                      </div>
                      {getEstadoBadge(item.estado_stock)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Recibido */}
            {grupos['No Recibido'].length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-gray-600">📦 No Recibido</span>
                  <Badge variant="secondary">{grupos['No Recibido'].length}</Badge>
                </h3>
                <div className="space-y-2">
                  {grupos['No Recibido'].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{item.producto_modelo} ({item.producto_sku})</p>
                        <p className="text-sm text-muted-foreground">
                          Venta: {item.sale_code} • {item.comprador}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Seguimiento: {item.numero_seguimiento || 'Sin número'}
                        </p>
                      </div>
                      {getEstadoBadge(item.estado_stock)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Probado - Listo para Reincorporar */}
            {grupos['Probado - Pendiente Reincorporar'].length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-green-600">✅ Listos para Reincorporar</span>
                  <Badge variant="secondary">{grupos['Probado - Pendiente Reincorporar'].length}</Badge>
                </h3>
                <div className="space-y-2">
                  {grupos['Probado - Pendiente Reincorporar'].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{item.producto_modelo} ({item.producto_sku})</p>
                        <p className="text-sm text-muted-foreground">
                          Venta: {item.sale_code} • {item.comprador}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Probado: {item.fecha_prueba ? new Date(item.fecha_prueba).toLocaleDateString() : 'N/A'}
                          {item.observaciones_prueba && ` • ${item.observaciones_prueba}`}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedDevolucion(item)
                          setShowReincorporar(true)
                        }}
                      >
                        Reincorporar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Roto */}
            {grupos['Stock Roto'].length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-red-600">❌ Stock Roto / No Recuperable</span>
                  <Badge variant="secondary">{grupos['Stock Roto'].length}</Badge>
                </h3>
                <div className="space-y-2">
                  {grupos['Stock Roto'].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{item.producto_modelo} ({item.producto_sku})</p>
                        <p className="text-sm text-muted-foreground">
                          Venta: {item.sale_code} • {item.comprador}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.ubicacion_producto && `Ubicación: ${item.ubicacion_producto}`}
                          {item.observaciones_prueba && ` • ${item.observaciones_prueba}`}
                        </p>
                      </div>
                      {getEstadoBadge(item.estado_stock)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reincorporados */}
            {grupos['Reincorporado a Stock'].length > 0 && (
              <details className="border rounded-lg p-4">
                <summary className="font-semibold cursor-pointer flex items-center gap-2">
                  <span className="text-blue-600">♻️ Reincorporados a Stock</span>
                  <Badge variant="secondary">{grupos['Reincorporado a Stock'].length}</Badge>
                </summary>
                <div className="space-y-2 mt-3">
                  {grupos['Reincorporado a Stock'].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{item.producto_modelo} ({item.producto_sku})</p>
                        <p className="text-sm text-muted-foreground">
                          Venta: {item.sale_code}
                        </p>
                      </div>
                      {getEstadoBadge(item.estado_stock)}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {stockDevoluciones.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay productos devueltos para controlar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal de Reincorporación */}
      <AlertDialog open={showReincorporar} onOpenChange={setShowReincorporar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>♻️ Reincorporar Stock</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a agregar este producto devuelto de vuelta al stock disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedDevolucion && (
            <div className="py-4">
              <div className="mb-4">
                <p className="font-medium">{selectedDevolucion.producto_modelo}</p>
                <p className="text-sm text-muted-foreground">SKU: {selectedDevolucion.producto_sku}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Selecciona el depósito</label>
                <select 
                  className="w-full border rounded p-2" 
                  value={deposito} 
                  onChange={(e) => setDeposito(e.target.value as 'Propio' | 'Full')}
                >
                  <option value="Propio">Stock Propio</option>
                  <option value="Full">Stock Full</option>
                </select>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowReincorporar(false)
              setSelectedDevolucion(null)
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReincorporar} disabled={isProcessing}>
              {isProcessing ? 'Procesando...' : 'Confirmar Reincorporación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
