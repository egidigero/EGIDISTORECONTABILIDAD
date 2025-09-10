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
import { MoreHorizontal, Edit, Trash2, Calculator } from "lucide-react"
import { deleteProducto, updateProducto } from "@/lib/actions/productos"
import { getProductoById } from "@/lib/actions/productos"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { ProductoForm } from "./producto-form"
import { CalculadoraPrecios } from "./calculadora-precios"

interface ProductoActionsProps {
  producto: {
    id: string
    modelo: string
    costoUnitarioARS?: number
    precio_venta?: number
  }
  onUpdate?: () => void
}

export function ProductoActions({ producto }: ProductoActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [editProducto, setEditProducto] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const onUpdate = arguments[0].onUpdate

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

  const handlePrecioCalculado = async (nuevoPrecio: number) => {
    try {
      // Obtener los datos completos del producto
      const productoCompleto = await getProductoById(producto.id)
      if (!productoCompleto) {
        toast({
          title: "Error",
          description: "No se pudo obtener la información del producto",
          variant: "destructive"
        })
        return
      }

      const result = await updateProducto(producto.id, {
        ...productoCompleto,
        precio_venta: nuevoPrecio
      })
      
      if (result.success) {
        toast({
          title: "Precio actualizado",
          description: `El precio de venta se actualizó a $${nuevoPrecio.toFixed(2)}`,
        })
        onUpdate?.()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el precio",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error al actualizar precio:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el precio de venta",
        variant: "destructive"
      })
    }
  }

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
