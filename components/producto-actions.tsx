"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoreHorizontal, Edit, Trash2, Calculator, Plus } from "lucide-react"
import { deleteProducto, updateProducto } from "@/lib/actions/productos"
import { getProductoById } from "@/lib/actions/productos"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { ProductoForm } from "./producto-form"
import { CalculadoraPrecios } from "./calculadora-precios"
import { DataTable } from "./data-table"
import { getCostosEstimados30Dias } from "@/lib/actions/devoluciones"
import { supabase } from "@/lib/supabase"

interface ProductoActionsProps {
  producto: {
    id: string
    modelo: string
    costoUnitarioARS?: number
    precio_venta?: number
    sku?: string
  }
  onUpdate?: () => void
  movimientos?: any[]
  ventasPorProducto?: any[]
}

export function ProductoActions({ producto, onUpdate, movimientos, ventasPorProducto }: ProductoActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [editProducto, setEditProducto] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMovimientos, setShowMovimientos] = useState(false)
  const [costosEstimados, setCostosEstimados] = useState<any>(null)
  const [loadingCostos, setLoadingCostos] = useState(false)
  const [showAgregarMovimiento, setShowAgregarMovimiento] = useState(false)
  const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida'>('entrada')
  const [cantidadMovimiento, setCantidadMovimiento] = useState(0)
  const [depositoMovimiento, setDepositoMovimiento] = useState('PROPIO')
  const [observacionesMovimiento, setObservacionesMovimiento] = useState('')
  const [isSubmittingMovimiento, setIsSubmittingMovimiento] = useState(false)
  const router = useRouter()

  // Handler para cuando se calcula un nuevo precio en la calculadora
  const handlePrecioCalculado = async (nuevoPrecio: number) => {
    try {
      await updateProducto(producto.id, { precio_venta: nuevoPrecio })
      toast({
        title: "Precio actualizado",
        description: `El precio de venta se actualizó a $${nuevoPrecio.toFixed(2)}`
      })
      if (onUpdate) onUpdate()
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el precio",
        variant: "destructive"
      })
    }
  }

  // Cargar costos estimados cuando se abre el modal de movimientos
  useEffect(() => {
    if (showMovimientos && !costosEstimados) {
      cargarCostosEstimados()
    }
  }, [showMovimientos])

  const cargarCostosEstimados = async () => {
    setLoadingCostos(true)
    try {
      const datos = await getCostosEstimados30Dias(Number(producto.id), undefined, producto.sku)
      console.log("📊 Costos estimados recibidos para producto", producto.modelo, ":", datos)
      setCostosEstimados(datos)
    } catch (error) {
      console.error("Error cargando costos estimados:", error)
    } finally {
      setLoadingCostos(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteProducto(producto.id)
      if (result.success) {
        toast({
          title: "Producto eliminado",
          description: "El producto ha sido eliminado correctamente.",
        })
        setShowDeleteDialog(false)
        if (onUpdate) await onUpdate();
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al eliminar el producto.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al eliminar producto:", error)
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el producto.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleGuardarMovimiento = async () => {
    if (cantidadMovimiento <= 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser mayor a 0",
        variant: "destructive"
      })
      return
    }

    const stockActual = Number(producto.stockTotal || producto.stockPropio || 0)
    if (tipoMovimiento === 'salida' && cantidadMovimiento > stockActual) {
      toast({
        title: "Error",
        description: `No puedes sacar más stock del disponible (${stockActual} unidades)`,
        variant: "destructive"
      })
      return
    }

    setIsSubmittingMovimiento(true)
    try {
      const { error } = await supabase.from('movimientos_stock').insert({
        producto_id: producto.id,
        tipo: tipoMovimiento,
        cantidad: cantidadMovimiento,
        deposito_origen: 'PROPIO',
        fecha: new Date().toISOString(),
        observaciones: observacionesMovimiento || `${tipoMovimiento === 'entrada' ? 'Entrada' : 'Salida'} manual de stock`,
        origen_tipo: 'ajuste',
      })

      if (error) {
        console.error("Error de Supabase:", error)
        throw error
      }

      toast({
        title: "Movimiento registrado",
        description: `Se ${tipoMovimiento === 'entrada' ? 'agregaron' : 'quitaron'} ${cantidadMovimiento} unidades`,
      })

      // Resetear formulario
      setCantidadMovimiento(0)
      setObservacionesMovimiento('')
      setShowAgregarMovimiento(false)

      // Actualizar datos
      if (onUpdate) await onUpdate()
      router.refresh()
    } catch (error) {
      console.error("Error al guardar movimiento:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el movimiento",
        variant: "destructive"
      })
    } finally {
      setIsSubmittingMovimiento(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={async () => {
            const prod = await getProductoById(producto.id)
            setEditProducto(prod)
            setShowEditModal(true)
          }}>
            <Edit className="w-4 h-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowCalculadora(true)}>
            <Calculator className="w-4 h-4 mr-2" /> Calculadora
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMovimientos(true)}>
            📦 Movimientos {movimientos && movimientos.length > 0 ? `(${movimientos.length})` : ''}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Seguro que querés eliminar este producto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de movimientos */}
      <Dialog open={showMovimientos} onOpenChange={setShowMovimientos}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center justify-between">
              <span>Movimientos de Stock - {producto.modelo}</span>
              <Button size="sm" onClick={() => setShowAgregarMovimiento(!showAgregarMovimiento)}>
                <Plus className="w-4 h-4 mr-2" />
                {showAgregarMovimiento ? 'Cancelar' : 'Agregar Movimiento'}
              </Button>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Stock actual: {producto.stockTotal || producto.stockPropio || 0} unidades</p>
          </DialogHeader>

          {/* Formulario para agregar movimiento */}
          {showAgregarMovimiento && (
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
              <h3 className="font-semibold">Nuevo Movimiento Manual</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Movimiento</Label>
                  <Select value={tipoMovimiento} onValueChange={(value: 'entrada' | 'salida') => setTipoMovimiento(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">➕ Entrada (Agregar stock)</SelectItem>
                      <SelectItem value="salida">➖ Salida (Quitar stock)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cantidadMovimiento}
                    onChange={(e) => setCantidadMovimiento(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Depósito</Label>
                  <Input
                    type="text"
                    value="PROPIO"
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-muted-foreground">Solo depósito PROPIO</p>
                </div>

                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Input
                    type="text"
                    value={observacionesMovimiento}
                    onChange={(e) => setObservacionesMovimiento(e.target.value)}
                    placeholder="Ej: Ajuste por inventario físico"
                  />
                </div>
              </div>

              {cantidadMovimiento > 0 && (
                <div className={`p-3 rounded border ${tipoMovimiento === 'entrada' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="text-sm font-medium">
                    Nuevo stock: {tipoMovimiento === 'entrada' 
                      ? (Number(producto.stockTotal || producto.stockPropio || 0) + cantidadMovimiento)
                      : (Number(producto.stockTotal || producto.stockPropio || 0) - cantidadMovimiento)} unidades
                    {tipoMovimiento === 'salida' && cantidadMovimiento > Number(producto.stockTotal || producto.stockPropio || 0) && (
                      <span className="text-red-600 block mt-1">⚠️ Stock insuficiente</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleGuardarMovimiento} disabled={isSubmittingMovimiento || cantidadMovimiento <= 0}>
                  {isSubmittingMovimiento ? 'Guardando...' : 'Guardar Movimiento'}
                </Button>
                <Button variant="outline" onClick={() => setShowAgregarMovimiento(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 120px)" }}>
            {(() => {
              const movimientosProducto = movimientos?.filter(m => String(m.producto_id) === String(producto.id)) || []
              
              if (movimientosProducto.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-medium">No hay movimientos registrados</p>
                    <p className="text-sm mt-2">Los movimientos aparecerán cuando se registren ventas o devoluciones</p>
                  </div>
                )
              }

              // Calcular stock acumulado de atrás hacia adelante
              const movimientosConStock = [...movimientosProducto]
                .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                .reduce((acc: any[], mov: any, index: number) => {
                  const stockAnterior = index === 0 ? 0 : acc[index - 1].stockParcial
                  const cambio = mov.tipo === 'entrada' ? mov.cantidad : -mov.cantidad
                  const stockParcial = stockAnterior + cambio
                  acc.push({ ...mov, stockParcial, cambio })
                  return acc
                }, [])
                .reverse() // Mostrar más recientes primero

              return (
                <div className="space-y-3">
                  {movimientosConStock.map((mov: any, idx: number) => {
                    const isEntrada = mov.tipo === 'entrada'
                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          isEntrada 
                            ? 'bg-green-50 border-green-500' 
                            : 'bg-red-50 border-red-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isEntrada 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {isEntrada ? '↑ Entrada' : '↓ Salida'}
                              </span>
                              <span className="text-sm text-gray-600">
                                {new Date(mov.fecha).toLocaleDateString('es-AR', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              {mov.deposito_origen && (
                                <div>
                                  <span className="text-gray-500">Origen:</span>
                                  <span className="ml-2 font-medium">{mov.deposito_origen}</span>
                                </div>
                              )}
                              {mov.deposito_destino && (
                                <div>
                                  <span className="text-gray-500">Destino:</span>
                                  <span className="ml-2 font-medium">{mov.deposito_destino}</span>
                                </div>
                              )}
                              {mov.observaciones && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">Obs:</span>
                                  <span className="ml-2">{mov.observaciones}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 ml-4">
                            <div className={`text-2xl font-bold ${
                              isEntrada ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isEntrada ? '+' : '-'}{mov.cantidad}
                            </div>
                            <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                              Stock: {mov.stockParcial}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de edición */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editProducto && (
            <ProductoForm
              producto={editProducto}
              onSuccess={async () => {
                setShowEditModal(false)
                if (onUpdate) await onUpdate()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Calculadora de precios */}
      <CalculadoraPrecios
        costoProducto={producto.costoUnitarioARS || 0}
        precioVentaInicial={producto.precio_venta || 0}
        open={showCalculadora}
        onOpenChange={setShowCalculadora}
        onPrecioCalculado={handlePrecioCalculado}
        trigger={<div style={{ display: 'none' }} />}
        productoId={Number(producto.id)}
        productoSku={producto.sku}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el producto{" "}
              <strong>{producto.modelo}</strong> y removerá sus datos de nuestros servidores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
