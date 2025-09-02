"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { createProducto, updateProducto } from "@/lib/actions/productos"
import { productoSchema, type ProductoFormData } from "@/lib/validations"

interface ProductoFormProps {
  producto?: {
    id: string
    modelo: string
    sku: string
    costoUnitarioARS: number
    activo: boolean
  }
}

export function ProductoForm({ producto }: ProductoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const isEditing = !!producto

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: producto
      ? {
          modelo: producto.modelo,
          sku: producto.sku,
          costoUnitarioARS: Number(producto.costoUnitarioARS),
          activo: producto.activo,
        }
      : {
          activo: true,
        },
  })

  const activo = watch("activo")

  const onSubmit = async (data: ProductoFormData) => {
    setIsSubmitting(true)
    try {
      const result = isEditing ? await updateProducto(producto.id, data) : await createProducto(data)

      if (result.success) {
        toast({
          title: isEditing ? "Producto actualizado" : "Producto creado",
          description: `El producto ${data.modelo} ha sido ${isEditing ? "actualizado" : "creado"} correctamente.`,
        })
        router.push("/productos")
      } else {
        toast({
          title: "Error",
          description: result.error || "Ocurrió un error inesperado.",
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
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Producto" : "Nuevo Producto"}</CardTitle>
        <CardDescription>
          {isEditing ? "Modifica los datos del producto" : "Completa los datos del nuevo producto"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...register("modelo")} placeholder="SW-ROSE-GOLD-42" />
              {errors.modelo && <p className="text-sm text-destructive">{errors.modelo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register("sku")} placeholder="SWRG42001" />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="costoUnitarioARS">Costo Unitario (ARS)</Label>
            <Input
              id="costoUnitarioARS"
              type="number"
              step="0.01"
              {...register("costoUnitarioARS", { valueAsNumber: true })}
              placeholder="15000.00"
            />
            {errors.costoUnitarioARS && <p className="text-sm text-destructive">{errors.costoUnitarioARS.message}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="activo" checked={activo} onCheckedChange={(checked) => setValue("activo", checked)} />
            <Label htmlFor="activo">Producto activo</Label>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Actualizando..."
                  : "Creando..."
                : isEditing
                  ? "Actualizar Producto"
                  : "Crear Producto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/productos")}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
