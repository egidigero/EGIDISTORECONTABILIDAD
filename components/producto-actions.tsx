"use client"

import { useState } from "react"
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

interface ProductoActionsProps {
  producto: {
    id: string
    modelo: string
    costoUnitarioARS?: number
    precio_venta?: number
  }
  onUpdate?: () => void
}

export function ProductoActions({ producto, onUpdate, movimientos, ventasPorProducto }: ProductoActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [editProducto, setEditProducto] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMovimientos, setShowMovimientos] = useState(false)
  const router = useRouter()

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
        productoId={producto.id}
        productoSku={producto.sku}
      />

      {/* Modal de Movimientos */}
      <Dialog open={showMovimientos} onOpenChange={setShowMovimientos}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Movimientos de Stock - {producto.modelo}</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            Debug: Movimientos recibidos: {movimientos ? movimientos.length : 'undefined'} | Tipo: {typeof movimientos}
          </div>
          {movimientos && movimientos.length > 0 ? (
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
              {movimientos.map((mov: any, idx: number) => {
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
                      +{movimientos.filter((m: any) => m.tipo === 'entrada').reduce((sum: number, m: any) => sum + m.cantidad, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total salidas</div>
                    <div className="font-mono font-semibold text-red-600">
                      -{movimientos.filter((m: any) => m.tipo === 'salida').reduce((sum: number, m: any) => sum + m.cantidad, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Movimientos totales</div>
                    <div className="font-mono font-semibold">{movimientos.length}</div>
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
