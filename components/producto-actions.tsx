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
