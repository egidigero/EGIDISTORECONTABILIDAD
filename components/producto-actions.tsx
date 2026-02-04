"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { MoreHorizontal, Edit, Trash2, Calculator } from "lucide-react"
import { deleteProducto, updateProducto } from "@/lib/actions/productos"
import { getProductoById } from "@/lib/actions/productos"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { ProductoForm } from "./producto-form"
import { CalculadoraPrecios } from "./calculadora-precios"
import { DataTable } from "./data-table"
import { getCostosEstimados30Dias } from "@/lib/actions/devoluciones"

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowCalculadora(true)}>
            <Calculator className="w-4 h-4 mr-2" /> Calculadora
          </DropdownMenuItem>
          {movimientos && (
            <DropdownMenuItem onClick={() => setShowMovimientos(true)}>
              📦 Movimientos
            </DropdownMenuItem>
          )}
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
      {showEditModal && (
        <ProductoForm producto={editProducto || producto} onSuccess={() => {
          setShowEditModal(false)
          if (onUpdate) onUpdate()
        }} />
      )}
      {/* Modal de movimientos */}
      <Dialog open={showMovimientos} onOpenChange={setShowMovimientos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Movimientos de stock para {producto.modelo}</DialogTitle>
          </DialogHeader>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <DataTable
              data={movimientos?.filter(m => m.productoId === producto.id) || []}
              columns={[
                { key: "fecha", header: "Fecha", render: (m: any) => new Date(m.fecha).toLocaleString() },
                { key: "tipo", header: "Tipo" },
                { key: "cantidad", header: "Cantidad" },
                { key: "depositoOrigen", header: "Depósito Origen" },
                { key: "depositoDestino", header: "Depósito Destino" },
                { key: "observaciones", header: "Obs." },
              ]}
              searchable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menú</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={async () => {
              const prod = await getProductoById(producto.id)
              setEditProducto(prod)
              setShowEditModal(true)
            }}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowCalculadora(true)}
            onSelect={(e) => e.preventDefault()}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Calculadora
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            <span style={{ color: "#000" }}>Eliminar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal de edición */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.2)" }}
          onClick={async () => {
            setShowEditModal(false);
            if (onUpdate) await onUpdate();
          }}
        >
          <div
            className="bg-white border rounded shadow-lg p-4 max-w-md w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Editar Producto</h2>
            {editProducto && (
              <ProductoForm
                producto={editProducto}
                onSuccess={async () => {
                  setShowEditModal(false);
                  if (onUpdate) await onUpdate();
                }}
              />
            )}
          </div>
        </div>
      )}

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

      {/* Modal de Movimientos */}
      <Dialog open={showMovimientos} onOpenChange={setShowMovimientos}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Movimientos de Stock - {producto.modelo}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Margen Operativo */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="text-lg font-semibold mb-3 text-blue-900">Margen Operativo</div>
              {loadingCostos ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : costosEstimados ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resultado Bruto:</span>
                    <span className="font-mono font-semibold text-green-600">
                      ${((costosEstimados.precioVentaPromedio || 0) - (producto.costoUnitarioARS || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costos Plataforma:</span>
                    <span className="font-mono font-semibold text-red-600">
                      -${((costosEstimados.precioVentaPromedio || 0) * 0.35).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Devoluciones estimadas:</span>
                    <span className="font-mono font-semibold text-red-600">
                      -${(costosEstimados.costoDevolucionesPorVenta || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gastos negocio estimados:</span>
                    <span className="font-mono font-semibold text-red-600">
                      -${(costosEstimados.costoGastosNegocioPorVenta || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-px bg-gray-300 my-2"></div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Margen Operativo:</span>
                    <span className="font-mono font-bold text-blue-600">
                      ${(
                        ((costosEstimados.precioVentaPromedio || 0) - (producto.costoUnitarioARS || 0)) -
                        ((costosEstimados.precioVentaPromedio || 0) * 0.35) -
                        (costosEstimados.costoDevolucionesPorVenta || 0) -
                        (costosEstimados.costoGastosNegocioPorVenta || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sin datos de últimos 30 días</div>
              )}
            </div>

            {/* Margen Final */}
            <div className="border rounded-lg p-4 bg-purple-50">
              <div className="text-lg font-semibold mb-3 text-purple-900">Margen Final</div>
              {loadingCostos ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : costosEstimados ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margen Operativo:</span>
                    <span className="font-mono font-semibold text-blue-600">
                      ${(
                        ((costosEstimados.precioVentaPromedio || 0) - (producto.costoUnitarioARS || 0)) -
                        ((costosEstimados.precioVentaPromedio || 0) * 0.35) -
                        (costosEstimados.costoDevolucionesPorVenta || 0) -
                        (costosEstimados.costoGastosNegocioPorVenta || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Publicidad (ROAS {costosEstimados.roas > 0 ? costosEstimados.roas.toFixed(1) : '5'}):
                    </span>
                    <span className="font-mono font-semibold text-red-600">
                      -${(
                        costosEstimados.roas > 0 
                          ? (costosEstimados.precioVentaPromedio || 0) / costosEstimados.roas 
                          : (costosEstimados.precioVentaPromedio || 0) / 5
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-px bg-gray-300 my-2"></div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Margen Neto:</span>
                    <span className="font-mono font-bold text-purple-600">
                      ${(
                        ((costosEstimados.precioVentaPromedio || 0) - (producto.costoUnitarioARS || 0)) -
                        ((costosEstimados.precioVentaPromedio || 0) * 0.35) -
                        (costosEstimados.costoDevolucionesPorVenta || 0) -
                        (costosEstimados.costoGastosNegocioPorVenta || 0) -
                        (costosEstimados.roas > 0 
                          ? (costosEstimados.precioVentaPromedio || 0) / costosEstimados.roas 
                          : (costosEstimados.precioVentaPromedio || 0) / 5)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sin datos de últimos 30 días</div>
              )}
            </div>

            {/* Datos de referencia */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="text-lg font-semibold mb-3">📊 Datos (30 días)</div>
              {loadingCostos ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : costosEstimados ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio venta prom:</span>
                    <span className="font-mono">${(costosEstimados.precioVentaPromedio || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío promedio:</span>
                    <span className="font-mono">${(costosEstimados.envioPromedio || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total ventas:</span>
                    <span className="font-mono">{costosEstimados.totalVentas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Devoluciones:</span>
                    <span className="font-mono">{costosEstimados.cantidadDevoluciones || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROAS:</span>
                    <span className="font-mono font-semibold">{costosEstimados.roas > 0 ? costosEstimados.roas.toFixed(1) : 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sin datos de últimos 30 días</div>
              )}
            </div>
          </div>

          {/* Tabla de movimientos */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Historial de Movimientos</h3>
            {movimientos && movimientos?.length && movimientos.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-2 text-xs font-semibold border-b pb-2 bg-gray-50 px-2 py-1">
                  <div>Fecha</div>
                  <div>Tipo</div>
                  <div className="text-right">Cantidad</div>
                  <div>Origen</div>
                  <div>Destino</div>
                  <div>Categoría</div>
                  <div>Observaciones</div>
                </div>
                {movimientos?.map((mov: any, idx: number) => {
                  const esEntrada = mov.tipo === 'entrada'
                  const esSalida = mov.tipo === 'salida'
                  
                  // Determinar icono y color según origen
                  let origenLabel = mov.origen_tipo || '-'
                  let origenColor = 'bg-gray-100 text-gray-700'
                  let origenIcon = ''
                  
                  if (mov.origen_tipo === 'venta') {
                    origenLabel = '🛒 Venta'
                    origenColor = 'bg-red-100 text-red-700'
                  } else if (mov.origen_tipo === 'devolucion' || mov.origen_tipo === 'reincorporacion') {
                    origenLabel = '↩️ Devolución'
                    origenColor = 'bg-green-100 text-green-700'
                  } else if (mov.origen_tipo === 'ingreso_manual') {
                    origenLabel = '➕ Ingreso manual'
                    origenColor = 'bg-blue-100 text-blue-700'
                  } else if (mov.origen_tipo === 'ajuste') {
                    origenLabel = '⚙️ Ajuste'
                    origenColor = 'bg-yellow-100 text-yellow-700'
                  }
                  
                  return (
                    <div key={idx} className="grid grid-cols-7 gap-2 text-xs border-b pb-2 px-2 py-1 hover:bg-gray-50">
                      <div className="text-muted-foreground">
                        {new Date(mov.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        <div className="text-[10px] text-gray-400">
                          {new Date(mov.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          esEntrada ? 'bg-green-100 text-green-700' :
                          esSalida ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {esEntrada ? '⬆️ Entrada' : esSalida ? '⬇️ Salida' : 'Ajuste'}
                        </span>
                      </div>
                      <div className={`font-mono text-right font-semibold ${esEntrada ? 'text-green-600' : esSalida ? 'text-red-600' : ''}`}>
                        {esEntrada ? '+' : esSalida ? '-' : ''}{mov.cantidad}
                      </div>
                      <div className="text-muted-foreground text-xs">{mov.deposito_origen}</div>
                      <div className="text-muted-foreground text-xs">{mov.deposito_destino || '-'}</div>
                      <div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${origenColor}`}>
                          {origenLabel}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs truncate" title={mov.observaciones}>
                        {mov.observaciones || '-'}
                      </div>
                    </div>
                  )
                })}
                
                {/* Resumen */}
                <div className="mt-4 pt-4 border-t bg-gray-50 p-3 rounded">
                  <div className="text-sm font-semibold mb-2">📊 Resumen</div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-muted-foreground">Total entradas</div>
                      <div className="font-mono font-semibold text-green-600">
                        +{movimientos?.filter((m: any) => m.tipo === 'entrada').reduce((sum: number, m: any) => sum + m.cantidad, 0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total salidas</div>
                      <div className="font-mono font-semibold text-red-600">
                        -{movimientos?.filter((m: any) => m.tipo === 'salida').reduce((sum: number, m: any) => sum + m.cantidad, 0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Movimientos totales</div>
                      <div className="font-mono font-semibold">{movimientos?.length || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">📦</div>
                <div className="font-medium">No hay movimientos registrados</div>
                <div className="text-xs mt-1">Los movimientos de ventas, devoluciones e ingresos aparecerán aquí</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
